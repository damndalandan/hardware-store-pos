const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyDatabase() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'pos_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_hardware_store'
  });

  try {
    console.log('\n🔍 Verifying Enhanced Database Setup...\n');

    // Check tables
    const [tables] = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'pos_db' 
      AND table_name IN (
        'payment_methods', 'payment_splits', 'customer_accounts', 
        'ar_transactions', 'expenses', 'petty_cash', 'daily_summaries'
      )
    `);

    console.log('✅ Enhanced Tables Found:');
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    console.log(`   Total: ${tables.length}/7\n`);

    // Check payment methods
    const [methods] = await pool.query('SELECT * FROM payment_methods ORDER BY code');
    console.log('✅ Payment Methods Seeded:');
    methods.forEach(m => console.log(`   - ${m.code.padEnd(15)} | ${m.name.padEnd(20)} | ${m.requires_reference ? 'Requires Ref' : 'No Ref'}`));
    console.log(`   Total: ${methods.length}/7\n`);

    // Check if any data exists
    const [customerCount] = await pool.query('SELECT COUNT(*) as count FROM customer_accounts');
    const [expenseCount] = await pool.query('SELECT COUNT(*) as count FROM expenses');
    const [pettyCashCount] = await pool.query('SELECT COUNT(*) as count FROM petty_cash');
    const [salesCount] = await pool.query('SELECT COUNT(*) as count FROM sales');

    console.log('📊 Current Data:');
    console.log(`   - Customers: ${customerCount[0].count}`);
    console.log(`   - Expenses: ${expenseCount[0].count}`);
    console.log(`   - Petty Cash Transactions: ${pettyCashCount[0].count}`);
    console.log(`   - Sales: ${salesCount[0].count}`);
    console.log('\n✨ Database verification complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyDatabase();
