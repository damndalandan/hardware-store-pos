# SQLite to MariaDB Migration Plan
## Hardware Store POS System Database Migration

**Date Created:** October 3, 2025  
**Migration Type:** SQLite3 → MariaDB  
**Risk Level:** HIGH - Zero tolerance for errors  
**Status:** Phase 1 - Pre-Migration Analysis COMPLETE

---

## Executive Summary

This document outlines the complete migration strategy from SQLite3 to MariaDB for the Hardware Store POS System. The system currently uses SQLite for development and PostgreSQL for production. This migration will replace SQLite with MariaDB for both development and production environments.

---

## Phase 1: Pre-Migration Analysis ✅ COMPLETE

### 1.1 Database Discovery - FINDINGS

#### Framework Detection
- **Backend Framework:** Node.js with Express.js + TypeScript
- **Database Abstraction:** Direct SQL using `sqlite` and `sqlite3` packages
- **ORM:** None (Direct SQL queries)
- **Connection Pattern:** Singleton pattern with transaction wrapper

#### SQLite References Found

**Primary Database Connection File:**
- `backend/src/database/connection.ts` - Main database connection logic

**Schema Definition Files:**
- `backend/src/database/connection.ts` - Table creation (lines 36-268)
- `backend/src/database/settingsSchema.ts` - Settings tables

**Migration & Seeding:**
- `backend/src/database/migrate.ts` - Migration runner
- `backend/src/database/seed.ts` - Database seeding
- `backend/src/database/quickSeed.ts` - Quick seed utility

**Utility Scripts (JavaScript):**
- `backend/checkProducts.js` - Product verification script
- `backend/insertProducts.js` - Direct SQLite product insertion
- `backend/insertSample.js` - Sample data insertion
- `setup-test-users.js` - Test user creation

**Route Files Using Database (94+ references):**
- `backend/src/routes/auth.ts` (3 getDatabase calls)
- `backend/src/routes/products.ts` (18 getDatabase calls)
- `backend/src/routes/inventory.ts` (11 getDatabase calls)
- `backend/src/routes/sales.ts` (7 getDatabase calls)
- `backend/src/routes/suppliers.ts` (10 getDatabase + 4 withTransaction)
- `backend/src/routes/users.ts` (16 getDatabase + 6 withTransaction)
- `backend/src/routes/purchaseOrders.ts` (7 getDatabase calls)
- `backend/src/routes/reports.ts` (6 getDatabase calls)
- `backend/src/routes/settings.ts` (10 getDatabase calls)
- `backend/src/routes/shifts.ts` (unknown - needs verification)

#### Dependencies Found

**Current SQLite Dependencies:**
```json
{
  "@types/sqlite3": "^3.1.11",
  "sqlite": "^5.1.1",
  "sqlite3": "^5.1.7"
}
```

**Required MariaDB Dependencies:**
```json
{
  "mysql2": "^3.6.0",         // MariaDB driver (MySQL 2 compatible)
  "@types/mysql2": "^3.0.0"   // TypeScript types
}
```

#### Environment Configuration

**Current Database URL:**
```
DATABASE_URL=sqlite:../data/pos.db
```

**Required MariaDB URL:**
```
DATABASE_URL=mariadb://username:password@localhost:3306/pos_hardware_store
```

---

## Phase 2: Critical Differences Analysis

### 2.1 SQL Syntax Differences

| Feature | SQLite | MariaDB | Action Required |
|---------|--------|---------|-----------------|
| Auto Increment | `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT AUTO_INCREMENT PRIMARY KEY` | Replace all |
| Boolean Type | `BOOLEAN` (stored as 0/1) | `TINYINT(1)` or `BOOLEAN` | Convert syntax |
| DateTime Default | `DATETIME DEFAULT CURRENT_TIMESTAMP` | Same (compatible) | ✓ No change |
| VARCHAR Limits | No strict limits | Requires max length | ✓ Already defined |
| PRAGMA | `PRAGMA foreign_keys = ON` | Foreign keys ON by default | Remove PRAGMA |
| Transactions | `BEGIN TRANSACTION` | `START TRANSACTION` or `BEGIN` | Update syntax |
| INSERT OR IGNORE | `INSERT OR IGNORE` | `INSERT IGNORE` | Replace syntax |
| INSERT OR REPLACE | `INSERT OR REPLACE` | `REPLACE INTO` | Replace syntax |
| UNIQUE Constraint | Same | Same | ✓ No change |
| Foreign Keys | Must enable with PRAGMA | Enabled by default | Remove PRAGMA |

### 2.2 Data Type Mapping

| SQLite Type | MariaDB Type | Notes |
|-------------|--------------|-------|
| INTEGER | INT | Standard conversion |
| VARCHAR(n) | VARCHAR(n) | Compatible |
| TEXT | TEXT | Compatible |
| DECIMAL(m,n) | DECIMAL(m,n) | Compatible |
| DATETIME | DATETIME | Compatible |
| BOOLEAN | TINYINT(1) | MariaDB boolean alias |
| DATE | DATE | Compatible |

### 2.3 Function Differences

| SQLite Function | MariaDB Function | Usage in Codebase |
|-----------------|------------------|-------------------|
| `datetime('now')` | `NOW()` or `CURRENT_TIMESTAMP` | Many INSERT statements |
| `CURRENT_TIMESTAMP` | `CURRENT_TIMESTAMP` | ✓ Compatible |
| `COUNT(*)` | `COUNT(*)` | ✓ Compatible |
| `strftime()` | `DATE_FORMAT()` | Check reports |

---

## Phase 3: Database Schema Analysis

### 3.1 Tables to Migrate (13 tables)

1. **users** - User authentication and management
2. **categories** - Product categories (self-referencing)
3. **suppliers** - Supplier information
4. **products** - Core product catalog
5. **inventory** - Stock levels
6. **purchase_orders** - Purchase order headers
7. **purchase_order_items** - PO line items
8. **sales** - Sales transaction headers
9. **sale_items** - Sales line items
10. **inventory_transactions** - Stock movement log
11. **shifts** - Cashier shift management
12. **system_settings** - Configuration settings
13. **business_info** - Business details
14. **tax_rates** - Tax configuration
15. **backup_settings** - Backup configuration

### 3.2 Foreign Key Relationships

```
users
  ├── suppliers.created_by → users.id
  ├── purchase_orders.created_by → users.id
  ├── sales.cashier_id → users.id
  ├── shifts.cashier_id → users.id
  └── inventory_transactions.created_by → users.id

categories
  └── categories.parent_id → categories.id (self-reference)

suppliers
  ├── products.supplier_id → suppliers.id
  └── purchase_orders.supplier_id → suppliers.id

products
  ├── inventory.product_id → products.id
  ├── purchase_order_items.product_id → products.id
  ├── sale_items.product_id → products.id
  └── inventory_transactions.product_id → products.id

purchase_orders
  └── purchase_order_items.purchase_order_id → purchase_orders.id

sales
  └── sale_items.sale_id → sales.id
```

### 3.3 Indexes to Create

```sql
-- Performance indexes (from connection.ts lines 252-265)
idx_products_sku
idx_products_barcode
idx_products_category
idx_inventory_product
idx_sales_date
idx_sales_cashier
idx_inventory_transactions_product
idx_shifts_cashier
idx_shifts_active
idx_shifts_date
```

---

## Phase 4: Code Migration Strategy

### 4.1 Files Requiring Modification

**Critical Priority (Must Update):**
1. `backend/src/database/connection.ts` - Complete rewrite
2. `backend/package.json` - Dependency updates
3. `backend/.env` and `.env.example` - Connection string
4. `backend/src/database/seed.ts` - SQL syntax updates
5. `backend/src/database/settingsSchema.ts` - SQL syntax updates

**High Priority (SQL Syntax Updates):**
6. `backend/checkProducts.js` - SQL syntax
7. `backend/insertProducts.js` - SQL syntax
8. `backend/insertSample.js` - SQL syntax
9. `setup-test-users.js` - SQL syntax

**Medium Priority (Query Review):**
10. All route files (10 files) - Review queries for compatibility

**Low Priority (Documentation):**
11. `README.md` - Update documentation
12. `.github/copilot-instructions.md` - Update instructions

### 4.2 Connection Layer Rewrite Strategy

**Current Architecture:**
```typescript
// SQLite pattern
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initializeDatabase() {
  db = await open({
    filename: path.join(dbDir, 'pos.db'),
    driver: sqlite3.Database
  });
  await db.exec('PRAGMA foreign_keys = ON');
}
```

**New MariaDB Architecture:**
```typescript
// MariaDB pattern
import mysql from 'mysql2/promise';

let pool: mysql.Pool;

export async function initializeDatabase() {
  pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}
```

### 4.3 Query Pattern Updates

**Pattern 1: Direct Execution**
```typescript
// BEFORE (SQLite)
await db.exec(`CREATE TABLE...`);

// AFTER (MariaDB)
await pool.query(`CREATE TABLE...`);
```

**Pattern 2: Parameterized Queries**
```typescript
// BEFORE (SQLite)
await db.run('INSERT INTO users (...) VALUES (?, ?)', [val1, val2]);

// AFTER (MariaDB)
await pool.execute('INSERT INTO users (...) VALUES (?, ?)', [val1, val2]);
```

**Pattern 3: SELECT Queries**
```typescript
// BEFORE (SQLite)
const result = await db.get('SELECT * FROM users WHERE id = ?', [id]);
const results = await db.all('SELECT * FROM users');

// AFTER (MariaDB)
const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
const result = rows[0];
const [results] = await pool.execute('SELECT * FROM users');
```

**Pattern 4: Transactions**
```typescript
// BEFORE (SQLite)
await db.run('BEGIN TRANSACTION');
// ... operations
await db.run('COMMIT');

// AFTER (MariaDB)
const connection = await pool.getConnection();
await connection.beginTransaction();
try {
  // ... operations
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

---

## Phase 5: Migration Execution Plan

### 5.1 Pre-Migration Checklist

- [ ] Backup current SQLite database
- [ ] Install MariaDB server locally
- [ ] Create new database: `pos_hardware_store`
- [ ] Create database user with privileges
- [ ] Test MariaDB connection
- [ ] Install npm dependencies (mysql2)

### 5.2 Migration Steps (Sequential - DO NOT SKIP)

**Step 1: Install MariaDB & Create Database**
```bash
# Windows - Install MariaDB
winget install MariaDB.Server

# Start MariaDB service
net start MariaDB

# Connect to MariaDB
mysql -u root -p

# Create database and user
CREATE DATABASE pos_hardware_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pos_user'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON pos_hardware_store.* TO 'pos_user'@'localhost';
FLUSH PRIVILEGES;
```

**Step 2: Update Dependencies**
```bash
cd backend
npm uninstall sqlite sqlite3 @types/sqlite3
npm install mysql2 @types/mysql2
```

**Step 3: Update Environment Variables**
```env
DATABASE_URL=mariadb://pos_user:secure_password_here@localhost:3306/pos_hardware_store
```

**Step 4: Rewrite connection.ts**
- Create new MariaDB connection pool
- Convert table creation SQL
- Update transaction wrapper
- Update getDatabase function

**Step 5: Update Schema Files**
- Convert settingsSchema.ts to MariaDB syntax
- Update all `AUTOINCREMENT` → `AUTO_INCREMENT`
- Update all `INSERT OR IGNORE` → `INSERT IGNORE`
- Remove PRAGMA statements

**Step 6: Update Seed Files**
- Update seed.ts SQL syntax
- Convert datetime('now') → NOW()
- Update INSERT OR IGNORE syntax

**Step 7: Test Database Initialization**
```bash
npm run migrate
```

**Step 8: Update Route Files**
- Review all route queries
- Test each endpoint
- Update any SQLite-specific syntax

**Step 9: Data Migration (if needed)**
- Export data from SQLite
- Transform to MariaDB format
- Import to MariaDB
- Validate data integrity

**Step 10: Testing Phase**
- Unit tests for database operations
- Integration tests for all routes
- Performance testing
- Offline sync testing

---

## Phase 6: Testing & Validation Plan

### 6.1 Database Connection Tests
- [ ] Pool creation successful
- [ ] Connection acquisition works
- [ ] Connection release works
- [ ] Connection timeout handling
- [ ] Error handling for failed connections

### 6.2 Schema Validation Tests
- [ ] All tables created
- [ ] All indexes created
- [ ] Foreign keys enforced
- [ ] Default values correct
- [ ] Data types correct

### 6.3 CRUD Operation Tests
- [ ] INSERT operations
- [ ] SELECT operations (single & multiple)
- [ ] UPDATE operations
- [ ] DELETE operations
- [ ] Transaction commit
- [ ] Transaction rollback

### 6.4 Application Feature Tests
- [ ] User authentication
- [ ] Product management
- [ ] Inventory tracking
- [ ] Sales processing
- [ ] Purchase orders
- [ ] Reporting functions
- [ ] Settings management
- [ ] Shift management

### 6.5 Performance Tests
- [ ] Query response times
- [ ] Concurrent connection handling
- [ ] Large dataset operations
- [ ] Index effectiveness

---

## Phase 7: Rollback Plan

### 7.1 Rollback Triggers
- Database connection failures
- Data corruption detected
- Critical functionality broken
- Performance degradation > 50%

### 7.2 Rollback Steps
1. Stop application server
2. Restore SQLite dependencies
3. Revert code changes (git)
4. Restore SQLite database from backup
5. Test application functionality
6. Document rollback reason

### 7.3 Backup Strategy
- Full SQLite database backup before migration
- Git commit before any code changes
- Document current state
- Keep MariaDB database for investigation

---

## Phase 8: Post-Migration Tasks

### 8.1 Immediate Post-Migration
- [ ] Verify all routes working
- [ ] Check logs for errors
- [ ] Monitor performance metrics
- [ ] Validate data integrity

### 8.2 Documentation Updates
- [ ] Update README.md
- [ ] Update .github/copilot-instructions.md
- [ ] Document MariaDB setup process
- [ ] Update deployment guides

### 8.3 Optimization
- [ ] Analyze slow queries
- [ ] Add additional indexes if needed
- [ ] Configure MariaDB parameters
- [ ] Set up automated backups

---

## Risk Assessment

### High Risk Areas

1. **Transaction Handling**
   - Risk: Different transaction semantics
   - Mitigation: Extensive testing of withTransaction wrapper

2. **Date/Time Functions**
   - Risk: Different datetime handling
   - Mitigation: Audit all date queries, standardize to compatible functions

3. **Insert Syntax**
   - Risk: INSERT OR IGNORE/REPLACE differences
   - Mitigation: Find-and-replace with verification

4. **Offline Sync**
   - Risk: IndexedDB sync might behave differently
   - Mitigation: Test offline scenarios extensively

### Medium Risk Areas

1. **Performance Changes**
   - Connection pooling vs. file-based
   - Network latency vs. local file access

2. **Data Type Conversions**
   - Boolean representation
   - Decimal precision

### Low Risk Areas

1. **Basic CRUD Operations**
   - Standard SQL syntax
   - Well-tested patterns

---

## Success Criteria

✅ **Migration Successful When:**

1. All tables created without errors
2. All foreign keys enforced
3. All indexes created
4. All route endpoints functional
5. All tests passing
6. No data loss
7. Performance acceptable (< 20% slower than SQLite)
8. Offline sync working
9. No console errors
10. Production-ready configuration documented

---

## Timeline Estimate

- **Phase 1:** Pre-Migration Analysis - ✅ COMPLETE (2 hours)
- **Phase 2:** MariaDB Installation & Setup - 1 hour
- **Phase 3:** Code Migration - 4-6 hours
- **Phase 4:** Testing & Validation - 3-4 hours
- **Phase 5:** Bug Fixes & Optimization - 2-3 hours
- **Phase 6:** Documentation - 1 hour

**Total Estimated Time:** 13-17 hours

---

## Next Steps

1. **Approval Required:** Review this migration plan
2. **Schedule Migration:** Choose low-traffic time window
3. **Backup Everything:** Code + Data + Documentation
4. **Begin Step 1:** Install MariaDB
5. **Follow Plan Sequentially:** Do not skip steps

---

## Contact & Support

- **Migration Owner:** [Your Name]
- **Database Expert:** [DBA Name if applicable]
- **Emergency Rollback Authority:** [Manager/Lead]

---

**Document Version:** 1.0  
**Last Updated:** October 3, 2025  
**Status:** READY FOR EXECUTION
