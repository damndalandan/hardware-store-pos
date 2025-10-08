import { Pool } from 'mysql2/promise';
import { logger } from '../../utils/logger';

/**
 * Migration: Add customer_id column to sales table
 * This links sales to the customers table for tracking purchase history
 */
export async function addCustomerIdToSales(pool: Pool): Promise<void> {
  try {
    logger.info('Running migration: Add customer_id to sales table');

    // Check if customer_id column already exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'sales' 
        AND COLUMN_NAME = 'customer_id'
    `);

    if ((columns as any[]).length > 0) {
      logger.info('customer_id column already exists in sales table, skipping migration');
      return;
    }

    // Add customer_id column
    await pool.execute(`
      ALTER TABLE sales 
      ADD COLUMN customer_id INT AFTER sale_number,
      ADD INDEX idx_customer_id (customer_id),
      ADD INDEX idx_sale_date (sale_date)
    `);

    logger.info('Added customer_id column to sales table');

    // Add foreign key constraint
    await pool.execute(`
      ALTER TABLE sales 
      ADD CONSTRAINT fk_sales_customer 
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
    `);

    logger.info('Added foreign key constraint for customer_id');

    // Optionally: Link existing sales to customers based on customer_name
    logger.info('Attempting to link existing sales to customers...');
    
    const [linkResult] = await pool.execute(`
      UPDATE sales s
      INNER JOIN customers c ON LOWER(s.customer_name) = LOWER(c.customer_name)
      SET s.customer_id = c.id
      WHERE s.customer_id IS NULL AND s.customer_name IS NOT NULL
    `);

    const linkedCount = (linkResult as any).affectedRows || 0;
    logger.info(`Linked ${linkedCount} existing sales to customers`);

    // Update customer purchase statistics for linked sales
    if (linkedCount > 0) {
      logger.info('Updating customer purchase statistics...');
      
      await pool.execute(`
        UPDATE customers c
        INNER JOIN (
          SELECT 
            customer_id,
            SUM(total_amount) as total_amount,
            MAX(sale_date) as last_purchase
          FROM sales
          WHERE customer_id IS NOT NULL
          GROUP BY customer_id
        ) s ON c.id = s.customer_id
        SET 
          c.total_purchases = s.total_amount,
          c.last_purchase_date = s.last_purchase
      `);

      logger.info('Customer purchase statistics updated successfully');
    }

    logger.info('Migration completed: customer_id added to sales table');

  } catch (error) {
    logger.error('Migration failed: addCustomerIdToSales', error);
    throw error;
  }
}
