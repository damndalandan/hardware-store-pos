import express from 'express';
import Joi from 'joi';
import { getPool, withTransaction } from '../database/connection';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const supplierSchema = Joi.object({
  name: Joi.string().required().min(2).max(255).trim(),
  contactPerson: Joi.string().allow('', null).max(255).trim(),
  email: Joi.string().email().allow('', null).max(255).trim(),
  phone: Joi.string().allow('', null).max(50).trim(),
  address: Joi.string().allow('', null).max(500).trim(),
  city: Joi.string().allow('', null).max(100).trim(),
  state: Joi.string().allow('', null).max(100).trim(),
  zipCode: Joi.string().allow('', null).max(20).trim(),
  country: Joi.string().allow('', null).max(100).trim(),
  taxId: Joi.string().allow('', null).max(50).trim(),
  website: Joi.string().allow('', null).max(255).trim(),
  notes: Joi.string().allow('', null).max(1000).trim(),
  paymentTerms: Joi.string().allow('', null).max(100).trim(),
  creditLimit: Joi.number().min(0).allow(null),
  isActive: Joi.boolean().default(true)
});

// Get all suppliers with filtering and pagination
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    page = 1,
    limit = 50,
    search,
    city,
    state,
    country,
    is_active = 'true',
    sort_by = 'name',
    sort_order = 'ASC'
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const pool = await getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (is_active !== 'all') {
    whereClause += ' AND s.is_active = ?';
    params.push(is_active === 'true' ? 1 : 0);
  }

  if (search) {
    whereClause += ' AND (s.name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (city) {
    whereClause += ' AND s.city = ?';
    params.push(city);
  }

  if (state) {
    whereClause += ' AND s.state = ?';
    params.push(state);
  }

  if (country) {
    whereClause += ' AND s.country = ?';
    params.push(country);
  }

  const validSortColumns = ['name', 'contact_person', 'city', 'state', 'created_at'];
  const sortColumn = validSortColumns.includes(sort_by as string) ? sort_by : 'name';
  const sortDirection = sort_order === 'DESC' ? 'DESC' : 'ASC';

  // Get suppliers with purchase order stats
  const [rows] = await pool.execute(`
    SELECT 
      s.*,
      COUNT(DISTINCT po.id) as total_orders,
      SUM(CASE WHEN po.status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN po.status = 'completed' THEN po.total_amount ELSE 0 END) as total_purchased,
      MAX(po.order_date) as last_order_date,
      COUNT(DISTINCT p.id) as product_count
    FROM suppliers s
    LEFT JOIN purchase_orders po ON s.id = po.supplier_id
    LEFT JOIN products p ON s.id = p.supplier_id
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.${sortColumn} ${sortDirection}
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const suppliers = rows as any[];

  // Get total count
  const [countRows] = await pool.execute(`
    SELECT COUNT(*) as total FROM suppliers s ${whereClause}
  `, params);
  const { total } = (countRows as any[])[0];

  res.json({
    suppliers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get supplier by ID with detailed information
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = await getPool();

  const [supplierRows] = await pool.execute(`
    SELECT 
      s.*,
      COUNT(DISTINCT po.id) as total_orders,
      SUM(CASE WHEN po.status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN po.status = 'completed' THEN po.total_amount ELSE 0 END) as total_purchased,
      MAX(po.order_date) as last_order_date,
      COUNT(DISTINCT p.id) as product_count
    FROM suppliers s
    LEFT JOIN purchase_orders po ON s.id = po.supplier_id
    LEFT JOIN products p ON s.id = p.supplier_id
    WHERE s.id = ?
    GROUP BY s.id
  `, [id]);
  const supplier = (supplierRows as any[])[0];

  if (!supplier) {
    throw createError('Supplier not found', 404);
  }

  // Get recent purchase orders
  const [orderRows] = await pool.execute(`
    SELECT id, po_number as order_number, order_date, status, total_amount
    FROM purchase_orders
    WHERE supplier_id = ?
    ORDER BY order_date DESC
    LIMIT 10
  `, [id]);
  const recentOrders = orderRows as any[];

  // Get products from this supplier
  const [productRows] = await pool.execute(`
    SELECT id, name, sku, brand, selling_price, cost_price, is_active
    FROM products
    WHERE supplier_id = ?
    ORDER BY name
    LIMIT 50
  `, [id]);
  const products = productRows as any[];

  res.json({
    ...supplier,
    recentOrders,
    products
  });
}));

// Create supplier
router.post('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = supplierSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const {
    name, contactPerson, email, phone, address, city, state, zipCode, country,
    taxId, website, notes, paymentTerms, creditLimit, isActive
  } = value;

  const pool = await getPool();

  // Check for duplicate supplier name
  const [existingRows] = await pool.execute(
    'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?) AND is_active = 1',
    [name]
  );
  const existingSupplier = (existingRows as any[])[0];

  if (existingSupplier) {
    throw createError('A supplier with this name already exists', 400);
  }

  const result = await withTransaction(async (connection) => {
    const [supplierResult] = await connection.execute(`
      INSERT INTO suppliers (
        name, contact_person, email, phone, address, city, state, zip_code, country,
        tax_id, website, notes, payment_terms, credit_limit, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, contactPerson, email, phone, address, city, state, zipCode, country,
      taxId, website, notes, paymentTerms, creditLimit, isActive ? 1 : 0, req.user?.id || null
    ]) as any;

    logger.info(`Supplier created: ${name} by ${req.user?.username || 'unknown'}`);
    return supplierResult;
  });

  res.status(201).json({
    message: 'Supplier created successfully',
    supplierId: result.insertId
  });
}));

// Update supplier
router.put('/:id', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { error, value } = supplierSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const {
    name, contactPerson, email, phone, address, city, state, zipCode, country,
    taxId, website, notes, paymentTerms, creditLimit, isActive
  } = value;

  const pool = await getPool();

  // Check if supplier exists
  const [existingRows] = await pool.execute('SELECT id FROM suppliers WHERE id = ?', [id]);
  const existingSupplier = (existingRows as any[])[0];
  if (!existingSupplier) {
    throw createError('Supplier not found', 404);
  }

  // Check for duplicate name (excluding current supplier)
  const [duplicateRows] = await pool.execute(
    'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?) AND id != ? AND is_active = 1',
    [name, id]
  );
  const duplicateSupplier = (duplicateRows as any[])[0];

  if (duplicateSupplier) {
    throw createError('A supplier with this name already exists', 400);
  }

  await withTransaction(async (connection) => {
    await connection.execute(`
      UPDATE suppliers SET
        name = ?, contact_person = ?, email = ?, phone = ?, address = ?,
        city = ?, state = ?, zip_code = ?, country = ?, tax_id = ?,
        website = ?, notes = ?, payment_terms = ?, credit_limit = ?,
        is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, contactPerson, email, phone, address, city, state, zipCode, country,
      taxId, website, notes, paymentTerms, creditLimit, isActive ? 1 : 0, id
    ]);

    logger.info(`Supplier updated: ${name} by ${req.user!.username}`);
  });

  res.json({ message: 'Supplier updated successfully' });
}));

// Delete supplier (soft delete)
router.delete('/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = await getPool();

  const [supplierRows] = await pool.execute('SELECT name FROM suppliers WHERE id = ?', [id]);
  const supplier = (supplierRows as any[])[0];
  if (!supplier) {
    throw createError('Supplier not found', 404);
  }

  // Check if supplier has active purchase orders
  const [activePORows] = await pool.execute(
    "SELECT id FROM purchase_orders WHERE supplier_id = ? AND status IN ('pending', 'ordered')",
    [id]
  );
  const activePO = (activePORows as any[])[0];

  if (activePO) {
    throw createError('Cannot delete supplier with active purchase orders', 400);
  }

  await withTransaction(async (connection) => {
    await connection.execute(
      'UPDATE suppliers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    logger.info(`Supplier deleted: ${supplier.name} by ${req.user!.username}`);
  });

  res.json({ message: 'Supplier deleted successfully' });
}));

// Get supplier analytics
router.get('/analytics/summary', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    start_date = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0],
    supplier_id
  } = req.query;

  const pool = await getPool();
  let whereClause = 'WHERE po.order_date >= DATE(?) AND po.order_date <= DATE(?)';
  let params = [start_date, end_date];

  if (supplier_id) {
    whereClause += ' AND po.supplier_id = ?';
    params.push(supplier_id as string);
  }

  // Get purchase order summary
  const [summaryRows] = await pool.execute(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(po.total_amount) as total_spent,
      AVG(po.total_amount) as average_order,
      COUNT(DISTINCT po.supplier_id) as active_suppliers
    FROM purchase_orders po
    ${whereClause}
  `, params);
  const summary = (summaryRows as any[])[0];

  // Get top suppliers by spending
  const [topRows] = await pool.execute(`
    SELECT 
      s.name,
      s.city,
      s.state,
      COUNT(po.id) as order_count,
      SUM(po.total_amount) as total_spent,
      AVG(po.total_amount) as average_order,
      MAX(po.order_date) as last_order_date
    FROM suppliers s
    JOIN purchase_orders po ON s.id = po.supplier_id
    ${whereClause}
    GROUP BY s.id
    ORDER BY total_spent DESC
    LIMIT 20
  `, params);
  const topSuppliers = topRows as any[];

  // Get monthly spending trend
  const [trendRows] = await pool.execute(`
    SELECT 
      DATE_FORMAT(po.order_date, '%Y-%m') as month,
      COUNT(*) as order_count,
      SUM(po.total_amount) as total_spent
    FROM purchase_orders po
    ${whereClause}
    GROUP BY DATE_FORMAT(po.order_date, '%Y-%m')
    ORDER BY month DESC
    LIMIT 12
  `, params);
  const monthlyTrend = trendRows as any[];

  // Get supplier performance metrics
  const [perfRows] = await pool.execute(`
    SELECT 
      s.name,
      COUNT(po.id) as total_orders,
      AVG(CASE WHEN po.status = 'completed' THEN 
        DATEDIFF(po.received_date, po.order_date)
      END) as avg_delivery_days,
      (COUNT(CASE WHEN po.status = 'completed' THEN 1 END) * 100.0 / COUNT(*)) as completion_rate
    FROM suppliers s
    JOIN purchase_orders po ON s.id = po.supplier_id
    ${whereClause}
    GROUP BY s.id
    HAVING total_orders >= 3
    ORDER BY completion_rate DESC, avg_delivery_days ASC
  `, params);
  const performance = perfRows as any[];

  res.json({
    summary: {
      ...summary,
      period: { start_date, end_date }
    },
    topSuppliers,
    monthlyTrend,
    performance
  });
}));

// Bulk operations
router.post('/bulk-update', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { supplierIds, updates } = req.body;

  if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
    throw createError('Supplier IDs are required', 400);
  }

  const allowedUpdates = ['is_active', 'payment_terms', 'credit_limit'];
  const validUpdates = Object.keys(updates).filter(key => allowedUpdates.includes(key));

  if (validUpdates.length === 0) {
    throw createError('No valid updates provided', 400);
  }

  let updatedCount = 0;

  await withTransaction(async (connection) => {
    for (const supplierId of supplierIds) {
      const setClause = validUpdates.map(key => `${key} = ?`).join(', ');
      const values = validUpdates.map(key => updates[key]);
      values.push(supplierId);

      const [result] = await connection.execute(`
        UPDATE suppliers 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, values) as any;

      if (result.affectedRows && result.affectedRows > 0) {
        updatedCount++;
      }
    }

    logger.info(`Bulk updated ${updatedCount} suppliers by ${req.user!.username}`);
  });

  res.json({
    message: `Successfully updated ${updatedCount} suppliers`,
    updatedCount
  });
}));

// Export suppliers
router.get('/export/:format', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { format } = req.params;
  const { is_active = 'true', include_stats = 'false' } = req.query;

  if (!['csv', 'excel'].includes(format)) {
    throw createError('Invalid export format. Use csv or excel', 400);
  }

  const pool = await getPool();
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (is_active !== 'all') {
    whereClause += ' AND s.is_active = ?';
    params.push(is_active === 'true' ? 1 : 0);
  }

  let suppliersData;
  if (include_stats === 'true') {
    const [rows] = await pool.execute(`
      SELECT 
        s.name,
        s.contact_person,
        s.email,
        s.phone,
        s.address,
        s.city,
        s.state,
        s.zip_code,
        s.country,
        s.payment_terms,
        s.credit_limit,
        s.is_active,
        COUNT(DISTINCT po.id) as total_orders,
        SUM(CASE WHEN po.status = 'completed' THEN po.total_amount ELSE 0 END) as total_purchased,
        COUNT(DISTINCT p.id) as product_count,
        MAX(po.order_date) as last_order_date
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      LEFT JOIN products p ON s.id = p.supplier_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.name
    `, params);
    suppliersData = rows as any[];
  } else {
    const [simpleRows] = await pool.execute(`
      SELECT 
        name, contact_person, email, phone, address, city, state, zip_code, country,
        tax_id, website, payment_terms, credit_limit, notes, is_active
      FROM suppliers s
      ${whereClause}
      ORDER BY name
    `, params);
    suppliersData = simpleRows as any[];
  }

  if (format === 'csv') {
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const path = require('path');
    const fs = require('fs').promises;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `suppliers-export-${timestamp}.csv`;
    const filepath = path.join(__dirname, '../../uploads', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const csvWriter = createCsvWriter({
      path: filepath,
      header: Object.keys(suppliersData[0] || {}).map(key => ({ id: key, title: key.replace(/_/g, ' ').toUpperCase() }))
    });
    
    await csvWriter.writeRecords(suppliersData);
    
    res.download(filepath, filename, (err) => {
      if (err) logger.error('Error downloading suppliers export:', err);
      fs.unlink(filepath).catch(console.error);
    });
  } else {
    const XLSX = require('xlsx');
    const path = require('path');
    const fs = require('fs').promises;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `suppliers-export-${timestamp}.xlsx`;
    const filepath = path.join(__dirname, '../../uploads', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const ws = XLSX.utils.json_to_sheet(suppliersData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers Export');
    
    XLSX.writeFile(wb, filepath);
    
    res.download(filepath, filename, (err) => {
      if (err) logger.error('Error downloading suppliers export:', err);
      fs.unlink(filepath).catch(console.error);
    });
  }
}));

export default router;