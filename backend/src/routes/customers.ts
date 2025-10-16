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

// Get customers with A/R account data
router.get('/with-ar', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { search, page = 1, limit = 100, hasArOnly } = req.query;
  const pool = getPool();

  let query = `
    SELECT DISTINCT
      c.id,
      c.customer_name,
      c.phone,
      c.email,
      c.address,
      c.notes,
      c.total_purchases,
      c.last_purchase_date,
      c.created_at,
      c.customer_code,
      c.contact_person,
      COALESCE(c.current_balance, 0) as current_balance,
      COALESCE(c.credit_limit, 0) as credit_limit,
      c.is_active,
      (SELECT COUNT(*) FROM ar_transactions WHERE customer_id = c.id) as transaction_count
    FROM customers c
    WHERE 1=1
  `;
  
  const params: any[] = [];

  // Filter only customers with A/R activity if requested
  if (hasArOnly === 'true') {
    query += ` AND (
      c.current_balance > 0 
      OR c.customer_code IS NOT NULL 
      OR EXISTS (
        SELECT 1 FROM ar_transactions 
        WHERE customer_id = c.id 
        AND (payment_method = 'AR' OR transaction_type IN ('payment', 'adjustment'))
      )
    )`;
  }
  
  if (search) {
    query += ' AND (c.customer_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.customer_code LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // Get total count for pagination
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(DISTINCT c.id) as total FROM');
  const [countResult] = await pool.execute(countQuery, params);
  const total = (countResult as any[])[0]?.total || 0;

  // Add pagination
  const offset = (Number(page) - 1) * Number(limit);
  query += ' ORDER BY c.current_balance DESC, c.last_purchase_date DESC, c.customer_name ASC LIMIT ? OFFSET ?';
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
  const { 
    customer_name, customerName, phone, email, address, notes,
    customer_code, customerCode, contact_person, contactPerson, 
    credit_limit, creditLimit, is_active 
  } = req.body;

  // Support both snake_case and camelCase
  const finalCustomerName = customer_name || customerName;
  const finalCustomerCode = customer_code || customerCode;
  const finalContactPerson = contact_person || contactPerson;
  const finalCreditLimit = credit_limit || creditLimit;

  if (!finalCustomerName || !finalCustomerName.trim()) {
    res.status(400).json({ message: 'Customer name is required' });
    return;
  }

  const pool = getPool();

  // Check if customer already exists
  const [existingCustomers] = await pool.execute(
    'SELECT id FROM customers WHERE LOWER(customer_name) = LOWER(?)',
    [finalCustomerName.trim()]
  );

  if ((existingCustomers as any[]).length > 0) {
    res.status(400).json({ message: 'Customer with this name already exists' });
    return;
  }

  // Check if customer_code already exists (if provided)
  if (finalCustomerCode) {
    const [existingCode] = await pool.execute(
      'SELECT id FROM customers WHERE customer_code = ?',
      [finalCustomerCode]
    );
    if ((existingCode as any[]).length > 0) {
      res.status(400).json({ message: 'Customer code already exists' });
      return;
    }
  }

  // Create new customer
  const [result] = await pool.execute(`
    INSERT INTO customers (
      customer_name, phone, email, address, notes, 
      customer_code, contact_person, credit_limit, current_balance, is_active,
      total_purchases, last_purchase_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 0, NULL)
  `, [
    finalCustomerName.trim(),
    phone || null,
    email || null,
    address || null,
    notes || null,
    finalCustomerCode || null,
    finalContactPerson || null,
    finalCreditLimit || 0.00,
    is_active !== undefined ? is_active : 1
  ]) as any;

  const customerId = result.insertId;

  const [newCustomer] = await pool.execute(
    'SELECT * FROM customers WHERE id = ?',
    [customerId]
  );

  logger.info(`New customer created manually: ${finalCustomerName}`);

  res.status(201).json({
    customer: (newCustomer as any[])[0]
  });
}));

// Update customer
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { 
    customer_name, phone, email, address, notes,
    customer_code, contact_person, credit_limit, is_active 
  } = req.body;

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

  // Check if customer_code already exists (if provided and changed)
  if (customer_code) {
    const [existingCode] = await pool.execute(
      'SELECT id FROM customers WHERE customer_code = ? AND id != ?',
      [customer_code, id]
    );
    if ((existingCode as any[]).length > 0) {
      res.status(400).json({ message: 'Customer code already exists' });
      return;
    }
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
      customer_code = ?,
      contact_person = ?,
      credit_limit = ?,
      is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    customer_name.trim(),
    phone || null,
    email || null,
    address || null,
    notes || null,
    customer_code || null,
    contact_person || null,
    credit_limit !== undefined ? credit_limit : null,
    is_active !== undefined ? is_active : null,
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

// Get customer AR transactions
router.get('/:id/ar-transactions', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const pool = getPool();

  // Get customer with AR data
  const [customerRows] = await pool.execute(
    'SELECT * FROM customers WHERE id = ?',
    [id]
  );

  if ((customerRows as any[]).length === 0) {
    res.status(404).json({ message: 'Customer not found' });
    return;
  }

  // Get recent transactions
  const [transactions] = await pool.execute(`
    SELECT 
      art.*,
      u.username as processed_by_name,
      s.sale_number
    FROM ar_transactions art
    LEFT JOIN users u ON art.processed_by = u.id
    LEFT JOIN sales s ON art.sale_id = s.id
    WHERE art.customer_id = ?
      AND (
        art.payment_method = 'AR' 
        OR art.transaction_type IN ('payment', 'adjustment')
      )
    ORDER BY art.transaction_date DESC
    LIMIT 50
  `, [id]);

  const customer = (customerRows as any[])[0];

  res.json({
    ...customer,
    transactions
  });
}));

// Create AR transaction (charge, payment, or adjustment)
router.post('/:id/ar-transactions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    transactionType,
    amount,
    paymentMethod,
    referenceNumber,
    notes,
    saleId
  } = req.body;

  if (!transactionType || !amount) {
    res.status(400).json({ message: 'Transaction type and amount are required' });
    return;
  }

  const pool = getPool();

  // Get current balance (amount customer owes)
  const [customerRows] = await pool.execute(
    'SELECT current_balance, customer_name FROM customers WHERE id = ?',
    [id]
  );

  if ((customerRows as any[]).length === 0) {
    res.status(404).json({ message: 'Customer not found' });
    return;
  }

  const customer = (customerRows as any[])[0];
  const currentBalance = parseFloat(customer.current_balance || 0);

  // Calculate new balance (debt tracking system)
  let balanceAfter = currentBalance;
  if (transactionType === 'charge') {
    balanceAfter += parseFloat(amount); // Increase debt owed
  } else if (transactionType === 'payment') {
    balanceAfter -= parseFloat(amount); // Reduce debt owed
    // Prevent negative balance (can't pay more than owed unless intentional)
    if (balanceAfter < 0) {
      balanceAfter = 0; // Can't have negative debt
    }
  } else if (transactionType === 'adjustment') {
    balanceAfter += parseFloat(amount); // Can be positive or negative
  }

  // Insert transaction
  await pool.execute(`
    INSERT INTO ar_transactions (
      customer_id, sale_id, transaction_type, amount, balance_after,
      payment_method, reference_number, notes, processed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    saleId || null,
    transactionType,
    amount,
    balanceAfter,
    paymentMethod || null,
    referenceNumber || null,
    notes || null,
    req.user!.id
  ]);

  // Update customer balance
  await pool.execute(
    'UPDATE customers SET current_balance = ? WHERE id = ?',
    [balanceAfter, id]
  );

  logger.info(`AR ${transactionType}: ${customer.customer_name} - Amount: ₱${amount}, Previous: ₱${currentBalance}, New: ₱${balanceAfter}, User: ${req.user!.id}`);

  res.json({
    success: true,
    previousBalance: currentBalance,
    newBalance: balanceAfter,
    transactionType,
    amount
  });
}));

// Get all AR transactions across all customers
router.get('/ar-transactions/all', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 50, search, startDate, endDate } = req.query;
  const pool = getPool();

  let query = `
    SELECT 
      art.*,
      c.customer_name,
      c.phone,
      c.email,
      u.username as processed_by_name,
      s.sale_number
    FROM ar_transactions art
    INNER JOIN customers c ON art.customer_id = c.id
    LEFT JOIN users u ON art.processed_by = u.id
    LEFT JOIN sales s ON art.sale_id = s.id
    WHERE (
      art.payment_method = 'AR' 
      OR art.transaction_type IN ('payment', 'adjustment')
    )
  `;
  
  const params: any[] = [];
  
  if (search) {
    query += ' AND (c.customer_name LIKE ? OR c.phone LIKE ? OR s.sale_number LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (startDate) {
    query += ' AND DATE(art.transaction_date) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND DATE(art.transaction_date) <= ?';
    params.push(endDate);
  }

  // Get total count for pagination
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
  const [countResult] = await pool.execute(countQuery, params);
  const total = (countResult as any[])[0]?.total || 0;

  // Add pagination
  const offset = (Number(page) - 1) * Number(limit);
  query += ' ORDER BY art.transaction_date DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  const [transactions] = await pool.execute(query, params);

  res.json({
    transactions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

export default router;
