# Route Files Update Patterns - SQLite to MariaDB

## Critical Migration Patterns

### 1. Import Changes
```typescript
// OLD - SQLite
import { getDatabase } from '../database/connection';
const db = await getDatabase();

// NEW - MariaDB
import { getPool } from '../database/connection';
const pool = await getPool();
```

### 2. Query Pattern Conversions

#### db.get() → pool.execute() with Single Row
```typescript
// OLD - SQLite
const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
// Returns: { id: 1, username: 'john' } or undefined

// NEW - MariaDB
const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
const user = rows[0];
// rows is array, take first element
```

#### db.all() → pool.execute() with Multiple Rows
```typescript
// OLD - SQLite
const users = await db.all('SELECT * FROM users WHERE role = ?', [role]);
// Returns: [{ id: 1 }, { id: 2 }]

// NEW - MariaDB
const [rows] = await pool.execute('SELECT * FROM users WHERE role = ?', [role]);
const users = rows;
// rows is already the array
```

#### db.run() → pool.execute() with Result Info
```typescript
// OLD - SQLite
const result = await db.run('INSERT INTO users (name) VALUES (?)', [name]);
const userId = result.lastID;
const affected = result.changes;

// NEW - MariaDB
const [result] = await pool.execute('INSERT INTO users (name) VALUES (?)', [name]);
const userId = result.insertId;
const affected = result.affectedRows;
```

### 3. Transaction Handling

#### Using withTransaction() Helper
```typescript
// OLD - SQLite (if using withTransaction)
const result = await withTransaction(async (db) => {
  const userResult = await db.run('INSERT INTO users (name) VALUES (?)', [name]);
  await db.run('INSERT INTO logs (user_id) VALUES (?)', [userResult.lastID]);
  return userResult.lastID;
});

// NEW - MariaDB (withTransaction now uses connection pool)
const result = await withTransaction(async (connection) => {
  const [userResult] = await connection.execute('INSERT INTO users (name) VALUES (?)', [name]);
  await connection.execute('INSERT INTO logs (user_id) VALUES (?)', [userResult.insertId]);
  return userResult.insertId;
});
```

#### Manual Transaction Handling
```typescript
// OLD - SQLite
await db.run('BEGIN TRANSACTION');
try {
  await db.run('INSERT INTO users (name) VALUES (?)', [name]);
  await db.run('COMMIT');
} catch (error) {
  await db.run('ROLLBACK');
  throw error;
}

// NEW - MariaDB
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  await connection.execute('INSERT INTO users (name) VALUES (?)', [name]);
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release(); // CRITICAL - always release connection
}
```

### 4. Common Gotchas

#### Destructuring is Required
```typescript
// ❌ WRONG - Missing destructuring
const rows = await pool.execute('SELECT * FROM users');
// rows is [RowDataPacket[], FieldPacket[]]

// ✅ CORRECT - Destructure to get data
const [rows] = await pool.execute('SELECT * FROM users');
// rows is RowDataPacket[]
```

#### Result Properties Changed
```typescript
// ❌ WRONG - SQLite properties
const result = await pool.execute('INSERT INTO users (name) VALUES (?)', [name]);
const id = result.lastID;  // undefined in MariaDB
const count = result.changes; // undefined in MariaDB

// ✅ CORRECT - MariaDB properties
const [result] = await pool.execute('INSERT INTO users (name) VALUES (?)', [name]);
const id = result.insertId;  // correct
const count = result.affectedRows; // correct
```

#### Connection Release in Transactions
```typescript
// ❌ WRONG - Connection not released
const connection = await pool.getConnection();
await connection.beginTransaction();
await connection.execute('INSERT INTO users (name) VALUES (?)', [name]);
await connection.commit();
// LEAK - connection still held

// ✅ CORRECT - Always use try/finally
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  await connection.execute('INSERT INTO users (name) VALUES (?)', [name]);
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release(); // Released even if error
}
```

## File-by-File Priority Order

### Phase 4A: Simple Routes (1-2 hours)
1. **auth.ts** - 4 calls - Start here (simplest)
2. **settings.ts** - 17 calls - Straightforward CRUD
3. **shifts.ts** - Fix import + basic queries

### Phase 4B: Medium Routes (2-3 hours)
4. **reports.ts** - 23 calls - Mostly SELECT queries
5. **sales.ts** - 31 calls - Critical for POS, test carefully
6. **purchaseOrders.ts** - 28 calls - Moderate complexity

### Phase 4C: Complex Routes (3-4 hours)
7. **suppliers.ts** - 20 calls - Has withTransaction usage
8. **users.ts** - 22 calls - Authentication critical
9. **inventory.ts** - 59 calls - Large file, many transactions
10. **products.ts** - 64 calls - Largest file, complex logic

### Phase 4D: Utility Scripts (30 minutes)
11. **seed.ts** - 7 INSERT OR IGNORE conversions
12. **quickSeed.ts** - Similar to seed.ts
13. **addSupplierTaxId.ts** - 2 simple calls

## Testing Strategy

### After Each File Update:
1. Run `npm run build` to check TypeScript compilation
2. Check for missing imports or type errors
3. Verify transaction patterns correct

### After Phase Complete:
1. Install MariaDB server
2. Test database connection
3. Run migrations
4. Seed test data
5. Test all endpoints with Postman/Insomnia
6. Test with frontend application

## Common SQL Syntax Already Fixed in Schema

✅ INTEGER → INT  
✅ AUTOINCREMENT → AUTO_INCREMENT  
✅ BOOLEAN → TINYINT(1)  
✅ INSERT OR IGNORE → INSERT IGNORE  
✅ Added ENGINE=InnoDB to all tables  
✅ Added CHARSET=utf8mb4 to all tables  
✅ Fixed reserved word `key` with backticks  

These are already handled in connection.ts and settingsSchema.ts.

## Next Action

Start with **auth.ts** - the simplest route file with only 4 database calls. This will validate our migration pattern before tackling larger files.
