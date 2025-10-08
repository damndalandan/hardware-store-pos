import { getPool, initializeDatabase } from './connection';

async function quickSeed() {
  await initializeDatabase();
  const pool = await getPool();

  // Creating sample products

  try {
    // Create a simple product without foreign key dependencies
    await pool.execute(`
      REPLACE INTO products (
        id, sku, barcode, name, brand, description, unit, cost_price, selling_price, 
        min_stock_level, is_active, created_at, updated_at
      ) VALUES (1, 'HAM001', '1234567890123', 'Claw Hammer', 'Stanley', 
               '16oz claw hammer with fiberglass handle', 'each', 12.50, 19.99, 
               10, 1, NOW(), NOW())
    `);

    await pool.execute(`
      REPLACE INTO products (
        id, sku, barcode, name, brand, description, unit, cost_price, selling_price, 
        min_stock_level, is_active, created_at, updated_at
      ) VALUES (2, 'SCR001', '2345678901234', 'Wood Screws', 'FastCo', 
               '#8 x 2" wood screws, box of 100', 'box', 8.25, 12.99, 
               20, 1, NOW(), NOW())
    `);

    await pool.execute(`
      REPLACE INTO products (
        id, sku, barcode, name, brand, description, unit, cost_price, selling_price, 
        min_stock_level, is_active, created_at, updated_at
      ) VALUES (3, 'DRL001', '3456789012345', 'Power Drill', 'DeWalt', 
               '18V cordless drill with battery', 'each', 89.50, 149.99, 
               5, 1, NOW(), NOW())
    `);

    // Add inventory for these products
    await pool.execute(`REPLACE INTO inventory (product_id, current_stock, min_stock_level, location) VALUES (1, 25, 10, 'MAIN')`);
    await pool.execute(`REPLACE INTO inventory (product_id, current_stock, min_stock_level, location) VALUES (2, 50, 10, 'MAIN')`);
    await pool.execute(`REPLACE INTO inventory (product_id, current_stock, min_stock_level, location) VALUES (3, 10, 10, 'MAIN')`);

    process.exit(0);
    
  } catch (error) {
    process.exit(1);
  }
}

quickSeed();