# MariaDB Installation & Setup Guide

**Date:** October 3, 2025  
**Platform:** Windows  
**Target Database:** pos_hardware_store

---

## Step 1: Install MariaDB

### Option A: Using winget (Recommended)

```powershell
# Install MariaDB
winget install MariaDB.Server

# Or specify version
winget install MariaDB.Server.11.5
```

### Option B: Manual Download

1. Visit: https://mariadb.org/download/
2. Download MariaDB Server for Windows
3. Run the installer
4. **During installation:**
   - Set root password (remember this!)
   - Enable "Use UTF8 as default server's character set"
   - Install as Windows Service (recommended)
   - Service Name: `MariaDB`

---

## Step 2: Verify Installation

```powershell
# Check if MariaDB service is running
Get-Service MariaDB

# Should show: Status = Running
```

If not running:
```powershell
# Start MariaDB service
Start-Service MariaDB

# Or using net command
net start MariaDB
```

---

## Step 3: Connect to MariaDB

```powershell
# Connect as root
mysql -u root -p

# Enter the root password you set during installation
```

You should see:
```
Welcome to the MariaDB monitor.
MariaDB [(none)]>
```

---

## Step 4: Create Database and User

Copy and paste these commands in the MariaDB console:

```sql
-- Create the database
CREATE DATABASE pos_hardware_store 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- Create the user
CREATE USER 'pos_user'@'localhost' IDENTIFIED BY 'POS_Secure_2025!';

-- Grant privileges
GRANT ALL PRIVILEGES ON pos_hardware_store.* TO 'pos_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify database created
SHOW DATABASES;

-- Verify user created
SELECT User, Host FROM mysql.user WHERE User = 'pos_user';

-- Exit
EXIT;
```

---

## Step 5: Test User Connection

```powershell
# Test connection with new user
mysql -u pos_user -p pos_hardware_store

# Enter password: POS_Secure_2025!
```

If successful, you should see:
```
Welcome to the MariaDB monitor.
Database changed
MariaDB [pos_hardware_store]>
```

Try a test query:
```sql
-- Should show empty result (no tables yet)
SHOW TABLES;

-- Exit
EXIT;
```

---

## Step 6: Update Environment Variables

The password used above is: `POS_Secure_2025!`

**IMPORTANT:** Change this to a more secure password in production!

---

## Verification Checklist

- [ ] MariaDB service installed and running
- [ ] Can connect as root user
- [ ] Database `pos_hardware_store` created
- [ ] User `pos_user` created with password
- [ ] User has ALL PRIVILEGES on database
- [ ] Can connect as `pos_user` to database
- [ ] Database uses utf8mb4 charset

---

## Troubleshooting

### Service Won't Start

```powershell
# Check service status details
Get-Service MariaDB | Select-Object *

# Check Windows Event Viewer
# Application and Services Logs > MariaDB
```

### Can't Connect

```powershell
# Verify MariaDB is listening on port 3306
netstat -ano | findstr :3306

# Should show:
# TCP    0.0.0.0:3306    0.0.0.0:0    LISTENING
```

### Forgot Root Password

```powershell
# Stop MariaDB service
Stop-Service MariaDB

# Reset password (requires editing my.ini)
# Location: C:\Program Files\MariaDB [version]\data\my.ini
```

---

## Next Steps

Once MariaDB is installed and verified:

1. ✅ Mark "Phase 2: MariaDB Installation & Setup" as complete
2. ➡️ Proceed to update package.json and .env files
3. ➡️ Begin code migration

---

## Connection Details Summary

```
Host: localhost
Port: 3306
Database: pos_hardware_store
Username: pos_user
Password: POS_Secure_2025!
Charset: utf8mb4
Collation: utf8mb4_unicode_ci
```

---

**Status:** Ready for code migration once MariaDB is verified ✅
