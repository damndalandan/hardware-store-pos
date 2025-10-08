import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../database/connection';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Login endpoint
router.post('/login', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw createError('Username and password are required', 400);
  }

  const pool = await getPool();
  const [rows] = await pool.execute(
    'SELECT id, username, email, password_hash, first_name, last_name, role, is_active FROM users WHERE username = ? OR email = ?',
    [username, username]
  );
  const user = (rows as any[])[0];

  if (!user) {
    throw createError('Invalid credentials', 401);
  }

  if (!user.is_active) {
    throw createError('Account is deactivated', 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw createError('Invalid credentials', 401);
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' } as jwt.SignOptions
  );

  logger.info(`User ${user.username} logged in successfully`);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    }
  });
}));

// Register endpoint (admin only)
router.post('/register', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { username, email, password, firstName, lastName, role } = req.body;

  if (!username || !email || !password || !firstName || !lastName || !role) {
    throw createError('All fields are required', 400);
  }

  const validRoles = ['admin', 'manager', 'cashier'];
  if (!validRoles.includes(role)) {
    throw createError('Invalid role', 400);
  }

  const pool = await getPool();
  
  // Check if user already exists
  const [existingRows] = await pool.execute(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );
  const existingUser = (existingRows as any[])[0];

  if (existingUser) {
    throw createError('Username or email already exists', 409);
  }

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Insert new user
  const [result] = await pool.execute(
    `INSERT INTO users (username, email, password_hash, first_name, last_name, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, email, passwordHash, firstName, lastName, role]
  ) as any;

  logger.info(`New user created: ${username} with role ${role}`);

  res.status(201).json({
    message: 'User created successfully',
    userId: result.insertId
  });
}));

// Verify token endpoint
router.get('/verify', asyncHandler(async (req: express.Request, res: express.Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw createError('Access token required', 401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
  
  const pool = await getPool();
  const [verifyRows] = await pool.execute(
    'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
    [decoded.id]
  );
  const user = (verifyRows as any[])[0];

  if (!user || !user.is_active) {
    throw createError('Invalid token', 401);
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    }
  });
}));

export default router;