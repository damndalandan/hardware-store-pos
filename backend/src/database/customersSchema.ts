import { Pool } from 'mysql2/promise';
import { logger } from '../utils/logger';

/**
 * Customers table schema - unified with AR account fields
 * This stores all customers who made purchases, with optional A/R credit account data
 */
export async function createCustomersTable(pool: Pool): Promise<void> {
  try {
    // Unified customers table (includes optional A/R fields)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(200) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        notes TEXT,
        total_purchases DECIMAL(10,2) DEFAULT 0.00,
        last_purchase_date DATETIME,
        customer_code VARCHAR(50) UNIQUE DEFAULT NULL,
        contact_person VARCHAR(100) DEFAULT NULL,
        credit_limit DECIMAL(10,2) DEFAULT 0.00,
        current_balance DECIMAL(10,2) DEFAULT 0.00,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_name (customer_name),
        INDEX idx_phone (phone),
        INDEX idx_last_purchase (last_purchase_date),
        INDEX idx_customer_code (customer_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    logger.info('Customers table created successfully');
  } catch (error) {
    logger.error('Error creating customers table:', error);
    throw error;
  }
}
