import express from 'express';
import { getPool } from '../database/connection';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Role-based access control
const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: express.Response, next: Function) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
};

// Get suppliers with their stock status for ordering
router.get('/suppliers-with-stock', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  
  const [rows] = await pool.execute(`
    SELECT 
      s.id,
      s.name,
      s.contact_person,
      s.email,
      s.phone,
      s.address,
      s.city,
      s.state
    FROM suppliers s
    WHERE s.is_active = 1
    ORDER BY s.name
  `);
  const suppliers = rows as any[];

  const suppliersWithStock = [];

  for (const supplier of suppliers) {
    // Get products for this supplier with stock information
    const [productRows] = await pool.execute(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.brand,
        p.unit,
        p.cost_price,
        p.min_stock_level,
        p.max_stock_level,
        COALESCE(i.current_stock, 0) as current_stock,
        c.name as category_name,
        CASE 
          WHEN COALESCE(i.current_stock, 0) = 0 THEN 'out'
          WHEN COALESCE(i.current_stock, 0) <= (p.min_stock_level * 0.5) THEN 'critical'
          WHEN COALESCE(i.current_stock, 0) <= p.min_stock_level THEN 'low'
          ELSE 'ok'
        END as stock_status
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.supplier_id = ? AND p.is_active = 1
      ORDER BY 
        CASE 
          WHEN COALESCE(i.current_stock, 0) = 0 THEN 1
          WHEN COALESCE(i.current_stock, 0) <= (p.min_stock_level * 0.5) THEN 2
          WHEN COALESCE(i.current_stock, 0) <= p.min_stock_level THEN 3
          ELSE 4
        END,
        p.name
    `, [supplier.id]);
    const products = productRows as any[];

    // Calculate suggested order quantities and statistics
    let lowStockCount = 0;
    let estimatedOrderValue = 0;
    
    const processedProducts = products.map(product => {
      const suggestedOrderQty = calculateSuggestedOrderQty(product);
      if (suggestedOrderQty > 0) {
        lowStockCount++;
        estimatedOrderValue += suggestedOrderQty * product.cost_price;
      }
      
      return {
        ...product,
        suggested_order_qty: suggestedOrderQty
      };
    });

    suppliersWithStock.push({
      ...supplier,
      products: processedProducts,
      total_products: products.length,
      low_stock_count: lowStockCount,
      estimated_order_value: estimatedOrderValue
    });
  }

  res.json({ suppliers: suppliersWithStock });
}));

// Helper function to calculate suggested order quantity
function calculateSuggestedOrderQty(product: any): number {
  const currentStock = product.current_stock || 0;
  const minStock = product.min_stock_level || 0;
  const maxStock = product.max_stock_level || minStock * 2;
  
  if (currentStock >= minStock) return 0;
  
  const deficit = minStock - currentStock;
  const bufferQty = Math.ceil((maxStock - minStock) * 0.5);
  return Math.max(deficit + bufferQty, 1);
}

// Get all purchase orders
router.get('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  
  const { page = 1, limit = 25, status, supplier_id } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  
  if (status) {
    whereClause += ' AND po.status = ?';
    params.push(status);
  }
  
  if (supplier_id) {
    whereClause += ' AND po.supplier_id = ?';
    params.push(supplier_id);
  }

  const [rows] = await pool.execute(`
    SELECT 
      po.id,
      po.po_number,
      po.supplier_id,
      s.name as supplier_name,
      po.status,
      po.order_date,
      po.expected_date,
      po.received_date,
      po.total_amount,
      po.paid_amount,
      po.payment_status,
      po.receiving_status,
      po.notes,
      po.created_at,
      u.username as created_by_username,
      COUNT(poi.id) as item_count
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN users u ON po.created_by = u.id
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    ${whereClause}
    GROUP BY po.id, po.po_number, po.supplier_id, s.name, po.status, 
             po.order_date, po.expected_date, po.received_date, po.total_amount, 
             po.paid_amount, po.payment_status, po.receiving_status,
             po.notes, po.created_at, u.username
    ORDER BY po.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const orders = rows as any[];

  const [countRows] = await pool.execute(`
    SELECT COUNT(*) as count
    FROM purchase_orders po
    ${whereClause}
  `, params);
  const totalCount = (countRows as any[])[0];

  res.json({
    orders,
    pagination: {
      current_page: Number(page),
      total_pages: Math.ceil(totalCount.count / Number(limit)),
      total_items: totalCount.count,
      items_per_page: Number(limit)
    }
  });
}));

// Create purchase order
router.post('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { supplier_id, items, expected_date, notes } = req.body;
  const pool = await getPool();

  if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'Supplier ID and items are required' });
    return;
  }

  // Validate supplier exists
  const [supplierRows] = await pool.execute('SELECT id, name FROM suppliers WHERE id = ? AND is_active = 1', [supplier_id]);
  const supplier = (supplierRows as any[])[0];
  if (!supplier) {
    res.status(404).json({ message: 'Supplier not found' });
    return;
  }

  // Generate PO number
  const [lastPORows] = await pool.execute(`
    SELECT po_number FROM purchase_orders 
    WHERE po_number LIKE 'PO%' 
    ORDER BY id DESC LIMIT 1
  `);
  const lastPO = (lastPORows as any[])[0];
  
  let poNumber = 'PO001';
  if (lastPO) {
    const lastNumber = parseInt(lastPO.po_number.substring(2));
    poNumber = `PO${String(lastNumber + 1).padStart(3, '0')}`;
  }

  // Calculate total amount
  const totalAmount = items.reduce((sum: number, item: any) => {
    return sum + (item.quantity * item.unit_cost);
  }, 0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Create purchase order
    const [poResult] = await connection.execute(`
      INSERT INTO purchase_orders (
        po_number, supplier_id, status, order_date, expected_date, 
        total_amount, notes, created_by
      ) VALUES (?, ?, 'draft', CURDATE(), ?, ?, ?, ?)
    `, [poNumber, supplier_id, expected_date || null, totalAmount, notes || null, req.user?.id]) as any;

    const purchaseOrderId = poResult.insertId;

    // Add items to purchase order
    for (const item of items) {
      await connection.execute(`
        INSERT INTO purchase_order_items (
          purchase_order_id, product_id, quantity, unit_cost
        ) VALUES (?, ?, ?, ?)
      `, [purchaseOrderId, item.product_id, item.quantity, item.unit_cost]);
    }

    await connection.commit();
    connection.release();

    logger.info(`Purchase order created: ${poNumber}`, {
      userId: req.user?.id,
      username: req.user?.username,
      supplierId: supplier_id,
      supplierName: supplier.name,
      itemCount: items.length,
      totalAmount
    });

    res.json({
      message: 'Purchase order created successfully',
      po_number: poNumber,
      id: purchaseOrderId,
      total_amount: totalAmount
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Get purchase order details
router.get('/:id', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const pool = await getPool();

  const [orderRows] = await pool.execute(`
    SELECT 
      po.*,
      s.name as supplier_name,
      s.contact_person,
      s.email,
      s.phone,
      u.username as created_by_username
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN users u ON po.created_by = u.id
    WHERE po.id = ?
  `, [id]);
  const order = (orderRows as any[])[0];

  if (!order) {
    res.status(404).json({ message: 'Purchase order not found' });
    return;
  }

  const [itemRows] = await pool.execute(`
    SELECT 
      poi.*,
      p.name as product_name,
      p.sku,
      p.unit,
      p.brand
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.purchase_order_id = ?
    ORDER BY p.name
  `, [id]);
  const items = itemRows as any[];

  res.json({
    ...order,
    items
  });
}));

// Update purchase order status
router.put('/:id/status', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const { status, received_date } = req.body;
  const pool = await getPool();

  if (!['draft', 'sent', 'received', 'cancelled'].includes(status)) {
    res.status(400).json({ message: 'Invalid status' });
    return;
  }

  const updateFields = ['status = ?'];
  const updateParams = [status];

  if (status === 'received' && received_date) {
    updateFields.push('received_date = ?');
    updateParams.push(received_date);
  }

  updateParams.push(id);

  await pool.execute(`
    UPDATE purchase_orders 
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, updateParams);

  logger.info(`Purchase order status updated: ${id} -> ${status}`, {
    userId: req.user?.id,
    username: req.user?.username
  });

  res.json({ message: 'Purchase order status updated successfully' });
}));

// Receive purchase order items
router.post('/:id/receive', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const { items, payment } = req.body; // Array of { purchase_order_item_id, product_id, quantity_received, actual_price }, optional payment object
  const pool = await getPool();

  if ((!items || !Array.isArray(items) || items.length === 0) && !payment) {
    res.status(400).json({ message: 'Items array or payment is required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let receivingStatus = 'Awaiting';
    let paymentStatus = 'Unpaid';
    let newPaidAmount = 0;

    // Process items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      // Validate items before processing
      for (const item of items) {
        // Get current item details
        const [itemDetails] = await connection.execute(`
          SELECT quantity, received_quantity 
          FROM purchase_order_items 
          WHERE id = ?
        `, [item.purchase_order_item_id]);
        
        if (itemDetails && (itemDetails as any[]).length > 0) {
          const itemData = (itemDetails as any[])[0];
          const remaining = itemData.quantity - itemData.received_quantity;
          
          // Validate: cannot receive more than remaining quantity
          if (item.quantity_received > remaining) {
            await connection.rollback();
            res.status(400).json({ 
              error: `Cannot receive ${item.quantity_received} units. Only ${remaining} units remaining for this item.` 
            });
            return;
          }
        }
      }
      
      // Process each item
      for (const item of items) {
        // Update received quantity for this specific item
        await connection.execute(`
          UPDATE purchase_order_items 
          SET received_quantity = received_quantity + ?
          WHERE id = ?
        `, [item.quantity_received, item.purchase_order_item_id]);

        // Update inventory stock (use inventory table, not products table)
        const [inventoryRows] = await connection.execute(`
          SELECT current_stock FROM inventory WHERE product_id = ?
        `, [item.product_id]);
        
        if (inventoryRows && (inventoryRows as any[]).length > 0) {
          // Update existing inventory record
          await connection.execute(`
            UPDATE inventory 
            SET current_stock = current_stock + ?
            WHERE product_id = ?
          `, [item.quantity_received, item.product_id]);
        } else {
          // Create new inventory record if it doesn't exist
          await connection.execute(`
            INSERT INTO inventory (product_id, current_stock, min_stock_level, location)
            VALUES (?, ?, 0, 'MAIN')
          `, [item.product_id, item.quantity_received]);
        }

        // Add inventory transaction
        await connection.execute(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_change, reference_id, 
            reference_type, notes, created_by, created_at
          ) VALUES (?, 'purchase', ?, ?, 'purchase_order', ?, ?, NOW())
        `, [
          item.product_id, 
          item.quantity_received, 
          id, 
          `Received ${item.quantity_received} units from PO`,
          req.user?.id
        ]);
      }

      // Calculate receiving status
      const [itemsRows] = await connection.execute(`
        SELECT 
          COUNT(*) as total_items,
          SUM(CASE WHEN received_quantity >= quantity THEN 1 ELSE 0 END) as fully_received,
          SUM(CASE WHEN received_quantity > 0 AND received_quantity < quantity THEN 1 ELSE 0 END) as partially_received
        FROM purchase_order_items
        WHERE purchase_order_id = ?
      `, [id]);
      
      const stats = (itemsRows as any[])[0];
      
      // If ALL items are fully received, mark as "Received"
      if (stats.fully_received === stats.total_items) {
        receivingStatus = 'Received';
      } 
      // If ANY item has been received but not all are complete, mark as "Partially Received"
      else if (stats.fully_received > 0 || stats.partially_received > 0) {
        receivingStatus = 'Partially Received';
      }
    }

    // Process payment if provided
    if (payment && payment.amount > 0) {
      // Get PO details
      const [poRows] = await connection.execute(`
        SELECT total_amount, COALESCE(paid_amount, 0) as paid_amount FROM purchase_orders WHERE id = ?
      `, [id]);
      
      const po = (poRows as any[])[0];
      if (!po) {
        res.status(404).json({ message: 'Purchase order not found' });
        await connection.rollback();
        connection.release();
        return;
      }

      // Record payment
      await connection.execute(`
        INSERT INTO purchase_order_payments (
          purchase_order_id, amount, payment_method, payment_date, notes, created_by
        ) VALUES (?, ?, ?, CURDATE(), ?, ?)
      `, [id, payment.amount, payment.payment_method, payment.notes || '', req.user?.id]);

      // Calculate new paid amount - ensure both values are numbers
      const currentPaid = Number(po.paid_amount) || 0;
      const paymentAmt = Number(payment.amount) || 0;
      newPaidAmount = currentPaid + paymentAmt;
      
      // Determine payment status
      const totalAmt = Number(po.total_amount) || 0;
      if (newPaidAmount >= totalAmt) {
        paymentStatus = 'Paid this month';
      } else if (newPaidAmount > 0) {
        paymentStatus = 'Partially Paid';
      }
    }

    // Update purchase order with both receiving and payment status
    const updateFields = ['updated_at = NOW()'];
    const updateParams: any[] = [];

    if (items && items.length > 0) {
      updateFields.push('receiving_status = ?');
      updateParams.push(receivingStatus);
    }

    if (payment && payment.amount > 0) {
      updateFields.push('paid_amount = ?', 'payment_status = ?');
      updateParams.push(newPaidAmount, paymentStatus);
    }

    updateParams.push(id);

    await connection.execute(`
      UPDATE purchase_orders 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateParams);

    await connection.commit();
    connection.release();

    logger.info(`Purchase order processed: ${id}`, {
      userId: req.user?.id,
      username: req.user?.username,
      itemsReceived: items?.length || 0,
      receivingStatus,
      paymentAmount: payment?.amount || 0,
      paymentStatus
    });

    res.json({ 
      message: items && items.length > 0 
        ? (payment && payment.amount > 0 ? 'Items received and payment recorded successfully' : 'Items received successfully')
        : 'Payment recorded successfully',
      receiving_status: receivingStatus,
      payment_status: paymentStatus,
      paid_amount: newPaidAmount
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Close purchase order (mark as complete even if not fully received)
router.post('/:id/close', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const { reason } = req.body;
  const pool = await getPool();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update purchase order status
    await connection.execute(`
      UPDATE purchase_orders 
      SET status = 'Closed', receiving_status = 'Received', updated_at = NOW()
      WHERE id = ?
    `, [id]);

    // Log the closure
    logger.info(`Purchase order closed manually: ${id}`, {
      userId: req.user?.id,
      username: req.user?.username,
      reason: reason || 'No reason provided'
    });

    await connection.commit();
    connection.release();

    res.json({ 
      message: 'Purchase order closed successfully',
      status: 'Closed',
      receiving_status: 'Received'
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Record payment for purchase order
router.post('/:id/payment', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const { amount, payment_method, notes } = req.body;
  const pool = await getPool();

  if (!amount || amount <= 0) {
    res.status(400).json({ message: 'Valid payment amount is required' });
    return;
  }

  if (!payment_method) {
    res.status(400).json({ message: 'Payment method is required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get PO details
    const [poRows] = await connection.execute(`
      SELECT total_amount, paid_amount FROM purchase_orders WHERE id = ?
    `, [id]);
    
    const po = (poRows as any[])[0];
    if (!po) {
      res.status(404).json({ message: 'Purchase order not found' });
      await connection.rollback();
      connection.release();
      return;
    }

    // Record payment
    await connection.execute(`
      INSERT INTO purchase_order_payments (
        purchase_order_id, amount, payment_method, payment_date, notes, created_by
      ) VALUES (?, ?, ?, CURDATE(), ?, ?)
    `, [id, amount, payment_method, notes || '', req.user?.id]);

    // Calculate new paid amount
    const newPaidAmount = (po.paid_amount || 0) + amount;
    
    // Determine payment status
    let paymentStatus = 'Unpaid';
    if (newPaidAmount >= po.total_amount) {
      paymentStatus = 'Paid this month';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'Partially Paid';
    }

    // Update purchase order
    await connection.execute(`
      UPDATE purchase_orders 
      SET paid_amount = ?, payment_status = ?, updated_at = NOW()
      WHERE id = ?
    `, [newPaidAmount, paymentStatus, id]);

    await connection.commit();
    connection.release();

    logger.info(`Payment recorded for purchase order: ${id}`, {
      userId: req.user?.id,
      username: req.user?.username,
      amount,
      paymentMethod: payment_method,
      paymentStatus
    });

    res.json({ 
      message: 'Payment recorded successfully',
      paid_amount: newPaidAmount,
      payment_status: paymentStatus
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Delete purchase order (only drafts)
router.delete('/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const pool = await getPool();

  const [orderRows] = await pool.execute('SELECT status FROM purchase_orders WHERE id = ?', [id]);
  const order = (orderRows as any[])[0];
  if (!order) {
    res.status(404).json({ message: 'Purchase order not found' });
    return;
  }

  if (order.status !== 'draft') {
    res.status(400).json({ message: 'Can only delete draft orders' });
    return;
  }

  await pool.execute('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
  await pool.execute('DELETE FROM purchase_orders WHERE id = ?', [id]);

  logger.info(`Purchase order deleted: ${id}`, {
    userId: req.user?.id,
    username: req.user?.username
  });

  res.json({ message: 'Purchase order deleted successfully' });
}));

export default router;