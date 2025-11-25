import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getPool } from '../database/connection';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// Validation schemas
const productSchema = joi.object({
  sku: joi.string().allow('', null).max(50),
  barcode: joi.string().allow('', null).max(100),
  name: joi.string().required().max(200),
  brand: joi.string().allow('', null).max(100),
  description: joi.string().allow('', null),
  categoryId: joi.number().integer().positive().allow(null),
  categoryName: joi.string().allow('', null).max(100), // Used for import lookup
  size: joi.string().allow('', null).max(50),
  variety: joi.string().allow('', null).max(100),
  color: joi.string().allow('', null).max(50),
  unit: joi.string().allow('', null).max(20).default('each'),
  costPrice: joi.number().positive().precision(2).required(),
  sellingPrice: joi.number().positive().precision(2).required(),
  minStockLevel: joi.number().integer().min(0).default(0),
  maxStockLevel: joi.number().integer().min(0).default(0),
  supplierId: joi.number().integer().positive().allow(null),
  supplierName: joi.string().allow('', null).max(200), // Used for import lookup
  initialStock: joi.number().integer().min(0).default(0)
});

const bulkUpdateSchema = joi.object({
  productIds: joi.array().items(joi.number().integer().positive()).required(),
  updates: joi.object({
    categoryId: joi.number().integer().positive().allow(null),
    supplierId: joi.number().integer().positive().allow(null),
    costPrice: joi.number().positive().precision(2),
    sellingPrice: joi.number().positive().precision(2),
    minStockLevel: joi.number().integer().min(0),
    maxStockLevel: joi.number().integer().min(0),
    isActive: joi.boolean()
  }).min(1).required()
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

// Get all products with filtering and pagination
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { 
    page = 1, 
    limit = 1000, // Increased default limit for better performance
    search, 
    category, 
    brand, 
    active_only = 'true',
    low_stock = 'false'
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const pool = getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (active_only === 'true') {
    whereClause += ' AND p.is_active = 1';
  }

  if (search) {
    whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  if (category) {
    whereClause += ' AND p.category_id = ?';
    params.push(category);
  }

  if (brand) {
    whereClause += ' AND p.brand LIKE ?';
    params.push(`%${brand}%`);
  }

  if (low_stock === 'true') {
    whereClause += ' AND i.current_stock <= p.min_stock_level';
  }

  const query = `
    SELECT 
      p.id, p.sku, p.barcode, p.name, p.brand, p.description,
      p.category_id, p.size, p.variety, p.color, p.unit,
      p.cost_price, p.selling_price, p.min_stock_level, p.max_stock_level,
      p.supplier_id, p.is_active, p.created_at, p.updated_at,
      c.name as category_name,
      s.name as supplier_name,
      COALESCE(i.current_stock, 0) as current_stock,
      COALESCE(i.reserved_quantity, 0) as reserved_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.id = i.product_id
    ${whereClause}
    ORDER BY p.name
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(query, [...params, Number(limit), offset]);
  const products = rows as any[];

  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    ${whereClause}
  `;
  const [countRows] = await pool.execute(countQuery, params);
  const { total } = (countRows as any[])[0];

  res.json({
    products,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get product by ID or barcode
router.get('/:identifier', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { identifier } = req.params;
  const pool = getPool();

  const [rows] = await pool.execute(`
    SELECT 
      p.id, p.sku, p.barcode, p.name, p.brand, p.description,
      p.category_id, p.size, p.variety, p.color, p.unit,
      p.cost_price, p.selling_price, p.min_stock_level, p.max_stock_level,
      p.supplier_id, p.is_active, p.created_at, p.updated_at,
      c.name as category_name,
      s.name as supplier_name,
      COALESCE(i.current_stock, 0) as current_stock,
      COALESCE(i.reserved_quantity, 0) as reserved_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.id = ? OR p.sku = ? OR p.barcode = ?
  `, [identifier, identifier, identifier]);
  const product = (rows as any[])[0];

  if (!product) {
    throw createError('Product not found', 404);
  }

  res.json(product);
}));

// Create new product with validation
router.post('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Validate input data
  const { error, value } = productSchema.validate(req.body);
  if (error) {
    throw createError(`Validation error: ${error.details[0].message}`, 400);
  }

  // Normalize SKU/barcode: convert empty strings to null so DB unique indexes allow multiple nulls
  const rawSku = value.sku;
  const rawBarcode = value.barcode;
  let sku = rawSku && typeof rawSku === 'string' && rawSku.trim() !== '' ? rawSku.trim() : null;
  const barcode = rawBarcode && typeof rawBarcode === 'string' && rawBarcode.trim() !== '' ? rawBarcode.trim() : null;

  const { name, brand, description, categoryId, size, variety, color, unit,
    costPrice, sellingPrice, minStockLevel, maxStockLevel, supplierId, initialStock } = value;

  const pool = getPool();
  const connection = await pool.getConnection();

  // Auto-generate SKU if not provided
  if (!sku) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    sku = `SKU-${timestamp}-${random}`;
  }

  try {
    await connection.beginTransaction();

    // Check for duplicate SKU or barcode (only when provided and non-null)
    if (sku) {
      const [skuRows] = await connection.execute('SELECT id, sku FROM products WHERE sku = ?', [sku]);
      const duplicateSku = (skuRows as any[])[0];
      if (duplicateSku) {
        await connection.rollback();
        throw createError('Product with this SKU already exists', 409);
      }
    }

    if (barcode) {
      const [barcodeRows] = await connection.execute('SELECT id, barcode FROM products WHERE barcode = ?', [barcode]);
      const duplicateBarcode = (barcodeRows as any[])[0];
      if (duplicateBarcode) {
        await connection.rollback();
        throw createError('Product with this barcode already exists', 409);
      }
    }

    // Validate category exists if provided
    if (categoryId) {
      const [categoryRows] = await connection.execute('SELECT id FROM categories WHERE id = ?', [categoryId]);
      const category = (categoryRows as any[])[0];
      if (!category) {
        await connection.rollback();
        throw createError('Invalid category ID', 400);
      }
    }

    // Validate supplier exists if provided
    if (supplierId) {
      const [supplierRows] = await connection.execute('SELECT id FROM suppliers WHERE id = ? AND is_active = 1', [supplierId]);
      const supplier = (supplierRows as any[])[0];
      if (!supplier) {
        await connection.rollback();
        throw createError('Invalid supplier ID', 400);
      }
    }

    // Validate business logic
    if (costPrice >= sellingPrice) {
      logger.warn(`Product ${sku}: Cost price (${costPrice}) >= selling price (${sellingPrice})`);
    }

    if (minStockLevel > maxStockLevel && maxStockLevel > 0) {
      await connection.rollback();
      throw createError('Minimum stock level cannot be greater than maximum stock level', 400);
      }

    // Insert product
    const [productResult]: any = await connection.execute(`
      INSERT INTO products (
        sku, barcode, name, brand, description, category_id, size, variety, color, unit,
        cost_price, selling_price, min_stock_level, max_stock_level, supplier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sku, barcode || null, name, brand || null, description || null, categoryId || null,
      size || null, variety || null, color || null, unit || null,
      costPrice, sellingPrice, minStockLevel, maxStockLevel, supplierId || null
    ]);

    const productId = productResult.insertId;

    // Initialize inventory if initial stock provided
    if (initialStock > 0) {
      await connection.execute(`
        INSERT INTO inventory (product_id, current_stock, location)
        VALUES (?, ?, 'MAIN')
      `, [productId, initialStock]);

      // Record inventory transaction
      await connection.execute(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, notes, created_by
        ) VALUES (?, 'adjustment', ?, 'Initial stock during product creation', ?)
      `, [productId, initialStock, req.user!.id]);
    } else {
      // Initialize with zero inventory
      await connection.execute(`
        INSERT INTO inventory (product_id, current_stock, location)
        VALUES (?, 0, 'MAIN')
      `, [productId]);
    }

    await connection.commit();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('product-created', { productId, name, sku, user: req.user!.username });

    logger.info(`Product created: ${name} (${sku}) by user ${req.user!.username}`);

    res.status(201).json({
      message: 'Product created successfully',
      productId,
      product: {
        id: productId,
        sku,
        name,
        brand,
        unit,
        costPrice,
        sellingPrice,
        initialStock
      }
    });

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Update product
router.put('/:id', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove fields that shouldn't be updated directly
  delete updateData.id;
  delete updateData.created_at;

  const pool = getPool();

  // Check if product exists
  const [productRows] = await pool.execute('SELECT id, name FROM products WHERE id = ?', [id]);
  const existingProduct = (productRows as any[])[0];
  if (!existingProduct) {
    throw createError('Product not found', 404);
  }

  // Normalize incoming SKU/barcode: convert empty strings to null so unique indexes behave correctly
  try {
    if (Object.prototype.hasOwnProperty.call(updateData, 'sku')) {
      const rawSku = updateData.sku;
      if (typeof rawSku === 'string') {
        const trimmed = rawSku.trim();
        updateData.sku = trimmed === '' ? null : trimmed;
      } else if (rawSku == null) {
        updateData.sku = null;
      }

      if (updateData.sku) {
        const [dupRows] = await pool.execute('SELECT id FROM products WHERE sku = ? AND id != ?', [updateData.sku, id]);
        const dup = (dupRows as any[])[0];
        if (dup) throw createError('Product with this SKU already exists', 409);
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'barcode')) {
      const rawBarcode = updateData.barcode;
      if (typeof rawBarcode === 'string') {
        const trimmed = rawBarcode.trim();
        updateData.barcode = trimmed === '' ? null : trimmed;
      } else if (rawBarcode == null) {
        updateData.barcode = null;
      }

      if (updateData.barcode) {
        const [dupB] = await pool.execute('SELECT id FROM products WHERE barcode = ? AND id != ?', [updateData.barcode, id]);
        const dupBar = (dupB as any[])[0];
        if (dupBar) throw createError('Product with this barcode already exists', 409);
      }
    }
  } catch (err) {
    throw err;
  }

  // Build dynamic update query
  const updateFields = Object.keys(updateData).map(key => `${key} = ?`);
  const updateValues = Object.values(updateData);

  if (updateFields.length === 0) {
    throw createError('No fields to update', 400);
  }

  updateFields.push('updated_at = NOW()');

  const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
  await pool.execute(query, [...updateValues, id]);

  // Emit real-time update
  const io = req.app.get('io');
  io.emit('product-updated', { productId: id, name: existingProduct.name });

  logger.info(`Product updated: ${existingProduct.name} (ID: ${id}) by user ${req.user!.username}`);

  res.json({ message: 'Product updated successfully' });
}));

// Delete product (soft delete)
router.delete('/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = getPool();

  const [productRows] = await pool.execute('SELECT id, name, sku FROM products WHERE id = ?', [id]);
  const product = (productRows as any[])[0];
  if (!product) {
    throw createError('Product not found', 404);
  }

  await pool.execute('UPDATE products SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);

  // Emit real-time update
  const io = req.app.get('io');
  io.emit('product-deleted', { productId: id, name: product.name });

  logger.info(`Product deleted: ${product.name} (${product.sku}) by user ${req.user!.username}`);

  res.json({ message: 'Product deleted successfully' });
}));

// Get product categories
router.get('/categories/list', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const pool = getPool();
  const [rows] = await pool.execute(`
    SELECT id, name, description, parent_id,
           (SELECT name FROM categories WHERE id = c.parent_id) as parent_name
    FROM categories c
    ORDER BY parent_id ASC, name ASC
  `);
  const categories = rows as any[];

  res.json(categories);
}));

// Create category
router.post('/categories', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { name, description, parentId } = req.body;

  if (!name) {
    throw createError('Category name is required', 400);
  }
  const pool = getPool();

  // Prevent duplicate category names (case-insensitive)
  const [existingRows] = await pool.execute('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [name]);
  const existing = (existingRows as any[])[0];
  if (existing) {
    throw createError('A category with this name already exists', 400);
  }

  const [result]: any = await pool.execute(
    'INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)',
    [name, description, parentId || null]
  );

  logger.info(`Category created: ${name} by user ${req.user!.username}`);

  res.status(201).json({
    message: 'Category created successfully',
    categoryId: result.insertId
  });
}));

// Update category
router.put('/categories/:id', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { name, description, parentId } = req.body;

  if (!name) {
    throw createError('Category name is required', 400);
  }

  const pool = getPool();

  // Check if category exists
  const [existingRows] = await pool.execute('SELECT id FROM categories WHERE id = ?', [id]);
  const existingCat = (existingRows as any[])[0];
  if (!existingCat) {
    throw createError('Category not found', 404);
  }

  // Prevent duplicate name (exclude current)
  const [duplicateRows] = await pool.execute('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?', [name, id]);
  const duplicate = (duplicateRows as any[])[0];
  if (duplicate) {
    throw createError('A category with this name already exists', 400);
  }

  await pool.execute('UPDATE categories SET name = ?, description = ?, parent_id = ? WHERE id = ?', [name, description || null, parentId || null, id]);

  logger.info(`Category updated: ${name} (ID: ${id}) by user ${req.user!.username}`);

  res.json({ message: 'Category updated successfully' });
}));

// Delete category (only if no child categories or products)
router.delete('/categories/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = getPool();

  const [categoryRows] = await pool.execute('SELECT id, name FROM categories WHERE id = ?', [id]);
  const category = (categoryRows as any[])[0];
  if (!category) {
    throw createError('Category not found', 404);
  }

  // Check for child categories
  const [childRows] = await pool.execute('SELECT id FROM categories WHERE parent_id = ?', [id]);
  const child = (childRows as any[])[0];
  if (child) {
    throw createError('Cannot delete category with subcategories. Reassign or remove them first.', 400);
  }

  // Check for products assigned to this category
  const [productRows] = await pool.execute('SELECT id FROM products WHERE category_id = ?', [id]);
  const product = (productRows as any[])[0];
  if (product) {
    throw createError('Cannot delete category that has products assigned. Reassign or remove products first.', 400);
  }

  await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

  logger.info(`Category deleted: ${category.name} (ID: ${id}) by user ${req.user!.username}`);

  res.json({ message: 'Category deleted successfully' });
}));

// Bulk update products
router.put('/bulk-update', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = bulkUpdateSchema.validate(req.body);
  if (error) {
    throw createError(`Validation error: ${error.details[0].message}`, 400);
  }

  const { productIds, updates } = value;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verify all products exist and get their names for logging
    const [productRows] = await connection.execute(`
      SELECT id, name, sku FROM products 
      WHERE id IN (${productIds.map(() => '?').join(',')})
    `, productIds);
    const products = productRows as any[];

    if (products.length !== productIds.length) {
      await connection.rollback();
      throw createError('One or more products not found', 404);
    }

    // Build dynamic update query
    const updateFields = Object.keys(updates).map(key => {
      switch (key) {
        case 'categoryId': return 'category_id = ?';
        case 'supplierId': return 'supplier_id = ?';
        case 'costPrice': return 'cost_price = ?';
        case 'sellingPrice': return 'selling_price = ?';
        case 'minStockLevel': return 'min_stock_level = ?';
        case 'maxStockLevel': return 'max_stock_level = ?';
        case 'isActive': return 'is_active = ?';
        default: return `${key} = ?`;
      }
    });

    updateFields.push('updated_at = NOW()');
    
    const updateValues = Object.values(updates);
    const query = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id IN (${productIds.map(() => '?').join(',')})
    `;

    await connection.execute(query, [...updateValues, ...productIds]);

    await connection.commit();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('products-bulk-updated', {
      productIds,
      updates,
      updatedBy: req.user!.username,
      count: productIds.length
    });

    logger.info(`Bulk update applied to ${productIds.length} products by user ${req.user!.username}`, {
      productIds,
      updates
    });

    res.json({
      message: `Successfully updated ${productIds.length} products`,
      updatedProducts: products.map(p => ({ id: p.id, name: p.name, sku: p.sku }))
    });

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Bulk delete products (soft delete with confirmation)
router.delete('/bulk-delete', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { productIds, confirmationCode } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    throw createError('Product IDs array is required', 400);
  }

  // Require confirmation code for bulk delete operations
  const expectedCode = `DELETE-${productIds.length}-PRODUCTS`;
  if (confirmationCode !== expectedCode) {
    throw createError(`Confirmation required. Please provide confirmation code: ${expectedCode}`, 400);
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get products to be deleted for logging
    const [productRows] = await connection.execute(`
      SELECT id, name, sku FROM products 
      WHERE id IN (${productIds.map(() => '?').join(',')})
    `, productIds);
    const products = productRows as any[];

    if (products.length === 0) {
      await connection.rollback();
      throw createError('No products found with the provided IDs', 404);
    }

    // Check if any products have recent sales (last 30 days) - safety check
    const [salesRows] = await connection.execute(`
      SELECT COUNT(*) as count FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE si.product_id IN (${productIds.map(() => '?').join(',')})
      AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, productIds);
    const recentSales = (salesRows as any[])[0];

    if (recentSales.count > 0) {
      await connection.rollback();
      throw createError('Cannot delete products with sales in the last 30 days. Consider deactivating instead.', 400);
    }

    // Soft delete products
    await connection.execute(`
      UPDATE products 
      SET is_active = 0, updated_at = NOW() 
      WHERE id IN (${productIds.map(() => '?').join(',')})
    `, productIds);

    await connection.commit();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('products-bulk-deleted', {
      productIds,
      deletedBy: req.user!.username,
      count: products.length
    });

    logger.warn(`Bulk deletion: ${products.length} products deactivated by user ${req.user!.username}`, {
      products: products.map(p => ({ id: p.id, name: p.name, sku: p.sku }))
    });

    res.json({
      message: `Successfully deactivated ${products.length} products`,
      deletedProducts: products
    });

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Generate barcode for product
router.post('/:id/generate-barcode', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = getPool();

  const [productRows] = await pool.execute('SELECT id, name, sku, barcode FROM products WHERE id = ?', [id]);
  const product = (productRows as any[])[0];
  if (!product) {
    throw createError('Product not found', 404);
  }

  if (product.barcode) {
    throw createError('Product already has a barcode', 400);
  }

  // Generate EAN-13 compatible barcode (simplified version)
  const timestamp = Date.now().toString();
  const productCode = id.toString().padStart(4, '0');
  const barcode = `20${productCode}${timestamp.slice(-6)}`;

  // Check if generated barcode is unique
  const [existingRows] = await pool.execute('SELECT id FROM products WHERE barcode = ?', [barcode]);
  const existing = (existingRows as any[])[0];
  if (existing) {
    throw createError('Generated barcode conflicts with existing product', 500);
  }

  await pool.execute('UPDATE products SET barcode = ?, updated_at = NOW() WHERE id = ?', [barcode, id]);

  logger.info(`Barcode generated for product: ${product.name} (${product.sku}) - ${barcode} by user ${req.user!.username}`);

  res.json({
    message: 'Barcode generated successfully',
    barcode,
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku
    }
  });
}));

// Export products to CSV
router.get('/export/csv', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { category, active_only = 'true' } = req.query;
  const pool = getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (active_only === 'true') {
    whereClause += ' AND p.is_active = 1';
  }

  if (category) {
    whereClause += ' AND p.category_id = ?';
    params.push(category);
  }

  const [rows] = await pool.execute(`
    SELECT 
      p.sku,
      p.barcode,
      p.name,
      p.brand,
      p.description,
      c.name as category_name,
      p.size,
      p.variety,
      p.color,
      p.unit,
      p.cost_price,
      p.selling_price,
      p.min_stock_level,
      p.max_stock_level,
      s.name as supplier_name,
      COALESCE(i.current_stock, 0) as current_stock,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.id = i.product_id
    ${whereClause}
    ORDER BY p.name
  `, params);
  const products = rows as any[];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `products-export-${timestamp}.csv`;
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
      { id: 'barcode', title: 'Barcode' },
      { id: 'name', title: 'Name' },
      { id: 'brand', title: 'Brand' },
      { id: 'category_name', title: 'Category' },
      { id: 'size', title: 'Size' },
      { id: 'variety', title: 'Variety' },
      { id: 'color', title: 'Color' },
      { id: 'unit', title: 'Unit' },
      { id: 'cost_price', title: 'Cost_Price' },
      { id: 'selling_price', title: 'Selling_Price' },
      { id: 'min_stock_level', title: 'Min_Stock_Level' },
      { id: 'max_stock_level', title: 'Max_Stock_Level' },
      { id: 'current_stock', title: 'Initial_Stock' },
      { id: 'description', title: 'Description' },
      { id: 'supplier_name', title: 'Supplier' },
      { id: 'created_at', title: 'Created Date' },
      { id: 'updated_at', title: 'Updated Date' }
    ]
  });

  await csvWriter.writeRecords(products);

  logger.info(`Products exported to CSV by user ${req.user!.username}: ${products.length} records`);

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

// Download Excel import template
router.get('/import/template', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const pool = getPool();
  
  // Get sample data from database
  const [categories]: any = await pool.execute('SELECT name FROM categories LIMIT 3');
  const [suppliers]: any = await pool.execute('SELECT name FROM suppliers LIMIT 3');
  
  const categoryNames = categories.map((c: any) => c.name);
  const supplierNames = suppliers.map((s: any) => s.name);
  
  // Create template with example data
  const templateData = [
    {
      SKU: 'EXAMPLE-001',
      Barcode: '1234567890123',
      Name: 'Example Product',
      Brand: 'Example Brand',
      Category: categoryNames[0] || 'Hardware',
      Size: "'3/4 inch",  // Use apostrophe prefix to prevent Excel auto-formatting
      Variety: 'Standard',
      Color: 'Red',
      Unit: 'pcs',
      Cost_Price: 5.00,
      Selling_Price: 10.00,
      Min_Stock_Level: 10,
      Max_Stock_Level: 100,
      Initial_Stock: 50,
      Description: 'Example product description',
      Supplier: supplierNames[0] || 'Example Supplier'
    },
    {
      SKU: 'EXAMPLE-002',
      Barcode: '1234567890124',
      Name: 'Example Product',
      Brand: 'Example Brand',
      Category: categoryNames[0] || 'Hardware',
      Size: '15mm',
      Variety: 'Standard',
      Color: 'Blue',
      Unit: 'pcs',
      Cost_Price: 6.00,
      Selling_Price: 12.00,
      Min_Stock_Level: 10,
      Max_Stock_Level: 100,
      Initial_Stock: 50,
      Description: 'Example product description',
      Supplier: supplierNames[0] || 'Example Supplier'
    }
  ];

  // Create workbook
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(templateData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // SKU
    { wch: 15 }, // Barcode
    { wch: 25 }, // Name
    { wch: 15 }, // Brand
    { wch: 15 }, // Category
    { wch: 12 }, // Size
    { wch: 12 }, // Variety
    { wch: 12 }, // Color
    { wch: 8 },  // Unit
    { wch: 12 }, // Cost_Price
    { wch: 12 }, // Selling_Price
    { wch: 15 }, // Min_Stock_Level
    { wch: 15 }, // Max_Stock_Level
    { wch: 15 }, // Initial_Stock
    { wch: 30 }, // Description
    { wch: 20 }  // Supplier
  ];
  
  xlsx.utils.book_append_sheet(wb, ws, 'Products');
  
  // Generate buffer
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');
  res.send(buffer);
}));

// Import products from CSV/Excel
router.post('/import', requireRole(['admin', 'manager']), upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.file) {
    throw createError('No file uploaded', 400);
  }

  const { validateOnly = 'false' } = req.body;
  const pool = getPool();
  
  let products: any[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.info(`Starting import process. File: ${req.file.originalname}, Size: ${req.file.size} bytes`);

  try {
    // Parse file based on type
    if (req.file.mimetype.includes('sheet') || req.file.mimetype.includes('excel')) {
      // Excel file
      logger.info('Parsing Excel file...');
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      products = xlsx.utils.sheet_to_json(worksheet);
      logger.info(`Parsed ${products.length} rows from Excel`);
    } else {
      // CSV file
      logger.info('Parsing CSV file...');
      products = await new Promise((resolve, reject) => {
        const results: any[] = [];
        createReadStream(req.file!.path)
          .pipe(csvParser())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
      logger.info(`Parsed ${products.length} rows from CSV`);
    }

    if (products.length === 0) {
      throw createError('No data found in uploaded file', 400);
    }

    if (products.length > 1000) {
      throw createError('Maximum 1000 products allowed per import', 400);
    }

    // Validate and process each product
    const validProducts: any[] = [];
    const duplicateSkus = new Set();
    const duplicateBarcodes = new Set();

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNum = i + 2; // Account for header row

      try {
        // Map CSV columns to our schema (handle different column name variations)
        const productData = {
          sku: row.SKU || row.sku || row['Product SKU'],
          barcode: row.Barcode || row.barcode || row['Barcode'],
          name: row.Name || row.name || row['Product Name'],
          brand: row.Brand || row.brand,
          description: row.Description || row.description,
          categoryId: row['Category ID'] || row.categoryId || null,
          categoryName: row.Category || row.category || row['Category Name'] || null,
          // Convert to string to handle Excel auto-formatting (e.g., 3/4 becomes date)
          size: row.Size || row.size ? String(row.Size || row.size) : null,
          variety: row.Variety || row.variety ? String(row.Variety || row.variety) : null,
          color: row.Color || row.color ? String(row.Color || row.color) : null,
          unit: row.Unit || row.unit ? String(row.Unit || row.unit) : 'each', // Default to 'each' if not provided
          costPrice: parseFloat(row.Cost_Price || row['Cost Price'] || row.costPrice || '0'),
          sellingPrice: parseFloat(row.Selling_Price || row['Selling Price'] || row.sellingPrice || '0'),
          minStockLevel: parseInt(row.Min_Stock_Level || row['Min Stock'] || row.minStockLevel || '0'),
          maxStockLevel: parseInt(row.Max_Stock_Level || row['Max Stock'] || row.maxStockLevel || '0'),
          supplierId: row['Supplier ID'] || row.supplierId || null,
          supplierName: row.Supplier || row.supplier || row['Supplier Name'] || null,
          initialStock: parseInt(row.Initial_Stock || row['Initial Stock'] || row.initialStock || '0')
        };

        // Validate required fields (only Name is required now)
        if (!productData.name) {
          errors.push(`Row ${rowNum}: Missing required field: Name`);
          continue;
        }

        if (productData.costPrice <= 0 || productData.sellingPrice <= 0) {
          errors.push(`Row ${rowNum}: Cost price (${productData.costPrice}) and selling price (${productData.sellingPrice}) must be greater than 0`);
          continue;
        }

        // Check for duplicates within the import (only if SKU provided)
        if (productData.sku && duplicateSkus.has(productData.sku)) {
          errors.push(`Row ${rowNum}: Duplicate SKU in import file: ${productData.sku}`);
          continue;
        }
        if (productData.sku) {
          duplicateSkus.add(productData.sku);
        }

        if (productData.barcode && duplicateBarcodes.has(productData.barcode)) {
          errors.push(`Row ${rowNum}: Duplicate barcode in import file: ${productData.barcode}`);
          continue;
        }
        if (productData.barcode) {
          duplicateBarcodes.add(productData.barcode);
        }

        // Validate schema
        const { error, value } = productSchema.validate(productData);
        if (error) {
          errors.push(`Row ${rowNum}: ${error.details[0].message}`);
          continue;
        }

        // Business logic warnings
        if (value.costPrice >= value.sellingPrice) {
          warnings.push(`Row ${rowNum}: Cost price >= selling price for ${value.name}`);
        }

        validProducts.push({ ...value, rowNum });

      } catch (err: any) {
        errors.push(`Row ${rowNum}: Error processing row - ${err?.message || 'Unknown error'}`);
      }
    }

    // If validation only, return results without importing
    if (validateOnly === 'true') {
      res.json({
        message: 'Validation completed',
        totalRows: products.length,
        validProducts: validProducts.length,
        errors: errors.length,
        warnings: warnings.length,
        details: { errors, warnings }
      });
      return;
    }

    if (errors.length > 0) {
      // Return detailed error information to help users fix their import file
      logger.warn(`Import validation failed: ${errors.length} errors found`);
      res.status(400).json({
        success: false,
        error: `Import contains ${errors.length} errors`,
        totalRows: products.length,
        successCount: 0,
        errorCount: errors.length,
        errors: errors.map((err, idx) => ({
          row: idx + 1,
          error: err,
          data: null
        }))
      });
      return;
    }

    if (validProducts.length === 0) {
      logger.warn('No valid products to import');
      throw createError('No valid products to import', 400);
    }

    logger.info(`Validation complete. Valid products: ${validProducts.length}`);

    // Check for existing SKUs/barcodes in database (only check products with SKU)
    const productsWithSku = validProducts.filter(p => p.sku);
    if (productsWithSku.length > 0) {
      const [skuRows] = await pool.execute(`
        SELECT sku FROM products WHERE sku IN (${productsWithSku.map(() => '?').join(',')})
      `, productsWithSku.map(p => p.sku));
      const existingSkus = skuRows as any[];

      if (existingSkus.length > 0) {
        throw createError(`Existing SKUs found in database: ${existingSkus.map(s => s.sku).join(', ')}`, 409);
      }
    }

    const productsWithBarcode = validProducts.filter(p => p.barcode);
    if (productsWithBarcode.length > 0) {
      const [barcodeRows] = await pool.execute(`
        SELECT barcode FROM products WHERE barcode IN (${productsWithBarcode.map(() => '?').join(',')})
      `, productsWithBarcode.map(p => p.barcode));
      const existingBarcodes = barcodeRows as any[];

      if (existingBarcodes.length > 0) {
        throw createError(`Existing barcodes found in database: ${existingBarcodes.map(b => b.barcode).join(', ')}`, 409);
      }
    }

    // Begin import transaction
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Create maps to cache category and supplier lookups
      const categoryMap = new Map<string, number>();
      const supplierMap = new Map<string, number>();

      let importedCount = 0;
      const importedProducts: any[] = [];

      for (const product of validProducts) {
        try {
          // Auto-generate SKU if not provided
          if (!product.sku) {
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            product.sku = `SKU-${timestamp}-${random}`;
          }

          // Resolve category ID from name if needed
          if (product.categoryName && !product.categoryId) {
            const categoryKey = product.categoryName.toLowerCase().trim();
            
            if (!categoryMap.has(categoryKey)) {
              // Check if category exists
              const [existingCategory]: any = await connection.execute(
                'SELECT id FROM categories WHERE LOWER(name) = ?',
                [categoryKey]
              );
              
              if (existingCategory.length > 0) {
                categoryMap.set(categoryKey, existingCategory[0].id);
              } else {
                // Create new category
                const [categoryResult]: any = await connection.execute(
                  'INSERT INTO categories (name, description) VALUES (?, ?)',
                  [product.categoryName, `Auto-created from import`]
                );
                categoryMap.set(categoryKey, categoryResult.insertId);
                logger.info(`Created new category: ${product.categoryName}`);
              }
            }
            
            product.categoryId = categoryMap.get(categoryKey);
          }

          // Resolve supplier ID from name if needed
          if (product.supplierName && !product.supplierId) {
            const supplierKey = product.supplierName.toLowerCase().trim();
            
            if (!supplierMap.has(supplierKey)) {
              // Check if supplier exists
              const [existingSupplier]: any = await connection.execute(
                'SELECT id FROM suppliers WHERE LOWER(name) = ?',
                [supplierKey]
              );
              
              if (existingSupplier.length > 0) {
                supplierMap.set(supplierKey, existingSupplier[0].id);
              } else {
                // Create new supplier with minimal required fields
                const [supplierResult]: any = await connection.execute(
                  'INSERT INTO suppliers (name, contact_person, email, phone) VALUES (?, ?, ?, ?)',
                  [product.supplierName, 'Auto-created', 'update@required.com', '000-000-0000']
                );
                supplierMap.set(supplierKey, supplierResult.insertId);
                logger.info(`Created new supplier: ${product.supplierName}`);
              }
            }
            
            product.supplierId = supplierMap.get(supplierKey);
          }

          // Insert product (ensure unit has a default value)
          const [result]: any = await connection.execute(`
            INSERT INTO products (
              sku, barcode, name, brand, description, category_id, size, variety, color, unit,
              cost_price, selling_price, min_stock_level, max_stock_level, supplier_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            product.sku, product.barcode || null, product.name, product.brand || null,
            product.description || null, product.categoryId || null, product.size || null,
            product.variety || null, product.color || null, product.unit || 'each',
            product.costPrice, product.sellingPrice, product.minStockLevel,
            product.maxStockLevel, product.supplierId || null
          ]);

          const productId = result.insertId;

          // Initialize inventory using REPLACE to avoid duplicates
          await connection.execute(`
            REPLACE INTO inventory (product_id, current_stock, location)
            VALUES (?, ?, 'MAIN')
          `, [productId, product.initialStock]);

          if (product.initialStock > 0) {
            // Record inventory transaction
            await connection.execute(`
              INSERT INTO inventory_transactions (
                product_id, transaction_type, quantity_change, notes, created_by
              ) VALUES (?, 'adjustment', ?, 'Initial stock from import', ?)
            `, [productId, product.initialStock, req.user!.id]);
          }

          importedProducts.push({
            id: productId,
            sku: product.sku,
            name: product.name,
            initialStock: product.initialStock
          });

          importedCount++;

        } catch (err: any) {
          logger.error(`Error importing product ${product.sku || product.name} (Row ${product.rowNum}):`, err);
          await connection.rollback();
          throw createError(`Error importing product "${product.name}" (Row ${product.rowNum}): ${err?.message || 'Unknown error'}`, 500);
        }
      }

      await connection.commit();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('products-imported', {
      count: importedCount,
      importedBy: req.user!.username,
      timestamp: new Date().toISOString()
    });

      logger.info(`Products imported successfully by user ${req.user!.username}: ${importedCount} products`);

      res.json({
        success: true,
        message: 'Import completed successfully',
        importedCount,
        successCount: importedCount,
        errorCount: 0,
        totalRows: products.length,
        warnings: warnings.length,
        warningDetails: warnings,
        importedProducts
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    throw error;
  } finally {
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
}));

export default router;