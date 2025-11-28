import { initializeDatabase } from './connection';
import { seedDatabase } from './seed';
import { addCustomerIdToSales } from './migrations/addCustomerIdToSales';
import { addPOPaymentTracking } from './migrations/add-po-payment-tracking';
import { getPool } from './connection';

async function migrate() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    console.log('Running migrations...');
    const pool = await getPool();
    await addCustomerIdToSales(pool);
    await addPOPaymentTracking();
    console.log('Migrations completed successfully');
    
    console.log('Seeding database...');
    await seedDatabase();
    console.log('Database seeded successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();