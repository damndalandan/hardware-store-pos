const { initializeDatabase, getPool } = require('./dist/database/connection');

async function clearData() {
  try {
    // Initialize database connection first
    await initializeDatabase();
    const pool = getPool();
    
    console.log('Clearing all product, inventory, and supplier data...');
    
    // Disable foreign key checks temporarily
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Clear all related tables
    await pool.execute('TRUNCATE TABLE inventory_transactions');
    console.log('✓ Cleared inventory_transactions');
    
    await pool.execute('TRUNCATE TABLE sale_items');
    console.log('✓ Cleared sale_items');
    
    await pool.execute('TRUNCATE TABLE sales');
    console.log('✓ Cleared sales');
    
    await pool.execute('TRUNCATE TABLE purchase_order_items');
    console.log('✓ Cleared purchase_order_items');
    
    await pool.execute('TRUNCATE TABLE purchase_orders');
    console.log('✓ Cleared purchase_orders');
    
    await pool.execute('TRUNCATE TABLE products');
    console.log('✓ Cleared products');
    
    await pool.execute('TRUNCATE TABLE suppliers');
    console.log('✓ Cleared suppliers');
    
    await pool.execute('TRUNCATE TABLE categories');
    console.log('✓ Cleared categories');
    
    // Re-enable foreign key checks
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✅ All product, inventory, and supplier data cleared successfully!');
    console.log('You can now import your actual data.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing data:', error.message);
    process.exit(1);
  }
}

clearData();
