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
const createPettyCashSchema = Joi.object({
  transactionType: Joi.string().valid('fund', 'advance', 'replenish', 'return').required(),
  amount: Joi.number().min(0.01).required(),
  purpose: Joi.string().required(),
  employeeName: Joi.string().allow('', null).optional(),
  shiftId: Joi.number().allow(null).optional(),
  dueDate: Joi.date().allow(null).optional(),
  notes: Joi.string().allow('', null).optional()
});

const updatePettyCashSchema = Joi.object({
  status: Joi.string().valid('active', 'settled', 'overdue').optional(),
  notes: Joi.string().allow('', null).optional()
});

// Generate transaction number
function generateTransactionNumber(type: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const prefix = type === 'advance' ? 'ADV' : type === 'fund' ? 'FND' : type === 'replenish' ? 'REP' : 'RET';
  return `${prefix}-${year}${month}${day}-${random}`;
}

// Get current petty cash balance
async function getCurrentBalance(pool: any): Promise<number> {
  const [rows] = await pool.execute(`
    SELECT balance_after FROM petty_cash 
    ORDER BY transaction_date DESC, id DESC 
    LIMIT 1
  `);
  
  if ((rows as any[]).length === 0) {
    return 0;
  }
  
  return parseFloat((rows as any[])[0].balance_after);
}

// Create petty cash transaction
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { error, value } = createPettyCashSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const {
    transactionType,
    amount,
    purpose,
    employeeName,
    shiftId,
    dueDate,
    notes
  } = value;

  const pool = getPool();
  const currentBalance = await getCurrentBalance(pool);
  
  // Calculate new balance
  let balanceAfter = currentBalance;
  if (transactionType === 'fund' || transactionType === 'replenish' || transactionType === 'return') {
    balanceAfter += amount;
  } else if (transactionType === 'advance') {
    if (currentBalance < amount) {
      res.status(400).json({ message: 'Insufficient petty cash balance' });
      return;
    }
    balanceAfter -= amount;
  }

  const transactionNumber = generateTransactionNumber(transactionType);

  const [result] = await pool.execute(`
    INSERT INTO petty_cash (
      transaction_number, transaction_type, amount, balance_after,
      purpose, employee_name, shift_id, due_date, notes, processed_by, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    transactionNumber,
    transactionType,
    amount,
    balanceAfter,
    purpose,
    employeeName || null,
    shiftId || null,
    dueDate || null,
    notes || null,
    req.user!.id,
    transactionType === 'advance' ? 'active' : 'settled'
  ]) as any;

  const transactionId = result.insertId;

  logger.info(`Petty cash transaction created: ${transactionNumber} by user ${req.user!.id}`);

  res.status(201).json({
    id: transactionId,
    transactionNumber,
    transactionType,
    amount,
    balanceAfter,
    status: transactionType === 'advance' ? 'active' : 'settled'
  });
}));

// Get all petty cash transactions
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const {
    page = 1,
    limit = 50,
    transactionType,
    status,
    startDate,
    endDate,
    shiftId
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const conditions: string[] = [];
  const params: any[] = [];

  if (transactionType) {
    conditions.push('transaction_type = ?');
    params.push(transactionType);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (startDate) {
    conditions.push('DATE(transaction_date) >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('DATE(transaction_date) <= ?');
    params.push(endDate);
  }

  if (shiftId) {
    conditions.push('shift_id = ?');
    params.push(shiftId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();

  const [transactions] = await pool.execute(`
    SELECT 
      pc.*,
      u.username as processed_by_name,
      a.username as approved_by_name
    FROM petty_cash pc
    LEFT JOIN users u ON pc.processed_by = u.id
    LEFT JOIN users a ON pc.approved_by = a.id
    ${whereClause}
    ORDER BY pc.transaction_date DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);

  const [countResult] = await pool.execute(`
    SELECT COUNT(*) as total FROM petty_cash pc ${whereClause}
  `, params);

  const total = (countResult as any[])[0].total;

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

// Get current balance
router.get('/balance', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  const balance = await getCurrentBalance(pool);

  res.json({ balance });
}));

// Get single transaction
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const pool = getPool();

  const [rows] = await pool.execute(`
    SELECT 
      pc.*,
      u.username as processed_by_name,
      a.username as approved_by_name
    FROM petty_cash pc
    LEFT JOIN users u ON pc.processed_by = u.id
    LEFT JOIN users a ON pc.approved_by = a.id
    WHERE pc.id = ?
  `, [id]);

  const transaction = (rows as any[])[0];

  if (!transaction) {
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  res.json(transaction);
}));

// Update transaction (mainly for settling advances)
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { error, value } = updatePettyCashSchema.validate(req.body);

  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const pool = getPool();

  const updates: string[] = [];
  const params: any[] = [];

  if (value.status) {
    updates.push('status = ?');
    params.push(value.status);
  }

  if (value.notes !== undefined) {
    updates.push('notes = ?');
    params.push(value.notes);
  }

  if (updates.length === 0) {
    res.status(400).json({ message: 'No fields to update' });
    return;
  }

  params.push(id);

  await pool.execute(`
    UPDATE petty_cash SET ${updates.join(', ')} WHERE id = ?
  `, params);

  logger.info(`Petty cash transaction ${id} updated by user ${req.user!.id}`);

  const [rows] = await pool.execute('SELECT * FROM petty_cash WHERE id = ?', [id]);
  res.json((rows as any[])[0]);
}));

// Get summary report
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
      status,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM petty_cash
    ${whereClause}
    GROUP BY transaction_type, status
  `, params);

  // Get outstanding advances
  const [outstanding] = await pool.execute(`
    SELECT 
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM petty_cash
    WHERE transaction_type = 'advance' AND status = 'active'
  `);

  res.json({
    summary,
    outstanding: (outstanding as any[])[0]
  });
}));

export default router;
