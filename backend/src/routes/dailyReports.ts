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

// Get daily summary report
router.get('/daily', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { date, cashierId } = req.query;
  const reportDate = date ? new Date(date as string) : new Date();
  const dateStr = reportDate.toISOString().split('T')[0];

  const pool = getPool();
  const conditions: string[] = ['DATE(sale_date) = ?'];
  const params: any[] = [dateStr];

  if (cashierId) {
    conditions.push('cashier_id = ?');
    params.push(cashierId);
  }

  const whereClause = conditions.join(' AND ');

  // Get sales summary by payment method
  const [salesByPayment] = await pool.execute(`
    SELECT 
      ps.payment_method_code,
      pm.name as payment_method_name,
      COUNT(DISTINCT ps.sale_id) as transaction_count,
      SUM(ps.amount) as total_amount
    FROM payment_splits ps
    INNER JOIN sales s ON ps.sale_id = s.id
    LEFT JOIN payment_methods pm ON ps.payment_method_code = pm.code
    WHERE ${whereClause}
    GROUP BY ps.payment_method_code, pm.name
    ORDER BY pm.sort_order
  `, params);

  // Get total sales
  const [totalSales] = await pool.execute(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(subtotal) as total_subtotal,
      SUM(tax_amount) as total_tax,
      SUM(discount_amount) as total_discount,
      SUM(total_amount) as total_amount
    FROM sales
    WHERE ${whereClause}
  `, params);

  // Get expenses for the day
  const [expenses] = await pool.execute(`
    SELECT 
      category,
      payment_method,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM expenses
    WHERE expense_date = ? ${cashierId ? 'AND shift_id IN (SELECT id FROM shifts WHERE cashier_id = ? AND DATE(start_time) = ?)' : ''}
    GROUP BY category, payment_method
  `, cashierId ? [dateStr, cashierId, dateStr] : [dateStr]);

  const [totalExpenses] = await pool.execute(`
    SELECT SUM(amount) as total FROM expenses WHERE expense_date = ?
  `, [dateStr]);

  // Get AR transactions for the day
  const [arTransactions] = await pool.execute(`
    SELECT 
      transaction_type,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM ar_transactions
    WHERE DATE(transaction_date) = ? ${cashierId ? 'AND processed_by = ?' : ''}
    GROUP BY transaction_type
  `, cashierId ? [dateStr, cashierId] : [dateStr]);

  // Calculate cash for deposit (cash sales - cash expenses)
  const cashSales = (salesByPayment as any[]).find((p: any) => p.payment_method_code === 'CASH');
  const cashExpenses = (expenses as any[]).filter((e: any) => e.payment_method === 'CASH')
    .reduce((sum, e) => sum + parseFloat(e.total_amount), 0);
  
  const cashForDeposit = (cashSales?.total_amount || 0) - cashExpenses;

  // Get shift information
  const [shifts] = await pool.execute(`
    SELECT 
      id, cashier_id, cashier_name, start_time, end_time,
      starting_cash, ending_cash, total_sales, total_transactions,
      cash_difference
    FROM shifts
    WHERE DATE(start_time) = ? ${cashierId ? 'AND cashier_id = ?' : ''}
    ORDER BY start_time
  `, cashierId ? [dateStr, cashierId] : [dateStr]);

  res.json({
    date: dateStr,
    sales: {
      summary: (totalSales as any[])[0],
      byPaymentMethod: salesByPayment
    },
    expenses: {
      summary: {
        total: (totalExpenses as any[])[0]?.total || 0,
        count: (expenses as any[]).reduce((sum, e) => sum + parseInt(e.count), 0)
      },
      byCategory: expenses
    },
    accountsReceivable: {
      transactions: arTransactions,
      totalCharges: (arTransactions as any[]).find((t: any) => t.transaction_type === 'charge')?.total_amount || 0,
      totalPayments: (arTransactions as any[]).find((t: any) => t.transaction_type === 'payment')?.total_amount || 0
    },
    cashForDeposit,
    shifts
  });
}));

// Get weekly summary report
router.get('/weekly', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate, cashierId } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ message: 'startDate and endDate are required' });
    return;
  }

  const pool = getPool();
  const conditions: string[] = ['DATE(sale_date) >= ?', 'DATE(sale_date) <= ?'];
  const params: any[] = [startDate, endDate];

  if (cashierId) {
    conditions.push('cashier_id = ?');
    params.push(cashierId);
  }

  const whereClause = conditions.join(' AND ');

  // Sales by day and payment method
  const [salesByDay] = await pool.execute(`
    SELECT 
      DATE(s.sale_date) as date,
      ps.payment_method_code,
      pm.name as payment_method_name,
      COUNT(DISTINCT ps.sale_id) as transaction_count,
      SUM(ps.amount) as total_amount
    FROM payment_splits ps
    INNER JOIN sales s ON ps.sale_id = s.id
    LEFT JOIN payment_methods pm ON ps.payment_method_code = pm.code
    WHERE ${whereClause}
    GROUP BY DATE(s.sale_date), ps.payment_method_code, pm.name
    ORDER BY date, pm.sort_order
  `, params);

  // Total sales summary
  const [totalSales] = await pool.execute(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(total_amount) as total_amount
    FROM sales
    WHERE ${whereClause}
  `, params);

  // Expenses summary
  const [totalExpenses] = await pool.execute(`
    SELECT 
      DATE(expense_date) as date,
      SUM(amount) as total_amount
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY DATE(expense_date)
    ORDER BY date
  `, [startDate, endDate]);

  res.json({
    period: { startDate, endDate },
    salesByDay,
    totalSales: (totalSales as any[])[0],
    expensesByDay: totalExpenses
  });
}));

// Get monthly summary report
router.get('/monthly', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { year, month, cashierId } = req.query;

  if (!year || !month) {
    res.status(400).json({ message: 'year and month are required' });
    return;
  }

  const pool = getPool();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

  const conditions: string[] = ['DATE(sale_date) >= ?', 'DATE(sale_date) <= ?'];
  const params: any[] = [startDate, endDate];

  if (cashierId) {
    conditions.push('cashier_id = ?');
    params.push(cashierId);
  }

  const whereClause = conditions.join(' AND ');

  // Sales summary by payment method
  const [salesByPayment] = await pool.execute(`
    SELECT 
      ps.payment_method_code,
      pm.name as payment_method_name,
      COUNT(DISTINCT ps.sale_id) as transaction_count,
      SUM(ps.amount) as total_amount
    FROM payment_splits ps
    INNER JOIN sales s ON ps.sale_id = s.id
    LEFT JOIN payment_methods pm ON ps.payment_method_code = pm.code
    WHERE ${whereClause}
    GROUP BY ps.payment_method_code, pm.name
    ORDER BY pm.sort_order
  `, params);

  // Daily breakdown
  const [dailyBreakdown] = await pool.execute(`
    SELECT 
      DATE(sale_date) as date,
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_amount
    FROM sales
    WHERE ${whereClause}
    GROUP BY DATE(sale_date)
    ORDER BY date
  `, params);

  // Expenses for the month
  const [expenses] = await pool.execute(`
    SELECT 
      category,
      SUM(amount) as total_amount,
      COUNT(*) as count
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY category
    ORDER BY total_amount DESC
  `, [startDate, endDate]);

  const [totalExpenses] = await pool.execute(`
    SELECT SUM(amount) as total FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
  `, [startDate, endDate]);

  res.json({
    period: { year, month, startDate, endDate },
    salesByPaymentMethod: salesByPayment,
    dailyBreakdown,
    expenses: {
      total: (totalExpenses as any[])[0]?.total || 0,
      byCategory: expenses
    }
  });
}));

// Get payment methods list
router.get('/payment-methods', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();

  const [methods] = await pool.execute(`
    SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order
  `);

  res.json(methods);
}));

// Get consolidated admin dashboard data
router.get('/dashboard', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Admin/Manager only
  if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
    res.status(403).json({ message: 'Insufficient permissions' });
    return;
  }

  const { startDate, endDate, cashierId, paymentMethod } = req.query;
  const pool = getPool();

  // Default to last 30 days if no dates provided
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const saleConditions: string[] = ['DATE(sale_date) >= ?', 'DATE(sale_date) <= ?'];
  const saleParams: any[] = [start, end];

  if (cashierId) {
    saleConditions.push('cashier_id = ?');
    saleParams.push(cashierId);
  }

  const saleWhereClause = saleConditions.join(' AND ');

  // Payment method filter for payment_splits
  let paymentFilter = '';
  if (paymentMethod) {
    paymentFilter = 'AND ps.payment_method_code = ?';
    saleParams.push(paymentMethod);
  }

  // Sales by payment method
  const [salesByPayment] = await pool.execute(`
    SELECT 
      ps.payment_method_code,
      pm.name as payment_method_name,
      COUNT(DISTINCT ps.sale_id) as transaction_count,
      SUM(ps.amount) as total_amount
    FROM payment_splits ps
    INNER JOIN sales s ON ps.sale_id = s.id
    LEFT JOIN payment_methods pm ON ps.payment_method_code = pm.code
    WHERE ${saleWhereClause} ${paymentFilter}
    GROUP BY ps.payment_method_code, pm.name
    ORDER BY pm.sort_order
  `, saleParams);

  // Top performing cashiers
  const [topCashiers] = await pool.execute(`
    SELECT 
      u.username,
      u.first_name,
      u.last_name,
      COUNT(s.id) as transaction_count,
      SUM(s.total_amount) as total_sales
    FROM sales s
    INNER JOIN users u ON s.cashier_id = u.id
    WHERE ${saleWhereClause.replace(/cashier_id = \?/, '1=1')}
    GROUP BY u.id, u.username, u.first_name, u.last_name
    ORDER BY total_sales DESC
    LIMIT 10
  `, [start, end]);

  // Sales trend (daily)
  const [salesTrend] = await pool.execute(`
    SELECT 
      DATE(sale_date) as date,
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_amount
    FROM sales
    WHERE ${saleWhereClause}
    GROUP BY DATE(sale_date)
    ORDER BY date
  `, saleParams.slice(0, cashierId ? 3 : 2));

  // Total expenses
  const [totalExpenses] = await pool.execute(`
    SELECT SUM(amount) as total FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
  `, [start, end]);

  // Total AR outstanding
  const [arOutstanding] = await pool.execute(`
    SELECT SUM(current_balance) as total FROM customer_accounts WHERE is_active = 1
  `);

  // Cash for deposit calculation
  const cashSales = (salesByPayment as any[]).find((p: any) => p.payment_method_code === 'CASH');
  const expensesTotal = (totalExpenses as any[])[0]?.total || 0;
  const cashForDeposit = (cashSales?.total_amount || 0) - expensesTotal;

  res.json({
    period: { startDate: start, endDate: end },
    salesByPaymentMethod: salesByPayment,
    topCashiers,
    salesTrend,
    summary: {
      totalSales: (salesByPayment as any[]).reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
      totalExpenses: expensesTotal,
      totalAR: (arOutstanding as any[])[0]?.total || 0,
      cashForDeposit
    }
  });
}));

export default router;
