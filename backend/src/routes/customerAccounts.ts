import { Router, Request, Response } from 'express';
import { getPool } from '../database/connection';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

// Validation schemas
const createCustomerSchema = Joi.object({
  customerCode: Joi.string().required(),
  customerName: Joi.string().required(),
  contactPerson: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  phone: Joi.string().allow('', null).optional(),
  address: Joi.string().allow('', null).optional(),
  creditLimit: Joi.number().min(0).default(0),
  notes: Joi.string().allow('', null).optional()
});

const updateCustomerSchema = Joi.object({
  customerName: Joi.string().optional(),
  contactPerson: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  phone: Joi.string().allow('', null).optional(),
  address: Joi.string().allow('', null).optional(),
  creditLimit: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
  notes: Joi.string().allow('', null).optional()
});

const createARTransactionSchema = Joi.object({
  customerAccountId: Joi.number().required(),
  transactionType: Joi.string().valid('charge', 'payment', 'adjustment').required(),
  amount: Joi.number().min(0.01).required(),
  paymentMethod: Joi.string().allow('', null).optional(),
  referenceNumber: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  saleId: Joi.number().allow(null).optional()
});

// Create customer account
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { error, value } = createCustomerSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const {
    customerCode,
    customerName,
    contactPerson,
    email,
    phone,
    address,
    creditLimit,
    notes
  } = value;

  const pool = getPool();

  // Check if customer code already exists
  const [existing] = await pool.execute(
    'SELECT id FROM customer_accounts WHERE customer_code = ?',
    [customerCode]
  );

  if ((existing as any[]).length > 0) {
    res.status(400).json({ message: 'Customer code already exists' });
    return;
  }

  const [result] = await pool.execute(`
    INSERT INTO customer_accounts (
      customer_code, customer_name, contact_person, email, phone,
      address, credit_limit, current_balance, created_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    customerCode, customerName, contactPerson || null, email || null,
    phone || null, address || null, creditLimit, req.user!.id, notes || null
  ]) as any;

  const customerId = result.insertId;

  logger.info(`Customer account created: ${customerCode} by user ${req.user!.id}`);

  res.status(201).json({
    id: customerId,
    customerCode,
    customerName,
    currentBalance: 0,
    creditLimit
  });
}));

// Get all customer accounts
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const {
    page = 1,
    limit = 50,
    search,
    isActive
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    conditions.push('(customer_code LIKE ? OR customer_name LIKE ? OR phone LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (isActive !== undefined) {
    conditions.push('is_active = ?');
    params.push(isActive === 'true' ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();

  const [customers] = await pool.execute(`
    SELECT 
      ca.*,
      u.username as created_by_name
    FROM customer_accounts ca
    LEFT JOIN users u ON ca.created_by = u.id
    ${whereClause}
    ORDER BY ca.customer_name
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);

  const [countResult] = await pool.execute(`
    SELECT COUNT(*) as total FROM customer_accounts ca ${whereClause}
  `, params);

  const total = (countResult as any[])[0].total;

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

// Get single customer account with transaction history
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const pool = getPool();

  const [customerRows] = await pool.execute(`
    SELECT 
      ca.*,
      u.username as created_by_name
    FROM customer_accounts ca
    LEFT JOIN users u ON ca.created_by = u.id
    WHERE ca.id = ?
  `, [id]);

  const customer = (customerRows as any[])[0];

  if (!customer) {
    res.status(404).json({ message: 'Customer account not found' });
    return;
  }

  // Get recent transactions
  const [transactions] = await pool.execute(`
    SELECT 
      art.*,
      u.username as processed_by_name
    FROM ar_transactions art
    LEFT JOIN users u ON art.processed_by = u.id
    WHERE art.customer_account_id = ?
      AND (
        art.payment_method = 'AR' 
        OR art.transaction_type IN ('payment', 'adjustment')
      )
    ORDER BY art.transaction_date DESC
    LIMIT 50
  `, [id]);

  res.json({
    ...customer,
    transactions
  });
}));

// Update customer account
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { error, value } = updateCustomerSchema.validate(req.body);

  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const pool = getPool();
  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(value).forEach(([key, val]) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    updates.push(`${snakeKey} = ?`);
    params.push(val);
  });

  if (updates.length === 0) {
    res.status(400).json({ message: 'No fields to update' });
    return;
  }

  params.push(id);

  await pool.execute(`
    UPDATE customer_accounts SET ${updates.join(', ')} WHERE id = ?
  `, params);

  logger.info(`Customer account ${id} updated by user ${req.user!.id}`);

  const [rows] = await pool.execute('SELECT * FROM customer_accounts WHERE id = ?', [id]);
  res.json((rows as any[])[0]);
}));

// Create AR transaction
router.post('/transactions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { error, value } = createARTransactionSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const {
    customerAccountId,
    transactionType,
    amount,
    paymentMethod,
    referenceNumber,
    notes,
    saleId
  } = value;

  const pool = getPool();

  // Get current balance
  const [customerRows] = await pool.execute(
    'SELECT current_balance, credit_limit FROM customer_accounts WHERE id = ?',
    [customerAccountId]
  );

  if ((customerRows as any[]).length === 0) {
    res.status(404).json({ message: 'Customer account not found' });
    return;
  }

  const customer = (customerRows as any[])[0];
  const currentBalance = parseFloat(customer.current_balance);
  const creditLimit = parseFloat(customer.credit_limit);

  // Calculate new balance
  let balanceAfter = currentBalance;
  if (transactionType === 'charge') {
    balanceAfter += amount;
    if (balanceAfter > creditLimit) {
      res.status(400).json({ 
        message: `Transaction exceeds credit limit. Current: ${currentBalance}, Limit: ${creditLimit}` 
      });
      return;
    }
  } else if (transactionType === 'payment') {
    balanceAfter -= amount;
  } else if (transactionType === 'adjustment') {
    balanceAfter = amount; // Adjustment sets the balance to a specific amount
  }

  // Create transaction
  const [result] = await pool.execute(`
    INSERT INTO ar_transactions (
      customer_account_id, sale_id, transaction_type, amount,
      balance_after, payment_method, reference_number, notes, processed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    customerAccountId, saleId || null, transactionType, amount,
    balanceAfter, paymentMethod || null, referenceNumber || null,
    notes || null, req.user!.id
  ]) as any;

  // Update customer balance
  await pool.execute(
    'UPDATE customer_accounts SET current_balance = ? WHERE id = ?',
    [balanceAfter, customerAccountId]
  );

  const transactionId = result.insertId;

  logger.info(`AR transaction created for customer ${customerAccountId} by user ${req.user!.id}`);

  res.status(201).json({
    id: transactionId,
    customerAccountId,
    transactionType,
    amount,
    balanceAfter
  });
}));

// Get AR summary report
router.get('/reports/summary', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query;

  const pool = getPool();
  const conditions: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditions.push('DATE(transaction_date) >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('DATE(transaction_date) <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [summary] = await pool.execute(`
    SELECT 
      transaction_type,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM ar_transactions
    ${whereClause}
    GROUP BY transaction_type
  `, params);

  // Get total outstanding balance
  const [balanceRows] = await pool.execute(`
    SELECT SUM(current_balance) as total_balance
    FROM customer_accounts
    WHERE is_active = 1
  `);

  res.json({
    summary,
    totalOutstanding: (balanceRows as any[])[0].total_balance || 0
  });
}));

export default router;
