-- MariaDB Database Setup Script
-- This script creates the database and user for the POS system

-- Create database with proper character set
CREATE DATABASE IF NOT EXISTS pos_hardware_store
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- Create dedicated user (use IF NOT EXISTS to avoid errors if user exists)
CREATE USER IF NOT EXISTS 'pos_user'@'localhost' 
  IDENTIFIED BY 'POS_Secure_2025!';

-- Grant all privileges on the POS database
GRANT ALL PRIVILEGES ON pos_hardware_store.* 
  TO 'pos_user'@'localhost';

-- Apply privilege changes
FLUSH PRIVILEGES;

-- Verify database creation
SHOW DATABASES LIKE 'pos_hardware_store';

-- Verify user creation
SELECT User, Host FROM mysql.user WHERE User = 'pos_user';

-- Show granted privileges
SHOW GRANTS FOR 'pos_user'@'localhost';
