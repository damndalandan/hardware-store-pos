# MariaDB Connection Template
## Complete Rewrite of connection.ts for MariaDB

This file serves as a **REFERENCE TEMPLATE** for the new MariaDB-based connection.ts file.

**DO NOT COPY-PASTE BLINDLY** - Review and understand each section before implementing.

---

## File: `backend/src/database/connection.ts` (NEW VERSION)

```typescript
import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';
import { createSettingsTables } from './settingsSchema';
import dotenv from 'dotenv';

dotenv.config();

// Database connection pool
let pool: mysql.Pool;

export { pool };

/**
 * Initialize MariaDB connection pool and create database schema
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Create connection pool
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
      // Optional: Connection timeout settings
      connectTimeout: 10000, // 10 seconds
      // Optional: Character set
      charset: 'utf8mb4'
    });

    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    logger.info('MariaDB connection pool created successfully');

    // Create tables if they don't exist
    await createTables();
    
    logger.info('Database connected and initialized');
  } catch (error) {
    logger.error('Database initialization error:', error);
    throw error;
  }
}

/**
 * Create all database tables with MariaDB syntax
 */
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
      quantity INT NOT NULL DEFAULT 0,
      reserved_quantity INT NOT NULL DEFAULT 0,
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
      customer_name VARCHAR(100),
      customer_email VARCHAR(100),
      customer_phone VARCHAR(20),
      subtotal DECIMAL(10,2) NOT NULL,
      tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'completed',
      cashier_id INT NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_offline_sale TINYINT(1) DEFAULT 0,
      sync_status VARCHAR(20) DEFAULT 'synced',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users (id)
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

  // Inventory transactions table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('sale', 'purchase', 'adjustment', 'return')),
      quantity_change INT NOT NULL,
      reference_id INT,
      reference_type VARCHAR(20),
      notes TEXT,
      created_by INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Shifts table
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

/**
 * Get the database connection pool
 * @returns MySQL connection pool
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Execute a database transaction
 * Automatically handles commit/rollback and connection release
 * 
 * @param callback Function to execute within transaction
 * @returns Result of callback function
 */
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

/**
 * Close the database connection pool
 * Should be called when shutting down the application
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
}

/**
 * Helper function for backwards compatibility
 * Executes a query and returns rows
 * @deprecated Use pool.execute() directly for better control
 */
export async function query(sql: string, params?: any[]): Promise<any> {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Helper function for backwards compatibility
 * Executes a query and returns first row
 * @deprecated Use pool.execute() directly and access rows[0]
 */
export async function queryOne(sql: string, params?: any[]): Promise<any> {
  const [rows] = await pool.execute(sql, params);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined;
}
```

---

## Usage Examples

### Example 1: Simple SELECT Query

```typescript
import { getPool } from '../database/connection';

async function getUser(userId: number) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  return rows[0];
}
```

### Example 2: INSERT Query with Last Insert ID

```typescript
import { getPool } from '../database/connection';

async function createProduct(productData: any) {
  const pool = getPool();
  const [result] = await pool.execute(
    'INSERT INTO products (sku, name, price) VALUES (?, ?, ?)',
    [productData.sku, productData.name, productData.price]
  );
  
  return {
    id: result.insertId,
    ...productData
  };
}
```

### Example 3: UPDATE Query

```typescript
import { getPool } from '../database/connection';

async function updateProduct(id: number, updates: any) {
  const pool = getPool();
  const [result] = await pool.execute(
    'UPDATE products SET name = ?, price = ? WHERE id = ?',
    [updates.name, updates.price, id]
  );
  
  return {
    affectedRows: result.affectedRows,
    success: result.affectedRows > 0
  };
}
```

### Example 4: Transaction

```typescript
import { withTransaction } from '../database/connection';

async function createSale(saleData: any) {
  return await withTransaction(async (connection) => {
    // Insert sale header
    const [saleResult] = await connection.execute(
      'INSERT INTO sales (sale_number, total_amount, cashier_id) VALUES (?, ?, ?)',
      [saleData.saleNumber, saleData.total, saleData.cashierId]
    );
    
    const saleId = saleResult.insertId;
    
    // Insert sale items
    for (const item of saleData.items) {
      await connection.execute(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [saleId, item.productId, item.quantity, item.price]
      );
      
      // Update inventory
      await connection.execute(
        'UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?',
        [item.quantity, item.productId]
      );
    }
    
    return saleId;
  });
}
```

### Example 5: Multiple Rows

```typescript
import { getPool } from '../database/connection';

async function getAllProducts() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM products WHERE is_active = 1');
  return rows; // Array of products
}
```

### Example 6: COUNT Query

```typescript
import { getPool } from '../database/connection';

async function getProductCount() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM products');
  return rows[0].count;
}
```

---

## Important Notes

### ON UPDATE CURRENT_TIMESTAMP

MariaDB supports automatic timestamp updates:

```sql
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

This automatically updates the `updated_at` column when any row is modified.

### ENGINE=InnoDB

Always use InnoDB for:
- Transaction support
- Foreign key constraints
- Better concurrency
- Crash recovery

### CHARSET and COLLATION

```sql
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

- `utf8mb4` - Full UTF-8 support (including emojis)
- `utf8mb4_unicode_ci` - Case-insensitive Unicode collation

### Connection Pool Benefits

- **Reuses connections** instead of creating new ones
- **Better performance** for concurrent requests
- **Automatic connection management**
- **Connection limits** prevent database overload

### Error Handling

Common MariaDB error codes to handle:

```typescript
try {
  await pool.execute('INSERT INTO users...');
} catch (error: any) {
  if (error.code === 'ER_DUP_ENTRY') {
    // Duplicate key error
  } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    // Foreign key constraint failed
  } else if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    // Cannot delete - row is referenced
  }
  throw error;
}
```

---

## Environment Variables Required

Add to `.env`:

```env
# MariaDB Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=pos_user
DB_PASSWORD=your_secure_password_here
DB_NAME=pos_hardware_store
DB_CONNECTION_LIMIT=10
```

---

## Migration from SQLite Pattern

### OLD (SQLite):
```typescript
const db = getDatabase();
const result = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
```

### NEW (MariaDB):
```typescript
const pool = getPool();
const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
const result = rows[0];
```

---

## Testing the Connection

```typescript
async function testConnection() {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    console.log('✓ MariaDB connection successful');
    connection.release();
  } catch (error) {
    console.error('✗ MariaDB connection failed:', error);
  }
}
```

---

## Performance Tips

1. **Use prepared statements** (automatically done with execute())
2. **Index frequently queried columns**
3. **Use appropriate connection pool size**
4. **Monitor slow queries** with `EXPLAIN`
5. **Use transactions for multiple related operations**
6. **Release connections** in finally blocks
7. **Avoid SELECT *** when possible

---

**END OF TEMPLATE**

Review this carefully before implementing. Test each section individually before moving to the next.
