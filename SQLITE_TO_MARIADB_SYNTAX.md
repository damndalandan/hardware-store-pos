# SQLite to MariaDB SQL Syntax Conversion Reference

**Project:** Hardware Store POS System  
**Purpose:** Quick reference for converting SQLite queries to MariaDB  
**Date:** October 3, 2025

---

## Table of Contents
1. [Auto Increment Syntax](#auto-increment-syntax)
2. [INSERT Syntax](#insert-syntax)
3. [Date/Time Functions](#datetime-functions)
4. [Transaction Syntax](#transaction-syntax)
5. [Data Types](#data-types)
6. [Boolean Values](#boolean-values)
7. [Common Query Patterns](#common-query-patterns)

---

## Auto Increment Syntax

### Table Creation

**SQLite:**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) NOT NULL
)
```

**MariaDB:**
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL
)
```

**Key Changes:**
- `INTEGER` → `INT`
- `AUTOINCREMENT` → `AUTO_INCREMENT`
- Position: `AUTO_INCREMENT` comes before `PRIMARY KEY`

---

## INSERT Syntax

### INSERT OR IGNORE

**SQLite:**
```sql
INSERT OR IGNORE INTO users (username, email) 
VALUES ('admin', 'admin@example.com')
```

**MariaDB:**
```sql
INSERT IGNORE INTO users (username, email) 
VALUES ('admin', 'admin@example.com')
```

**Alternative (MariaDB):**
```sql
INSERT INTO users (username, email) 
VALUES ('admin', 'admin@example.com')
ON DUPLICATE KEY UPDATE username = username
```

### INSERT OR REPLACE

**SQLite:**
```sql
INSERT OR REPLACE INTO products (id, sku, name) 
VALUES (1, 'HAM001', 'Hammer')
```

**MariaDB:**
```sql
REPLACE INTO products (id, sku, name) 
VALUES (1, 'HAM001', 'Hammer')
```

**Alternative (More explicit):**
```sql
INSERT INTO products (id, sku, name) 
VALUES (1, 'HAM001', 'Hammer')
ON DUPLICATE KEY UPDATE 
  sku = VALUES(sku),
  name = VALUES(name)
```

### Getting Last Insert ID

**SQLite:**
```typescript
const result = await db.run('INSERT INTO users...');
const lastId = result.lastID;
```

**MariaDB:**
```typescript
const [result] = await pool.execute('INSERT INTO users...');
const lastId = result.insertId;
```

---

## Date/Time Functions

### Current Timestamp

**SQLite:**
```sql
-- Function style
datetime('now')

-- Keyword style
CURRENT_TIMESTAMP
```

**MariaDB:**
```sql
-- Function style (recommended)
NOW()

-- Keyword style (also works)
CURRENT_TIMESTAMP
```

### INSERT with Current Time

**SQLite:**
```sql
INSERT INTO sales (sale_date, created_at) 
VALUES (datetime('now'), datetime('now'))
```

**MariaDB:**
```sql
INSERT INTO sales (sale_date, created_at) 
VALUES (NOW(), NOW())
```

### Default Timestamp in CREATE TABLE

**Both Compatible:**
```sql
CREATE TABLE sales (
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Date Formatting

**SQLite:**
```sql
strftime('%Y-%m-%d', sale_date)
```

**MariaDB:**
```sql
DATE_FORMAT(sale_date, '%Y-%m-%d')
```

**Common Format Patterns:**
- `%Y` - 4-digit year
- `%m` - 2-digit month
- `%d` - 2-digit day
- `%H` - Hour (00-23)
- `%i` - Minute (00-59)
- `%s` - Second (00-59)

---

## Transaction Syntax

### Basic Transactions

**SQLite:**
```sql
BEGIN TRANSACTION;
-- operations
COMMIT;
-- or
ROLLBACK;
```

**MariaDB:**
```sql
START TRANSACTION;
-- or simply: BEGIN;
-- operations
COMMIT;
-- or
ROLLBACK;
```

### Transaction in TypeScript

**SQLite Pattern:**
```typescript
export async function withTransaction<T>(
  callback: (db: Database) => Promise<T>
): Promise<T> {
  const database = getDatabase();
  
  try {
    await database.run('BEGIN TRANSACTION');
    const result = await callback(database);
    await database.run('COMMIT');
    return result;
  } catch (error) {
    await database.run('ROLLBACK');
    throw error;
  }
}
```

**MariaDB Pattern:**
```typescript
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
    throw error;
  } finally {
    connection.release();
  }
}
```

---

## Data Types

### Type Mapping Table

| SQLite Type | MariaDB Type | Notes |
|-------------|--------------|-------|
| `INTEGER` | `INT` | Standard integer |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT AUTO_INCREMENT PRIMARY KEY` | Auto-incrementing ID |
| `VARCHAR(n)` | `VARCHAR(n)` | ✓ Compatible |
| `TEXT` | `TEXT` | ✓ Compatible |
| `BLOB` | `BLOB` | ✓ Compatible |
| `REAL` | `FLOAT` or `DOUBLE` | Floating point |
| `DECIMAL(m,n)` | `DECIMAL(m,n)` | ✓ Compatible |
| `DATETIME` | `DATETIME` | ✓ Compatible |
| `DATE` | `DATE` | ✓ Compatible |
| `TIME` | `TIME` | ✓ Compatible |
| `BOOLEAN` | `TINYINT(1)` or `BOOLEAN` | See Boolean section |

### Specific Conversions in POS System

**User Table:**
```sql
-- SQLite
id INTEGER PRIMARY KEY AUTOINCREMENT
username VARCHAR(50)
is_active BOOLEAN DEFAULT 1

-- MariaDB
id INT AUTO_INCREMENT PRIMARY KEY
username VARCHAR(50)
is_active TINYINT(1) DEFAULT 1
```

**Products Table:**
```sql
-- SQLite
id INTEGER PRIMARY KEY AUTOINCREMENT
cost_price DECIMAL(10,2) NOT NULL
selling_price DECIMAL(10,2) NOT NULL

-- MariaDB (same)
id INT AUTO_INCREMENT PRIMARY KEY
cost_price DECIMAL(10,2) NOT NULL
selling_price DECIMAL(10,2) NOT NULL
```

---

## Boolean Values

### Storage

**SQLite:**
- Stores as `0` (false) or `1` (true)
- Type defined as `BOOLEAN`

**MariaDB:**
- Stores as `TINYINT(1)`
- `BOOLEAN` is alias for `TINYINT(1)`
- Values: `0` (false), `1` (true)

### Queries (Compatible)

```sql
-- Both SQLite and MariaDB
SELECT * FROM users WHERE is_active = 1;
SELECT * FROM users WHERE is_active = 0;

-- MariaDB can also use:
SELECT * FROM users WHERE is_active = TRUE;
SELECT * FROM users WHERE is_active = FALSE;
```

### INSERT (Compatible)

```sql
-- Both work the same
INSERT INTO users (is_active) VALUES (1);
INSERT INTO users (is_active) VALUES (0);
```

---

## Common Query Patterns

### SELECT Single Row

**SQLite:**
```typescript
const user = await db.get(
  'SELECT * FROM users WHERE id = ?', 
  [userId]
);
// Returns: { id: 1, username: 'admin', ... } or undefined
```

**MariaDB:**
```typescript
const [rows] = await pool.execute(
  'SELECT * FROM users WHERE id = ?', 
  [userId]
);
const user = rows[0];
// rows is array, get first element
// Returns: { id: 1, username: 'admin', ... } or undefined
```

### SELECT Multiple Rows

**SQLite:**
```typescript
const users = await db.all('SELECT * FROM users');
// Returns: [ { id: 1, ... }, { id: 2, ... } ]
```

**MariaDB:**
```typescript
const [users] = await pool.execute('SELECT * FROM users');
// Returns: [ { id: 1, ... }, { id: 2, ... } ]
// Note: execute returns [rows, fields], we destructure to get rows
```

### INSERT and Get ID

**SQLite:**
```typescript
const result = await db.run(
  'INSERT INTO users (username) VALUES (?)',
  ['admin']
);
const newUserId = result.lastID;
```

**MariaDB:**
```typescript
const [result] = await pool.execute(
  'INSERT INTO users (username) VALUES (?)',
  ['admin']
);
const newUserId = result.insertId;
```

### UPDATE

**SQLite:**
```typescript
const result = await db.run(
  'UPDATE users SET username = ? WHERE id = ?',
  ['newname', userId]
);
const rowsAffected = result.changes;
```

**MariaDB:**
```typescript
const [result] = await pool.execute(
  'UPDATE users SET username = ? WHERE id = ?',
  ['newname', userId]
);
const rowsAffected = result.affectedRows;
```

### DELETE

**SQLite:**
```typescript
const result = await db.run(
  'DELETE FROM users WHERE id = ?',
  [userId]
);
const rowsDeleted = result.changes;
```

**MariaDB:**
```typescript
const [result] = await pool.execute(
  'DELETE FROM users WHERE id = ?',
  [userId]
);
const rowsDeleted = result.affectedRows;
```

### COUNT Query

**Both Compatible:**
```sql
SELECT COUNT(*) as count FROM users
```

**SQLite:**
```typescript
const result = await db.get('SELECT COUNT(*) as count FROM users');
const count = result.count;
```

**MariaDB:**
```typescript
const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users');
const count = rows[0].count;
```

---

## PRAGMA Statements

### Foreign Keys

**SQLite (Required):**
```sql
PRAGMA foreign_keys = ON;
```

**MariaDB:**
```
Not needed - foreign keys are enabled by default
Simply define foreign keys in CREATE TABLE statements
```

### Other PRAGMA

**SQLite:**
```sql
PRAGMA table_info(users);  -- Get table schema
PRAGMA database_list;       -- List databases
```

**MariaDB Equivalent:**
```sql
DESCRIBE users;             -- Get table schema
SHOW TABLES;                -- List tables
SHOW DATABASES;             -- List databases
```

---

## CREATE TABLE Example (Complete Conversion)

### SQLite Version (Current)

```sql
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku VARCHAR(50) UNIQUE NOT NULL,
  barcode VARCHAR(100) UNIQUE,
  name VARCHAR(200) NOT NULL,
  brand VARCHAR(100),
  description TEXT,
  category_id INTEGER,
  supplier_id INTEGER,
  cost_price DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories (id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
)
```

### MariaDB Version (Converted)

```sql
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  barcode VARCHAR(100) UNIQUE,
  name VARCHAR(200) NOT NULL,
  brand VARCHAR(100),
  description TEXT,
  category_id INT,
  supplier_id INT,
  cost_price DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories (id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Differences:**
1. `INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`
2. `BOOLEAN` → `TINYINT(1)`
3. `INTEGER` (for FK) → `INT`
4. Added `ENGINE=InnoDB` (best for transactions)
5. Added charset/collation for proper UTF-8 support

---

## CREATE INDEX Examples

**Both Compatible (same syntax):**

```sql
-- Single column index
CREATE INDEX IF NOT EXISTS idx_products_sku 
ON products (sku);

-- Multiple column index
CREATE INDEX IF NOT EXISTS idx_sales_date_cashier 
ON sales (sale_date, cashier_id);

-- Unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode 
ON products (barcode);
```

---

## ALTER TABLE Examples

### Add Column

**Both Compatible:**
```sql
ALTER TABLE suppliers 
ADD COLUMN tax_id VARCHAR(50);
```

### Modify Column

**SQLite (Limited):**
```sql
-- SQLite doesn't support ALTER COLUMN well
-- Usually requires recreating table
```

**MariaDB:**
```sql
ALTER TABLE suppliers 
MODIFY COLUMN tax_id VARCHAR(100);

-- Or rename while changing type
ALTER TABLE suppliers 
CHANGE COLUMN tax_id tax_identification VARCHAR(100);
```

---

## Connection Pool vs Single Connection

### SQLite (Single File Connection)

```typescript
let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initializeDatabase() {
  db = await open({
    filename: path.join(dbDir, 'pos.db'),
    driver: sqlite3.Database
  });
}

export function getDatabase() {
  return db;
}
```

### MariaDB (Connection Pool)

```typescript
let pool: mysql.Pool;

export async function initializeDatabase() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });
}

export function getPool() {
  return pool;
}

// For backwards compatibility with existing code
export async function query(sql: string, params?: any[]) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
```

---

## Quick Find & Replace Guide

Use these patterns for bulk updates:

### Pattern 1: Auto Increment
- **Find:** `INTEGER PRIMARY KEY AUTOINCREMENT`
- **Replace:** `INT AUTO_INCREMENT PRIMARY KEY`

### Pattern 2: Boolean Type
- **Find:** `BOOLEAN`
- **Replace:** `TINYINT(1)`

### Pattern 3: Foreign Key Integer
- **Find:** `category_id INTEGER,`
- **Replace:** `category_id INT,`
- *(Repeat for all FK columns)*

### Pattern 4: Insert or Ignore
- **Find:** `INSERT OR IGNORE INTO`
- **Replace:** `INSERT IGNORE INTO`

### Pattern 5: Insert or Replace
- **Find:** `INSERT OR REPLACE INTO`
- **Replace:** `REPLACE INTO`

### Pattern 6: DateTime Now
- **Find:** `datetime('now')`
- **Replace:** `NOW()`

### Pattern 7: Begin Transaction
- **Find:** `BEGIN TRANSACTION`
- **Replace:** `START TRANSACTION`

---

## TypeScript Interface Changes

### Result Objects

**SQLite:**
```typescript
interface RunResult {
  lastID: number;
  changes: number;
}
```

**MariaDB (mysql2):**
```typescript
interface ResultSetHeader {
  insertId: number;
  affectedRows: number;
  changedRows: number;
  warningStatus: number;
}
```

### Usage Pattern Change

**SQLite:**
```typescript
const result = await db.run('INSERT...');
console.log(result.lastID, result.changes);
```

**MariaDB:**
```typescript
const [result] = await pool.execute('INSERT...');
console.log(result.insertId, result.affectedRows);
```

---

## Performance Considerations

### Index Usage (Same)
Both databases benefit from proper indexing:
```sql
CREATE INDEX idx_sales_date ON sales(sale_date);
```

### Query Optimization
- Use `EXPLAIN` to analyze queries
- Add indexes for frequently queried columns
- Use connection pooling (MariaDB)

### Connection Pooling (MariaDB Advantage)
```typescript
const pool = mysql.createPool({
  connectionLimit: 10  // Reuse connections
});
```

---

## Error Handling Changes

### SQLite Errors

```typescript
try {
  await db.run('INSERT...');
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT') {
    // Handle constraint violation
  }
}
```

### MariaDB Errors

```typescript
try {
  await pool.execute('INSERT...');
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    // Handle duplicate entry
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    // Handle foreign key violation
  }
}
```

**Common Error Codes:**
- `ER_DUP_ENTRY` - Duplicate key violation
- `ER_NO_REFERENCED_ROW_2` - Foreign key constraint fails
- `ER_ROW_IS_REFERENCED_2` - Cannot delete parent row
- `ER_DATA_TOO_LONG` - Data exceeds column size

---

## Testing Queries

### Test Connectivity

**MariaDB:**
```typescript
try {
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();
  console.log('✓ Database connected');
} catch (error) {
  console.error('✗ Database connection failed:', error);
}
```

### Verify Table Creation

```sql
SHOW TABLES;
DESCRIBE products;
```

---

## Checklist for Each File

When converting a file with SQLite queries:

- [ ] Replace `INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`
- [ ] Replace `BOOLEAN` → `TINYINT(1)`
- [ ] Replace `INTEGER` (for FKs) → `INT`
- [ ] Replace `INSERT OR IGNORE` → `INSERT IGNORE`
- [ ] Replace `INSERT OR REPLACE` → `REPLACE INTO`
- [ ] Replace `datetime('now')` → `NOW()`
- [ ] Replace `BEGIN TRANSACTION` → `START TRANSACTION`
- [ ] Remove `PRAGMA` statements
- [ ] Update `db.run()` → `pool.execute()` with destructuring
- [ ] Update `db.get()` → `pool.execute()` + `[0]`
- [ ] Update `db.all()` → `pool.execute()` destructure
- [ ] Update `result.lastID` → `result.insertId`
- [ ] Update `result.changes` → `result.affectedRows`
- [ ] Add `ENGINE=InnoDB` to CREATE TABLE
- [ ] Add charset/collation to CREATE TABLE

---

**End of Syntax Reference**

Use this document as a quick reference during migration. For complex queries, test in a MariaDB console first before updating code.
