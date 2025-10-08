const { getDatabase, initializeDatabase } = require('./dist/database/connection');

async function insertSampleProduct() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    // First, insert a category
    await db.run('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)', 'Hardware', 'General Hardware Items');
    
    // Insert a supplier  
    await db.run('INSERT OR IGNORE INTO suppliers (name, email, phone, address, is_active) VALUES (?, ?, ?, ?, ?)', 'Sample Supplier', 'supplier@example.com', '555-0123', '123 Main St', 1);
    
    // Insert a sample product
    const productResult = await db.run(`
      INSERT OR REPLACE INTO products 
      (sku, name, brand, category_id, supplier_id, cost_price, selling_price, min_stock_level, max_stock_level, barcode, description, unit, is_active) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 'SAMPLE-001', 'Sample Hammer', 'DeWalt', 1, 1, 15.00, 25.00, 5, 50, '123456789012', 'A quality hammer for general use', 'each', 1);
    
    // Insert inventory record
    await db.run('INSERT OR REPLACE INTO inventory (product_id, quantity, reserved_quantity) VALUES (?, ?, ?)', productResult.lastID, 25, 0);
    
    console.log('Sample product inserted successfully with ID:', productResult.lastID);
    
    // Check if it was inserted
    const count = await db.get('SELECT COUNT(*) as count FROM products');
    console.log('Total products in database:', count.count);
    
    process.exit(0);
  } catch (error) {
    console.error('Error inserting sample product:', error);
    process.exit(1);
  }
}

insertSampleProduct();