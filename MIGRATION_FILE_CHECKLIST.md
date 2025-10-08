# SQLite to MariaDB Migration - File-by-File Checklist

**Project:** Hardware Store POS System  
**Date:** October 3, 2025  
**Purpose:** Detailed checklist for each file requiring modification

---

## Overview

**Total Files to Modify:** 16 files  
**Critical Files:** 5  
**High Priority:** 4  
**Medium Priority:** 7

---

## Critical Priority Files (MUST COMPLETE FIRST)

### 1. `backend/package.json` ✅

**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Risk Level:** LOW

**Changes Required:**

#### Remove Dependencies:
```json
"@types/sqlite3": "^3.1.11",
"sqlite": "^5.1.1",
"sqlite3": "^5.1.7"
```

#### Add Dependencies:
```json
"mysql2": "^3.6.0"
```

#### Add Dev Dependencies:
```json
"@types/mysql2": "^3.0.0"
```

**Commands to Execute:**
```bash
cd backend
npm uninstall sqlite sqlite3 @types/sqlite3
npm install mysql2
npm install --save-dev @types/mysql2
```

**Verification:**
- [ ] Dependencies removed from package.json
- [ ] New dependencies added to package.json
- [ ] npm install completed without errors
- [ ] package-lock.json updated

---

### 2. `backend/.env` and `backend/.env.example` ✅

**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Risk Level:** LOW

**Changes Required:**

#### Current (SQLite):
```env
DATABASE_URL=sqlite:../data/pos.db
```

#### New (MariaDB):
```env
# MariaDB Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=pos_user
DB_PASSWORD=your_secure_password_here
DB_NAME=pos_hardware_store
DB_CONNECTION_LIMIT=10

# Legacy (for backwards compatibility)
DATABASE_URL=mariadb://pos_user:your_secure_password_here@localhost:3306/pos_hardware_store
```

**Verification:**
- [ ] .env updated with MariaDB config
- [ ] .env.example updated as template
- [ ] Passwords are secure
- [ ] Database name is correct

---

### 3. `backend/src/database/connection.ts` 🔴 CRITICAL

**Status:** Not Started  
**Estimated Time:** 60-90 minutes  
**Risk Level:** CRITICAL  
**Complexity:** HIGH

**SQL Syntax Changes Required:**
- 11 instances of `INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`
- Remove 1 `PRAGMA foreign_keys = ON`
- Add ENGINE and CHARSET to all tables
- 1 instance of `BEGIN TRANSACTION` → `START TRANSACTION`

**Code Architecture Changes:**

#### Complete Rewrite Needed:

**Current Structure:**
```typescript
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
let db: Database<sqlite3.Database, sqlite3.Statement>;
```

**New Structure:**
```typescript
import mysql from 'mysql2/promise';
let pool: mysql.Pool;
```

**Key Functions to Rewrite:**

1. **initializeDatabase()** - Complete rewrite
   - Replace file-based connection with pool
   - Remove PRAGMA
   - Update createTables() call

2. **createTables()** - SQL syntax updates
   - Update all CREATE TABLE statements
   - Add ENGINE=InnoDB
   - Add CHARSET specifications

3. **getDatabase()** - Return pool instead of db
   ```typescript
   // OLD
   export function getDatabase(): Database<...> { return db; }
   
   // NEW
   export function getPool(): mysql.Pool { return pool; }
   ```

4. **withTransaction()** - Complete rewrite
   ```typescript
   // OLD: Uses db.run('BEGIN TRANSACTION')
   // NEW: Uses connection.beginTransaction()
   ```

5. **closeDatabase()** - Update to close pool
   ```typescript
   // OLD: await db.close()
   // NEW: await pool.end()
   ```

**Detailed Changes:**

**Lines 1-7: Imports**
```typescript
// REMOVE
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

// ADD
import mysql from 'mysql2/promise';
```

**Lines 8-10: Database Variable**
```typescript
// REMOVE
let db: Database<sqlite3.Database, sqlite3.Statement>;
export { db };

// ADD
let pool: mysql.Pool;
export { pool };
```

**Lines 12-34: initializeDatabase()**
```typescript
// COMPLETE REWRITE - See SQLITE_TO_MARIADB_SYNTAX.md Section "Connection Pool"
```

**Lines 36-268: createTables()**
- 11 table CREATE statements need updates
- Each needs: INTEGER→INT, AUTOINCREMENT position change, ENGINE, CHARSET

**Lines 271-275: getDatabase()**
```typescript
// RENAME and UPDATE
export function getPool(): mysql.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}
```

**Lines 279-292: withTransaction()**
```typescript
// COMPLETE REWRITE for connection-based transactions
```

**Lines 294-299: closeDatabase()**
```typescript
// UPDATE
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database pool closed');
  }
}
```

**Verification:**
- [ ] All imports updated
- [ ] Pool connection created successfully
- [ ] All 11 tables create without errors
- [ ] All indexes created
- [ ] Foreign keys work
- [ ] Transactions work correctly
- [ ] Connection pooling works
- [ ] No PRAGMA statements remain

---

### 4. `backend/src/database/settingsSchema.ts` 🔴

**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Risk Level:** MEDIUM

**SQL Syntax Changes Required:**
- 4 instances of `INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`
- 3 instances of `INSERT OR IGNORE` → `INSERT IGNORE`
- Add ENGINE=InnoDB to 4 tables
- Add CHARSET to 4 tables

**Line-by-Line Changes:**

**Line 7:** system_settings table
```sql
-- BEFORE
id INTEGER PRIMARY KEY AUTOINCREMENT,

-- AFTER
id INT AUTO_INCREMENT PRIMARY KEY,
```

**Line 18:** Add ENGINE after table
```sql
-- BEFORE
)
  `);

-- AFTER
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
```

**Line 22:** business_info table
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT, → id INT AUTO_INCREMENT PRIMARY KEY,
```

**Line 45:** tax_rates table
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT, → id INT AUTO_INCREMENT PRIMARY KEY,
```

**Line 60:** backup_settings table
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT, → id INT AUTO_INCREMENT PRIMARY KEY,
```

**Line 74:** INSERT OR IGNORE
```sql
-- BEFORE
INSERT OR IGNORE INTO system_settings

-- AFTER
INSERT IGNORE INTO system_settings
```

**Line 91:** INSERT OR IGNORE
```sql
INSERT OR IGNORE INTO business_info → INSERT IGNORE INTO business_info
```

**Line 97:** INSERT OR IGNORE
```sql
INSERT OR IGNORE INTO tax_rates → INSERT IGNORE INTO tax_rates
```

**Verification:**
- [ ] 4 tables use INT AUTO_INCREMENT PRIMARY KEY
- [ ] All tables have ENGINE=InnoDB
- [ ] All tables have CHARSET=utf8mb4
- [ ] 3 INSERT IGNORE statements correct
- [ ] Settings populate correctly

---

### 5. `backend/src/database/seed.ts` 🔴

**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Risk Level:** MEDIUM

**SQL Syntax Changes Required:**
- 7 instances of `INSERT OR IGNORE` → `INSERT IGNORE`
- Update callback pattern for MariaDB

**Changes Required:**

**Lines 15, 22, 29:** User inserts
```sql
INSERT OR IGNORE INTO users → INSERT IGNORE INTO users
```

**Line 45:** Categories insert
```sql
INSERT OR IGNORE INTO categories → INSERT IGNORE INTO categories
```

**Line 52:** Suppliers insert
```sql
INSERT OR IGNORE INTO suppliers → INSERT IGNORE INTO suppliers
```

**Line 109:** Products insert
```sql
INSERT OR IGNORE INTO products → INSERT IGNORE INTO products
```

**Line 127:** Inventory insert
```sql
INSERT OR IGNORE INTO inventory → INSERT IGNORE INTO inventory
```

**Callback Pattern Changes:**

**Lines 56-64:** Get category (OLD pattern)
```typescript
// REMOVE sqlite callback pattern
const toolsCategory = await new Promise<{id: number} | undefined>((resolve) => {
  db.get('SELECT id FROM categories WHERE name = ?', ['Tools & Hardware'], (err: any, row: any) => {
    resolve(row as {id: number} | undefined);
  });
});

// ADD MariaDB pattern
const [categoryRows] = await pool.execute(
  'SELECT id FROM categories WHERE name = ?',
  ['Tools & Hardware']
);
const toolsCategory = categoryRows[0] as {id: number} | undefined;
```

**Similar changes needed for:**
- Lines 66-72: Get supplier
- Lines 100-111: Insert products with callback
- Lines 123-130: Insert inventory with callback

**Verification:**
- [ ] All INSERT OR IGNORE replaced
- [ ] All callback patterns updated to async/await
- [ ] Seed script runs without errors
- [ ] Default users created
- [ ] Categories created
- [ ] Sample products created
- [ ] Inventory records created

---

## High Priority Files (Complete After Critical)

### 6. `backend/checkProducts.js` 📝

**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Risk Level:** MEDIUM

**Changes Required:**
- 6 instances of `datetime('now')` → `NOW()`
- 1 instance of `INSERT OR REPLACE` → `REPLACE INTO`
- Update import to use pool instead of getDatabase
- Update all query patterns to MariaDB style

**Specific Changes:**

**Line 1:** Update import
```javascript
// BEFORE
const { getDatabase, initializeDatabase } = require('./dist/database/connection');

// AFTER
const { getPool, initializeDatabase } = require('./dist/database/connection');
```

**Line 6:** Update getDatabase call
```javascript
// BEFORE
const db = getDatabase();

// AFTER
const pool = getPool();
```

**Lines 10-14:** SELECT COUNT pattern
```javascript
// BEFORE
const count = await new Promise((resolve, reject) => {
  db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

// AFTER
const [rows] = await pool.execute('SELECT COUNT(*) as count FROM products');
const count = rows[0];
```

**Lines 23-33:** INSERT with datetime('now')
```javascript
// BEFORE
db.run(`INSERT INTO products (...) VALUES (..., datetime('now'), datetime('now'))`, ...)

// AFTER
const [result] = await pool.execute(`INSERT INTO products (...) VALUES (..., NOW(), NOW())`, ...);
```

**Line 69:** INSERT OR REPLACE
```javascript
// BEFORE
db.run(`INSERT OR REPLACE INTO inventory ...

// AFTER
await pool.execute(`REPLACE INTO inventory ...
```

**Verification:**
- [ ] All datetime('now') replaced with NOW()
- [ ] All callback patterns updated
- [ ] Script runs without errors
- [ ] Products check works correctly

---

### 7. `backend/insertProducts.js` 📝

**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Risk Level:** LOW

**Changes Required:**
- 2 instances of `INSERT OR REPLACE` → `REPLACE INTO`
- 4 instances of `datetime('now')` → `NOW()`
- Update to use pool.execute pattern

**Line 20:** INSERT OR REPLACE
```javascript
db.run(`INSERT OR REPLACE INTO products → REPLACE INTO products
```

**Line 22:** datetime('now')
```javascript
datetime('now'), datetime('now') → NOW(), NOW()
```

**Line 31:** INSERT OR REPLACE
```javascript
INSERT OR REPLACE INTO inventory → REPLACE INTO inventory
```

**Verification:**
- [ ] Script updated to MariaDB syntax
- [ ] Test product insertion works

---

### 8. `backend/insertSample.js` 📝

**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Risk Level:** LOW

**Changes Required:**
- 2 instances of `INSERT OR IGNORE` → `INSERT IGNORE`
- 2 instances of `INSERT OR REPLACE` → `REPLACE INTO`

**Line 9:** INSERT OR IGNORE categories
```javascript
INSERT OR IGNORE INTO categories → INSERT IGNORE INTO categories
```

**Line 12:** INSERT OR IGNORE suppliers
```javascript
INSERT OR IGNORE INTO suppliers → INSERT IGNORE INTO suppliers
```

**Line 16:** INSERT OR REPLACE products
```javascript
INSERT OR REPLACE INTO products → REPLACE INTO products
```

**Line 22:** INSERT OR REPLACE inventory
```javascript
INSERT OR REPLACE INTO inventory → REPLACE INTO inventory
```

**Verification:**
- [ ] All syntax updated
- [ ] Sample data inserts correctly

---

### 9. `setup-test-users.js` 📝

**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Risk Level:** LOW

**Changes Required:**
- 2 instances of `INSERT OR REPLACE` → `REPLACE INTO`
- 4 instances of `datetime('now')` → `NOW()`

**Line 20:** Admin user
```javascript
INSERT OR REPLACE INTO users → REPLACE INTO users
```

**Line 21:** datetime
```javascript
datetime('now'), datetime('now') → NOW(), NOW()
```

**Line 26:** Manager user
```javascript
INSERT OR REPLACE INTO users → REPLACE INTO users
```

**Line 27:** datetime
```javascript
datetime('now'), datetime('now') → NOW(), NOW()
```

**Verification:**
- [ ] Script runs successfully
- [ ] Test users created

---

## Medium Priority Files (Review & Update)

### 10. `backend/src/routes/sales.ts` 📝

**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Risk Level:** LOW

**Changes Required:**
- 2 instances of `BEGIN TRANSACTION` → `START TRANSACTION` or update to use withTransaction
- Update getDatabase() calls to getPool()
- Update query patterns to MariaDB execute() with destructuring

**Lines 32, 654:** Transaction handling
```typescript
// OPTION 1: Update syntax
await db.run('BEGIN TRANSACTION'); → await connection.query('START TRANSACTION');

// OPTION 2: Use withTransaction wrapper (RECOMMENDED)
await withTransaction(async (connection) => {
  // operations
});
```

**Verification:**
- [ ] All transactions work correctly
- [ ] Sales creation works
- [ ] Offline sales sync works

---

### 11. `backend/src/routes/inventory.ts` 📝

**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Risk Level:** LOW

**Changes Required:**
- 4 instances of `BEGIN TRANSACTION` → Use withTransaction wrapper
- Update all getDatabase() to getPool()
- Update query destructuring patterns

**Lines 117, 284, 427, 932:** Transaction handling

**Verification:**
- [ ] Inventory adjustments work
- [ ] Stock updates work
- [ ] Bulk operations work

---

### 12. `backend/src/routes/purchaseOrders.ts` 📝

**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Risk Level:** LOW

**Changes Required:**
- 2 instances of `BEGIN TRANSACTION` → Use withTransaction
- Update query patterns

**Lines 216, 350:** Transaction handling

**Verification:**
- [ ] PO creation works
- [ ] PO receiving works

---

### 13. `backend/src/routes/products.ts` 📝

**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Risk Level:** LOW

**Changes Required:**
- 4 instances of `BEGIN TRANSACTION` → Use withTransaction
- Update query patterns

**Lines 191, 473, 555, 906:** Transaction handling

**Verification:**
- [ ] Product CRUD operations work
- [ ] Bulk updates work
- [ ] CSV import works

---

### 14. `backend/src/database/quickSeed.ts` 📝

**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Risk Level:** LOW

**Changes Required:**
- 6 instances of `INSERT OR REPLACE` → `REPLACE INTO`
- 6 instances of `datetime('now')` → `NOW()`

**Lines 13, 27, 41, 55, 61, 67:** Updates needed

**Verification:**
- [ ] Quick seed works

---

### 15. Remaining Route Files 📝

**Files:**
- `backend/src/routes/auth.ts`
- `backend/src/routes/suppliers.ts`
- `backend/src/routes/users.ts`
- `backend/src/routes/reports.ts`
- `backend/src/routes/settings.ts`
- `backend/src/routes/shifts.ts`

**Status:** Not Started  
**Estimated Time:** 15-20 minutes each  
**Risk Level:** LOW

**Changes Required:**
- Update all `getDatabase()` to `getPool()`
- Update query patterns:
  - `db.get()` → `pool.execute()` + `rows[0]`
  - `db.all()` → `pool.execute()` + `rows`
  - `db.run()` → `pool.execute()` + `result`
- Update all `withTransaction()` callbacks to use connection parameter
- Update result property access:
  - `result.lastID` → `result.insertId`
  - `result.changes` → `result.affectedRows`

**Verification for Each:**
- [ ] All endpoints return correct data
- [ ] No errors in console
- [ ] Transactions work properly

---

### 16. `backend/src/database/migrate.ts` 📝

**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Risk Level:** LOW

**Changes Required:**
- None (just imports initializeDatabase which will be updated)

**Verification:**
- [ ] Migration script runs successfully

---

## Documentation Updates

### 17. `README.md` 📄

**Changes Required:**
- Update database section
- Change SQLite references to MariaDB
- Add MariaDB installation instructions
- Update environment variable examples

**Current Text to Update:**
```markdown
- **SQLite** for development, **PostgreSQL** for production
```

**New Text:**
```markdown
- **MariaDB** for both development and production
```

---

### 18. `.github/copilot-instructions.md` 📄

**Changes Required:**
- Update Database section
- Change SQLite to MariaDB
- Update connection details

---

## Master Verification Checklist

After completing ALL file updates, verify:

### Database Connection
- [ ] MariaDB installed and running
- [ ] Database created: pos_hardware_store
- [ ] User created with proper permissions
- [ ] Pool connection works
- [ ] Connection pooling tested

### Schema
- [ ] All 15 tables created
- [ ] All foreign keys work
- [ ] All indexes created
- [ ] Data types correct
- [ ] Default values correct

### CRUD Operations
- [ ] Create operations work
- [ ] Read operations work
- [ ] Update operations work
- [ ] Delete operations work

### Transactions
- [ ] Transaction commit works
- [ ] Transaction rollback works
- [ ] Nested transactions handled
- [ ] Connection release works

### Application Features
- [ ] User login works
- [ ] Product management works
- [ ] Inventory tracking works
- [ ] Sales processing works
- [ ] Purchase orders work
- [ ] Reporting works
- [ ] Settings work
- [ ] Shift management works

### Performance
- [ ] Query response times acceptable
- [ ] No connection leaks
- [ ] Pool size appropriate
- [ ] Indexes effective

### Error Handling
- [ ] Duplicate key errors handled
- [ ] Foreign key errors handled
- [ ] Connection errors handled
- [ ] Transaction errors handled

---

## Migration Order (CRITICAL - Follow This Sequence)

1. ✅ Backup current SQLite database
2. ✅ Install MariaDB
3. ✅ Create database and user
4. ✅ Update package.json and install dependencies
5. ✅ Update .env files
6. 🔴 Update connection.ts (MOST CRITICAL)
7. 🔴 Update settingsSchema.ts
8. 🔴 Update seed.ts
9. 📝 Test database initialization: `npm run migrate`
10. 📝 Update all utility scripts (checkProducts, insertProducts, etc.)
11. 📝 Update all route files
12. 📝 Update quickSeed.ts
13. 📝 Test all endpoints
14. 📝 Update documentation
15. ✅ Final verification

---

## Rollback Plan

If issues occur at any step:

1. **Stop immediately**
2. **Document the error**
3. **Revert code changes:**
   ```bash
   git checkout .
   ```
4. **Restore SQLite dependencies:**
   ```bash
   npm install sqlite sqlite3 @types/sqlite3
   ```
5. **Restore .env file**
6. **Test application works with SQLite**
7. **Analyze issue before retrying**

---

## Success Criteria

Migration is complete when:

- [ ] All 16 files updated
- [ ] All syntax changes applied
- [ ] Application starts without errors
- [ ] All routes respond correctly
- [ ] All tests pass
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Team trained on MariaDB differences

---

## Notes

- Keep SQLite database backup until production proven stable
- Document any issues encountered
- Update this checklist as you progress
- Each checkbox represents a test or verification step
- Do not skip verification steps

---

**Status:** READY FOR EXECUTION  
**Last Updated:** October 3, 2025  
**Estimated Total Time:** 8-12 hours
