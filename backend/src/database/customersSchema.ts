import { Pool } from 'mysql2/promise';
import { logger } from '../utils/logger';

/**
 * Customers table schema - separate from AR accounts
 * This stores all customers who made purchases, regardless of payment method
 */
export async function createCustomersTable(pool: Pool): Promise<void> {
  try {
    // Regular customers table (anyone who has made a purchase)
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_name (customer_name),
        INDEX idx_phone (phone),
        INDEX idx_last_purchase (last_purchase_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    logger.info('Customers table created successfully');
  } catch (error) {
    logger.error('Error creating customers table:', error);
    throw error;
  }
}
