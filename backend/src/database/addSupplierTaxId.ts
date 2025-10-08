import { initializeDatabase, getPool } from './connection';
import { logger } from '../utils/logger';

export async function updateSuppliersTable() {
  // Initialize database first
  await initializeDatabase();
  const pool = await getPool();
  
  try {
    // Check current table structure
    const [rows] = await pool.execute("SHOW COLUMNS FROM suppliers");
    const tableInfo = rows as any[];
    const existingColumns = tableInfo.map((col: any) => col.Field);
    
    console.log('Current supplier columns:', existingColumns);
    
    // Define required columns with their SQL definitions
    const requiredColumns = {
      'tax_id': 'VARCHAR(50)',
      'website': 'VARCHAR(255)',
      'notes': 'TEXT',
      'payment_terms': 'VARCHAR(100)',
      'credit_limit': 'DECIMAL(10,2)',
      'created_by': 'INTEGER'
    };
    
    // Add missing columns
    for (const [columnName, columnDefinition] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        await pool.execute(`ALTER TABLE suppliers ADD COLUMN ${columnName} ${columnDefinition}`);
        logger.info(`Added ${columnName} column to suppliers table`);
        console.log(`✅ Added ${columnName} column to suppliers table`);
      } else {
        console.log(`✅ ${columnName} column already exists in suppliers table`);
      }
    }
    
    console.log('✅ Suppliers table migration completed successfully');
  } catch (error) {
    logger.error('Error updating suppliers table:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  updateSuppliersTable()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}