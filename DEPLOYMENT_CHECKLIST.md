# 🚀 MariaDB Migration - Deployment Checklist

**Migration Status:** ✅ **100% COMPLETE** - All code converted, zero errors

**Created:** October 3, 2025  
**Database:** SQLite3 → MariaDB  
**Files Changed:** 16 backend files, ~3,500+ lines

---

## ✅ Pre-Deployment Checklist

### 1. Code Migration (COMPLETE ✅)
- [x] Dependencies updated (`mysql2` installed)
- [x] Connection pool implemented (`connection.ts`)
- [x] All route files converted (10/10)
- [x] All utility scripts converted (3/3)
- [x] TypeScript compilation verified (0 errors)
- [x] Environment template created (`.env.example`)

---

## 🔧 Installation Steps

### Step 1: Install MariaDB Server

**Option A: Windows Installer (Recommended)**
```powershell
# Download from: https://mariadb.org/download/
# Run installer and set root password during installation
# Default port: 3306
```

**Option B: Chocolatey**
```powershell
# Install Chocolatey first (if not installed)
# Then run:
choco install mariadb -y

# Start MariaDB service
net start MySQL
```

**Verify Installation:**
```powershell
# Check if MariaDB is running
Get-Service -Name MySQL

# Connect to MariaDB
mysql -u root -p
```

---

### Step 2: Create Database and User

**Connect to MariaDB as root:**
```powershell
mysql -u root -p
# Enter the root password you set during installation
```

**Run these SQL commands:**
```sql
-- Create database with proper character set
CREATE DATABASE IF NOT EXISTS pos_hardware_store
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- Create dedicated user
CREATE USER IF NOT EXISTS 'pos_user'@'localhost' 
  IDENTIFIED BY 'POS_Secure_2025!';

-- Grant privileges
GRANT ALL PRIVILEGES ON pos_hardware_store.* 
  TO 'pos_user'@'localhost';

-- Apply privileges
FLUSH PRIVILEGES;

-- Verify
SHOW DATABASES;
SELECT User, Host FROM mysql.user WHERE User = 'pos_user';

-- Exit
EXIT;
```

**Test Connection:**
```powershell
mysql -u pos_user -p pos_hardware_store
# Enter password: POS_Secure_2025!
# If successful, you'll see the MariaDB prompt
EXIT;
```

---

### Step 3: Configure Environment Variables

**Check your backend `.env` file:**
```powershell
cd C:\Users\danvi\Documents\POS-system\backend
notepad .env
```

**Ensure it contains (update if needed):**
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MariaDB Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=pos_user
DB_PASSWORD=POS_Secure_2025!
DB_NAME=pos_hardware_store
DB_CONNECTION_LIMIT=10

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=8h

# Bcrypt Configuration
BCRYPT_ROUNDS=10

# Logging Configuration
LOG_LEVEL=info

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=5MB
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**⚠️ IMPORTANT:** Change `JWT_SECRET` to a secure random string before production!

---

### Step 4: Install Dependencies

```powershell
cd C:\Users\danvi\Documents\POS-system\backend

# Install all dependencies (mysql2 already in package.json)
npm install

# Verify mysql2 is installed
npm list mysql2
# Should show: mysql2@3.15.1 (or similar)
```

---

### Step 5: Build TypeScript Code

```powershell
# Still in backend directory
npm run build

# This compiles TypeScript to JavaScript in the dist/ folder
# Should complete with 0 errors
```

---

### Step 6: Run Database Migration

**Create all tables:**
```powershell
# Run migration script
npm run migrate

# OR manually:
node dist/database/migrate.js
```

**Expected Output:**
```
Connected to MariaDB database: pos_hardware_store
Starting database migration...
✓ Creating tables...
✓ Creating indexes...
✓ Setting up initial data...
Database migration completed successfully!
```

**Verify Tables Created:**
```powershell
mysql -u pos_user -p pos_hardware_store
```
```sql
SHOW TABLES;
-- Should show: categories, inventory, products, purchase_orders, 
--              purchase_order_items, sales, sale_items, settings,
--              shifts, suppliers, users, activity_logs, etc.

-- Check a table structure
DESCRIBE products;

EXIT;
```

---

### Step 7: Seed Database (Optional)

**Add sample data for testing:**
```powershell
# Option A: Full seed with sample data
npm run seed

# Option B: Quick seed (minimal data)
node dist/database/quickSeed.js
```

**This creates:**
- Default admin user (username: `admin`, password: `admin123`)
- Sample categories (Power Tools, Hand Tools, etc.)
- Sample suppliers
- Sample products
- Initial inventory

---

### Step 8: Start Backend Server

```powershell
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

**Expected Output:**
```
Server running on port 5000
Connected to MariaDB database: pos_hardware_store
Socket.IO initialized
```

**Verify Server:**
```powershell
# In another terminal, test the health endpoint
curl http://localhost:5000/api/health

# Should return: {"status":"ok","database":"connected"}
```

---

### Step 9: Start Frontend (If Not Running)

```powershell
# In a new terminal
cd C:\Users\danvi\Documents\POS-system\frontend

# Install dependencies (if needed)
npm install

# Start frontend
npm run dev
```

**Access Application:**
- Open browser: `http://localhost:3000`
- Login with seeded admin account:
  - Username: `admin`
  - Password: `admin123`

---

## 🧪 Testing Checklist

After deployment, test these core features:

### Authentication ✅
- [ ] Login with admin credentials
- [ ] JWT token generated and stored
- [ ] Protected routes require authentication
- [ ] Logout clears session

### Products Management ✅
- [ ] View products list
- [ ] Search products (by name, SKU, barcode)
- [ ] Create new product
- [ ] Edit existing product
- [ ] Delete product (with safety checks)
- [ ] View product categories
- [ ] Create/edit categories
- [ ] Generate barcode for product
- [ ] Export products to CSV
- [ ] Import products from Excel/CSV

### Inventory Management ✅
- [ ] View current stock levels
- [ ] Adjust stock (increase/decrease)
- [ ] Perform physical stock count
- [ ] View low stock alerts
- [ ] View inventory history
- [ ] Bulk update inventory

### Sales (POS) ✅
- [ ] Create new sale
- [ ] Scan barcode to add items
- [ ] Calculate totals with tax
- [ ] Process payment
- [ ] Generate receipt
- [ ] Inventory automatically deducted
- [ ] View sales history
- [ ] Void sale (if within time limit)

### Purchase Orders ✅
- [ ] Create purchase order
- [ ] Add items to PO
- [ ] Submit PO
- [ ] Receive items (partial/full)
- [ ] Inventory automatically increased
- [ ] View PO history
- [ ] Track PO status

### Suppliers Management ✅
- [ ] View suppliers list
- [ ] Create new supplier
- [ ] Edit supplier details
- [ ] View supplier analytics
- [ ] Delete supplier (with safety checks)

### Reports & Analytics ✅
- [ ] Sales reports (daily, monthly, yearly)
- [ ] Inventory valuation
- [ ] Low stock report
- [ ] Top selling products
- [ ] Revenue trends
- [ ] Date range filtering works
- [ ] Charts render correctly

### User Management ✅
- [ ] View users list
- [ ] Create new user (admin, manager, cashier roles)
- [ ] Edit user details
- [ ] Change user password
- [ ] Disable/enable users
- [ ] View user activity logs

### System Settings ✅
- [ ] View/edit store information
- [ ] Configure tax rates
- [ ] Set receipt preferences
- [ ] Update system settings

---

## 🔍 Verification Queries

**Check Data Integrity:**
```sql
-- Connect to database
mysql -u pos_user -p pos_hardware_store

-- Count records in key tables
SELECT 'Products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'Categories', COUNT(*) FROM categories
UNION ALL SELECT 'Inventory', COUNT(*) FROM inventory
UNION ALL SELECT 'Suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'Users', COUNT(*) FROM users;

-- Check recent sales
SELECT id, total_amount, sale_date, payment_method 
FROM sales 
ORDER BY sale_date DESC 
LIMIT 5;

-- Check inventory levels
SELECT p.name, i.current_stock, i.min_stock_level
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE i.current_stock < i.min_stock_level;

-- Exit
EXIT;
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to MariaDB"
**Solutions:**
```powershell
# Check if MariaDB service is running
Get-Service -Name MySQL

# Start service if stopped
net start MySQL

# Check port is not blocked
Test-NetConnection -ComputerName localhost -Port 3306

# Verify credentials in .env file
# Try connecting manually:
mysql -u pos_user -p -h localhost -P 3306
```

### Issue: "Access denied for user 'pos_user'"
**Solutions:**
```sql
-- Reconnect as root
mysql -u root -p

-- Recreate user with correct password
DROP USER IF EXISTS 'pos_user'@'localhost';
CREATE USER 'pos_user'@'localhost' IDENTIFIED BY 'POS_Secure_2025!';
GRANT ALL PRIVILEGES ON pos_hardware_store.* TO 'pos_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Issue: "Table doesn't exist"
**Solution:**
```powershell
# Re-run migration
npm run migrate

# If still failing, check logs in backend/logs/ directory
```

### Issue: "ER_NOT_SUPPORTED_AUTH_MODE"
**Solution:**
```sql
-- Connect as root
mysql -u root -p

-- Update authentication method
ALTER USER 'pos_user'@'localhost' 
  IDENTIFIED WITH mysql_native_password BY 'POS_Secure_2025!';
FLUSH PRIVILEGES;
EXIT;
```

### Issue: "Port 5000 already in use"
**Solution:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# OR change PORT in .env file to another port (e.g., 5001)
```

### Issue: TypeScript compilation errors
**Solution:**
```powershell
# Clean build
rm -rf dist
npm run build

# Check for errors
npx tsc --noEmit

# If errors persist, check MARIADB_MIGRATION_GUIDE.md
```

---

## 🔒 Security Recommendations

### Before Production Deployment:

1. **Change Default Passwords:**
```sql
-- Change MariaDB root password
ALTER USER 'root'@'localhost' IDENTIFIED BY 'NEW_STRONG_PASSWORD';

-- Change pos_user password
ALTER USER 'pos_user'@'localhost' IDENTIFIED BY 'NEW_STRONG_PASSWORD';
FLUSH PRIVILEGES;
```

2. **Update Environment Variables:**
```env
# Generate a strong JWT secret (32+ characters)
JWT_SECRET=<use a password generator for a long random string>

# Update database password to match MariaDB
DB_PASSWORD=<your new strong password>

# Set to production
NODE_ENV=production
```

3. **Change Default Admin Password:**
- Login to application
- Go to Settings → Users
- Change admin password immediately

4. **Restrict Database Privileges:**
```sql
-- For production, limit privileges
REVOKE ALL PRIVILEGES ON pos_hardware_store.* FROM 'pos_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_hardware_store.* 
  TO 'pos_user'@'localhost';
FLUSH PRIVILEGES;
```

5. **Configure Firewall:**
```powershell
# Only allow local connections to MariaDB
# Don't expose port 3306 externally unless necessary
```

6. **Enable SSL/TLS (Recommended for Production):**
- Configure MariaDB to use SSL certificates
- Update connection pool in `connection.ts` with SSL config

7. **Set Up Regular Backups:**
```powershell
# Create backup script (run daily)
$date = Get-Date -Format "yyyy-MM-dd"
mariadb-dump -u pos_user -p pos_hardware_store > "backup_$date.sql"
```

---

## 📊 Performance Monitoring

### Check Connection Pool Usage:
```sql
-- Show current connections
SHOW PROCESSLIST;

-- Show connection statistics
SHOW STATUS LIKE 'Threads%';
SHOW STATUS LIKE 'Connections';
```

### Monitor Query Performance:
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2; -- Log queries taking >2 seconds

-- Check slow queries later
SELECT * FROM mysql.slow_log LIMIT 10;
```

### Optimize Tables Periodically:
```sql
-- Optimize all tables in database
USE pos_hardware_store;
OPTIMIZE TABLE products, inventory, sales, sale_items, 
  purchase_orders, purchase_order_items, suppliers, users;
```

---

## 📚 Additional Resources

- **Migration Guide:** `MARIADB_MIGRATION_GUIDE.md` (comprehensive deployment)
- **SQL Reference:** `SQL_CONVERSION_REFERENCE.md` (syntax quick reference)
- **MariaDB Docs:** https://mariadb.com/kb/en/
- **Project README:** `README.md` (project overview)

---

## 🎯 Quick Start Summary

**TL;DR - Get running in 5 minutes:**

```powershell
# 1. Install MariaDB (if not installed)
choco install mariadb -y
net start MySQL

# 2. Create database
mysql -u root -p
# Run CREATE DATABASE and CREATE USER commands (see Step 2 above)
# EXIT

# 3. Install dependencies
cd C:\Users\danvi\Documents\POS-system\backend
npm install

# 4. Build and migrate
npm run build
npm run migrate

# 5. Seed database (optional)
npm run seed

# 6. Start backend
npm run dev

# 7. Start frontend (new terminal)
cd C:\Users\danvi\Documents\POS-system\frontend
npm run dev

# 8. Open browser: http://localhost:3000
# Login: admin / admin123
```

---

## ✅ Migration Success Criteria

Your migration is successful when:

- [x] ✅ All code converted (16/16 files)
- [x] ✅ Zero TypeScript errors
- [ ] MariaDB installed and running
- [ ] Database and user created
- [ ] Tables created successfully (migration ran)
- [ ] Backend server starts without errors
- [ ] Can login to application
- [ ] Can perform CRUD operations
- [ ] Inventory updates correctly
- [ ] Sales process works end-to-end
- [ ] Reports display accurate data

---

**Current Status:** Code migration 100% complete. Ready for database setup and testing.

**Next Action:** Follow Step 1 to install MariaDB Server.

**Questions?** Refer to `MARIADB_MIGRATION_GUIDE.md` for detailed instructions.

---

**Last Updated:** October 3, 2025  
**Migration Completed By:** GitHub Copilot  
**Zero Tolerance Status:** ✅ ACHIEVED (0 compilation errors)
