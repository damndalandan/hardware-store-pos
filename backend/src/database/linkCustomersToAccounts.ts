import { getPool, initializeDatabase } from './connection.js';
import { logger } from '../utils/logger.js';

/**
 * Migration: Link customer_accounts to customers table
 * Adds customer_id foreign key to customer_accounts table
 */
export async function linkCustomersToAccounts() {
  // Initialize database connection
  await initializeDatabase();
  const pool = await getPool();
  
  try {
    logger.info('Starting migration: Link customer_accounts to customers table');

    // Check if customer_id column already exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customer_accounts' 
        AND COLUMN_NAME = 'customer_id'
    `);

    if ((columns as any[]).length > 0) {
      logger.info('customer_id column already exists in customer_accounts table');
      return;
    }

    // Add customer_id column to customer_accounts
    await pool.execute(`
      ALTER TABLE customer_accounts 
      ADD COLUMN customer_id INT DEFAULT NULL AFTER id
    `);
    logger.info('Added customer_id column to customer_accounts');

    // Add index for customer_id
    await pool.execute(`
      ALTER TABLE customer_accounts 
      ADD INDEX idx_customer_id (customer_id)
    `);
    logger.info('Added index for customer_id');

    // Add foreign key constraint
    await pool.execute(`
      ALTER TABLE customer_accounts 
      ADD CONSTRAINT fk_customer_accounts_customer 
      FOREIGN KEY (customer_id) REFERENCES customers (id) 
      ON DELETE SET NULL
    `);
    logger.info('Added foreign key constraint to customers table');

    // Try to auto-link existing customer_accounts to customers by matching name
    const [accounts] = await pool.execute(`
      SELECT id, customer_name FROM customer_accounts WHERE customer_id IS NULL
    `);

    let linkedCount = 0;
    for (const account of accounts as any[]) {
      const [customers] = await pool.execute(`
        SELECT id FROM customers WHERE LOWER(customer_name) = LOWER(?) LIMIT 1
      `, [account.customer_name]);

      if ((customers as any[]).length > 0) {
        const customerId = (customers as any[])[0].id;
        await pool.execute(`
          UPDATE customer_accounts SET customer_id = ? WHERE id = ?
        `, [customerId, account.id]);
        linkedCount++;
      }
    }

    logger.info(`Auto-linked ${linkedCount} customer accounts to existing customers`);
    logger.info('Migration completed successfully: customer_accounts now linked to customers');

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Self-executing if run directly
if (require.main === module) {
  linkCustomersToAccounts()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
