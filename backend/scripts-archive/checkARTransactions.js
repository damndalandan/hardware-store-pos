const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkARTransactions() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'pos_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_hardware_store'
  });

  try {
    console.log('\n=== AR Transactions ===\n');
    const [rows] = await connection.execute(`
      SELECT 
        id, 
        customer_account_id, 
        sale_id, 
        transaction_type, 
        ROUND(amount, 2) as amount,
        payment_method, 
        reference_number,
        DATE_FORMAT(transaction_date, '%Y-%m-%d %H:%i') as trans_date
      FROM ar_transactions 
      ORDER BY transaction_date DESC 
      LIMIT 20
    `);
    console.table(rows);

    console.log('\n=== Payment Methods in AR Transactions ===\n');
    const [paymentMethods] = await connection.execute(`
      SELECT 
        payment_method, 
        COUNT(*) as count,
        ROUND(SUM(amount), 2) as total_amount
      FROM ar_transactions 
      WHERE transaction_type = 'charge'
      GROUP BY payment_method
      ORDER BY count DESC
    `);
    console.table(paymentMethods);

    console.log('\n=== Recent Sales with Payment Splits ===\n');
    const [sales] = await connection.execute(`
      SELECT 
        s.id,
        s.sale_number,
        s.payment_method as primary_method,
        s.total_amount,
        GROUP_CONCAT(CONCAT(ps.payment_method_code, ':', ps.amount) SEPARATOR ', ') as payment_splits
      FROM sales s
      LEFT JOIN payment_splits ps ON s.id = ps.sale_id
      WHERE s.customer_id IS NOT NULL
      GROUP BY s.id, s.sale_number, s.payment_method, s.total_amount
      ORDER BY s.id DESC
      LIMIT 10
    `);
    console.table(sales);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkARTransactions();
