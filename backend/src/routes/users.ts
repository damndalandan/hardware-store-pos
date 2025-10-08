import express from 'express';
import Joi from 'joi';
import bcrypt from 'bcrypt';
import { getPool, withTransaction } from '../database/connection';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const userSchema = Joi.object({
  username: Joi.string().required().min(3).max(50).trim().pattern(/^[a-zA-Z0-9_]+$/),
  email: Joi.string().email().required().max(100).trim(),
  password: Joi.string().required().min(6).max(100),
  firstName: Joi.string().required().min(1).max(50).trim(),
  lastName: Joi.string().required().min(1).max(50).trim(),
  role: Joi.string().required().valid('admin', 'manager', 'cashier'),
  isActive: Joi.boolean().default(true)
});

const updateUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).trim().pattern(/^[a-zA-Z0-9_]+$/),
  email: Joi.string().email().max(100).trim(),
  firstName: Joi.string().min(1).max(50).trim(),
  lastName: Joi.string().min(1).max(50).trim(),
  role: Joi.string().valid('admin', 'manager', 'cashier'),
  isActive: Joi.boolean()
});

const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().required().min(6).max(100)
});

// Get all users with filtering and pagination
router.get('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    page = 1,
    limit = 50,
    search,
    role,
    is_active = 'all',
    sort_by = 'created_at',
    sort_order = 'DESC'
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const pool = await getPool();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (is_active !== 'all') {
    whereClause += ' AND u.is_active = ?';
    params.push(is_active === 'true' ? 1 : 0);
  }

  if (search) {
    whereClause += ' AND (u.username LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (role) {
    whereClause += ' AND u.role = ?';
    params.push(role);
  }

  const validSortColumns = ['username', 'first_name', 'last_name', 'email', 'role', 'created_at'];
  const sortColumn = validSortColumns.includes(sort_by as string) ? sort_by : 'created_at';
  const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';

  // Get users with activity stats
  const [rows] = await pool.execute(`
    SELECT 
      u.id,
      u.username,
      u.email,
      u.first_name,
      u.last_name,
      u.role,
      u.is_active,
      u.created_at,
      u.updated_at,
      COUNT(DISTINCT s.id) as total_sales,
      SUM(s.total_amount) as total_sales_amount,
      MAX(s.sale_date) as last_sale_date
    FROM users u
    LEFT JOIN sales s ON u.id = s.cashier_id
    ${whereClause}
    GROUP BY u.id
    ORDER BY u.${sortColumn} ${sortDirection}
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const users = rows as any[];

  // Remove password from response
  const safeUsers = users.map(user => {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  });

  // Get total count
  const [countRows] = await pool.execute(`
    SELECT COUNT(*) as total FROM users u ${whereClause}
  `, params);
  const { total } = (countRows as any[])[0];

  res.json({
    users: safeUsers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get user by ID
router.get('/:id', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = await getPool();

  // Allow users to view their own profile
  if (req.user!.role === 'cashier' && req.user!.id !== parseInt(id)) {
    throw createError('Access denied', 403);
  }

  const [userRows] = await pool.execute(`
    SELECT 
      u.id,
      u.username,
      u.email,
      u.first_name,
      u.last_name,
      u.role,
      u.is_active,
      u.created_at,
      u.updated_at,
      COUNT(DISTINCT s.id) as total_sales,
      SUM(s.total_amount) as total_sales_amount,
      MAX(s.sale_date) as last_sale_date
    FROM users u
    LEFT JOIN sales s ON u.id = s.cashier_id
    WHERE u.id = ?
    GROUP BY u.id
  `, [id]);
  const user = (userRows as any[])[0];

  if (!user) {
    throw createError('User not found', 404);
  }

  // Get recent activity
  const [salesRows] = await pool.execute(`
    SELECT 
      s.id,
      s.sale_number,
      s.sale_date,
      s.total_amount,
      s.customer_name
    FROM sales s
    WHERE s.cashier_id = ?
    ORDER BY s.sale_date DESC
    LIMIT 10
  `, [id]);
  const recentSales = salesRows as any[];

  const { password_hash, ...safeUser } = user;
  res.json({
    ...safeUser,
    recentSales
  });
}));

// Create user
router.post('/', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { username, email, password, firstName, lastName, role, isActive } = value;
  const pool = await getPool();

  // Check for duplicate username
  const [usernameRows] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
  const existingUsername = (usernameRows as any[])[0];
  if (existingUsername) {
    throw createError('Username already exists', 400);
  }

  // Check for duplicate email
  const [emailRows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  const existingEmail = (emailRows as any[])[0];
  if (existingEmail) {
    throw createError('Email already exists', 400);
  }

  const result = await withTransaction(async (connection) => {
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [userResult] = await connection.execute(`
      INSERT INTO users (
        username, email, password_hash, first_name, last_name, role, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [username, email, passwordHash, firstName, lastName, role, isActive ? 1 : 0]) as any;

    logger.info(`User created: ${username} (${role}) by ${req.user!.username}`);
    return userResult;
  });

  res.status(201).json({
    message: 'User created successfully',
    userId: result.insertId
  });
}));

// Update user
router.put('/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { error, value } = updateUserSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { username, email, firstName, lastName, role, isActive } = value;
  const pool = await getPool();

  // Check if user exists
  const [existingRows] = await pool.execute('SELECT username FROM users WHERE id = ?', [id]);
  const existingUser = (existingRows as any[])[0];
  if (!existingUser) {
    throw createError('User not found', 404);
  }

  // Check for duplicate username (excluding current user)
  if (username) {
    const [dupUsernameRows] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
    const duplicateUsername = (dupUsernameRows as any[])[0];
    if (duplicateUsername) {
      throw createError('Username already exists', 400);
    }
  }

  // Check for duplicate email (excluding current user)
  if (email) {
    const [dupEmailRows] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    const duplicateEmail = (dupEmailRows as any[])[0];
    if (duplicateEmail) {
      throw createError('Email already exists', 400);
    }
  }

  await withTransaction(async (connection) => {
    const updates = [];
    const params = [];

    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (firstName !== undefined) { updates.push('first_name = ?'); params.push(firstName); }
    if (lastName !== undefined) { updates.push('last_name = ?'); params.push(lastName); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await connection.execute(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `, params);

    logger.info(`User updated: ${existingUser.username} by ${req.user!.username}`);
  });

  res.json({ message: 'User updated successfully' });
}));

// Delete user (soft delete)
router.delete('/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const pool = await getPool();

  // Prevent self-deletion
  if (req.user!.id === parseInt(id)) {
    throw createError('Cannot delete your own account', 400);
  }

  const [userRows] = await pool.execute('SELECT username FROM users WHERE id = ?', [id]);
  const user = (userRows as any[])[0];
  if (!user) {
    throw createError('User not found', 404);
  }

  await withTransaction(async (connection) => {
    await connection.execute(
      'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    logger.info(`User deactivated: ${user.username} by ${req.user!.username}`);
  });

  res.json({ message: 'User deactivated successfully' });
}));

// Change password
router.post('/change-password', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = passwordChangeSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { currentPassword, newPassword } = value;
  const pool = await getPool();

  // Get current user's password hash
  const [userRows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
  const user = (userRows as any[])[0];
  if (!user) {
    throw createError('User not found', 404);
  }

  // Verify current password
  const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!passwordMatch) {
    throw createError('Current password is incorrect', 400);
  }

  await withTransaction(async (connection) => {
    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await connection.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, req.user!.id]
    );

    logger.info(`Password changed for user: ${req.user!.username}`);
  });

  res.json({ message: 'Password changed successfully' });
}));

// Reset password (admin only)
router.post('/:id/reset-password', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    throw createError('New password must be at least 6 characters long', 400);
  }

  const pool = await getPool();

  const [userRows] = await pool.execute('SELECT username FROM users WHERE id = ?', [id]);
  const user = (userRows as any[])[0];
  if (!user) {
    throw createError('User not found', 404);
  }

  await withTransaction(async (connection) => {
    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await connection.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, id]
    );

    logger.info(`Password reset for user: ${user.username} by ${req.user!.username}`);
  });

  res.json({ message: 'Password reset successfully' });
}));

// Get user activity logs
router.get('/:id/activity', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  const pool = await getPool();

  // Allow users to view their own activity
  if (req.user!.role === 'cashier' && req.user!.id !== parseInt(id)) {
    throw createError('Access denied', 403);
  }

  // Get sales activity
  const [activityRows] = await pool.execute(`
    SELECT 
      'sale' as activity_type,
      s.sale_number as reference,
      s.sale_date as activity_date,
      s.total_amount as amount,
      'Sale completed' as description
    FROM sales s
    WHERE s.cashier_id = ?
    ORDER BY s.sale_date DESC
    LIMIT ? OFFSET ?
  `, [id, Number(limit), Number(offset)]);
  const salesActivity = activityRows as any[];

  res.json({
    activities: salesActivity
  });
}));

// Get user statistics
router.get('/stats/summary', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    start_date = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0]
  } = req.query;

  const pool = await getPool();

  // User role distribution
  const [roleRows] = await pool.execute(`
    SELECT 
      role,
      COUNT(*) as count,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
    FROM users
    GROUP BY role
    ORDER BY count DESC
  `);
  const roleDistribution = roleRows as any[];

  // User activity summary
  const [activityRows] = await pool.execute(`
    SELECT 
      u.id,
      u.username,
      u.first_name,
      u.last_name,
      u.role,
      COUNT(s.id) as sales_count,
      SUM(s.total_amount) as total_sales_amount,
      MAX(s.sale_date) as last_sale_date
    FROM users u
    LEFT JOIN sales s ON u.id = s.cashier_id 
      AND DATE(s.sale_date) >= DATE(?) 
      AND DATE(s.sale_date) <= DATE(?)
    WHERE u.is_active = 1
    GROUP BY u.id
    ORDER BY total_sales_amount DESC
  `, [start_date, end_date]);
  const activitySummary = activityRows as any[];

  // Recent user registrations
  const [recentRows] = await pool.execute(`
    SELECT 
      username,
      first_name,
      last_name,
      role,
      created_at
    FROM users
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ORDER BY created_at DESC
    LIMIT 10
  `);
  const recentRegistrations = recentRows as any[];

  res.json({
    period: { start_date, end_date },
    roleDistribution,
    activitySummary,
    recentRegistrations
  });
}));

export default router;