import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import joi from 'joi';
import path from 'path';
import fs from 'fs';
import { getPool } from '../database/connection';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// Validation schemas
const adjustmentSchema = joi.object({
  productId: joi.number().integer().positive().required(),
  quantityChange: joi.number().integer().required(),
  location: joi.string().max(100).default('MAIN'),
  notes: joi.string().max(500).required(),
  reason: joi.string().valid('damaged', 'lost', 'found', 'correction', 'expired', 'returned', 'other').required()
});

const physicalCountSchema = joi.object({
  productId: joi.number().integer().positive().required(),
  countedQuantity: joi.number().integer().min(0).required(),
  location: joi.string().max(100).default('MAIN'),
  notes: joi.string().max(500).allow('', null),
  countedBy: joi.string().max(100).required()
});

const bulkAdjustmentSchema = joi.object({
  adjustments: joi.array().items(joi.object({
    productId: joi.number().integer().positive().required(),
    quantityChange: joi.number().integer().required(),
    notes: joi.string().max(500).required(),
    reason: joi.string().valid('damaged', 'lost', 'found', 'correction', 'expired', 'returned', 'other').required()
  })).min(1).max(100).required(),
  location: joi.string().max(100).default('MAIN')
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  }
});

const router = express.Router();

// Get inventory levels
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { location, low_stock_only = 'false', limit = '1000' } = req.query;
  const pool = getPool();

  let whereClause = 'WHERE p.is_active = 1';
  const params: any[] = [];

  if (location) {
    whereClause += ' AND i.location = ?';
    params.push(location);
  }

  if (low_stock_only === 'true') {
    whereClause += ' AND i.current_stock <= p.min_stock_level';
  }

  const [rows] = await pool.execute(`
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.brand,
      p.unit,
      p.min_stock_level,
      p.max_stock_level,
      COALESCE(i.current_stock, 0) as current_stock,
      COALESCE(i.reserved_quantity, 0) as reserved_stock,
      COALESCE(i.location, 'MAIN') as location,
      i.last_counted_at,
      c.name as category_name
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY 
      CASE WHEN i.current_stock <= p.min_stock_level THEN 0 ELSE 1 END,
      p.name
    LIMIT ?
  `, [...params, Number(limit)]);
  const inventory = rows as any[];

  res.json(inventory);
}));

// Adjust inventory with enhanced validation
router.post('/adjust', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Validate input data
  const { error, value } = adjustmentSchema.validate(req.body);
  if (error) {
    throw createError(`Validation error: ${error.details[0].message}`, 400);
  }

  const { productId, quantityChange, location, notes, reason } = value;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verify product exists and is active
    const [productRows] = await connection.execute(
      'SELECT id, name, sku, is_active, min_stock_level FROM products WHERE id = ?',
      [productId]
    );
    const product = (productRows as any[])[0];

    if (!product) {
      await connection.rollback();
      throw createError('Product not found', 404);
    }

    if (!product.is_active) {
      await connection.rollback();
      throw createError('Cannot adjust inventory for inactive product', 400);
    }

    // Get current inventory
    const [inventoryRows] = await connection.execute(
      'SELECT current_stock, reserved_quantity FROM inventory WHERE product_id = ? AND location = ?',
      [productId, location]
    );
    const currentInventory = (inventoryRows as any[])[0];

    const currentQuantity = currentInventory?.current_stock || 0;
    const reservedQuantity = currentInventory?.reserved_quantity || 0;
    const newQuantity = currentQuantity + Number(quantityChange);

    // Validate adjustment won't create negative inventory
    if (newQuantity < 0) {
      await connection.rollback();
      throw createError(`Adjustment would result in negative inventory. Current: ${currentQuantity}, Change: ${quantityChange}`, 400);
    }

    // Warn if adjustment will result in stock below reserved quantity
    if (newQuantity < reservedQuantity) {
      logger.warn(`Inventory adjustment will put available stock below reserved quantity for product ${product.sku}. New: ${newQuantity}, Reserved: ${reservedQuantity}`);
    }

    // Update or insert inventory
    if (currentInventory) {
      await connection.execute(
        'UPDATE inventory SET current_stock = ?, updated_at = NOW() WHERE product_id = ? AND location = ?',
        [newQuantity, productId, location]
      );
    } else {
      await connection.execute(
        'INSERT INTO inventory (product_id, current_stock, location) VALUES (?, ?, ?)',
        [productId, newQuantity, location]
      );
    }

    // Record detailed transaction
    await connection.execute(`
      INSERT INTO inventory_transactions (
        product_id, transaction_type, quantity_change, notes, created_by, reference_type
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [productId, 'adjustment', quantityChange, `${reason}: ${notes}`, req.user!.id, reason]);

    await connection.commit();

    // Check for low stock alert
    const isLowStock = newQuantity <= product.min_stock_level;
    const availableQuantity = newQuantity - reservedQuantity;

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('inventory-updated', {
      productId,
      productName: product.name,
      sku: product.sku,
      location,
      newQuantity,
      availableQuantity,
      quantityChange,
      isLowStock,
      updatedBy: req.user!.username,
      reason,
      timestamp: new Date().toISOString()
    });

    // Emit low stock alert if applicable
    if (isLowStock) {
      io.emit('low-stock-alert', {
        productId,
        productName: product.name,
        sku: product.sku,
        currentStock: newQuantity,
        minStockLevel: product.min_stock_level,
        location
      });
    }

    logger.info(`Inventory adjusted: ${product.name} (${product.sku}) ${quantityChange > 0 ? '+' : ''}${quantityChange} (${reason}) by user ${req.user!.username}`, {
      productId,
      quantityChange,
      newQuantity,
      reason,
      location
    });

    res.json({
      message: 'Inventory adjusted successfully',
      adjustment: {
        productId,
        productName: product.name,
        sku: product.sku,
        previousQuantity: currentQuantity,
        quantityChange,
        newQuantity,
        availableQuantity,
        location,
        reason,
        isLowStock,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Get inventory transactions history
router.get('/transactions', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { productId, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const pool = getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (productId) {
    whereClause += ' AND it.product_id = ?';
    params.push(productId);
  }

  const [rows] = await pool.execute(`
    SELECT 
      it.*,
      p.name as product_name,
      p.sku,
      u.username as created_by_username
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.id
    JOIN users u ON it.created_by = u.id
    ${whereClause}
    ORDER BY it.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const transactions = rows as any[];

  res.json(transactions);
}));

// Physical count update with enhanced validation
router.post('/count', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Validate input data
  const { error, value } = physicalCountSchema.validate(req.body);
  if (error) {
    throw createError(`Validation error: ${error.details[0].message}`, 400);
  }

  const { productId, countedQuantity, location, notes, countedBy } = value;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verify product exists and is active
    const [productRows] = await connection.execute(
      'SELECT id, name, sku, is_active, min_stock_level FROM products WHERE id = ?',
      [productId]
    );
    const product = (productRows as any[])[0];

    if (!product) {
      await connection.rollback();
      throw createError('Product not found', 404);
    }

    if (!product.is_active) {
      await connection.rollback();
      throw createError('Cannot count inventory for inactive product', 400);
    }

    // Get current inventory
    const [inventoryRows] = await connection.execute(
      'SELECT current_stock, reserved_quantity, last_counted_at FROM inventory WHERE product_id = ? AND location = ?',
      [productId, location]
    );
    const currentInventory = (inventoryRows as any[])[0];

    const currentQuantity = currentInventory?.current_stock || 0;
    const reservedQuantity = currentInventory?.reserved_quantity || 0;
    const difference = Number(countedQuantity) - currentQuantity;
    const lastCountedAt = currentInventory?.last_counted_at;

    // Validate significant discrepancies
    const discrepancyThreshold = Math.max(10, Math.abs(currentQuantity * 0.1)); // 10% or 10 units, whichever is larger
    if (Math.abs(difference) > discrepancyThreshold && currentQuantity > 0) {
      logger.warn(`Large inventory discrepancy detected for product ${product.sku}: ${difference} units (${((difference / currentQuantity) * 100).toFixed(1)}%)`);
    }

    // Update inventory with count timestamp
    if (currentInventory) {
      await connection.execute(
        'UPDATE inventory SET current_stock = ?, last_counted_at = NOW(), updated_at = NOW() WHERE product_id = ? AND location = ?',
        [countedQuantity, productId, location]
      );
    } else {
      await connection.execute(
        'INSERT INTO inventory (product_id, current_stock, location, last_counted_at) VALUES (?, ?, ?, NOW())',
        [productId, countedQuantity, location]
      );
    }

    // Record transaction if there's a difference
    if (difference !== 0) {
      const adjustmentNotes = `Physical count by ${countedBy}. Difference: ${difference}. ${notes || 'No additional notes.'}`;
      await connection.execute(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, notes, created_by, reference_type
        ) VALUES (?, 'adjustment', ?, ?, ?, 'physical_count')
      `, [productId, difference, adjustmentNotes, req.user!.id]);
    }

    // Record the count event (even if no difference)
    await connection.execute(`
      INSERT INTO inventory_transactions (
        product_id, transaction_type, quantity_change, notes, created_by, reference_type
      ) VALUES (?, 'count', 0, ?, ?, 'physical_count')
    `, [productId, `Physical count by ${countedBy}: ${countedQuantity} units. ${notes || ''}`, req.user!.id]);

    await connection.commit();

    // Check for low stock alert
    const isLowStock = countedQuantity <= product.min_stock_level;
    const availableQuantity = countedQuantity - reservedQuantity;

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('inventory-counted', {
      productId,
      productName: product.name,
      sku: product.sku,
      location,
      countedQuantity,
      previousQuantity: currentQuantity,
      difference,
      availableQuantity,
      countedBy,
      isLowStock,
      lastCountedAt,
      timestamp: new Date().toISOString()
    });

    // Emit low stock alert if applicable
    if (isLowStock) {
      io.emit('low-stock-alert', {
        productId,
        productName: product.name,
        sku: product.sku,
        currentStock: countedQuantity,
        minStockLevel: product.min_stock_level,
        location
      });
    }

    logger.info(`Physical count completed: ${product.name} (${product.sku}) counted ${countedQuantity}, difference: ${difference} by ${countedBy} (user: ${req.user!.username})`, {
      productId,
      countedQuantity,
      difference,
      countedBy,
      location
    });

    res.json({
      message: 'Physical count completed successfully',
      count: {
        productId,
        productName: product.name,
        sku: product.sku,
        previousQuantity: currentQuantity,
        countedQuantity,
        difference,
        availableQuantity,
        location,
        countedBy,
        isLowStock,
        lastCountedAt,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Bulk inventory adjustments
router.post('/bulk-adjust', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = bulkAdjustmentSchema.validate(req.body);
  if (error) {
    throw createError(`Validation error: ${error.details[0].message}`, 400);
  }

  const { adjustments, location } = value;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const results = [];
    const errors = [];

    // Validate all products exist and are active
    const productIds = adjustments.map((adj: any) => adj.productId);
    const [productRows] = await connection.execute(`
      SELECT id, name, sku, is_active FROM products 
      WHERE id IN (${productIds.map(() => '?').join(',')})
    `, productIds);
    const products = productRows as any[];

    if (products.length !== productIds.length) {
      await connection.rollback();
      throw createError('One or more products not found', 404);
    }

    const inactiveProducts = products.filter((p: any) => !p.is_active);
    if (inactiveProducts.length > 0) {
      await connection.rollback();
      throw createError(`Cannot adjust inventory for inactive products: ${inactiveProducts.map((p: any) => p.sku).join(', ')}`, 400);
    }

    // Process each adjustment
    for (const adjustment of adjustments) {
      try {
        const { productId, quantityChange, notes, reason } = adjustment;
        const product = products.find((p: any) => p.id === productId);

        // Get current inventory
        const [inventoryRows] = await connection.execute(
          'SELECT current_stock, reserved_quantity FROM inventory WHERE product_id = ? AND location = ?',
          [productId, location]
        );
        const currentInventory = (inventoryRows as any[])[0];

        const currentQuantity = currentInventory?.current_stock || 0;
        const newQuantity = currentQuantity + Number(quantityChange);

        if (newQuantity < 0) {
          errors.push(`${product.sku}: Adjustment would result in negative inventory (${newQuantity})`);
          continue;
        }

        // Update inventory
        if (currentInventory) {
          await connection.execute(
            'UPDATE inventory SET current_stock = ?, updated_at = NOW() WHERE product_id = ? AND location = ?',
            [newQuantity, productId, location]
          );
        } else {
          await connection.execute(
            'INSERT INTO inventory (product_id, current_stock, location) VALUES (?, ?, ?)',
            [productId, newQuantity, location]
          );
        }

        // Record transaction
        await connection.execute(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_change, notes, created_by, reference_type
          ) VALUES (?, 'adjustment', ?, ?, ?, ?)
        `, [productId, quantityChange, `Bulk ${reason}: ${notes}`, req.user!.id, reason]);

        results.push({
          productId,
          sku: product.sku,
          name: product.name,
          previousQuantity: currentQuantity,
          quantityChange,
          newQuantity
        });

      } catch (error: any) {
        errors.push(`${products.find((p: any) => p.id === adjustment.productId)?.sku}: ${error.message}`);
      }
    }

    if (errors.length > 0 && results.length === 0) {
      await connection.rollback();
      throw createError(`All adjustments failed: ${errors.join('; ')}`, 400);
    }

    await connection.commit();

    // Emit real-time updates
    const io = req.app.get('io');
    io.emit('inventory-bulk-updated', {
      adjustments: results,
      errors,
      location,
      updatedBy: req.user!.username,
      timestamp: new Date().toISOString()
    });

    logger.info(`Bulk inventory adjustment completed: ${results.length} successful, ${errors.length} errors by user ${req.user!.username}`, {
      successCount: results.length,
      errorCount: errors.length,
      location
    });

    res.json({
      message: `Bulk adjustment completed: ${results.length} successful, ${errors.length} errors`,
      results,
      errors,
      summary: {
        totalAttempted: adjustments.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Get low stock alerts
router.get('/low-stock', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { location, threshold_multiplier = '1.0' } = req.query;
  const pool = getPool();

  let whereClause = 'WHERE p.is_active = 1 AND (i.current_stock <= (p.min_stock_level * ?) OR i.current_stock IS NULL)';
  const params: any[] = [parseFloat(threshold_multiplier as string)];

  if (location && location !== 'all') {
    whereClause += ' AND (i.location = ? OR i.location IS NULL)';
    params.push(location as string);
  }

  const [rows] = await pool.execute(`
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.brand,
      p.unit,
      p.min_stock_level,
      p.max_stock_level,
      c.name as category_name,
      s.name as supplier_name,
      COALESCE(i.current_stock, 0) as current_stock,
      COALESCE(i.reserved_quantity, 0) as reserved_stock,
      COALESCE(i.location, 'MAIN') as location,
      i.last_counted_at,
      CASE 
        WHEN i.current_stock IS NULL THEN 'No inventory record'
        WHEN i.current_stock = 0 THEN 'Out of stock'
        WHEN i.current_stock <= (p.min_stock_level * 0.5) THEN 'Critical'
        ELSE 'Low'
      END as alert_level,
      p.min_stock_level - COALESCE(i.current_stock, 0) as shortage_quantity
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ${whereClause}
    ORDER BY 
      CASE 
        WHEN i.current_stock IS NULL THEN 0
        WHEN i.current_stock = 0 THEN 1
        WHEN i.current_stock <= (p.min_stock_level * 0.5) THEN 2
        ELSE 3
      END,
      p.name
  `, params);
  const lowStockItems = rows as any[];

  res.json({
    lowStockItems,
    summary: {
      total: lowStockItems.length,
      outOfStock: lowStockItems.filter((item: any) => item.current_stock === 0).length,
      critical: lowStockItems.filter((item: any) => item.alert_level === 'Critical').length,
      low: lowStockItems.filter((item: any) => item.alert_level === 'Low').length,
      noRecord: lowStockItems.filter((item: any) => item.alert_level === 'No inventory record').length
    }
  });
}));

// Get movement history with enhanced filtering
router.get('/movements', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { 
    productId, 
    page = 1, 
    limit = 50, 
    start_date, 
    end_date,
    transaction_type,
    reference_type,
    created_by
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const pool = getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (productId) {
    whereClause += ' AND it.product_id = ?';
    params.push(productId);
  }

  if (start_date) {
    whereClause += ' AND DATE(it.created_at) >= DATE(?)';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND DATE(it.created_at) <= DATE(?)';
    params.push(end_date);
  }

  if (transaction_type) {
    whereClause += ' AND it.transaction_type = ?';
    params.push(transaction_type);
  }

  if (reference_type) {
    whereClause += ' AND it.reference_type = ?';
    params.push(reference_type);
  }

  if (created_by) {
    whereClause += ' AND it.created_by = ?';
    params.push(created_by);
  }

  const [movementRows] = await pool.execute(`
    SELECT 
      it.*,
      p.name as product_name,
      p.sku,
      p.unit,
      u.username as created_by_username,
      u.first_name,
      u.last_name,
      CASE it.reference_type
        WHEN 'sale' THEN (SELECT s.sale_number FROM sales s WHERE s.id = it.reference_id)
        WHEN 'purchase_order' THEN (SELECT po.po_number FROM purchase_orders po WHERE po.id = it.reference_id)
        ELSE NULL
      END as reference_number
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.id
    JOIN users u ON it.created_by = u.id
    ${whereClause}
    ORDER BY it.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const movements = movementRows as any[];

  // Get total count
  const [countRows] = await pool.execute(`
    SELECT COUNT(*) as total 
    FROM inventory_transactions it 
    ${whereClause}
  `, params);
  const { total } = (countRows as any[])[0];

  res.json({
    movements,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Export inventory to CSV
router.get('/export/csv', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { location, category, low_stock_only = 'false', include_inactive = 'false' } = req.query;
  const pool = getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (include_inactive !== 'true') {
    whereClause += ' AND p.is_active = 1';
  }

  if (location && location !== 'all') {
    whereClause += ' AND (i.location = ? OR i.location IS NULL)';
    params.push(location);
  }

  if (category) {
    whereClause += ' AND p.category_id = ?';
    params.push(category);
  }

  if (low_stock_only === 'true') {
    whereClause += ' AND (i.current_stock <= p.min_stock_level OR i.current_stock IS NULL)';
  }

  const [rows] = await pool.execute(`
    SELECT 
      p.sku,
      p.name as product_name,
      p.brand,
      c.name as category_name,
      p.unit,
      COALESCE(i.current_stock, 0) as current_stock,
      COALESCE(i.reserved_quantity, 0) as reserved_stock,
      COALESCE(i.current_stock, 0) - COALESCE(i.reserved_quantity, 0) as available_stock,
      p.min_stock_level,
      p.max_stock_level,
      p.cost_price,
      p.selling_price,
      COALESCE(i.current_stock, 0) * p.cost_price as inventory_value,
      s.name as supplier_name,
      COALESCE(i.location, 'MAIN') as location,
      i.last_counted_at,
      CASE 
        WHEN i.current_stock IS NULL THEN 'No Record'
        WHEN i.current_stock = 0 THEN 'Out of Stock'
        WHEN i.current_stock <= p.min_stock_level THEN 'Low Stock'
        WHEN i.current_stock >= p.max_stock_level AND p.max_stock_level > 0 THEN 'Overstock'
        ELSE 'Normal'
      END as stock_status,
      p.is_active
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ${whereClause}
    ORDER BY p.name
  `, params);
  const inventory = rows as any[];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `inventory-export-${timestamp}.csv`;
  const filepath = path.join(__dirname, '../../exports', filename);

  // Ensure exports directory exists
  const exportsDir = path.dirname(filepath);
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'sku', title: 'SKU' },
      { id: 'product_name', title: 'Product Name' },
      { id: 'brand', title: 'Brand' },
      { id: 'category_name', title: 'Category' },
      { id: 'unit', title: 'Unit' },
      { id: 'current_stock', title: 'Current Stock' },
      { id: 'reserved_stock', title: 'Reserved Stock' },
      { id: 'available_stock', title: 'Available Stock' },
      { id: 'min_stock_level', title: 'Min Stock Level' },
      { id: 'max_stock_level', title: 'Max Stock Level' },
      { id: 'cost_price', title: 'Cost Price' },
      { id: 'selling_price', title: 'Selling Price' },
      { id: 'inventory_value', title: 'Inventory Value' },
      { id: 'supplier_name', title: 'Supplier' },
      { id: 'location', title: 'Location' },
      { id: 'last_counted_at', title: 'Last Counted' },
      { id: 'stock_status', title: 'Stock Status' },
      { id: 'is_active', title: 'Active' }
    ]
  });

  await csvWriter.writeRecords(inventory);

  logger.info(`Inventory exported to CSV by user ${req.user!.username}: ${inventory.length} records`);

  res.download(filepath, filename, (err) => {
    if (err) {
      logger.error('Error sending CSV file:', err);
    }
    // Clean up file after download
    setTimeout(() => {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }, 60000); // Delete after 1 minute
  });
}));

// Import inventory adjustments from CSV/Excel
router.post('/import', requireRole(['admin', 'manager']), upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.file) {
    throw createError('No file uploaded', 400);
  }

  const { validateOnly = 'false', location = 'MAIN' } = req.body;
  const pool = getPool();
  
  let adjustments: any[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let connection: any = null;

  try {
    // Parse file based on type
    if (req.file.mimetype.includes('sheet') || req.file.mimetype.includes('excel')) {
      // Excel file
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      adjustments = xlsx.utils.sheet_to_json(worksheet);
    } else {
      // CSV file
      adjustments = await new Promise((resolve, reject) => {
        const results: any[] = [];
        createReadStream(req.file!.path)
          .pipe(csvParser())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    }

    if (adjustments.length === 0) {
      throw createError('No data found in uploaded file', 400);
    }

    if (adjustments.length > 500) {
      throw createError('Maximum 500 inventory adjustments allowed per import', 400);
    }

    // Validate and process each adjustment (validation phase uses pool, not connection)
    const validAdjustments: any[] = [];

    for (let i = 0; i < adjustments.length; i++) {
      const row = adjustments[i];
      const rowNum = i + 2; // Account for header row

      try {
        // Map CSV columns to our schema
        const adjustmentData = {
          sku: row.SKU || row.sku || row['Product SKU'],
          quantityChange: parseInt(row['Quantity Change'] || row.quantityChange || row.adjustment || '0'),
          notes: row.Notes || row.notes || row.reason || '',
          reason: row.Reason || row.reason || row.type || 'correction'
        };

        // Validate required fields
        if (!adjustmentData.sku) {
          errors.push(`Row ${rowNum}: Missing SKU`);
          continue;
        }

        if (adjustmentData.quantityChange === 0) {
          warnings.push(`Row ${rowNum}: Zero quantity change for ${adjustmentData.sku}`);
          continue;
        }

        if (!adjustmentData.notes) {
          errors.push(`Row ${rowNum}: Notes/reason required for adjustment`);
          continue;
        }

        // Validate reason
        const validReasons = ['damaged', 'lost', 'found', 'correction', 'expired', 'returned', 'other'];
        if (!validReasons.includes(adjustmentData.reason)) {
          adjustmentData.reason = 'other';
          warnings.push(`Row ${rowNum}: Invalid reason, defaulting to 'other'`);
        }

        // Look up product by SKU (using pool for validation phase)
        const [productRows] = await pool.execute('SELECT id, name, sku, is_active FROM products WHERE sku = ?', [adjustmentData.sku]);
        const product = (productRows as any[])[0];
        
        if (!product) {
          errors.push(`Row ${rowNum}: Product not found with SKU: ${adjustmentData.sku}`);
          continue;
        }

        if (!product.is_active) {
          errors.push(`Row ${rowNum}: Product is inactive: ${adjustmentData.sku}`);
          continue;
        }

        validAdjustments.push({
          ...adjustmentData,
          productId: product.id,
          productName: product.name,
          rowNum
        });

      } catch (err: any) {
        errors.push(`Row ${rowNum}: Error processing row - ${err?.message || 'Unknown error'}`);
      }
    }

    // If validation only, return results without importing
    if (validateOnly === 'true') {
      res.json({
        message: 'Validation completed',
        totalRows: adjustments.length,
        validAdjustments: validAdjustments.length,
        errors: errors.length,
        warnings: warnings.length,
        details: { errors, warnings }
      });
      return;
    }

    if (errors.length > 0) {
      throw createError(`Import contains ${errors.length} errors. Please fix and try again.`, 400);
    }

    if (validAdjustments.length === 0) {
      throw createError('No valid adjustments to import', 400);
    }

    // Begin import transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let importedCount = 0;
    const importResults: any[] = [];

    for (const adjustment of validAdjustments) {
      try {
        // Get current inventory
        const [inventoryRows] = await connection.execute(
          'SELECT current_stock FROM inventory WHERE product_id = ? AND location = ?',
          [adjustment.productId, location]
        );
        const currentInventory = (inventoryRows as any[])[0];

        const currentQuantity = currentInventory?.current_stock || 0;
        const newQuantity = currentQuantity + adjustment.quantityChange;

        if (newQuantity < 0) {
          errors.push(`${adjustment.sku}: Would result in negative inventory (${newQuantity})`);
          continue;
        }

        // Update inventory
        if (currentInventory) {
          await connection.execute(
            'UPDATE inventory SET current_stock = ?, updated_at = NOW() WHERE product_id = ? AND location = ?',
            [newQuantity, adjustment.productId, location]
          );
        } else {
          await connection.execute(
            'INSERT INTO inventory (product_id, current_stock, location) VALUES (?, ?, ?)',
            [adjustment.productId, newQuantity, location]
          );
        }

        // Record transaction
        await connection.execute(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_change, notes, created_by, reference_type
          ) VALUES (?, 'adjustment', ?, ?, ?, ?)
        `, [adjustment.productId, adjustment.quantityChange, `Import: ${adjustment.reason} - ${adjustment.notes}`, req.user!.id, adjustment.reason]);

        importResults.push({
          sku: adjustment.sku,
          productName: adjustment.productName,
          quantityChange: adjustment.quantityChange,
          newQuantity
        });

        importedCount++;

      } catch (err: any) {
        errors.push(`${adjustment.sku}: ${err?.message || 'Unknown error'}`);
      }
    }

    if (importedCount === 0) {
      await connection.rollback();
      throw createError('No adjustments could be imported', 400);
    }

    await connection.commit();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('inventory-imported', {
      count: importedCount,
      location,
      importedBy: req.user!.username,
      timestamp: new Date().toISOString()
    });

    logger.info(`Inventory adjustments imported successfully by user ${req.user!.username}: ${importedCount} adjustments`);

    res.json({
      message: 'Import completed successfully',
      importedCount,
      totalRows: adjustments.length,
      errors: errors.length,
      warnings: warnings.length,
      errorDetails: errors,
      warningDetails: warnings,
      importResults
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
}));

// Get inventory valuation report
router.get('/valuation', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { location, category } = req.query;
  const pool = getPool();

  let whereClause = 'WHERE p.is_active = 1';
  const params: any[] = [];

  if (location && location !== 'all') {
    whereClause += ' AND (i.location = ? OR i.location IS NULL)';
    params.push(location);
  }

  if (category) {
    whereClause += ' AND p.category_id = ?';
    params.push(category);
  }

  const [rows] = await pool.execute(`
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.brand,
      c.name as category_name,
      COALESCE(i.current_stock, 0) as quantity,
      p.cost_price,
      p.selling_price,
      COALESCE(i.current_stock, 0) * p.cost_price as cost_value,
      COALESCE(i.current_stock, 0) * p.selling_price as retail_value,
      (COALESCE(i.current_stock, 0) * p.selling_price) - (COALESCE(i.current_stock, 0) * p.cost_price) as potential_profit,
      COALESCE(i.location, 'MAIN') as location
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY cost_value DESC
  `, params);
  const valuation = rows as any[];

  const summary = valuation.reduce((acc: any, item: any) => ({
    totalItems: acc.totalItems + (item.quantity || 0),
    totalCostValue: acc.totalCostValue + (item.cost_value || 0),
    totalRetailValue: acc.totalRetailValue + (item.retail_value || 0),
    totalPotentialProfit: acc.totalPotentialProfit + (item.potential_profit || 0)
  }), {
    totalItems: 0,
    totalCostValue: 0,
    totalRetailValue: 0,
    totalPotentialProfit: 0
  });

  res.json({
    valuation,
    summary: {
      ...summary,
      averageMargin: summary.totalRetailValue > 0 ? 
        ((summary.totalPotentialProfit / summary.totalRetailValue) * 100).toFixed(2) + '%' : '0%'
    }
  });
}));

export default router;