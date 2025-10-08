const { getDatabase, initializeDatabase } = require('./backend/dist/database/connection');
const bcrypt = require('bcrypt');

async function setupTestUsers() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    console.log('Setting up test users...');
    
    // Check existing users
    const existingUsers = await db.all('SELECT username FROM users');
    console.log('Existing users:', existingUsers.map(u => u.username));
    
    const adminPassword = await bcrypt.hash('admin123', 10);
    const cashierPassword = await bcrypt.hash('cashier123', 10);
    
    // Create or update admin user
    await db.run(`
      INSERT OR REPLACE INTO users (username, password, email, first_name, last_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, 'admin', adminPassword, 'admin@hardware-pos.com', 'System', 'Administrator', 'admin', 1);
    
    // Create or update cashier user
    await db.run(`
      INSERT OR REPLACE INTO users (username, password, email, first_name, last_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, 'cashier', cashierPassword, 'cashier@hardware-pos.com', 'Test', 'Cashier', 'cashier', 1);
    
    console.log('✅ Test users created successfully:');
    console.log('   Admin: username=admin, password=admin123');
    console.log('   Cashier: username=cashier, password=cashier123');
    
    // Verify users were created
    const users = await db.all('SELECT username, role, is_active FROM users');
    console.log('\nAll users in database:');
    users.forEach(user => {
      console.log(`   ${user.username} (${user.role}) - ${user.is_active ? 'Active' : 'Inactive'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up users:', error);
    process.exit(1);
  }
}

setupTestUsers();