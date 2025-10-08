import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import productImportRoutes from './routes/productImport';
import inventoryRoutes from './routes/inventory';
import salesRoutes from './routes/sales';
import supplierRoutes from './routes/suppliers';
import purchaseOrderRoutes from './routes/purchaseOrders';
import userRoutes from './routes/users';
import reportRoutes from './routes/reports';
import shiftRoutes from './routes/shifts';
import settingsRoutes from './routes/settings';
import expensesRoutes from './routes/expenses';
import pettyCashRoutes from './routes/pettyCash';
import customerAccountsRoutes from './routes/customerAccounts';
import customersRoutes from './routes/customers';
import dailyReportsRoutes from './routes/dailyReports';

// Import middleware
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Import database
import { initializeDatabase, getPool } from './database/connection';
import { createEnhancedTables } from './database/enhancedSchema';
import { createCustomersTable } from './database/customersSchema';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.FRONTEND_URL || "http://localhost:3000").split(','),
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Rate limiting - more generous for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // increased from 100 to 500 requests per windowMs for development
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: (process.env.FRONTEND_URL || "http://localhost:3000").split(','),
  credentials: true
}));
app.use(compression());
app.use(limiter);
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/products', authenticateToken, productImportRoutes); // Product import routes
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/suppliers', authenticateToken, supplierRoutes);
app.use('/api/purchase-orders', authenticateToken, purchaseOrderRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);
app.use('/api/shifts', authenticateToken, shiftRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/expenses', authenticateToken, expensesRoutes);
app.use('/api/petty-cash', authenticateToken, pettyCashRoutes);
app.use('/api/customers', authenticateToken, customersRoutes);
app.use('/api/customer-accounts', authenticateToken, customerAccountsRoutes);
app.use('/api/daily-reports', authenticateToken, dailyReportsRoutes);

// Socket.IO for real-time updates
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    // Add token verification logic here
    next();
  } else {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);
  
  socket.on('join-store', (storeId) => {
    socket.join(`store-${storeId}`);
    logger.info(`Socket ${socket.id} joined store ${storeId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Create enhanced tables for new features
    try {
      const pool = getPool();
      await createEnhancedTables(pool);
      await createCustomersTable(pool);
      logger.info('Enhanced tables and customers table initialized successfully');
      
      // Run migrations
      const { addCustomerIdToSales } = await import('./database/migrations/addCustomerIdToSales');
      await addCustomerIdToSales(pool);
      logger.info('Database migrations completed successfully');
    } catch (enhancedError) {
      logger.warn('Enhanced tables initialization or migrations skipped:', enhancedError);
    }
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

startServer();

export { io };
