import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { getPool } from '../database/connection';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

interface ProductRow {
  sku: string;
  barcode?: string;
  name: string;
  brand?: string;
  category?: string;
  size?: string;
  variety?: string;
  color?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  min_stock_level?: number;
  max_stock_level?: number;
  initial_stock?: number;
  description?: string;
  supplier?: string;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; error: string; data: any }>;
  duplicateSkus: string[];
}

/**
 * Parse Excel/CSV file and extract product data
 */
function parseProductFile(filePath: string): ProductRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  
  const products: ProductRow[] = rawData.map((row, index) => {
    // Normalize column names (handle different cases and spaces)
    const normalizedRow: any = {};
    Object.keys(row).forEach(key => {
      const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
      normalizedRow[normalizedKey] = row[key];
    });
    
    return {
      sku: String(normalizedRow.sku || '').trim(),
      barcode: normalizedRow.barcode ? String(normalizedRow.barcode).trim() : undefined,
      name: String(normalizedRow.name || normalizedRow.product_name || '').trim(),
      brand: normalizedRow.brand ? String(normalizedRow.brand).trim() : undefined,
      category: normalizedRow.category ? String(normalizedRow.category).trim() : undefined,
      size: normalizedRow.size ? String(normalizedRow.size).trim() : undefined,
      variety: normalizedRow.variety ? String(normalizedRow.variety).trim() : undefined,
      color: normalizedRow.color ? String(normalizedRow.color).trim() : undefined,
      unit: String(normalizedRow.unit || 'each').trim(),
      cost_price: parseFloat(normalizedRow.cost_price || normalizedRow.cost || 0),
      selling_price: parseFloat(normalizedRow.selling_price || normalizedRow.price || 0),
      min_stock_level: normalizedRow.min_stock_level || normalizedRow.min_stock ? parseInt(normalizedRow.min_stock_level || normalizedRow.min_stock) : 0,
      max_stock_level: normalizedRow.max_stock_level || normalizedRow.max_stock ? parseInt(normalizedRow.max_stock_level || normalizedRow.max_stock) : 0,
      initial_stock: normalizedRow.initial_stock || normalizedRow.stock ? parseInt(normalizedRow.initial_stock || normalizedRow.stock) : undefined,
      description: normalizedRow.description ? String(normalizedRow.description).trim() : undefined,
      supplier: normalizedRow.supplier ? String(normalizedRow.supplier).trim() : undefined
    };
  });
  
  return products;
}

/**
 * Validate product row
 */
function validateProductRow(product: ProductRow, rowNumber: number): string | null {
  if (!product.sku) {
    return `Missing required field: SKU`;
  }
  
  if (!product.name) {
    return `Missing required field: Name`;
  }
  
  if (!product.unit) {
    return `Missing required field: Unit`;
  }
  
  if (product.selling_price <= 0) {
    return `Invalid selling price: must be greater than 0`;
  }
  
  if (product.cost_price < 0) {
    return `Invalid cost price: cannot be negative`;
  }
  
  if (product.sku.length > 50) {
    return `SKU too long (max 50 characters)`;
  }
  
  if (product.name.length > 200) {
    return `Name too long (max 200 characters)`;
  }
  
  return null;
}

/**
 * Import products from Excel file
 * POST /api/products/import
 */
router.post('/import', authenticateToken, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  
  // Check admin/manager role
  if (!['admin', 'manager'].includes(user.role)) {
    return res.status(403).json({ error: 'Only admins and managers can import products' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const filePath = req.file.path;
  const pool = getPool();
  
  try {
    // Parse the file
    const products = parseProductFile(filePath);
    
    const result: ImportResult = {
      success: true,
      totalRows: products.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      duplicateSkus: []
    };
    
    // Check for duplicate SKUs in the file
    const skuSet = new Set<string>();
    const duplicatesInFile: string[] = [];
    
    products.forEach((product, index) => {
      if (skuSet.has(product.sku)) {
        duplicatesInFile.push(product.sku);
        result.errors.push({
          row: index + 2, // +2 because row 1 is header, and array is 0-indexed
          error: `Duplicate SKU in file: ${product.sku}`,
          data: product
        });
        result.errorCount++;
      } else {
        skuSet.add(product.sku);
      }
    });
    
    // Get existing SKUs from database
    const [existingProducts] = await pool.query(
      'SELECT sku FROM products WHERE sku IN (?)',
      [Array.from(skuSet)]
    ) as any[];
    
    const existingSkus = new Set(existingProducts.map((p: any) => p.sku));
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const rowNumber = i + 2; // +2 because row 1 is header
      
      // Skip if already marked as duplicate in file
      if (duplicatesInFile.includes(product.sku)) {
        continue;
      }
      
      // Validate
      const validationError = validateProductRow(product, rowNumber);
      if (validationError) {
        result.errors.push({
          row: rowNumber,
          error: validationError,
          data: product
        });
        result.errorCount++;
        continue;
      }
      
      // Check if SKU already exists
      if (existingSkus.has(product.sku)) {
        result.duplicateSkus.push(product.sku);
        result.errors.push({
          row: rowNumber,
          error: `SKU already exists in database: ${product.sku}`,
          data: product
        });
        result.errorCount++;
        continue;
      }
      
      try {
        // Get or create category
        let categoryId = null;
        if (product.category) {
          const [categoryRows] = await pool.query(
            'SELECT id FROM categories WHERE name = ?',
            [product.category]
          ) as any[];
          
          if (categoryRows.length > 0) {
            categoryId = categoryRows[0].id;
          } else {
            // Create new category
            const [categoryResult] = await pool.query(
              'INSERT INTO categories (name, created_at) VALUES (?, NOW())',
              [product.category]
            ) as any[];
            categoryId = categoryResult.insertId;
          }
        }
        
        // Get or create supplier
        let supplierId = null;
        if (product.supplier) {
          const [supplierRows] = await pool.query(
            'SELECT id FROM suppliers WHERE name = ?',
            [product.supplier]
          ) as any[];
          
          if (supplierRows.length > 0) {
            supplierId = supplierRows[0].id;
          } else {
            // Create new supplier
            const [supplierResult] = await pool.query(
              'INSERT INTO suppliers (name, is_active, created_by, created_at) VALUES (?, 1, ?, NOW())',
              [product.supplier, user.id]
            ) as any[];
            supplierId = supplierResult.insertId;
          }
        }
        
        // Insert product
        const [productResult] = await pool.query(
          `INSERT INTO products (
            sku, barcode, name, brand, description, category_id, 
            size, variety, color, unit, 
            cost_price, selling_price, min_stock_level, max_stock_level, 
            supplier_id, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [
            product.sku,
            product.barcode || null,
            product.name,
            product.brand || null,
            product.description || null,
            categoryId,
            product.size || null,
            product.variety || null,
            product.color || null,
            product.unit,
            product.cost_price,
            product.selling_price,
            product.min_stock_level || 0,
            product.max_stock_level || 0,
            supplierId
          ]
        ) as any[];
        
        const productId = productResult.insertId;
        
        // Create inventory record if initial stock is provided
        if (product.initial_stock !== undefined && product.initial_stock > 0) {
          await pool.query(
            `INSERT INTO inventory (product_id, current_stock, reserved_quantity, min_stock_level, location, created_at, updated_at) 
             VALUES (?, ?, 0, ?, 'MAIN', NOW(), NOW())`,
            [productId, product.initial_stock, product.min_stock_level || 0]
          );
          
          // Create inventory transaction
          await pool.query(
            `INSERT INTO inventory_transactions (
              product_id, transaction_type, quantity_change, notes, created_by, created_at
            ) VALUES (?, 'adjustment', ?, 'Initial stock from import', ?, NOW())`,
            [productId, product.initial_stock, user.id]
          );
        } else {
          // Create inventory record with 0 stock
          await pool.query(
            `INSERT INTO inventory (product_id, current_stock, reserved_quantity, min_stock_level, location, created_at, updated_at) 
             VALUES (?, 0, 0, ?, 'MAIN', NOW(), NOW())`,
            [productId, product.min_stock_level || 0]
          );
        }
        
        result.successCount++;
      } catch (error: any) {
        logger.error(`Error importing product at row ${rowNumber}:`, error);
        result.errors.push({
          row: rowNumber,
          error: error.message || 'Database error',
          data: product
        });
        result.errorCount++;
      }
    }
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    result.success = result.errorCount === 0;
    
    logger.info(`Product import completed: ${result.successCount} succeeded, ${result.errorCount} failed`);
    
    return res.json(result);
  } catch (error: any) {
    // Clean up uploaded file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    logger.error('Product import error:', error);
    return res.status(500).json({ 
      error: 'Failed to import products',
      message: error.message 
    });
  }
}));

/**
 * Download Excel template
 * GET /api/products/import/template
 */
router.get('/import/template', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  // Create sample data
  const sampleData = [
    {
      SKU: 'ELEC-WIRE-10M',
      Barcode: '1234567890123',
      Name: 'Electrical Wire',
      Brand: 'ElecTest',
      Category: 'Electrical',
      Size: '10m',
      Variety: '',
      Color: 'Red',
      Unit: 'roll',
      Cost_Price: 45.00,
      Selling_Price: 65.00,
      Min_Stock_Level: 10,
      Max_Stock_Level: 100,
      Initial_Stock: 50,
      Description: 'High quality electrical wire 10 meters',
      Supplier: 'Electrical Supplies Co.'
    },
    {
      SKU: 'ELEC-WIRE-5M',
      Barcode: '1234567890124',
      Name: 'Electrical Wire',
      Brand: 'ElecTest',
      Category: 'Electrical',
      Size: '5m',
      Variety: '',
      Color: 'Red',
      Unit: 'roll',
      Cost_Price: 25.00,
      Selling_Price: 35.00,
      Min_Stock_Level: 10,
      Max_Stock_Level: 100,
      Initial_Stock: 75,
      Description: 'High quality electrical wire 5 meters',
      Supplier: 'Electrical Supplies Co.'
    },
    {
      SKU: 'PAINT-PRO-FLAT',
      Barcode: '1234567890125',
      Name: 'ProPaint',
      Brand: 'ProBrand',
      Category: 'Paint',
      Size: '1L',
      Variety: 'Flat Finish',
      Color: 'White',
      Unit: 'can',
      Cost_Price: 120.00,
      Selling_Price: 180.00,
      Min_Stock_Level: 5,
      Max_Stock_Level: 50,
      Initial_Stock: 20,
      Description: 'Professional grade paint with flat finish',
      Supplier: 'Paint Masters Inc.'
    },
    {
      SKU: 'PAINT-PRO-GLOSS',
      Barcode: '1234567890126',
      Name: 'ProPaint',
      Brand: 'ProBrand',
      Category: 'Paint',
      Size: '1L',
      Variety: 'Glossy Finish',
      Color: 'White',
      Unit: 'can',
      Cost_Price: 130.00,
      Selling_Price: 195.00,
      Min_Stock_Level: 5,
      Max_Stock_Level: 50,
      Initial_Stock: 15,
      Description: 'Professional grade paint with glossy finish',
      Supplier: 'Paint Masters Inc.'
    }
  ];
  
  // Create workbook
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
  
  // Set column widths
  const columnWidths = [
    { wch: 15 }, // SKU
    { wch: 15 }, // Barcode
    { wch: 25 }, // Name
    { wch: 15 }, // Brand
    { wch: 15 }, // Category
    { wch: 10 }, // Size
    { wch: 15 }, // Variety
    { wch: 10 }, // Color
    { wch: 8 },  // Unit
    { wch: 12 }, // Cost_Price
    { wch: 12 }, // Selling_Price
    { wch: 15 }, // Min_Stock_Level
    { wch: 15 }, // Max_Stock_Level
    { wch: 12 }, // Initial_Stock
    { wch: 40 }, // Description
    { wch: 25 }  // Supplier
  ];
  worksheet['!cols'] = columnWidths;
  
  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  // Send file
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');
  return res.send(buffer);
}));

export default router;
