import { getPool, initializeDatabase } from './connection';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

export async function seedDatabase(): Promise<void> {
  await initializeDatabase();
  const pool = await getPool();

  try {
    logger.info('Starting database seeding...');

    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.execute(`
      INSERT IGNORE INTO users (username, email, password_hash, first_name, last_name, role)
      VALUES ('admin', 'admin@hardware-store.com', ?, 'Admin', 'User', 'admin')
    `, [adminPassword]);

    // Create manager user
    const managerPassword = await bcrypt.hash('manager123', 10);
    await pool.execute(`
      INSERT IGNORE INTO users (username, email, password_hash, first_name, last_name, role)
      VALUES ('manager', 'manager@hardware-store.com', ?, 'Store', 'Manager', 'manager')
    `, [managerPassword]);

    // Create cashier user
    const cashierPassword = await bcrypt.hash('cashier123', 10);
    await pool.execute(`
      INSERT IGNORE INTO users (username, email, password_hash, first_name, last_name, role)
      VALUES ('cashier', 'cashier@hardware-store.com', ?, 'Store', 'Cashier', 'cashier')
    `, [cashierPassword]);

    // Create sample categories
    const categories = [
      { name: 'Tools & Hardware', description: 'Hand tools, power tools, and hardware' },
      { name: 'Plumbing', description: 'Pipes, fittings, and plumbing supplies' },
      { name: 'Electrical', description: 'Wiring, outlets, and electrical components' },
      { name: 'Paint & Supplies', description: 'Paint, brushes, and painting supplies' },
      { name: 'Garden & Outdoor', description: 'Gardening tools and outdoor equipment' },
      { name: 'Building Materials', description: 'Lumber, concrete, and construction materials' }
    ];

    for (const category of categories) {
      await pool.execute(`
        INSERT IGNORE INTO categories (name, description)
        VALUES (?, ?)
      `, [category.name, category.description]);
    }

    // Create sample supplier
    await pool.execute(`
      INSERT IGNORE INTO suppliers (name, contact_person, email, phone, address, city, state, zip_code)
      VALUES ('ABC Hardware Supply', 'John Smith', 'john@abchardware.com', '555-0123', '123 Industrial Blvd', 'Hardware City', 'NY', '12345')
    `);

    // Get category and supplier IDs for sample products
    const [categoryRows] = await pool.execute('SELECT id FROM categories WHERE name = ?', ['Tools & Hardware']);
    const toolsCategory = (categoryRows as {id: number}[])[0];
    
    const [supplierRows] = await pool.execute('SELECT id FROM suppliers WHERE name = ?', ['ABC Hardware Supply']);
    const supplier = (supplierRows as {id: number}[])[0];

    // Category and supplier found

    // Create sample products
    const products = [
      {
        sku: 'HAM001',
        barcode: '1234567890123',
        name: 'Claw Hammer',
        brand: 'Stanley',
        description: '16oz claw hammer with fiberglass handle',
        size: '16oz',
        variety: null,
        color: 'Blue/Black',
        unit: 'each',
        costPrice: 12.50,
        sellingPrice: 19.99,
        minStockLevel: 10,
        categoryId: toolsCategory?.id || null,
        supplierId: supplier?.id || null
      },
      {
        sku: 'SCR001',
        barcode: '2345678901234',
        name: 'Wood Screws',
        brand: 'FastCo',
        description: '#8 x 2" wood screws, box of 100',
        size: '#8 x 2"',
        variety: 'Phillips Head',
        color: null,
        unit: 'box',
        costPrice: 8.25,
        sellingPrice: 12.99,
        minStockLevel: 20,
        categoryId: toolsCategory?.id || null,
        supplierId: supplier?.id || null
      }
    ];

    for (const product of products) {
      const [result] = await pool.execute(`
        INSERT IGNORE INTO products (
          sku, barcode, name, brand, description, category_id, size, variety, color, unit,
          cost_price, selling_price, min_stock_level, supplier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.sku, product.barcode, product.name, product.brand, product.description,
        product.categoryId, product.size, product.variety, product.color, product.unit,
        product.costPrice, product.sellingPrice, product.minStockLevel, product.supplierId
      ]) as any;

      // Add initial inventory
      if (result.insertId) {
        await pool.execute(`
          INSERT IGNORE INTO inventory (product_id, current_stock, min_stock_level, location)
          VALUES (?, ?, 10, 'MAIN')
        `, [result.insertId, 50]);
      }
    }

    logger.info('Database seeding completed successfully');
    
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase().then(() => {
    process.exit(0);
  }).catch((error) => {
    process.exit(1);
  });
}