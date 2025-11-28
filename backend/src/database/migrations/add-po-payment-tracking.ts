import { getPool } from '../connection';
import { logger } from '../../utils/logger';

export async function addPOPaymentTracking(): Promise<void> {
  const pool = await getPool();
  
  try {
    logger.info('Adding payment tracking fields to purchase_orders table...');
    
    // Add new columns to purchase_orders table if they don't exist
    await pool.execute(`
      ALTER TABLE purchase_orders 
      ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Unpaid',
      ADD COLUMN IF NOT EXISTS receiving_status VARCHAR(50) DEFAULT 'Awaiting'
    `);
    
    logger.info('Creating purchase_order_payments table...');
    
    // Create purchase_order_payments table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS purchase_order_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_order_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_date DATE NOT NULL,
        notes TEXT,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Update existing purchase orders with receiving status based on items
    logger.info('Updating existing purchase orders with receiving status...');
    
    await pool.execute(`
      UPDATE purchase_orders po
      SET receiving_status = (
        SELECT CASE
          WHEN COUNT(*) = SUM(CASE WHEN received_quantity >= quantity THEN 1 ELSE 0 END) 
            THEN 'Received'
          WHEN SUM(CASE WHEN received_quantity > 0 THEN 1 ELSE 0 END) > 0 
            THEN 'Partially Received'
          ELSE 'Awaiting'
        END
        FROM purchase_order_items
        WHERE purchase_order_id = po.id
      )
      WHERE EXISTS (
        SELECT 1 FROM purchase_order_items WHERE purchase_order_id = po.id
      )
    `);
    
    logger.info('Payment tracking migration completed successfully');
    
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME' || error.message?.includes('Duplicate column name')) {
      logger.info('Payment tracking fields already exist, skipping...');
    } else {
      logger.error('Error adding payment tracking:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  addPOPaymentTracking()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
