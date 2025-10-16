import { Router, Request, Response } from 'express';
import { getPool } from '../database/connection';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Interface for shift data  
interface Shift {
  id: number;
  cashier_id: number;
  cashier_name: string;
  start_time: string;
  end_time: string | null;
  starting_cash: number;
  ending_cash: number | null;
  total_sales: number;
  total_transactions: number;
  total_cash: number;
  total_card: number;
  total_mobile: number;
  total_check: number;
  is_active: number;
  cash_difference: number | null;
}

// Extend Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

// Validation schemas
const startShiftSchema = Joi.object({
  cashierId: Joi.number().required(),
  cashierName: Joi.string().required(),
  startingCash: Joi.number().min(0).required(),
  startTime: Joi.string().isoDate().required()
});

const endShiftSchema = Joi.object({
  endingCash: Joi.number().min(0).required(),
  endTime: Joi.string().isoDate().required(),
  cashDifference: Joi.number().optional()
});

// Helper: convert ISO datetime (with T and optional Z) to MySQL DATETIME 'YYYY-MM-DD HH:MM:SS'
const isoToSqlDatetime = (iso: string) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    // Use toISOString to get consistent UTC value, then remove the 'T' and milliseconds/Z
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch (err) {
    return null;
  }
};

// Get current shift for a cashier
router.get('/current/:cashierId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { cashierId } = req.params;
  
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT * FROM shifts 
    WHERE cashier_id = ? AND is_active = 1
    ORDER BY start_time DESC 
    LIMIT 1
  `, [cashierId]);
  
  const shift = (rows as Shift[])[0];

  if (shift) {
    res.json({
      id: shift.id,
      cashierId: shift.cashier_id,
      cashierName: shift.cashier_name,
      startTime: shift.start_time,
      endTime: shift.end_time,
      startingCash: shift.starting_cash,
      endingCash: shift.ending_cash,
      totalSales: shift.total_sales || 0,
      totalTransactions: shift.total_transactions || 0,
      totalCash: shift.total_cash || 0,
      totalCard: shift.total_card || 0,
      totalMobile: shift.total_mobile || 0,
      totalCheck: shift.total_check || 0,
      isActive: shift.is_active === 1,
      cashDifference: shift.cash_difference
    });
  } else {
    res.status(404).json({ message: 'No active shift found' });
  }
}));

// Start a new shift
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { error, value } = startShiftSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const { cashierId, cashierName, startingCash, startTime } = value;

  // Convert ISO startTime to MySQL DATETIME
  const sqlStartTime = isoToSqlDatetime(startTime);
  if (!sqlStartTime) {
    res.status(400).json({ message: 'Invalid startTime format' });
    return;
  }

  const pool = await getPool();
  
  // Check if there's already an active shift for this cashier
  const [existingRows] = await pool.execute(`
    SELECT id FROM shifts 
    WHERE cashier_id = ? AND is_active = 1
  `, [cashierId]);
  
  const existingShift = (existingRows as { id: number }[])[0];

  if (existingShift) {
    res.status(400).json({ message: 'Cashier already has an active shift' });
    return;
  }

  // Create new shift
  const [insertResult] = await pool.execute(`
    INSERT INTO shifts (
      cashier_id, cashier_name, start_time, starting_cash,
      total_sales, total_transactions, total_cash, total_card,
      total_mobile, total_check, is_active
    ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 1)
  `, [cashierId, cashierName, sqlStartTime, startingCash]) as any;

  const shiftId = (insertResult as any).insertId;

  const [newShiftRows] = await pool.execute('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  const newShift = (newShiftRows as Shift[])[0];

  logger.info(`Shift started for cashier ${cashierName} (ID: ${cashierId})`);

  res.status(201).json({
    id: newShift.id,
    cashierId: newShift.cashier_id,
    cashierName: newShift.cashier_name,
    startTime: newShift.start_time,
    startingCash: newShift.starting_cash,
    totalSales: 0,
    totalTransactions: 0,
    totalCash: 0,
    totalCard: 0,
    totalMobile: 0,
    totalCheck: 0,
    isActive: true
  });
}));

// End a shift
router.post('/:shiftId/end', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { shiftId } = req.params;
  const { error, value } = endShiftSchema.validate(req.body);
  
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }

  const { endingCash, endTime, cashDifference } = value;

  // Convert ISO endTime to MySQL DATETIME
  const sqlEndTime = isoToSqlDatetime(endTime);
  if (!sqlEndTime) {
    res.status(400).json({ message: 'Invalid endTime format' });
    return;
  }

  const pool = await getPool();
  
  // Normalize optional values to avoid passing undefined into SQL driver
  const cd = typeof cashDifference === 'undefined' ? null : cashDifference;
  const ec = typeof endingCash === 'undefined' ? null : endingCash;
  const sid = parseInt(shiftId as any, 10);

  // Update shift
  await pool.execute(`
    UPDATE shifts 
    SET end_time = ?, ending_cash = ?, cash_difference = ?, is_active = 0
    WHERE id = ?
  `, [sqlEndTime, ec, cd, sid]);

  const [endedShiftRows] = await pool.execute('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  const endedShift = (endedShiftRows as Shift[])[0];

  // Get expenses for this shift
  const [expensesRows] = await pool.execute(`
    SELECT 
      category,
      SUM(amount) as total_amount,
      COUNT(*) as count
    FROM expenses
    WHERE shift_id = ?
    GROUP BY category
  `, [shiftId]);

  const expenses = (expensesRows as any[]).map(exp => ({
    category: exp.category,
    totalAmount: exp.total_amount,
    count: exp.count
  }));

  // Get total expenses
  const [expensesTotalRows] = await pool.execute(`
    SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE shift_id = ?
  `, [shiftId]);
  
  const totalExpenses = (expensesTotalRows as any[])[0]?.total || 0;

  logger.info(`Shift ended for shift ID: ${shiftId}`);

  res.json({
    id: endedShift.id,
    cashierId: endedShift.cashier_id,
    cashierName: endedShift.cashier_name,
    startTime: endedShift.start_time,
    endTime: endedShift.end_time,
    startingCash: endedShift.starting_cash,
    endingCash: endedShift.ending_cash,
    totalSales: endedShift.total_sales,
    totalTransactions: endedShift.total_transactions,
    totalCash: endedShift.total_cash,
    totalCard: endedShift.total_card,
    totalMobile: endedShift.total_mobile,
    totalCheck: endedShift.total_check,
    isActive: false,
    cashDifference: endedShift.cash_difference,
    expenses: expenses,
    totalExpenses: totalExpenses
  });
}));

// Get shift history for a cashier
router.get('/history/:cashierId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { cashierId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);

  const pool = await getPool();
  
  const [shifts] = await pool.execute(`
    SELECT * FROM shifts 
    WHERE cashier_id = ? 
    ORDER BY start_time DESC 
    LIMIT ? OFFSET ?
  `, [cashierId, limit, offset]) as any;

  const [countRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM shifts WHERE cashier_id = ?', 
    [cashierId]
  );
  const totalCount = (countRows as { count: number }[])[0].count;

  res.json({
    shifts: (shifts as Shift[]).map(shift => ({
      id: shift.id,
      cashierId: shift.cashier_id,
      cashierName: shift.cashier_name,
      startTime: shift.start_time,
      endTime: shift.end_time,
      startingCash: shift.starting_cash,
      endingCash: shift.ending_cash,
      totalSales: shift.total_sales,
      totalTransactions: shift.total_transactions,
      totalCash: shift.total_cash,
      totalCard: shift.total_card,
      totalMobile: shift.total_mobile,
      totalCheck: shift.total_check,
      isActive: shift.is_active === 1,
      cashDifference: shift.cash_difference
    })),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / Number(limit))
    }
  });
}));

// Update shift totals (called when processing sales)
router.put('/:shiftId/update-totals', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { shiftId } = req.params;
  const { totalSales, totalTransactions, totalCash, totalCard, totalMobile, totalCheck } = req.body;

  const pool = await getPool();
  
  await pool.execute(`
    UPDATE shifts 
    SET total_sales = total_sales + ?,
        total_transactions = total_transactions + ?,
        total_cash = total_cash + ?,
        total_card = total_card + ?,
        total_mobile = total_mobile + ?,
        total_check = total_check + ?
    WHERE id = ?
  `, [totalSales || 0, totalTransactions || 0, totalCash || 0, totalCard || 0, totalMobile || 0, totalCheck || 0, shiftId]);

  const [updatedShiftRows] = await pool.execute('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  const updatedShift = (updatedShiftRows as Shift[])[0];

  res.json({
    id: updatedShift.id,
    totalSales: updatedShift.total_sales,
    totalTransactions: updatedShift.total_transactions,
    totalCash: updatedShift.total_cash,
    totalCard: updatedShift.total_card,
    totalMobile: updatedShift.total_mobile,
    totalCheck: updatedShift.total_check
  });
}));

// Get all shifts (admin only)
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check if user is admin or manager
  if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
    res.status(403).json({ message: 'Insufficient permissions' });
    return;
  }

  const { page = 1, limit = 20, cashierId, date } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = '';
  const params: any[] = [];

  if (cashierId) {
    whereClause += 'WHERE cashier_id = ?';
    params.push(cashierId);
  }

  if (date) {
    if (whereClause) {
      whereClause += ' AND DATE(start_time) = ?';
    } else {
      whereClause += 'WHERE DATE(start_time) = ?';
    }
    params.push(date);
  }

  const pool = await getPool();
  
  const [shifts] = await pool.execute(`
    SELECT * FROM shifts 
    ${whereClause}
    ORDER BY start_time DESC 
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]) as any;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as count FROM shifts ${whereClause}`, 
    params
  );
  const totalCount = (countRows as { count: number }[])[0].count;

  res.json({
    shifts: (shifts as Shift[]).map(shift => ({
      id: shift.id,
      cashierId: shift.cashier_id,
      cashierName: shift.cashier_name,
      startTime: shift.start_time,
      endTime: shift.end_time,
      startingCash: shift.starting_cash,
      endingCash: shift.ending_cash,
      totalSales: shift.total_sales,
      totalTransactions: shift.total_transactions,
      totalCash: shift.total_cash,
      totalCard: shift.total_card,
      totalMobile: shift.total_mobile,
      totalCheck: shift.total_check,
      isActive: shift.is_active === 1,
      cashDifference: shift.cash_difference
    })),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / Number(limit))
    }
  });
}));

export default router;