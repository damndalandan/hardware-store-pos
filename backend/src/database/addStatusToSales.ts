import { getPool, initializeDatabase } from './connection';

async function addStatusToSales() {
  // Initialize database first
  await initializeDatabase();
  
  const pool = await getPool();
  
  try {
    // Check if status column exists
    const [columns] = await pool.execute(`
      SHOW COLUMNS FROM sales LIKE 'status'
    `);
    
    if ((columns as any[]).length === 0) {
      // Add status column
      await pool.execute(`
        ALTER TABLE sales
        ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'completed' AFTER payment_status,
        ADD COLUMN void_reason TEXT AFTER status,
        ADD COLUMN voided_by INT AFTER void_reason,
        ADD COLUMN voided_at DATETIME AFTER voided_by,
        ADD INDEX idx_status (status)
      `);
      
      console.log('Successfully added status, void_reason, voided_by, and voided_at columns to sales table');
    } else {
      console.log('Status column already exists in sales table');
    }
  } catch (error) {
    console.error('Error adding status column:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addStatusToSales()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export default addStatusToSales;
