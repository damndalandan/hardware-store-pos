const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRecentProducts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'pos_user',
    password: process.env.DB_PASSWORD || 'POS_Secure_2025!',
    database: process.env.DB_NAME || 'pos_hardware_store'
  });

  try {
    console.log('\n=== Recent Products (Last 20) ===\n');
    const [products] = await connection.execute(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.brand,
        c.name as category,
        ROUND(p.cost_price, 2) as cost,
        ROUND(p.selling_price, 2) as price,
        i.current_stock as stock,
        DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') as created
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      ORDER BY p.created_at DESC
      LIMIT 20
    `);
    console.table(products);

    console.log('\n=== Product Count ===\n');
    const [count] = await connection.execute(`
      SELECT COUNT(*) as total FROM products
    `);
    console.table(count);

    console.log('\n=== Inventory Transactions (Last 10) ===\n');
    const [transactions] = await connection.execute(`
      SELECT 
        it.id,
        p.sku,
        p.name,
        it.transaction_type,
        it.quantity_change,
        it.notes,
        DATE_FORMAT(it.created_at, '%Y-%m-%d %H:%i') as created
      FROM inventory_transactions it
      JOIN products p ON it.product_id = p.id
      ORDER BY it.created_at DESC
      LIMIT 10
    `);
    console.table(transactions);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkRecentProducts();
