const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCardingCustomer() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'pos_user',
    password: process.env.DB_PASSWORD || 'POS_Secure_2025!',
    database: process.env.DB_NAME || 'pos_hardware_store'
  });

  try {
    console.log('\n=== Customer "Carding" Details ===\n');
    const [customer] = await connection.execute(`
      SELECT * FROM customers WHERE customer_name LIKE '%card%'
    `);
    console.table(customer);

    console.log('\n=== Customer Accounts for "Carding" ===\n');
    const [accounts] = await connection.execute(`
      SELECT ca.* 
      FROM customer_accounts ca
      WHERE ca.customer_name LIKE '%card%'
    `);
    console.table(accounts);

    console.log('\n=== All Customer Accounts ===\n');
    const [allAccounts] = await connection.execute(`
      SELECT 
        id,
        customer_code,
        customer_name,
        ROUND(current_balance, 2) as balance,
        ROUND(credit_limit, 2) as credit_limit,
        is_active
      FROM customer_accounts
    `);
    console.table(allAccounts);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkCardingCustomer();
