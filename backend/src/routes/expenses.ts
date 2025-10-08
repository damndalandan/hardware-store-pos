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
const createExpenseSchema = Joi.object({
  category: Joi.string().required(),
  description: Joi.string().required(),
  amount: Joi.number().min(0.01).required(),
  paymentMethod: Joi.string().required(),
  referenceNumber: Joi.string().allow('', null).optional(),
  expenseDate: Joi.date().required(),
  vendorName: Joi.string().allow('', null).optional(),
  shiftId: Joi.number().allow(null).optional(),
  notes: Joi.string().allow('', null).optional()
});

const updateExpenseSchema = Joi.object({
  category: Joi.string().optional(),
  description: Joi.string().optional(),
  amount: Joi.number().min(0.01).optional(),
  paymentMethod: Joi.string().optional(),
  referenceNumber: Joi.string().allow('', null).optional(),
  expenseDate: Joi.date().optional(),
  vendorName: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional()
});

// Generate expense number
function generateExpenseNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `EXP-${year}${month}${day}-${random}`;
}

// Create expense
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { error, value } = createExpenseSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const {
    category,
    description,
    amount,
    paymentMethod,
    referenceNumber,
    expenseDate,
    vendorName,
    shiftId,
    notes
  } = value;

  const expenseNumber = generateExpenseNumber();
  const pool = getPool();

  const [result] = await pool.execute(`
    INSERT INTO expenses (
      expense_number, category, description, amount, payment_method,
      reference_number, expense_date, vendor_name, shift_id, recorded_by, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    expenseNumber, category, description, amount, paymentMethod,
    referenceNumber || null, expenseDate, vendorName || null,
    shiftId || null, req.user!.id, notes || null
  ]) as any;

  const expenseId = result.insertId;

  logger.info(`Expense created: ${expenseNumber} by user ${req.user!.id}`);

  res.status(201).json({
    id: expenseId,
    expenseNumber,
    category,
    description,
    amount,
    paymentMethod,
    expenseDate,
    status: 'pending'
  });
}));

// Get all expenses with filtering
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const {
    page = 1,
    limit = 50,
    category,
    status,
    startDate,
    endDate,
    shiftId,
    recordedBy
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const conditions: string[] = [];
  const params: any[] = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (startDate) {
    conditions.push('expense_date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('expense_date <= ?');
    params.push(endDate);
  }

  if (shiftId) {
    conditions.push('shift_id = ?');
    params.push(shiftId);
  }

  if (recordedBy) {
    conditions.push('recorded_by = ?');
    params.push(recordedBy);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();

  const [expenses] = await pool.execute(`
    SELECT 
      e.*,
      u.username as recorded_by_name,
      a.username as approved_by_name
    FROM expenses e
    LEFT JOIN users u ON e.recorded_by = u.id
    LEFT JOIN users a ON e.approved_by = a.id
    ${whereClause}
    ORDER BY e.expense_date DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);

  const [countResult] = await pool.execute(`
    SELECT COUNT(*) as total FROM expenses e ${whereClause}
  `, params);

  const total = (countResult as any[])[0].total;

  res.json({
    expenses,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get single expense
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const pool = getPool();

  const [rows] = await pool.execute(`
    SELECT 
      e.*,
      u.username as recorded_by_name,
      a.username as approved_by_name
    FROM expenses e
    LEFT JOIN users u ON e.recorded_by = u.id
    LEFT JOIN users a ON e.approved_by = a.id
    WHERE e.id = ?
  `, [id]);

  const expense = (rows as any[])[0];

  if (!expense) {
    res.status(404).json({ message: 'Expense not found' });
    return;
  }

  res.json(expense);
}));

// Update expense
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { error, value } = updateExpenseSchema.validate(req.body);

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

  if (value.status === 'approved') {
    updates.push('approved_by = ?');
    params.push(req.user!.id);
  }

  params.push(id);

  await pool.execute(`
    UPDATE expenses SET ${updates.join(', ')} WHERE id = ?
  `, params);

  logger.info(`Expense ${id} updated by user ${req.user!.id}`);

  const [rows] = await pool.execute('SELECT * FROM expenses WHERE id = ?', [id]);
  res.json((rows as any[])[0]);
}));

// Delete expense
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Only admin can delete
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Insufficient permissions' });
    return;
  }

  const { id } = req.params;
  const pool = getPool();

  await pool.execute('DELETE FROM expenses WHERE id = ?', [id]);

  logger.info(`Expense ${id} deleted by user ${req.user!.id}`);

  res.json({ message: 'Expense deleted successfully' });
}));

// Get expense categories
router.get('/meta/categories', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();

  const [rows] = await pool.execute(`
    SELECT DISTINCT category FROM expenses ORDER BY category
  `);

  res.json((rows as any[]).map(r => r.category));
}));

// Get expense summary by date range
router.get('/reports/summary', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const pool = getPool();
  let dateFormat = '%Y-%m-%d';
  
  if (groupBy === 'week') {
    dateFormat = '%Y-%u';
  } else if (groupBy === 'month') {
    dateFormat = '%Y-%m';
  }

  const conditions: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditions.push('expense_date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('expense_date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [summary] = await pool.execute(`
    SELECT 
      DATE_FORMAT(expense_date, ?) as period,
      category,
      payment_method,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM expenses
    ${whereClause}
    GROUP BY period, category, payment_method
    ORDER BY period DESC, category
  `, [dateFormat, ...params]);

  res.json(summary);
}));

export default router;
