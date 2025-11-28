-- Fix payment_status and receiving_status constraints in purchase_orders table
USE pos_hardware_store;

-- Drop existing constraints if they exist
-- Note: MariaDB/MySQL may not enforce CHECK constraints in older versions
-- This script ensures the column can accept the correct values

-- First, check if there are any invalid values and update them
UPDATE purchase_orders 
SET payment_status = 'Unpaid' 
WHERE payment_status NOT IN ('Unpaid', 'Paid this month', 'To be paid next month', 'Partially Paid');

UPDATE purchase_orders 
SET receiving_status = 'Awaiting' 
WHERE receiving_status NOT IN ('Awaiting', 'Partially Received', 'Received');

-- Alter the columns to ensure they accept the right values
ALTER TABLE purchase_orders 
MODIFY COLUMN payment_status VARCHAR(50) DEFAULT 'Unpaid';

ALTER TABLE purchase_orders 
MODIFY COLUMN receiving_status VARCHAR(50) DEFAULT 'Awaiting';

-- If you're using MariaDB 10.2.1+ or MySQL 8.0.16+, you can add CHECK constraints
-- Uncomment the following lines if your database version supports it:

-- ALTER TABLE purchase_orders 
-- ADD CONSTRAINT chk_payment_status 
-- CHECK (payment_status IN ('Unpaid', 'Paid this month', 'To be paid next month', 'Partially Paid'));

-- ALTER TABLE purchase_orders 
-- ADD CONSTRAINT chk_receiving_status 
-- CHECK (receiving_status IN ('Awaiting', 'Partially Received', 'Received'));

SELECT 'Migration completed successfully' as status;
