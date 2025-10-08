# SQLite to MariaDB SQL Conversion Reference

**Quick reference guide for all SQL syntax changes made during migration**

---

## 📋 Database Operations

### Connection & Initialization

| SQLite3 | MariaDB |
|---------|---------|
| `const db = getDatabase()` | `const pool = getPool()` |
| `db.get(sql, params)` | `const [rows] = await pool.execute(sql, params); const result = (rows as any[])[0];` |
| `db.all(sql, params)` | `const [rows] = await pool.execute(sql, params); const results = rows as any[];` |
| `db.run(sql, params)` | `await pool.execute(sql, params)` |

### Manual Transactions

| SQLite3 | MariaDB |
|---------|---------|
| `await db.run('BEGIN TRANSACTION')` | `const connection = await pool.getConnection(); await connection.beginTransaction();` |
| `await db.run('COMMIT')` | `await connection.commit()` |
| `await db.run('ROLLBACK')` | `await connection.rollback()` |
| N/A | `connection.release()` (in finally block) |

**Example:**
```typescript
// SQLite3
try {
  await db.run('BEGIN TRANSACTION');
  await db.run('INSERT INTO ...');
  await db.run('COMMIT');
} catch (error) {
  await db.run('ROLLBACK');
  throw error;
}

// MariaDB
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  await connection.execute('INSERT INTO ...');
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

---

## 🔢 Data Types

| SQLite3 | MariaDB | Notes |
|---------|---------|-------|
| `INTEGER` | `INT` | Standard integer |
| `INTEGER PRIMARY KEY` | `INT AUTO_INCREMENT PRIMARY KEY` | Auto-incrementing ID |
| `AUTOINCREMENT` | `AUTO_INCREMENT` | Auto-increment keyword |
| `REAL` | `DECIMAL(10,2)` or `DOUBLE` | Decimal numbers |
| `TEXT` | `VARCHAR(n)` or `TEXT` | Text/strings |
| `BLOB` | `BLOB` | Binary data (same) |
| `BOOLEAN` | `TINYINT(1)` | Boolean values (0/1) |
| `DATETIME` | `DATETIME` | Date and time (same) |
| `TIMESTAMP` | `TIMESTAMP` | Timestamp (same) |

---

## 📅 Date & Time Functions

### Current Date/Time

| SQLite3 | MariaDB |
|---------|---------|
| `date('now')` | `CURDATE()` |
| `datetime('now')` | `NOW()` |
| `time('now')` | `CURTIME()` |
| `CURRENT_TIMESTAMP` | `NOW()` or `CURRENT_TIMESTAMP` |

### Date Arithmetic

| SQLite3 | MariaDB |
|---------|---------|
| `date('now', '-7 days')` | `DATE_SUB(CURDATE(), INTERVAL 7 DAY)` |
| `date('now', '+1 month')` | `DATE_ADD(CURDATE(), INTERVAL 1 MONTH)` |
| `datetime('now', '-30 days')` | `DATE_SUB(NOW(), INTERVAL 30 DAY)` |
| `datetime('now', '+1 year')` | `DATE_ADD(NOW(), INTERVAL 1 YEAR)` |

### Date Formatting

| SQLite3 | MariaDB |
|---------|---------|
| `strftime('%Y-%m-%d', date_column)` | `DATE_FORMAT(date_column, '%Y-%m-%d')` |
| `strftime('%Y-%m', date_column)` | `DATE_FORMAT(date_column, '%Y-%m')` |
| `strftime('%H:%M:%S', date_column)` | `DATE_FORMAT(date_column, '%H:%i:%s')` |
| `strftime('%Y', date_column)` | `YEAR(date_column)` or `DATE_FORMAT(date_column, '%Y')` |
| `strftime('%m', date_column)` | `MONTH(date_column)` or `DATE_FORMAT(date_column, '%m')` |
| `strftime('%d', date_column)` | `DAY(date_column)` or `DATE_FORMAT(date_column, '%d')` |

### Date Comparisons

| SQLite3 | MariaDB |
|---------|---------|
| `julianday(date1) - julianday(date2)` | `DATEDIFF(date1, date2)` |
| `DATE(column)` | `DATE(column)` (same) |
| `date(column) >= date('now')` | `DATE(column) >= CURDATE()` |

**Common format specifiers:**
```sql
-- SQLite strftime
'%Y'    Year (4 digits)
'%m'    Month (01-12)
'%d'    Day (01-31)
'%H'    Hour (00-23)
'%M'    Minute (00-59)
'%S'    Second (00-59)

-- MariaDB DATE_FORMAT
'%Y'    Year (4 digits)
'%m'    Month (01-12)
'%d'    Day (01-31)
'%H'    Hour (00-23)
'%i'    Minute (00-59)  <- NOTE: '%i' not '%M'
'%s'    Second (00-59)  <- NOTE: '%s' not '%S'
```

---

## 🔄 INSERT Statements

### Insert with Conflict Resolution

| SQLite3 | MariaDB |
|---------|---------|
| `INSERT OR IGNORE INTO table ...` | `INSERT IGNORE INTO table ...` |
| `INSERT OR REPLACE INTO table ...` | `REPLACE INTO table ...` |
| `INSERT OR FAIL INTO table ...` | `INSERT INTO table ...` (default) |

### Getting Last Insert ID

| SQLite3 | MariaDB |
|---------|---------|
| `result.lastID` | `result.insertId` |

**Example:**
```typescript
// SQLite3
const result = await db.run('INSERT INTO products ...');
const productId = result.lastID;

// MariaDB
const [result]: any = await pool.execute('INSERT INTO products ...');
const productId = result.insertId;
```

---

## 🔧 UPDATE/DELETE Statements

### Affected Rows

| SQLite3 | MariaDB |
|---------|---------|
| `result.changes` | `result.affectedRows` |

**Example:**
```typescript
// SQLite3
const result = await db.run('UPDATE products SET ...');
console.log(`Updated ${result.changes} rows`);

// MariaDB
const [result]: any = await pool.execute('UPDATE products SET ...');
console.log(`Updated ${result.affectedRows} rows`);
```

---

## 📊 Schema Information

### Table Introspection

| SQLite3 | MariaDB |
|---------|---------|
| `PRAGMA table_info(table_name)` | `SHOW COLUMNS FROM table_name` |
| `PRAGMA table_list` | `SHOW TABLES` |
| `PRAGMA index_list(table_name)` | `SHOW INDEX FROM table_name` |

### Column Information

| SQLite3 | MariaDB |
|---------|---------|
| Access `name` property | Access `Field` property |
| Access `type` property | Access `Type` property |
| Access `notnull` property | Check `Null` property |

**Example:**
```typescript
// SQLite3
const columns = await db.all('PRAGMA table_info(products)');
columns.forEach(col => console.log(col.name));

// MariaDB
const [columns] = await pool.execute('SHOW COLUMNS FROM products');
(columns as any[]).forEach(col => console.log(col.Field));
```

---

## 🔐 CREATE TABLE Syntax

### Basic Differences

| SQLite3 | MariaDB |
|---------|---------|
| `CREATE TABLE IF NOT EXISTS` | `CREATE TABLE IF NOT EXISTS` (same) |
| `INTEGER PRIMARY KEY` | `INT AUTO_INCREMENT PRIMARY KEY` |
| No engine specified | `ENGINE=InnoDB` |
| No charset specified | `DEFAULT CHARSET=utf8mb4` |

### Reserved Keywords

| SQLite3 | MariaDB |
|---------|---------|
| `key TEXT` | `` `key` TEXT `` (backticks required) |

**Example:**
```sql
-- SQLite3
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MariaDB
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 📝 Common Column Mappings

### Inventory Table Specific

| SQLite3 Column | MariaDB Column |
|----------------|----------------|
| `quantity` | `current_stock` |

**All references updated in:**
- Inventory queries (SELECT/UPDATE/INSERT)
- Sales processing (stock deduction)
- Purchase orders (stock addition)
- Physical counts
- Low stock alerts
- Reports and analytics

---

## 🎯 Query Examples

### Date Range Queries

```sql
-- SQLite3: Last 30 days
WHERE sale_date >= date('now', '-30 days')

-- MariaDB: Last 30 days
WHERE sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
```

```sql
-- SQLite3: This month
WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now')

-- MariaDB: This month
WHERE DATE_FORMAT(sale_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
```

### Monthly Aggregation

```sql
-- SQLite3
SELECT 
  strftime('%Y-%m', sale_date) as month,
  SUM(total_amount) as revenue
FROM sales
GROUP BY strftime('%Y-%m', sale_date)

-- MariaDB
SELECT 
  DATE_FORMAT(sale_date, '%Y-%m') as month,
  SUM(total_amount) as revenue
FROM sales
GROUP BY DATE_FORMAT(sale_date, '%Y-%m')
```

### Time Differences

```sql
-- SQLite3: Days between dates
SELECT julianday(end_date) - julianday(start_date) as days_diff

-- MariaDB: Days between dates
SELECT DATEDIFF(end_date, start_date) as days_diff
```

---

## 🔍 Search Patterns

Both use LIKE operator the same way:

```sql
-- Case-insensitive search (both)
WHERE name LIKE '%search%'

-- Exact match
WHERE sku = 'EXACT-SKU'

-- Multiple conditions
WHERE (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
```

---

## ⚡ Performance Optimizations

### Indexing

```sql
-- Both SQLite and MariaDB
CREATE INDEX idx_product_sku ON products(sku);
CREATE INDEX idx_sale_date ON sales(sale_date);
CREATE INDEX idx_inventory_product ON inventory(product_id);
```

### Query Optimization

```sql
-- Use EXPLAIN to analyze queries (both)
EXPLAIN SELECT * FROM products WHERE sku = 'ABC123';

-- MariaDB additional optimization
EXPLAIN FORMAT=JSON SELECT ...;
```

---

## 📦 Backup & Restore

### SQLite3
```bash
# Backup
sqlite3 pos.db ".backup backup.db"

# Restore
sqlite3 new.db ".restore backup.db"
```

### MariaDB
```bash
# Backup
mariadb-dump -u pos_user -p pos_hardware_store > backup.sql

# Restore
mariadb -u pos_user -p pos_hardware_store < backup.sql
```

---

## 🚨 Common Migration Errors

### Error: "Unknown column 'quantity'"
**Solution:** Column renamed to `current_stock`
```sql
-- Change this:
SELECT quantity FROM inventory
-- To this:
SELECT current_stock FROM inventory
```

### Error: "You have an error in your SQL syntax near 'key'"
**Solution:** `key` is a reserved word, use backticks
```sql
-- Change this:
CREATE TABLE settings (key TEXT, value TEXT)
-- To this:
CREATE TABLE settings (`key` TEXT, value TEXT)
```

### Error: "FUNCTION strftime does not exist"
**Solution:** Use DATE_FORMAT instead
```sql
-- Change this:
strftime('%Y-%m', date_column)
-- To this:
DATE_FORMAT(date_column, '%Y-%m')
```

### Error: "lastID is not a property of result"
**Solution:** Use insertId
```sql
-- Change this:
const id = result.lastID;
-- To this:
const id = result.insertId;
```

---

## ✅ Validation Queries

### Check table exists
```sql
-- SQLite3
SELECT name FROM sqlite_master WHERE type='table' AND name='products';

-- MariaDB
SHOW TABLES LIKE 'products';
```

### Count records
```sql
-- Both (same)
SELECT COUNT(*) FROM products;
```

### Check constraints
```sql
-- SQLite3
PRAGMA foreign_key_list(table_name);

-- MariaDB
SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_NAME = 'table_name';
```

---

## 📚 Additional Resources

- MariaDB Documentation: https://mariadb.com/kb/en/
- MySQL to MariaDB Migration: https://mariadb.com/kb/en/migrating-from-sql-server-to-mariadb/
- Date Functions: https://mariadb.com/kb/en/date-time-functions/
- SQL Syntax: https://mariadb.com/kb/en/sql-statements/

---

**Last Updated:** October 3, 2025
**Migration Status:** ✅ Complete - All conversions applied
