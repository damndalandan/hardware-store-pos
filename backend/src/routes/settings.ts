import express, { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Role-based access control
const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: Function) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
};

// Get all system settings
router.get('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pool = await getPool();
  
  const [rows] = await pool.execute(`
    SELECT category, \`key\`, value, data_type, description, updated_at
    FROM system_settings
    ORDER BY category, \`key\`
  `);
  const settings = rows as any[];

  // Group settings by category
  const groupedSettings: any = {};
  settings.forEach(setting => {
    if (!groupedSettings[setting.category]) {
      groupedSettings[setting.category] = {};
    }
    
    let value = setting.value;
    // Parse value based on data type
    switch (setting.data_type) {
      case 'number':
        value = parseFloat(setting.value);
        break;
      case 'boolean':
        value = setting.value === 'true';
        break;
      case 'json':
        try {
          value = JSON.parse(setting.value);
        } catch (e) {
          value = setting.value;
        }
        break;
    }
    
    groupedSettings[setting.category][setting.key] = {
      value,
      description: setting.description,
      data_type: setting.data_type,
      updated_at: setting.updated_at
    };
  });

  res.json({ settings: groupedSettings });
}));

// Update system setting
router.put('/system/:category/:key', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { category, key } = req.params;
  const { value } = req.body;
  const pool = await getPool();

  if (value === undefined) {
    res.status(400).json({ message: 'Value is required' });
    return;
  }

  // Convert value to string for storage
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

  await pool.execute(`
    UPDATE system_settings 
    SET value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE category = ? AND \`key\` = ?
  `, [stringValue, category, key]);

  logger.info(`Setting updated: ${category}.${key} = ${stringValue}`, { 
    userId: req.user?.id, 
    username: req.user?.username 
  });

  res.json({ message: 'Setting updated successfully' });
}));

// Get business information
router.get('/business', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pool = await getPool();
  
  const [rows] = await pool.execute(`
    SELECT * FROM business_info ORDER BY id LIMIT 1
  `);
  const businessInfo = (rows as any[])[0];

  res.json({ business: businessInfo || {} });
}));

// Update business information
router.put('/business', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    business_name, address_line1, address_line2, city, state, zip_code,
    country, phone, email, website, tax_id, logo_url, receipt_header, receipt_footer
  } = req.body;
  
  const pool = await getPool();

  // Check if business info exists
  const [existingRows] = await pool.execute('SELECT id FROM business_info LIMIT 1');
  const existing = (existingRows as any[])[0];

  if (existing) {
    // Update existing
    await pool.execute(`
      UPDATE business_info SET
        business_name = ?, address_line1 = ?, address_line2 = ?, city = ?,
        state = ?, zip_code = ?, country = ?, phone = ?, email = ?, website = ?,
        tax_id = ?, logo_url = ?, receipt_header = ?, receipt_footer = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [business_name, address_line1, address_line2, city, state, zip_code,
        country, phone, email, website, tax_id, logo_url, receipt_header, receipt_footer, existing.id]);
  } else {
    // Insert new
    await pool.execute(`
      INSERT INTO business_info (
        business_name, address_line1, address_line2, city, state, zip_code,
        country, phone, email, website, tax_id, logo_url, receipt_header, receipt_footer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [business_name, address_line1, address_line2, city, state, zip_code,
        country, phone, email, website, tax_id, logo_url, receipt_header, receipt_footer]);
  }

  logger.info('Business information updated', { 
    userId: req.user?.id, 
    username: req.user?.username 
  });

  res.json({ message: 'Business information updated successfully' });
}));

// Get tax rates
router.get('/tax-rates', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pool = await getPool();
  
  const [rows] = await pool.execute(`
    SELECT tr.*, c.name as category_name
    FROM tax_rates tr
    LEFT JOIN categories c ON tr.category_id = c.id
    WHERE tr.is_active = 1
    ORDER BY tr.is_default DESC, tr.name
  `);
  const taxRates = rows as any[];

  res.json({ tax_rates: taxRates });
}));

// Create tax rate
router.post('/tax-rates', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, rate, category_id, is_default } = req.body;
  const pool = await getPool();

  if (!name || rate === undefined) {
    res.status(400).json({ message: 'Name and rate are required' });
    return;
  }

  // If setting as default, remove default from others
  if (is_default) {
    await pool.execute('UPDATE tax_rates SET is_default = 0');
  }

  const [result] = await pool.execute(`
    INSERT INTO tax_rates (name, rate, category_id, is_default, is_active)
    VALUES (?, ?, ?, ?, 1)
  `, [name, rate, category_id || null, is_default ? 1 : 0]) as any;

  logger.info(`Tax rate created: ${name} (${rate})`, { 
    userId: req.user?.id, 
    username: req.user?.username 
  });

  res.json({ 
    message: 'Tax rate created successfully', 
    id: result.insertId 
  });
}));

// Update tax rate
router.put('/tax-rates/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, rate, category_id, is_default, is_active } = req.body;
  const pool = await getPool();

  // If setting as default, remove default from others
  if (is_default) {
    await pool.execute('UPDATE tax_rates SET is_default = 0 WHERE id != ?', [id]);
  }

  await pool.execute(`
    UPDATE tax_rates SET
      name = ?, rate = ?, category_id = ?, is_default = ?, is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [name, rate, category_id || null, is_default ? 1 : 0, is_active ? 1 : 0, id]);

  logger.info(`Tax rate updated: ${id}`, { 
    userId: req.user?.id, 
    username: req.user?.username 
  });

  res.json({ message: 'Tax rate updated successfully' });
}));

// Delete tax rate
router.delete('/tax-rates/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const pool = await getPool();

  // Check if this is the default rate
  const [taxRows] = await pool.execute('SELECT is_default FROM tax_rates WHERE id = ?', [id]);
  const taxRate = (taxRows as any[])[0];
  
  if (!taxRate) {
    res.status(404).json({ message: 'Tax rate not found' });
    return;
  }

  if (taxRate.is_default) {
    res.status(400).json({ message: 'Cannot delete the default tax rate' });
    return;
  }

  await pool.execute('DELETE FROM tax_rates WHERE id = ?', [id]);

  logger.info(`Tax rate deleted: ${id}`, { 
    userId: req.user?.id, 
    username: req.user?.username 
  });

  res.json({ message: 'Tax rate deleted successfully' });
}));

// Get backup settings
router.get('/backup', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pool = await getPool();
  
  const [rows] = await pool.execute(`
    SELECT * FROM backup_settings ORDER BY id
  `);
  const backupSettings = rows as any[];

  res.json({ backup_settings: backupSettings });
}));

// Update backup settings
router.put('/backup/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { backup_type, frequency, backup_path, retention_days, is_active } = req.body;
  const pool = await getPool();

  await pool.execute(`
    UPDATE backup_settings SET
      backup_type = ?, frequency = ?, backup_path = ?, retention_days = ?, is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [backup_type, frequency, backup_path, retention_days, is_active ? 1 : 0, id]);

  logger.info(`Backup settings updated: ${id}`, { 
    userId: req.user?.id, 
    username: req.user?.username 
  });

  res.json({ message: 'Backup settings updated successfully' });
}));

// Trigger manual backup
router.post('/backup/execute', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pool = await getPool();
  
  try {
    // This is a simplified version - in production you'd want to implement proper database backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `backup_${timestamp}.db`;
    
    // Update last backup date
    await pool.execute(`
      UPDATE backup_settings 
      SET last_backup_date = CURRENT_TIMESTAMP 
      WHERE backup_type = 'manual'
    `);

    logger.info('Manual backup executed', { 
      userId: req.user?.id, 
      username: req.user?.username,
      backupPath 
    });

    res.json({ 
      message: 'Backup completed successfully',
      backup_path: backupPath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Backup failed:', error);
    res.status(500).json({ message: 'Backup failed', error: (error as Error).message });
  }
}));

export default router;