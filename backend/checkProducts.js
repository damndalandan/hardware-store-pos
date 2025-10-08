const { getDatabase, initializeDatabase } = require('./dist/database/connection');

async function checkAndAddProducts() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    // Check current products
    const count = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    console.log('Current products in database:', count.count);
    
    if (count.count === 0) {
      console.log('Adding sample products...');
      
      // Insert products directly without foreign key dependencies
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO products (
            sku, name, brand, description, unit, cost_price, selling_price, 
            min_stock_level, max_stock_level, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, ['HAM001', 'Claw Hammer', 'Stanley', '16oz claw hammer', 'each', 12.50, 19.99, 10, 100, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO products (
            sku, name, brand, description, unit, cost_price, selling_price, 
            min_stock_level, max_stock_level, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, ['SCR001', 'Wood Screws', 'FastCo', '#8 x 2" wood screws', 'box', 8.25, 12.99, 20, 200, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO products (
            sku, name, brand, description, unit, cost_price, selling_price, 
            min_stock_level, max_stock_level, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, ['DRL001', 'Power Drill', 'DeWalt', '18V cordless drill', 'each', 89.50, 149.99, 5, 50, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Add inventory records for the products
      const products = await new Promise((resolve, reject) => {
        db.all('SELECT id FROM products ORDER BY id', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      for (const product of products) {
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT OR REPLACE INTO inventory (product_id, quantity, reserved_quantity, location) 
            VALUES (?, ?, ?, ?)
          `, [product.id, 25, 0, 'MAIN'], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      console.log('Sample products added successfully!');
    }
    
    // Check final count
    const finalCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    console.log('Final products count:', finalCount.count);
    
    // Show all products
    const allProducts = await new Promise((resolve, reject) => {
      db.all('SELECT sku, name, brand, selling_price FROM products', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('All products:');
    allProducts.forEach(p => console.log(`- ${p.sku}: ${p.name} by ${p.brand} - $${p.selling_price}`));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndAddProducts();