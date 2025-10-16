const mysql = require('mysql2/promise');

async function checkARTransactions() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'admin',
    database: 'pos_system',
    authPlugins: {
      mysql_native_password: () => () => Buffer.from('admin')
    }
  });

  console.log('\n=== AR TRANSACTIONS FOR CARDING ===\n');

  const [arTransactions] = await connection.execute(`
    SELECT 
      ar.id,
      ar.transaction_type,
      ar.amount,
      ar.balance_after,
      ar.created_at,
      c.customer_name,
      c.current_balance,
      s.sale_number
    FROM ar_transactions ar
    JOIN customers c ON ar.customer_id = c.id
    LEFT JOIN sales s ON ar.sale_id = s.id
    WHERE c.customer_name = 'Carding'
    ORDER BY ar.created_at DESC
  `);

  console.table(arTransactions);

  console.log('\n=== CUSTOMER DETAILS ===\n');

  const [customer] = await connection.execute(`
    SELECT 
      id,
      customer_name,
      customer_code,
      current_balance,
      total_purchases,
      last_purchase_date
    FROM customers
    WHERE customer_name = 'Carding'
  `);

  console.table(customer);

  console.log('\n=== SALES FOR CARDING ===\n');

  const [sales] = await connection.execute(`
    SELECT 
      s.id,
      s.sale_number,
      s.total_amount,
      s.payment_method,
      s.created_at,
      s.customer_name
    FROM sales s
    WHERE s.customer_name = 'Carding'
    ORDER BY s.created_at DESC
  `);

  console.table(sales);

  await connection.end();
}

checkARTransactions().catch(console.error);
