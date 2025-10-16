const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function setupUsers() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'pos_user',
    password: 'POS_Secure_2025!',
    database: 'pos_hardware_store'
  });

  try {
    console.log('Connected to MariaDB database...');
    
    // Check existing users
    const [existingUsers] = await connection.query('SELECT username, role FROM users');
    console.log('\nExisting users:');
    existingUsers.forEach(u => console.log(`  - ${u.username} (${u.role})`));
    
    // Hash passwords
    const adminHash = await bcrypt.hash('admin123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);
    const cashierHash = await bcrypt.hash('cashier123', 10);
    
    console.log('\nCreating/updating test users...');
    
    // Insert or update admin
    await connection.query(`
      INSERT INTO users (username, password_hash, email, first_name, last_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        email = VALUES(email),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        role = VALUES(role),
        is_active = 1,
        updated_at = NOW()
    `, ['admin', adminHash, 'admin@hardware-pos.com', 'System', 'Administrator', 'admin']);
    
    // Insert or update manager
    await connection.query(`
      INSERT INTO users (username, password_hash, email, first_name, last_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        email = VALUES(email),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        role = VALUES(role),
        is_active = 1,
        updated_at = NOW()
    `, ['manager', managerHash, 'manager@hardware-pos.com', 'Store', 'Manager', 'manager']);
    
    // Insert or update cashier
    await connection.query(`
      INSERT INTO users (username, password_hash, email, first_name, last_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        email = VALUES(email),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        role = VALUES(role),
        is_active = 1,
        updated_at = NOW()
    `, ['cashier', cashierHash, 'cashier@hardware-pos.com', 'Test', 'Cashier', 'cashier']);
    
    console.log('\n✅ Test users created/updated successfully!\n');
    console.log('Login credentials:');
    console.log('==================');
    console.log('Admin:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('');
    console.log('Manager:');
    console.log('  Username: manager');
    console.log('  Password: manager123');
    console.log('');
    console.log('Cashier:');
    console.log('  Username: cashier');
    console.log('  Password: cashier123');
    console.log('');
    
    // Verify
    const [users] = await connection.query('SELECT username, role, is_active FROM users ORDER BY role');
    console.log('\nAll users in database:');
    users.forEach(u => {
      console.log(`  ${u.username.padEnd(10)} - ${u.role.padEnd(10)} - ${u.is_active ? 'Active' : 'Inactive'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

setupUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
