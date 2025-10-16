import express from 'express';
import { getPool } from '../database/connection';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import { processEnhancedSale, PaymentSplit } from '../services/enhancedSalesService';

const router = express.Router();

// Process an enhanced sale with multi-payment support
router.post('/enhanced', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    customerAccountId,
    items,
    paymentSplits,
    taxRate = 0,
    discountAmount = 0,
    shiftId
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError('Sale items are required', 400);
  }

  if (!paymentSplits || !Array.isArray(paymentSplits) || paymentSplits.length === 0) {
    throw createError('At least one payment method is required', 400);
  }

  const pool = await getPool();

  const result = await processEnhancedSale(pool, {
    customerName,
    customerEmail,
    customerPhone,
    customerAccountId,
    items: items.map((item: any) => ({
      productId: item.product_id || item.productId,
      quantity: item.quantity,
      unitPrice: item.unit_price || item.unitPrice,
      discountAmount: item.discount || item.discountAmount || 0
    })),
    paymentSplits: paymentSplits.map((split: any) => ({
      paymentMethod: split.payment_method_code || split.paymentMethod,
      amount: split.amount,
      referenceNumber: split.reference_number || split.referenceNumber || null,
      notes: split.notes || null
    })),
    taxRate,
    discountAmount,
    shiftId,
    cashierId: req.user!.id
  });

  // Emit real-time updates
  const io = req.app.get('io');
  if (io) {
    io.emit('sale-completed', {
      saleId: result.saleId,
      saleNumber: result.saleNumber,
      totalAmount: result.totalAmount,
      itemCount: items.length,
      cashier: req.user!.username
    });

    // Emit inventory updates
    for (const item of items) {
      io.emit('inventory-updated', {
        productId: item.productId,
        quantityChange: -item.quantity
      });
    }
  }

  logger.info(`Enhanced sale completed: ${result.saleNumber} for $${result.totalAmount} by ${req.user!.username}`);

  res.status(201).json({
    message: 'Sale processed successfully',
    ...result
  });
}));

// Process a new sale
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    items,
    paymentMethod,
    discountAmount = 0,
    taxRate = 0,
    shiftId
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError('Sale items are required', 400);
  }

  if (!paymentMethod) {
    throw createError('Payment method is required', 400);
  }

  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Calculate totals
    let subtotal = 0;
    const saleItems = [];

    // Validate items and check inventory
    for (const item of items) {
      const { productId, quantity, unitPrice } = item;

      if (!productId || !quantity || !unitPrice) {
        throw createError('Product ID, quantity, and unit price are required for all items', 400);
      }

      // Check if product exists and is active
      const [productRows] = await connection.execute(
        'SELECT id, name, sku, is_active FROM products WHERE id = ? AND is_active = 1',
        [productId]
      );
      const product = (productRows as any[])[0];

      if (!product) {
        throw createError(`Product with ID ${productId} not found or inactive`, 400);
      }

      // Check inventory availability
      const [inventoryRows] = await connection.execute(
        'SELECT current_stock, min_stock_level FROM inventory WHERE product_id = ?',
        [productId]
      );
      const inventory = (inventoryRows as any[])[0];

      const availableQuantity = inventory?.current_stock || 0;
      if (availableQuantity < quantity) {
        throw createError(`Insufficient inventory for ${product.name}. Available: ${availableQuantity}`, 400);
      }

      const totalPrice = Number(quantity) * Number(unitPrice);
      subtotal += totalPrice;

      saleItems.push({
        productId,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        totalPrice,
        productName: product.name,
        sku: product.sku
      });
    }

    const taxAmount = subtotal * (Number(taxRate) / 100);
    const totalAmount = subtotal + taxAmount - Number(discountAmount);

    // Generate sale number
    const saleNumber = `SALE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Find or create customer if customer name is provided
    let customerId: number | null = null;
    if (customerName && customerName.trim()) {
      try {
        // Check if customer exists (case-insensitive)
        const [existingCustomers] = await connection.execute(
          'SELECT id FROM customers WHERE LOWER(customer_name) = LOWER(?)',
          [customerName.trim()]
        );

        if ((existingCustomers as any[]).length > 0) {
          customerId = (existingCustomers as any[])[0].id;
        } else {
          // Create new customer
          const [customerResult] = await connection.execute(`
            INSERT INTO customers (customer_name, phone, email, total_purchases, last_purchase_date)
            VALUES (?, ?, ?, 0, NOW())
          `, [customerName.trim(), customerPhone || null, customerEmail || null]);
          customerId = (customerResult as any).insertId;
          logger.info(`Auto-created customer: ${customerName} (ID: ${customerId})`);
        }
      } catch (error) {
        logger.warn(`Failed to create/link customer: ${error}`);
        // Continue with sale even if customer linking fails
      }
    }

    // Insert sale record
    const [saleResult] = await connection.execute(`
      INSERT INTO sales (
        sale_number, customer_id, customer_name, customer_email, customer_phone,
        subtotal, tax_amount, discount_amount, total_amount,
        payment_method, cashier_id, shift_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      saleNumber, customerId, customerName, customerEmail, customerPhone,
      subtotal, taxAmount, discountAmount, totalAmount,
      paymentMethod, req.user!.id, shiftId
    ]) as any;

    const saleId = saleResult.insertId;

    // Insert sale items and update inventory
    for (const item of saleItems) {
      // Insert sale item
      await connection.execute(`
        INSERT INTO sale_items (
          sale_id, product_id, quantity, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?)
      `, [saleId, item.productId, item.quantity, item.unitPrice, item.totalPrice]);

      // Update inventory
      await connection.execute(
        'UPDATE inventory SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?',
        [item.quantity, item.productId]
      );

      // Record inventory transaction
      await connection.execute(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, reference_id, reference_type, created_by
        ) VALUES (?, 'sale', ?, ?, 'sale', ?)
      `, [item.productId, -item.quantity, saleId, req.user!.id]);
    }

    // Update customer purchase statistics
    if (customerId) {
      try {
        await connection.execute(`
          UPDATE customers 
          SET total_purchases = total_purchases + ?,
              last_purchase_date = NOW()
          WHERE id = ?
        `, [totalAmount, customerId]);
        logger.info(`Updated customer ${customerId} purchase stats: +$${totalAmount}`);
      } catch (error) {
        logger.warn(`Failed to update customer purchase stats: ${error}`);
        // Non-fatal, continue with sale
      }
    }

    await connection.commit();
    connection.release();

    // Update shift totals if cashier has an active shift
    try {
      const [shiftRows] = await pool.execute(
        'SELECT id FROM shifts WHERE cashier_id = ? AND is_active = 1',
        [req.user!.id]
      );
      const activeShift = (shiftRows as any[])[0];

      if (activeShift) {
        // Determine payment amounts by method
        let cashAmount = 0, cardAmount = 0, mobileAmount = 0, checkAmount = 0;
        
        switch (paymentMethod.toLowerCase()) {
          case 'cash':
            cashAmount = totalAmount;
            break;
          case 'card':
          case 'credit':
          case 'debit':
            cardAmount = totalAmount;
            break;
          case 'mobile':
          case 'digital':
            mobileAmount = totalAmount;
            break;
          case 'check':
            checkAmount = totalAmount;
            break;
        }

        // Update shift totals
        await pool.execute(`
          UPDATE shifts 
          SET total_sales = total_sales + ?,
              total_transactions = total_transactions + 1,
              total_cash = total_cash + ?,
              total_card = total_card + ?,
              total_mobile = total_mobile + ?,
              total_check = total_check + ?
          WHERE id = ?
        `, [totalAmount, cashAmount, cardAmount, mobileAmount, checkAmount, activeShift.id]);

        logger.info(`Updated shift ${activeShift.id} with sale amount: $${totalAmount}`);
      }
    } catch (shiftError) {
      // Log but don't fail the sale if shift update fails
      logger.warn(`Failed to update shift totals for sale ${saleNumber}:`, shiftError);
    }

    // Emit real-time updates
    const io = req.app.get('io');
    io.emit('sale-completed', {
      saleId,
      saleNumber,
      totalAmount,
      itemCount: saleItems.length,
      cashier: req.user!.username
    });

    // Emit inventory updates for each item
    for (const item of saleItems) {
      io.emit('inventory-updated', {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantityChange: -item.quantity
      });
    }

    logger.info(`Sale completed: ${saleNumber} for $${totalAmount} by ${req.user!.username}`);

    res.status(201).json({
      message: 'Sale processed successfully',
      saleId,
      saleNumber,
      totalAmount,
      receiptData: {
        saleNumber,
        customerName,
        items: saleItems,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paymentMethod,
        cashier: `${req.user!.username}`,
        saleDate: new Date().toISOString()
      }
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Get sales history
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { 
    page = 1, 
    limit = 50, 
    start_date, 
    end_date, 
    cashier_id,
    payment_method 
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const pool = await getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (start_date) {
    whereClause += ' AND DATE(s.sale_date) >= DATE(?)';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND DATE(s.sale_date) <= DATE(?)';
    params.push(end_date);
  }

  if (cashier_id) {
    whereClause += ' AND s.cashier_id = ?';
    params.push(cashier_id);
  }

  if (payment_method) {
    whereClause += ' AND s.payment_method = ?';
    params.push(payment_method);
  }

  const [rows] = await pool.execute(`
    SELECT 
      s.id, s.sale_number, s.sale_date, s.customer_id, s.customer_name, 
      s.customer_email, s.customer_phone, s.cashier_id, s.subtotal, 
      s.tax_amount, s.discount_amount, s.total_amount, 
      s.payment_method, s.payment_status, s.shift_id, s.created_at,
      u.username as cashier_username,
      COUNT(si.id) as item_count,
      GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ', ') as product_names
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    LEFT JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN products p ON si.product_id = p.id
    ${whereClause}
    GROUP BY s.id, s.sale_number, s.sale_date, s.customer_id, s.customer_name, 
             s.customer_email, s.customer_phone, s.cashier_id, s.subtotal, 
             s.tax_amount, s.discount_amount, s.total_amount, 
             s.payment_method, s.payment_status, s.shift_id, s.created_at, u.username
    ORDER BY s.sale_date DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const sales = rows as any[];

  // Get total count
  const [countRows] = await pool.execute(`
    SELECT COUNT(*) as total FROM sales s ${whereClause}
  `, params);
  const { total } = (countRows as any[])[0];

  res.json({
    sales,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get sales analytics
router.get('/analytics/summary', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { 
    start_date = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0],
    cashier_id
  } = req.query;

  const pool = await getPool();
  let whereClause = 'WHERE DATE(s.sale_date) >= DATE(?) AND DATE(s.sale_date) <= DATE(?)';
  let params = [start_date, end_date];

  if (cashier_id) {
    whereClause += ' AND s.cashier_id = ?';
    params.push(cashier_id as string);
  }

  // Get sales summary
  const [summaryRows] = await pool.execute(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(s.total_amount) as total_revenue,
      AVG(s.total_amount) as average_sale,
      SUM(s.discount_amount) as total_discounts,
      SUM(s.tax_amount) as total_tax
    FROM sales s
    ${whereClause}
  `, params);
  const summary = (summaryRows as any[])[0];

  // Get daily sales
  const [dailyRows] = await pool.execute(`
    SELECT 
      DATE(s.sale_date) as sale_date,
      COUNT(*) as transaction_count,
      SUM(s.total_amount) as daily_revenue,
      AVG(s.total_amount) as average_sale
    FROM sales s
    ${whereClause}
    GROUP BY DATE(s.sale_date)
    ORDER BY sale_date DESC
  `, params);
  const dailySales = dailyRows as any[];

  // Get payment method breakdown
  const [paymentRows] = await pool.execute(`
    SELECT 
      s.payment_method,
      COUNT(*) as transaction_count,
      SUM(s.total_amount) as total_amount
    FROM sales s
    ${whereClause}
    GROUP BY s.payment_method
    ORDER BY total_amount DESC
  `, params);
  const paymentMethods = paymentRows as any[];

  // Get top selling products
  const [topRows] = await pool.execute(`
    SELECT 
      p.name,
      p.sku,
      p.brand,
      SUM(si.quantity) as total_quantity,
      SUM(si.total_price) as total_revenue,
      COUNT(DISTINCT si.sale_id) as sale_count
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    ${whereClause}
    GROUP BY si.product_id
    ORDER BY total_revenue DESC
    LIMIT 20
  `, params);
  const topProducts = topRows as any[];

  // Get cashier performance
  const [cashierRows] = await pool.execute(`
    SELECT 
      u.username,
      u.first_name,
      u.last_name,
      COUNT(*) as transaction_count,
      SUM(s.total_amount) as total_sales,
      AVG(s.total_amount) as average_sale
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    ${whereClause}
    GROUP BY s.cashier_id
    ORDER BY total_sales DESC
  `, params);
  const cashierPerformance = cashierRows as any[];

  res.json({
    summary: {
      ...summary,
      period: { start_date, end_date }
    },
    dailySales,
    paymentMethods,
    topProducts,
    cashierPerformance
  });
}));

// Get sale details by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = await getPool();

  const [saleRows] = await pool.execute(`
    SELECT 
      s.*,
      u.username as cashier_username,
      u.first_name as cashier_first_name,
      u.last_name as cashier_last_name
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    WHERE s.id = ?
  `, [id]);
  const sale = (saleRows as any[])[0];

  if (!sale) {
    throw createError('Sale not found', 404);
  }

  const [itemRows] = await pool.execute(`
    SELECT 
      si.*,
      p.name as product_name,
      p.sku,
      p.brand,
      p.unit
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
    ORDER BY si.id
  `, [id]);
  const saleItems = itemRows as any[];

  res.json({
    ...sale,
    items: saleItems
  });
}));

// Reprint receipt
router.get('/:id/receipt', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = await getPool();

  const [saleRows] = await pool.execute(`
    SELECT 
      s.*,
      u.username as cashier_username,
      u.first_name as cashier_first_name,
      u.last_name as cashier_last_name
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    WHERE s.id = ?
  `, [id]);
  const sale = (saleRows as any[])[0];

  if (!sale) {
    throw createError('Sale not found', 404);
  }

  const [itemRows] = await pool.execute(`
    SELECT 
      si.*,
      p.name as product_name,
      p.sku,
      p.brand,
      p.unit
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
    ORDER BY si.id
  `, [id]);
  const saleItems = itemRows as any[];

  const receiptData = {
    saleNumber: sale.sale_number,
    customerName: sale.customer_name,
    customerEmail: sale.customer_email,
    customerPhone: sale.customer_phone,
    items: saleItems.map((item: any) => ({
      productName: item.product_name,
      sku: item.sku,
      brand: item.brand,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total_price
    })),
    subtotal: sale.subtotal,
    taxAmount: sale.tax_amount,
    discountAmount: sale.discount_amount,
    totalAmount: sale.total_amount,
    paymentMethod: sale.payment_method,
    cashier: `${sale.cashier_first_name} ${sale.cashier_last_name}`,
    saleDate: sale.sale_date,
    reprintDate: new Date().toISOString(),
    reprintedBy: req.user!.username
  };

  // Log receipt reprint
  logger.info(`Receipt reprinted for sale ${sale.sale_number} by ${req.user!.username}`);

  res.json({
    message: 'Receipt data retrieved successfully',
    receiptData
  });
}));

// Void sale
router.post('/:id/void', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const pool = await getPool();

  // Check if sale exists and is not already voided
  const [saleRows] = await pool.execute(`
    SELECT * FROM sales WHERE id = ?
  `, [id]);
  const sale = (saleRows as any[])[0];

  if (!sale) {
    throw createError('Sale not found', 404);
  }

  if (sale.status === 'voided') {
    throw createError('Sale is already voided', 400);
  }

  // Get sale items to restore inventory
  const [itemRows] = await pool.execute(`
    SELECT product_id, quantity FROM sale_items WHERE sale_id = ?
  `, [id]);
  const items = itemRows as any[];

  // Start transaction
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // Update sale status to voided
    await connection.execute(`
      UPDATE sales 
      SET status = 'voided',
          void_reason = ?,
          voided_by = ?,
          voided_at = NOW()
      WHERE id = ?
    `, [reason || 'Customer return', req.user?.id, id]);

    // Restore inventory for each item
    for (const item of items) {
      await connection.execute(`
        UPDATE products 
        SET stock_quantity = stock_quantity + ?
        WHERE id = ?
      `, [item.quantity, item.product_id]);
    }

    await connection.commit();
    connection.release();

    logger.info(`Sale ${sale.sale_number} voided by ${req.user!.username}. Reason: ${reason || 'Customer return'}`);

    res.json({ message: 'Sale voided successfully', id });
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Export sales data
router.get('/export/:format', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { format } = req.params;
  const { 
    start_date, 
    end_date, 
    cashier_id,
    payment_method,
    include_items = 'false'
  } = req.query;

  if (!['csv', 'excel'].includes(format)) {
    throw createError('Invalid export format. Use csv or excel', 400);
  }

  const pool = await getPool();
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (start_date) {
    whereClause += ' AND DATE(s.sale_date) >= DATE(?)';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND DATE(s.sale_date) <= DATE(?)';
    params.push(end_date);
  }

  if (cashier_id) {
    whereClause += ' AND s.cashier_id = ?';
    params.push(cashier_id);
  }

  if (payment_method) {
    whereClause += ' AND s.payment_method = ?';
    params.push(payment_method);
  }

  let salesData;
  if (include_items === 'true') {
    // Export with line items
    const [rows] = await pool.execute(`
      SELECT 
        s.sale_number,
        s.sale_date,
        s.customer_name,
        s.customer_email,
        s.customer_phone,
        s.payment_method,
        u.username as cashier,
        p.name as product_name,
        p.sku,
        p.brand,
        si.quantity,
        si.unit_price,
        si.total_price,
        s.subtotal,
        s.tax_amount,
        s.discount_amount,
        s.total_amount
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      ${whereClause}
      ORDER BY s.sale_date DESC, si.id
    `, params);
    salesData = rows as any[];
  } else {
    // Export sales summary only
    const [summaryRows] = await pool.execute(`
      SELECT 
        s.sale_number,
        s.sale_date,
        s.customer_name,
        s.customer_email,
        s.customer_phone,
        s.payment_method,
        u.username as cashier,
        COUNT(si.id) as item_count,
        s.subtotal,
        s.tax_amount,
        s.discount_amount,
        s.total_amount
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.sale_date DESC
    `, params);
    salesData = summaryRows as any[];
  }

  if (format === 'csv') {
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const path = require('path');
    const fs = require('fs').promises;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `sales-export-${timestamp}.csv`;
    const filepath = path.join(__dirname, '../../uploads', filename);
    
    // Ensure uploads directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const csvWriter = createCsvWriter({
      path: filepath,
      header: Object.keys(salesData[0] || {}).map(key => ({ id: key, title: key.replace(/_/g, ' ').toUpperCase() }))
    });
    
    await csvWriter.writeRecords(salesData);
    
    res.download(filepath, filename, (err) => {
      if (err) {
        logger.error('Error downloading sales export:', err);
      }
      // Clean up file after download
      fs.unlink(filepath).catch(console.error);
    });
  } else {
    // Excel export
    const XLSX = require('xlsx');
    const path = require('path');
    const fs = require('fs').promises;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `sales-export-${timestamp}.xlsx`;
    const filepath = path.join(__dirname, '../../uploads', filename);
    
    // Ensure uploads directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const ws = XLSX.utils.json_to_sheet(salesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Export');
    
    XLSX.writeFile(wb, filepath);
    
    res.download(filepath, filename, (err) => {
      if (err) {
        logger.error('Error downloading sales export:', err);
      }
      // Clean up file after download
      fs.unlink(filepath).catch(console.error);
    });
  }
}));

// Process return
router.post('/:id/return', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { items, reason } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError('Return items are required', 400);
  }

  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verify sale exists
    const [saleRows] = await connection.execute('SELECT id, sale_number, total_amount FROM sales WHERE id = ?', [id]);
    const sale = (saleRows as any[])[0];
    if (!sale) {
      throw createError('Sale not found', 404);
    }

    let returnTotal = 0;

    // Process each return item
    for (const returnItem of items) {
      const { saleItemId, returnQuantity } = returnItem;

      // Get original sale item
      const [itemRows] = await connection.execute(
        'SELECT product_id, quantity, unit_price FROM sale_items WHERE id = ? AND sale_id = ?',
        [saleItemId, id]
      );
      const saleItem = (itemRows as any[])[0];

      if (!saleItem) {
        throw createError(`Sale item ${saleItemId} not found`, 400);
      }

      if (returnQuantity > saleItem.quantity) {
        throw createError(`Cannot return more than originally sold`, 400);
      }

      const returnAmount = returnQuantity * saleItem.unit_price;
      returnTotal += returnAmount;

      // Update inventory (add back to stock)
      await connection.execute(
        'UPDATE inventory SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?',
        [returnQuantity, saleItem.product_id]
      );

      // Record inventory transaction
      await connection.execute(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, reference_id, reference_type, notes, created_by
        ) VALUES (?, 'return', ?, ?, 'sale', ?, ?)
      `, [saleItem.product_id, returnQuantity, id, reason, req.user!.id]);
    }

    await connection.commit();
    connection.release();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('sale-returned', {
      saleId: id,
      saleNumber: sale.sale_number,
      returnTotal,
      returnedBy: req.user!.username
    });

    logger.info(`Sale return processed: ${sale.sale_number} return amount $${returnTotal} by ${req.user!.username}`);

    res.json({
      message: 'Return processed successfully',
      returnTotal
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

export default router;
