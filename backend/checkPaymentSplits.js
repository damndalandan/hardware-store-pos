const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPaymentSplits() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'pos_user',
    password: process.env.DB_PASSWORD || 'POS_Secure_2025!',
    database: process.env.DB_NAME || 'pos_hardware_store'
  });

  try {
    console.log('\n=== Payment Splits ===\n');
    const [splits] = await connection.execute(`
      SELECT 
        ps.id,
        ps.sale_id,
        s.sale_number,
        s.customer_id,
        c.customer_name,
        ps.payment_method_code,
        ROUND(ps.amount, 2) as amount,
        ps.reference_number,
        DATE_FORMAT(s.sale_date, '%Y-%m-%d %H:%i') as sale_date
      FROM payment_splits ps
      JOIN sales s ON ps.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.sale_date DESC
      LIMIT 20
    `);
    console.table(splits);

    console.log('\n=== Sales with AR Customers ===\n');
    const [salesWithAR] = await connection.execute(`
      SELECT 
        s.id,
        s.sale_number,
        c.customer_name,
        s.payment_method as primary_method,
        ROUND(s.total_amount, 2) as total,
        GROUP_CONCAT(CONCAT(ps.payment_method_code, '=₱', ROUND(ps.amount, 2)) SEPARATOR ', ') as payment_splits
      FROM sales s
      INNER JOIN customers c ON s.customer_id = c.id
      LEFT JOIN payment_splits ps ON s.id = ps.sale_id
      WHERE c.customer_code IS NOT NULL
        AND c.customer_code != ''
      GROUP BY s.id, s.sale_number, c.customer_name, s.payment_method, s.total_amount
      ORDER BY s.id DESC
      LIMIT 10
    `);
    console.table(salesWithAR);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkPaymentSplits();
