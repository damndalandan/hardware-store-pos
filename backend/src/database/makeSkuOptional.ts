import { getPool, initializeDatabase } from './connection';

export async function makeSkuAndUnitOptional() {
  // Initialize database connection first
  await initializeDatabase();
  
  const pool = getPool();
  
  try {
    // Make SKU nullable and remove UNIQUE constraint temporarily
    await pool.execute(`
      ALTER TABLE products 
      MODIFY COLUMN sku VARCHAR(50) NULL,
      MODIFY COLUMN unit VARCHAR(20) NULL
    `);
    
    // Drop the UNIQUE constraint on sku if it exists
    await pool.execute(`
      ALTER TABLE products 
      DROP INDEX sku
    `).catch(() => {
      console.log('SKU unique index already removed or does not exist');
    });
    
    // Add a new unique constraint that allows NULL values
    await pool.execute(`
      CREATE UNIQUE INDEX sku_unique ON products (sku)
    `).catch(() => {
      console.log('SKU unique index already exists');
    });
    
    console.log('✅ SKU and Unit columns are now optional');
    
    // Add product form settings
    await pool.execute(`
      INSERT IGNORE INTO system_settings (category, \`key\`, value, data_type, description) VALUES
      ('product_form', 'require_sku', 'false', 'boolean', 'Require SKU when adding products'),
      ('product_form', 'require_barcode', 'false', 'boolean', 'Require barcode when adding products'),
      ('product_form', 'require_unit', 'false', 'boolean', 'Require unit when adding products'),
      ('product_form', 'auto_generate_sku', 'true', 'boolean', 'Auto-generate SKU if not provided')
    `);
    
    console.log('✅ Product form settings added');
    
  } catch (error) {
    console.error('Error making SKU and unit optional:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  makeSkuAndUnitOptional()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
