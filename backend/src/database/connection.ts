import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';
import { createSettingsTables } from './settingsSchema';
import dotenv from 'dotenv';

dotenv.config();

// Support a dev-only SQLite fallback when USE_SQLITE_DEV=true
const useSqliteDev = (process.env.USE_SQLITE_DEV || '').toLowerCase() === 'true' || (process.env.DB_TYPE || '').toLowerCase() === 'sqlite';

// MySQL pool (used in production mode)
let pool: mysql.Pool;

// SQLite handle when in dev fallback mode
let sqliteDb: any = null; // will be an instance that exposes run/all/close if enabled

export { pool };

export async function initializeDatabase(): Promise<void> {
  try {
    if (useSqliteDev) {
      // Lazy require to avoid type issues when sqlite deps are not installed in production
      // We use the `sqlite` promise wrapper on top of `sqlite3`.
      // Keep API minimal so setup-test-users.js (which uses db.run / db.all) works.
      const sqlite3: any = require('sqlite3');
      const { open } = require('sqlite');

      const dbPath = process.env.SQLITE_FILE || './backend/data/dev.sqlite';
      sqlite3.verbose();
      sqliteDb = await open({ filename: dbPath, driver: sqlite3.Database });

      logger.info(`SQLite dev DB opened at ${dbPath}`);

      // Ensure users table exists (setup-test-users.js only requires users table)
      await sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          password TEXT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          role TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now'))
        )
      `);

      // Call any additional settings creation that can safely run against sqlite (no-op if incompatible)
      try {
        await createSettingsTables(sqliteDb as any);
      } catch (e) {
        // Non-fatal in dev fallback
        logger.warn('createSettingsTables skipped or failed for sqlite dev fallback', e);
      }

      logger.info('SQLite dev database initialized');
      return;
    }

    // Create MariaDB connection pool
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'pos_user',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pos_hardware_store',
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10000, // 10 seconds
      charset: 'utf8mb4'
    });

    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    logger.info('MariaDB connection pool created successfully');
    
    // Create tables
    await createTables();
    
    logger.info('Database connected and initialized');
  } catch (error) {
    logger.error('Database initialization error:', error);
    throw error;
  }
}

async function createTables(): Promise<void> {
  // Users table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Categories table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      parent_id INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Suppliers table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      contact_person VARCHAR(100),
      email VARCHAR(100),
      phone VARCHAR(20),
      address TEXT,
      city VARCHAR(50),
      state VARCHAR(50),
      zip_code VARCHAR(10),
      country VARCHAR(50),
      tax_id VARCHAR(50),
      website VARCHAR(255),
      notes TEXT,
      payment_terms VARCHAR(100),
      credit_limit DECIMAL(10,2),
      is_active TINYINT(1) DEFAULT 1,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Products table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku VARCHAR(50) UNIQUE NOT NULL,
      barcode VARCHAR(100) UNIQUE,
      name VARCHAR(200) NOT NULL,
      brand VARCHAR(100),
      description TEXT,
      category_id INT,
      size VARCHAR(50),
      variety VARCHAR(100),
      color VARCHAR(50),
      unit VARCHAR(20) NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      selling_price DECIMAL(10,2) NOT NULL,
      min_stock_level INT DEFAULT 0,
      max_stock_level INT DEFAULT 0,
      supplier_id INT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Inventory table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      current_stock INT NOT NULL DEFAULT 0,
      reserved_quantity INT NOT NULL DEFAULT 0,
      min_stock_level INT NOT NULL DEFAULT 0,
      location VARCHAR(100),
      last_counted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      UNIQUE(product_id, location)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Purchase orders table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_number VARCHAR(50) UNIQUE NOT NULL,
      supplier_id INT NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
      order_date DATE NOT NULL,
      expected_date DATE,
      received_date DATE,
      total_amount DECIMAL(10,2),
      notes TEXT,
      created_by INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Purchase order items table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      unit_cost DECIMAL(10,2) NOT NULL,
      received_quantity INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Sales table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_number VARCHAR(50) UNIQUE NOT NULL,
      customer_id INT,
      customer_name VARCHAR(100),
      customer_email VARCHAR(100),
      customer_phone VARCHAR(20),
      subtotal DECIMAL(10,2) NOT NULL,
      tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'completed',
      status VARCHAR(20) NOT NULL DEFAULT 'completed',
      void_reason TEXT,
      voided_by INT,
      voided_at DATETIME,
      cashier_id INT NOT NULL,
      shift_id INT,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_offline_sale TINYINT(1) DEFAULT 0,
      sync_status VARCHAR(20) DEFAULT 'synced',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users (id),
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
      FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE SET NULL,
      INDEX idx_customer_id (customer_id),
      INDEX idx_sale_date (sale_date),
      INDEX idx_shift_id (shift_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Sale items table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      total_price DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Inventory transactions table (for tracking stock movements)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('sale', 'purchase', 'adjustment', 'return')),
      quantity_change INT NOT NULL,
      reference_id INT, -- sale_id or purchase_order_id
      reference_type VARCHAR(20), -- 'sale' or 'purchase_order'
      notes TEXT,
      created_by INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Shifts table (for cashier shift management)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cashier_id INT NOT NULL,
      cashier_name VARCHAR(100) NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      starting_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      ending_cash DECIMAL(10,2),
      total_sales DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_transactions INT NOT NULL DEFAULT 0,
      total_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_card DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_mobile DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_check DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      cash_difference DECIMAL(10,2),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Create indexes for better performance
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory (product_id)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (sale_date)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales (cashier_id)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions (product_id)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts (cashier_id)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts (is_active)
  `);
  await pool.execute(`
    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts (start_time)
  `);

  logger.info('Database tables created successfully');
  
  // Create settings tables
  await createSettingsTables(pool);
}

export function getPool(): mysql.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

// (Backwards compatibility handled by exported getDatabase below which returns either sqlite or pool)

// Transaction wrapper function
export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (useSqliteDev) {
    if (sqliteDb) {
      await sqliteDb.close();
      logger.info('SQLite dev database closed');
    }
    return;
  }

  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
}

// If running in sqlite dev fallback, export a getDatabase compatible helper
export function getDatabase(): any {
  if (useSqliteDev) {
    if (!sqliteDb) throw new Error('SQLite dev DB not initialized. Call initializeDatabase() first.');
    return sqliteDb;
  }
  return getPool();
}