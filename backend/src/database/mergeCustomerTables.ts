import { Pool } from 'mysql2/promise';
import { logger } from '../utils/logger';

/**
 * Merge customer_accounts into customers table
 * This consolidates the dual customer system into a single unified table
 */
export async function mergeCustomerTables(pool: Pool): Promise<void> {
  try {
    logger.info('Starting customer tables merge...');

    // Step 1: Add A/R fields to customers table if they don't exist
    const arFields = [
      { name: 'customer_code', definition: 'VARCHAR(50) UNIQUE DEFAULT NULL' },
      { name: 'contact_person', definition: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'credit_limit', definition: 'DECIMAL(10,2) DEFAULT 0.00' },
      { name: 'current_balance', definition: 'DECIMAL(10,2) DEFAULT 0.00' },
      { name: 'is_active', definition: 'TINYINT(1) DEFAULT 1' }
    ];

    for (const field of arFields) {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME = ?
      `, [field.name]);

      if ((columns as any[]).length === 0) {
        logger.info(`Adding ${field.name} to customers table`);
        await pool.execute(`
          ALTER TABLE customers 
          ADD COLUMN ${field.name} ${field.definition}
        `);
      }
    }

    // Step 2: Add indexes for A/R fields
    try {
      await pool.execute(`
        ALTER TABLE customers 
        ADD INDEX idx_customer_code (customer_code)
      `);
      logger.info('Added index for customer_code');
    } catch (error: any) {
      if (!error.message.includes('Duplicate key name')) {
        throw error;
      }
    }

    // Step 3: Migrate data from customer_accounts to customers
    logger.info('Migrating data from customer_accounts to customers...');

    // Get all customer accounts
    const [accounts] = await pool.execute(`
      SELECT * FROM customer_accounts
    `);

    for (const account of accounts as any[]) {
      // Check if customer already exists by name
      const [existing] = await pool.execute(`
        SELECT id FROM customers WHERE customer_name = ?
      `, [account.customer_name]);

      if ((existing as any[]).length > 0) {
        // Update existing customer with A/R data
        const customerId = (existing as any[])[0].id;
        await pool.execute(`
          UPDATE customers 
          SET 
            customer_code = ?,
            contact_person = ?,
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            credit_limit = ?,
            current_balance = ?,
            is_active = ?,
            notes = COALESCE(?, notes)
          WHERE id = ?
        `, [
          account.customer_code,
          account.contact_person,
          account.email,
          account.phone,
          account.address,
          account.credit_limit,
          account.current_balance,
          account.is_active,
          account.notes,
          customerId
        ]);

        // Update ar_transactions to reference the customers table
        await pool.execute(`
          UPDATE ar_transactions 
          SET customer_account_id = ? 
          WHERE customer_account_id = ?
        `, [customerId, account.id]);

        logger.info(`Updated customer: ${account.customer_name} (ID: ${customerId})`);
      } else {
        // Insert new customer with A/R data
        const [result] = await pool.execute(`
          INSERT INTO customers (
            customer_name,
            customer_code,
            contact_person,
            email,
            phone,
            address,
            credit_limit,
            current_balance,
            is_active,
            notes,
            total_purchases,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?)
        `, [
          account.customer_name,
          account.customer_code,
          account.contact_person,
          account.email,
          account.phone,
          account.address,
          account.credit_limit,
          account.current_balance,
          account.is_active,
          account.notes,
          account.created_at,
          account.updated_at
        ]);

        const newCustomerId = (result as any).insertId;

        // Update ar_transactions to reference the new customer
        await pool.execute(`
          UPDATE ar_transactions 
          SET customer_account_id = ? 
          WHERE customer_account_id = ?
        `, [newCustomerId, account.id]);

        logger.info(`Created new customer: ${account.customer_name} (ID: ${newCustomerId})`);
      }
    }

    // Step 4: Rename customer_account_id to customer_id in ar_transactions
    const [arColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'ar_transactions' 
      AND COLUMN_NAME = 'customer_id'
    `);

    if ((arColumns as any[]).length === 0) {
      logger.info('Renaming customer_account_id to customer_id in ar_transactions');
      
      // Drop old foreign key
      await pool.execute(`
        ALTER TABLE ar_transactions 
        DROP FOREIGN KEY ar_transactions_ibfk_1
      `);

      // Rename column
      await pool.execute(`
        ALTER TABLE ar_transactions 
        CHANGE COLUMN customer_account_id customer_id INT NOT NULL
      `);

      // Add new foreign key
      await pool.execute(`
        ALTER TABLE ar_transactions 
        ADD CONSTRAINT fk_ar_customer 
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      `);
    }

    // Step 5: Drop customer_accounts table
    logger.info('Dropping customer_accounts table...');
    await pool.execute(`DROP TABLE IF EXISTS customer_accounts`);

    logger.info('Customer tables merge completed successfully!');
    logger.info('The system now uses a single unified customers table.');
  } catch (error) {
    logger.error('Error merging customer tables:', error);
    throw error;
  }
}
