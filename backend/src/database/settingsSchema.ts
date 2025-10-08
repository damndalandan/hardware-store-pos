// Settings schema for MariaDB

export const createSettingsTables = async (pool: any) => {
  // System settings table for configurable values
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      \`key\` VARCHAR(100) NOT NULL,
      value TEXT NOT NULL,
      data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE(category, \`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Business information table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS business_info (
      id INT AUTO_INCREMENT PRIMARY KEY,
      business_name VARCHAR(200) NOT NULL,
      address_line1 VARCHAR(200),
      address_line2 VARCHAR(200),
      city VARCHAR(100),
      state VARCHAR(100),
      zip_code VARCHAR(20),
      country VARCHAR(100),
      phone VARCHAR(50),
      email VARCHAR(100),
      website VARCHAR(200),
      tax_id VARCHAR(50),
      logo_url VARCHAR(500),
      receipt_header TEXT,
      receipt_footer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Tax rates table for different categories/locations
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tax_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      rate DECIMAL(5,4) NOT NULL,
      category_id INT,
      is_default TINYINT(1) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Backup configurations
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS backup_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('auto', 'manual')),
      frequency VARCHAR(50), -- daily, weekly, monthly
      backup_path VARCHAR(500),
      retention_days INT DEFAULT 30,
      last_backup_date DATETIME,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Insert default settings
  await pool.execute(`
    INSERT IGNORE INTO system_settings (category, \`key\`, value, data_type, description) VALUES
    ('tax', 'default_rate', '0.12', 'number', 'Default VAT rate (12%)'),
    ('tax', 'vat_inclusive', 'true', 'boolean', 'Prices include VAT (VAT-inclusive pricing)'),
    ('tax', 'show_vat_breakdown', 'true', 'boolean', 'Show VAT breakdown on receipts (VATABLE SALE + VAT)'),
    ('tax', 'vat_registered', 'true', 'boolean', 'Business is VAT-registered (BIR compliance)'),
    ('receipt', 'print_automatically', 'false', 'boolean', 'Auto-print receipts after sale'),
    ('receipt', 'email_receipts', 'true', 'boolean', 'Enable email receipts'),
    ('inventory', 'auto_reorder', 'false', 'boolean', 'Enable automatic reordering'),
    ('inventory', 'low_stock_threshold', '10', 'number', 'Default low stock alert threshold'),
    ('pos', 'barcode_scanning', 'true', 'boolean', 'Enable barcode scanning'),
    ('pos', 'customer_display', 'false', 'boolean', 'Enable customer-facing display'),
    ('security', 'session_timeout', '480', 'number', 'Session timeout in minutes'),
    ('security', 'max_login_attempts', '5', 'number', 'Maximum login attempts before lockout'),
    ('reporting', 'default_date_range', '30', 'number', 'Default report date range in days'),
    ('backup', 'auto_backup', 'true', 'boolean', 'Enable automatic backups')
  `);

  // Insert default business info
  await pool.execute(`
    INSERT IGNORE INTO business_info (business_name, receipt_header, receipt_footer) VALUES
    ('Hardware Store POS', 'Welcome to Our Hardware Store', 'Thank you for your business!')
  `);

  // Insert default tax rate
  await pool.execute(`
    INSERT IGNORE INTO tax_rates (name, rate, is_default, is_active) VALUES
    ('VAT (12%)', 0.12, 1, 1)
  `);

  // Settings tables created and seeded with defaults
};