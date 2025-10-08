import { Router, Request, Response } from 'express';
import { getPool } from '../database/connection';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

// Get customers with A/R account data (JOIN with customer_accounts)
router.get('/with-ar', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { search, page = 1, limit = 100, hasArOnly } = req.query;
  const pool = getPool();

  let query = `
    SELECT 
      c.id,
      c.customer_name,
      c.phone,
      c.email,
      c.address,
      c.notes,
      c.total_purchases,
      c.last_purchase_date,
      c.created_at,
      ca.customer_code,
      ca.current_balance,
      ca.credit_limit,
      ca.is_active
    FROM customers c
    LEFT JOIN customer_accounts ca ON c.customer_name = ca.customer_name
    WHERE 1=1
  `;
  
  const params: any[] = [];

  // Filter only customers with A/R accounts if requested
  if (hasArOnly === 'true') {
    query += ' AND ca.id IS NOT NULL';
  }
  
  if (search) {
    query += ' AND (c.customer_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR ca.customer_code LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // Get total count for pagination
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
  const [countResult] = await pool.execute(countQuery, params);
  const total = (countResult as any[])[0]?.total || 0;

  // Add pagination
  const offset = (Number(page) - 1) * Number(limit);
  query += ' ORDER BY c.last_purchase_date DESC, c.customer_name ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  const [customers] = await pool.execute(query, params);

  res.json({
    customers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get all customers (for autocomplete and listing)
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { search, page = 1, limit = 100 } = req.query;
  const pool = getPool();

  let query = `
    SELECT 
      id,
      customer_name,
      phone,
      email,
      address,
      notes,
      total_purchases,
      last_purchase_date,
      created_at
    FROM customers
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (search) {
    query += ' AND (customer_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Get total count for pagination
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
  const [countResult] = await pool.execute(countQuery, params);
  const total = (countResult as any[])[0].total;

  // Add pagination
  const offset = (Number(page) - 1) * Number(limit);
  query += ' ORDER BY last_purchase_date DESC, customer_name ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  const [customers] = await pool.execute(query, params);

  res.json({
    customers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get or create customer by name
router.post('/find-or-create', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { customerName, phone, email } = req.body;

  if (!customerName || !customerName.trim()) {
    res.status(400).json({ message: 'Customer name is required' });
    return;
  }

  const pool = getPool();

  // Try to find existing customer by exact name match
  const [existingCustomers] = await pool.execute(
    'SELECT * FROM customers WHERE LOWER(customer_name) = LOWER(?)',
    [customerName.trim()]
  );

  if ((existingCustomers as any[]).length > 0) {
    // Customer exists, return it
    res.json({
      customer: (existingCustomers as any[])[0],
      created: false
    });
    return;
  }

  // Customer doesn't exist, create new one
  const [result] = await pool.execute(`
    INSERT INTO customers (
      customer_name, phone, email, total_purchases, last_purchase_date
    ) VALUES (?, ?, ?, 0, NOW())
  `, [
    customerName.trim(),
    phone || null,
    email || null
  ]) as any;

  const customerId = result.insertId;

  const [newCustomer] = await pool.execute(
    'SELECT * FROM customers WHERE id = ?',
    [customerId]
  );

  logger.info(`New customer created: ${customerName}`);

  res.status(201).json({
    customer: (newCustomer as any[])[0],
    created: true
  });
}));

// Create a new customer manually
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { customer_name, phone, email, address, notes } = req.body;

  if (!customer_name || !customer_name.trim()) {
    res.status(400).json({ message: 'Customer name is required' });
    return;
  }

  const pool = getPool();

  // Check if customer already exists
  const [existingCustomers] = await pool.execute(
    'SELECT id FROM customers WHERE LOWER(customer_name) = LOWER(?)',
    [customer_name.trim()]
  );

  if ((existingCustomers as any[]).length > 0) {
    res.status(400).json({ message: 'Customer with this name already exists' });
    return;
  }

  // Create new customer
  const [result] = await pool.execute(`
    INSERT INTO customers (
      customer_name, phone, email, address, notes, total_purchases, last_purchase_date
    ) VALUES (?, ?, ?, ?, ?, 0, NULL)
  `, [
    customer_name.trim(),
    phone || null,
    email || null,
    address || null,
    notes || null
  ]) as any;

  const customerId = result.insertId;

  const [newCustomer] = await pool.execute(
    'SELECT * FROM customers WHERE id = ?',
    [customerId]
  );

  logger.info(`New customer created manually: ${customer_name}`);

  res.status(201).json({
    customer: (newCustomer as any[])[0]
  });
}));

// Update customer
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { customer_name, phone, email, address, notes } = req.body;

  if (!customer_name || !customer_name.trim()) {
    res.status(400).json({ message: 'Customer name is required' });
    return;
  }

  const pool = getPool();

  // Check if customer exists
  const [existing] = await pool.execute('SELECT id FROM customers WHERE id = ?', [id]);
  if ((existing as any[]).length === 0) {
    res.status(404).json({ message: 'Customer not found' });
    return;
  }

  // Check if another customer has the same name
  const [duplicates] = await pool.execute(
    'SELECT id FROM customers WHERE LOWER(customer_name) = LOWER(?) AND id != ?',
    [customer_name.trim(), id]
  );

  if ((duplicates as any[]).length > 0) {
    res.status(400).json({ message: 'Another customer with this name already exists' });
    return;
  }

  // Update customer
  await pool.execute(`
    UPDATE customers 
    SET 
      customer_name = ?,
      phone = ?,
      email = ?,
      address = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    customer_name.trim(),
    phone || null,
    email || null,
    address || null,
    notes || null,
    id
  ]);

  const [updatedCustomer] = await pool.execute(
    'SELECT * FROM customers WHERE id = ?',
    [id]
  );

  logger.info(`Customer updated: ${customer_name} (ID: ${id})`);

  res.json({
    customer: (updatedCustomer as any[])[0]
  });
}));

// Update customer purchase stats
router.put('/:id/purchase', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    res.status(400).json({ message: 'Valid amount is required' });
    return;
  }

  const pool = getPool();

  await pool.execute(`
    UPDATE customers 
    SET 
      total_purchases = total_purchases + ?,
      last_purchase_date = NOW()
    WHERE id = ?
  `, [amount, id]);

  res.json({ message: 'Customer purchase updated' });
}));

// Search customers by name (for autocomplete)
router.get('/search', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    res.json({ customers: [] });
    return;
  }

  const pool = getPool();
  const searchTerm = `%${q}%`;

  const [customers] = await pool.execute(`
    SELECT 
      id,
      customer_name,
      phone,
      email,
      total_purchases,
      last_purchase_date
    FROM customers
    WHERE customer_name LIKE ? OR phone LIKE ?
    ORDER BY last_purchase_date DESC, customer_name ASC
    LIMIT 20
  `, [searchTerm, searchTerm]);

  res.json({ customers });
}));

// Get customer purchase history
router.get('/:id/history', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const pool = getPool();
  
  const offset = (Number(page) - 1) * Number(limit);

  // Get customer details
  const [customerRows] = await pool.execute(
    'SELECT * FROM customers WHERE id = ?',
    [id]
  );

  if ((customerRows as any[]).length === 0) {
    res.status(404).json({ message: 'Customer not found' });
    return;
  }

  const customer = (customerRows as any[])[0];

  // Get sales history
  const [salesRows] = await pool.execute(`
    SELECT 
      s.id,
      s.sale_number,
      s.sale_date,
      s.total_amount,
      s.payment_method,
      u.username as cashier_username,
      COUNT(si.id) as item_count
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN users u ON s.cashier_id = u.id
    WHERE s.customer_id = ?
    GROUP BY s.id
    ORDER BY s.sale_date DESC
    LIMIT ? OFFSET ?
  `, [id, Number(limit), offset]);

  // Get total count
  const [countRows] = await pool.execute(
    'SELECT COUNT(*) as total FROM sales WHERE customer_id = ?',
    [id]
  );
  const total = (countRows as any[])[0].total;

  res.json({
    customer,
    sales: salesRows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get customer sale details
router.get('/:customerId/sales/:saleId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { customerId, saleId } = req.params;
  const pool = getPool();

  // Verify sale belongs to customer
  const [saleRows] = await pool.execute(`
    SELECT 
      s.*,
      u.username as cashier_username,
      u.first_name as cashier_first_name,
      u.last_name as cashier_last_name
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    WHERE s.id = ? AND s.customer_id = ?
  `, [saleId, customerId]);

  if ((saleRows as any[]).length === 0) {
    res.status(404).json({ message: 'Sale not found or does not belong to this customer' });
    return;
  }

  const sale = (saleRows as any[])[0];

  // Get sale items
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
  `, [saleId]);

  res.json({
    ...sale,
    items: itemRows
  });
}));

export default router;
