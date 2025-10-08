const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'pos.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath);

const products = [
  [1, 'HAM001', '1234567890123', 'Claw Hammer', 'Stanley', '16oz claw hammer with fiberglass handle', 'each', 12.50, 19.99, 10],
  [2, 'SCR001', '2345678901234', 'Wood Screws', 'FastCo', '#8 x 2" wood screws, box of 100', 'box', 8.25, 12.99, 20],
  [3, 'DRL001', '3456789012345', 'Power Drill', 'DeWalt', '18V cordless drill with battery', 'each', 89.50, 149.99, 5]
];

let completed = 0;

products.forEach((product) => {
  const [id, sku, barcode, name, brand, description, unit, cost_price, selling_price, min_stock_level] = product;
  
  db.run(`INSERT OR REPLACE INTO products 
          (id, sku, barcode, name, brand, description, unit, cost_price, selling_price, min_stock_level, is_active, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`, 
         [id, sku, barcode, name, brand, description, unit, cost_price, selling_price, min_stock_level], 
         (err) => {
    if (err) {
      console.error('Error inserting product:', err);
    } else {
      console.log('✅ Product inserted:', name);
    }
    
    db.run('INSERT OR REPLACE INTO inventory (product_id, quantity, location) VALUES (?, ?, ?)', 
           [id, 25 + id * 10, 'MAIN'], (err) => {
      if (err) {
        console.error('Error inserting inventory:', err);
      } else {
        console.log('✅ Inventory added for:', name);
      }
      
      completed++;
      if (completed === products.length) {
        console.log('🎉 All sample products added successfully!');
        db.close();
      }
    });
  });
});