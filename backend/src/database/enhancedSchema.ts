import { Pool } from 'mysql2/promise';
import { logger } from '../utils/logger';

/**
 * Enhanced database schema for advanced POS features
 * Includes: multi-payment tracking, expenses, petty cash, customer accounts
 */
export async function createEnhancedTables(pool: Pool): Promise<void> {
  try {
    // Payment methods configuration table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        requires_reference TINYINT(1) DEFAULT 0,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Payment splits for multi-payment transactions
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS payment_splits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        payment_method_code VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reference_number VARCHAR(100),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        INDEX idx_sale_payment (sale_id, payment_method_code),
        INDEX idx_payment_method (payment_method_code),
        INDEX idx_created_date (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Customer accounts for AR tracking
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_code VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(20),
        address TEXT,
        credit_limit DECIMAL(10,2) DEFAULT 0.00,
        current_balance DECIMAL(10,2) DEFAULT 0.00,
        is_active TINYINT(1) DEFAULT 1,
        notes TEXT,
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id),
        INDEX idx_customer_code (customer_code),
        INDEX idx_customer_name (customer_name),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // AR transactions linked to customer accounts
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ar_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_account_id INT NOT NULL,
        sale_id INT,
        transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('charge', 'payment', 'adjustment')),
        amount DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20),
        reference_number VARCHAR(100),
        notes TEXT,
        processed_by INT NOT NULL,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_account_id) REFERENCES customer_accounts (id),
        FOREIGN KEY (sale_id) REFERENCES sales (id),
        FOREIGN KEY (processed_by) REFERENCES users (id),
        INDEX idx_customer (customer_account_id),
        INDEX idx_transaction_date (transaction_date),
        INDEX idx_type (transaction_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Expenses tracking
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_number VARCHAR(50) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        reference_number VARCHAR(100),
        expense_date DATE NOT NULL,
        vendor_name VARCHAR(200),
        receipt_file VARCHAR(255),
        shift_id INT,
        recorded_by INT NOT NULL,
        approved_by INT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (shift_id) REFERENCES shifts (id),
        FOREIGN KEY (recorded_by) REFERENCES users (id),
        FOREIGN KEY (approved_by) REFERENCES users (id),
        INDEX idx_expense_date (expense_date),
        INDEX idx_category (category),
        INDEX idx_shift (shift_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Petty cash and cash advances
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS petty_cash (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_number VARCHAR(50) UNIQUE NOT NULL,
        transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('fund', 'advance', 'replenish', 'return')),
        amount DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        purpose TEXT,
        employee_name VARCHAR(200),
        shift_id INT,
        approved_by INT,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        due_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'settled', 'overdue')),
        notes TEXT,
        processed_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shift_id) REFERENCES shifts (id),
        FOREIGN KEY (processed_by) REFERENCES users (id),
        FOREIGN KEY (approved_by) REFERENCES users (id),
        INDEX idx_transaction_date (transaction_date),
        INDEX idx_type (transaction_type),
        INDEX idx_status (status),
        INDEX idx_shift (shift_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Daily summary reports (cached aggregations)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        summary_date DATE UNIQUE NOT NULL,
        total_sales DECIMAL(10,2) DEFAULT 0.00,
        total_expenses DECIMAL(10,2) DEFAULT 0.00,
        total_ar DECIMAL(10,2) DEFAULT 0.00,
        cash_for_deposit DECIMAL(10,2) DEFAULT 0.00,
        total_transactions INT DEFAULT 0,
        payment_breakdown JSON,
        is_finalized TINYINT(1) DEFAULT 0,
        finalized_by INT,
        finalized_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (finalized_by) REFERENCES users (id),
        INDEX idx_summary_date (summary_date),
        INDEX idx_finalized (is_finalized)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    logger.info('Enhanced database tables created successfully');

    // Seed default payment methods
    await seedPaymentMethods(pool);
    
  } catch (error) {
    logger.error('Error creating enhanced tables:', error);
    throw error;
  }
}

async function seedPaymentMethods(pool: Pool): Promise<void> {
  const paymentMethods = [
    { code: 'CASH', name: 'Cash', requires_reference: 0, sort_order: 1 },
    { code: 'AR', name: 'Accounts Receivable', requires_reference: 1, sort_order: 2 },
    { code: 'GCASH', name: 'GCash', requires_reference: 1, sort_order: 3 },
    { code: 'BANK_TRANSFER', name: 'Bank Transfer', requires_reference: 1, sort_order: 4 },
    { code: 'QR_PH', name: 'QR PH', requires_reference: 1, sort_order: 5 },
    { code: 'CREDIT_CARD', name: 'Credit Card', requires_reference: 1, sort_order: 6 },
    { code: 'CHECK', name: 'Check', requires_reference: 1, sort_order: 7 },
  ];

  for (const method of paymentMethods) {
    await pool.execute(`
      INSERT INTO payment_methods (code, name, requires_reference, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        requires_reference = VALUES(requires_reference),
        sort_order = VALUES(sort_order)
    `, [method.code, method.name, method.requires_reference, method.sort_order]);
  }

  logger.info('Payment methods seeded successfully');
}
