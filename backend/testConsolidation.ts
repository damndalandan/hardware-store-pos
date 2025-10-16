/**
 * Test script to verify customer table consolidation
 * Run this after the server has started to verify the migration worked
 */

import { getPool } from './src/database/connection';

async function testConsolidation() {
  const pool = getPool();

  try {
    console.log('Testing customer table consolidation...\n');

    // 1. Check if customers table has A/R fields
    console.log('1. Checking customers table structure...');
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME IN ('customer_code', 'credit_limit', 'current_balance', 'contact_person', 'is_active')
    `);
    
    console.log(`   Found ${(columns as any[]).length}/5 A/R fields in customers table`);
    if ((columns as any[]).length === 5) {
      console.log('   ✅ Customers table has all A/R fields\n');
    } else {
      console.log('   ❌ Missing A/R fields in customers table\n');
      return;
    }

    // 2. Check if customer_accounts table still exists
    console.log('2. Checking if customer_accounts table was dropped...');
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'customer_accounts'
    `);
    
    if ((tables as any[]).length === 0) {
      console.log('   ✅ customer_accounts table successfully dropped\n');
    } else {
      console.log('   ⚠️  customer_accounts table still exists (migration may not have run)\n');
    }

    // 3. Check ar_transactions table uses customer_id
    console.log('3. Checking ar_transactions table...');
    const [arColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'ar_transactions'
      AND COLUMN_NAME = 'customer_id'
    `);
    
    if ((arColumns as any[]).length > 0) {
      console.log('   ✅ ar_transactions uses customer_id\n');
    } else {
      console.log('   ❌ ar_transactions still uses customer_account_id\n');
    }

    // 4. Count customers
    console.log('4. Counting customers...');
    const [customerCount] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(customer_code) as with_ar,
        COUNT(*) - COUNT(customer_code) as without_ar
      FROM customers
    `);
    
    const counts = (customerCount as any[])[0];
    console.log(`   Total customers: ${counts.total}`);
    console.log(`   With A/R accounts: ${counts.with_ar}`);
    console.log(`   Without A/R: ${counts.without_ar}\n`);

    // 5. Sample customer records
    console.log('5. Sample customer records:');
    const [samples] = await pool.execute(`
      SELECT 
        id,
        customer_name,
        customer_code,
        credit_limit,
        current_balance
      FROM customers
      LIMIT 5
    `);
    
    console.table(samples);

    console.log('\n✅ Consolidation test complete!');
    console.log('\nNext steps:');
    console.log('1. Test Customers page - all customers should be visible');
    console.log('2. Test POS payment dialog - A/R customers should show credit info');
    console.log('3. Test A/R transactions - charges and payments should work\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testConsolidation();
