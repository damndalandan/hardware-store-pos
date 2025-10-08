import { initializeDatabase, getPool } from './connection';

async function addShiftIdColumn() {
  try {
    await initializeDatabase();
    const pool = getPool();

    console.log('Adding shift_id column to sales table...');

    // Check if column exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'sales' 
        AND COLUMN_NAME = 'shift_id'
    `);

    if ((columns as any[]).length > 0) {
      console.log('shift_id column already exists in sales table');
      process.exit(0);
    }

    // Add the column
    await pool.execute(`
      ALTER TABLE sales 
      ADD COLUMN shift_id INT NULL AFTER cashier_id,
      ADD CONSTRAINT fk_sales_shift_id FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE SET NULL,
      ADD INDEX idx_shift_id (shift_id)
    `);

    console.log('Successfully added shift_id column to sales table');
    process.exit(0);
  } catch (error) {
    console.error('Error adding shift_id column:', error);
    process.exit(1);
  }
}

addShiftIdColumn();
