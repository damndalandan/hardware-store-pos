# Excel Product Import Guide

## Overview

The POS system now supports batch importing products from Excel files. This feature allows you to quickly add hundreds or thousands of products from a spreadsheet instead of entering them one by one.

**✅ NEW:** Export and import formats are now **fully compatible**! You can export products, edit them in Excel, and re-import without any format conversion needed.

## Quick Start

### Option 1: Start with Template (For New Products)
1. **Navigate to Products Page** (Admin or Manager role required)
2. **Click "Import Excel"** button in the toolbar
3. **Download Template** - Click "Download Excel Template" to get the sample file
4. **Fill in Your Products** - Edit the template with your product data
5. **Upload & Import** - Select your file and click "Import"

### Option 2: Export → Edit → Import (For Existing Products)
1. **Navigate to Products Page**
2. **Click "Export CSV"** to download current products
3. **Edit in Excel** - Update prices, stock, or add new products
4. **Click "Import Excel"** and select your edited file
5. **Import** - System updates existing products and adds new ones

**✅ Perfect Round-Trip:** Export format matches import format exactly!

## Excel Template

### Download Template

The template includes:
- **Proper column headers** with the exact format required
- **4 example products** showing how to fill in the data
- **Pre-formatted columns** with appropriate widths

### Template Columns

| Column Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| SKU | Text | ✅ Yes | Unique product identifier | ELEC-WIRE-10M |
| Barcode | Text | ❌ No | Barcode/UPC number | 1234567890123 |
| Name | Text | ✅ Yes | Product name | Electrical Wire |
| Brand | Text | ❌ No | Product brand | ElecTest |
| Category | Text | ❌ No | Category name (auto-created if new) | Electrical |
| Size | Text | ❌ No | Product size/dimension | 10m, 5m, 1L, 4L |
| Variety | Text | ❌ No | Product variety/type | Flat Finish, Glossy |
| Color | Text | ❌ No | Product color | Red, White, Blue |
| Unit | Text | ✅ Yes | Unit of measure | roll, can, piece, box |
| Cost_Price | Number | ✅ Yes | Purchase cost per unit | 45.00 |
| Selling_Price | Number | ✅ Yes | Retail selling price | 65.00 |
| Min_Stock_Level | Number | ❌ No | Minimum stock alert level | 10 |
| Max_Stock_Level | Number | ❌ No | Maximum stock capacity | 100 |
| Initial_Stock | Number | ❌ No | Starting inventory quantity | 50 |
| Description | Text | ❌ No | Product description | High quality electrical wire |
| Supplier | Text | ❌ No | Supplier name (auto-created if new) | Electrical Supplies Co. |

### Example Data

The template includes these example products:

#### Example 1: Electrical Wire Variants
```
SKU: ELEC-WIRE-10M
Name: Electrical Wire
Brand: ElecTest
Size: 10m
Cost Price: 45.00
Selling Price: 65.00
Initial Stock: 50
```

```
SKU: ELEC-WIRE-5M
Name: Electrical Wire
Brand: ElecTest
Size: 5m
Cost Price: 25.00
Selling Price: 35.00
Initial Stock: 75
```

These will appear as **variants** in the POS (same brand+name, different size).

#### Example 2: ProPaint Varieties
```
SKU: PAINT-PRO-FLAT
Name: ProPaint
Brand: ProBrand
Variety: Flat Finish
Cost Price: 120.00
Selling Price: 180.00
```

```
SKU: PAINT-PRO-GLOSS
Name: ProPaint
Brand: ProBrand
Variety: Glossy Finish
Cost Price: 130.00
Selling Price: 195.00
```

These will appear as **variety variants** in the POS.

## Import Process

### Step-by-Step

1. **Open Import Dialog**
   - Click "Import Excel" button on Products page
   - Dialog opens with instructions

2. **Download Template**
   - Click "Download Excel Template"
   - Save the file: `product_import_template.xlsx`

3. **Fill in Your Data**
   - Open the template in Excel or Google Sheets
   - **Keep the header row** (row 1) unchanged
   - Delete or modify the example products (rows 2-5)
   - Add your products starting from row 2
   - Save the file when complete

4. **Upload File**
   - Click "Select Excel File" in the dialog
   - Choose your filled template
   - File name will appear below the button

5. **Start Import**
   - Click "Import" button
   - Progress indicator shows while processing
   - Wait for completion message

6. **Review Results**
   - Success: "Successfully imported X products!"
   - Partial Success: Shows count of succeeded and failed
   - View error details for any failed rows

### What Happens During Import

1. **File Validation**
   - Checks file format (.xlsx or .xls)
   - Parses Excel data
   - Validates each row

2. **Data Processing**
   - Creates new categories if they don't exist
   - Creates new suppliers if they don't exist
   - Validates SKU uniqueness
   - Checks required fields

3. **Database Insertion**
   - Inserts products into database
   - Creates inventory records
   - Creates initial stock transactions
   - Links categories and suppliers

4. **Result Summary**
   - Total rows processed
   - Successful imports
   - Errors with details

## Validation Rules

### Required Fields
- **SKU** - Cannot be empty
- **Name** - Cannot be empty
- **Unit** - Cannot be empty
- **Selling Price** - Must be greater than 0

### Data Limits
- SKU: Max 50 characters
- Name: Max 200 characters
- Selling Price: Must be positive number
- Cost Price: Cannot be negative

### Duplicate Detection
- **SKU must be unique** across all products
- Duplicate SKUs in file: Rejected with error
- SKU exists in database: Rejected with error
- Solution: Use unique SKU codes for each product

## Auto-Creation Features

### Categories
If you specify a category name that doesn't exist:
- ✅ Category is automatically created
- ✅ Products are linked to the new category
- ❌ No parent category assigned (top-level only)

### Suppliers
If you specify a supplier name that doesn't exist:
- ✅ Supplier is automatically created
- ✅ Products are linked to the new supplier
- ❌ No contact information (add later)

## Creating Product Variants

### Same Brand + Name = Variants

Products with the **same Brand and Name** are grouped as variants in the POS:

```excel
SKU              Name         Brand      Size    Variety
PAINT-W-FLAT-1L  Wall Paint   PaintCo    1L      Matte
PAINT-W-FLAT-4L  Wall Paint   PaintCo    4L      Matte
PAINT-W-GLOS-1L  Wall Paint   PaintCo    1L      Glossy
```

In POS, these appear as **one product** with selectable variants.

### Variant Attributes

Use these columns to create variants:
- **Size** - For different sizes (10m, 5m, 1L, 4L)
- **Variety** - For different types (Flat Finish, Glossy, Semi-Gloss)
- **Color** - For different colors (White, Red, Blue)

### SKU Strategy for Variants

Create unique SKUs that indicate the variant:

```
Format: PREFIX-PRODUCT-VARIANT-SIZE
Example: PAINT-PRO-FLAT-1L
         PAINT-PRO-GLOSS-1L
         PAINT-PRO-FLAT-4L
```

## Error Handling

### Common Errors

#### 1. Missing Required Field
```
Error: Missing required field: SKU
Solution: Fill in the SKU column for all products
```

#### 2. Duplicate SKU in File
```
Error: Duplicate SKU in file: ELEC-001
Solution: Ensure each SKU appears only once in your file
```

#### 3. SKU Already Exists
```
Error: SKU already exists in database: ELEC-001
Solution: Use a different SKU or update the existing product manually
```

#### 4. Invalid Selling Price
```
Error: Invalid selling price: must be greater than 0
Solution: Enter a positive number in the Selling_Price column
```

#### 5. Invalid Cost Price
```
Error: Invalid cost price: cannot be negative
Solution: Enter 0 or a positive number in the Cost_Price column
```

### Error Details Table

After import, if there are errors, you'll see a table with:
- **Row** - Row number in Excel file (starting from 2)
- **Error** - Description of what went wrong
- **Data** - SKU and Name of the failed product

### Partial Import Success

The import continues even if some rows fail:
- ✅ Valid products are imported
- ❌ Invalid products are skipped with error details
- 📊 Summary shows both successful and failed counts

## Tips & Best Practices

### 1. Start Small
- Test with 5-10 products first
- Verify they import correctly
- Then import your full product list

### 2. Prepare Your Data
- Clean up product names (remove extra spaces)
- Ensure SKUs are unique
- Use consistent brand names
- Standardize size/color/variety values

### 3. Use Consistent Units
Common units for hardware stores:
- `piece` or `pcs` - Individual items
- `box` - Boxed items
- `roll` - Wire, tape, etc.
- `can` - Paint, chemicals
- `bag` - Cement, fertilizer
- `sheet` - Plywood, metal sheets
- `meter` or `m` - Measured materials

### 4. Organize Variants
For products with variants:
- Keep brand name exactly the same
- Keep product name exactly the same
- Vary only size/variety/color
- Use descriptive SKUs

### 5. Pricing Strategy
- Cost Price: Your purchase cost
- Selling Price: Retail price (can include VAT)
- Ensure selling price > cost price for profit

### 6. Initial Stock
- Enter initial stock if you're setting up inventory
- Leave blank if you'll add stock via purchase orders
- You can always adjust stock later

## Column Name Variations

The system accepts multiple column name formats:

| Standard | Also Accepts |
|----------|--------------|
| Cost_Price | cost_price, cost, Cost Price |
| Selling_Price | selling_price, price, Selling Price |
| Min_Stock_Level | min_stock_level, min_stock, Min Stock Level |
| Max_Stock_Level | max_stock_level, max_stock, Max Stock Level |
| Initial_Stock | initial_stock, stock, Initial Stock |

Column headers are case-insensitive and space-insensitive.

## File Size Limits

- **Maximum file size**: 10 MB
- **Recommended**: Under 5,000 products per file
- For larger imports: Split into multiple files

## Supported File Formats

✅ Supported:
- `.xlsx` - Excel 2007 and newer
- `.xls` - Excel 97-2003

❌ Not Supported:
- `.csv` - Use the separate "Import CSV" button
- `.ods` - Convert to .xlsx first
- Google Sheets - Download as .xlsx first

## After Import

### Verify Import
1. Go to Products page
2. Search for imported products
3. Check prices and stock levels
4. Verify categories assigned correctly

### Update Details
After import, you can edit products to add:
- Product descriptions
- Better categorization
- Supplier contact information
- Product images (if system supports)

### Inventory Management
- Initial stock creates inventory records
- Stock levels sync automatically
- Purchase orders can replenish stock
- Sales deplete stock automatically

## Troubleshooting

### Import Button Not Visible

**Problem**: Can't see "Import Excel" button

**Solutions**:
- Check user role (must be Admin or Manager)
- Refresh the page
- Clear browser cache

### Template Won't Download

**Problem**: Click template button but nothing happens

**Solutions**:
- Check browser popup blocker
- Try different browser
- Check download folder permissions
- Contact system administrator

### Import Takes Too Long

**Problem**: Import is processing for many minutes

**Solutions**:
- Large files (1000+ products) take time
- Don't close the dialog
- Wait for completion message
- If over 10 minutes, contact support

### Products Not Appearing

**Problem**: Import succeeded but products don't show

**Solutions**:
- Click "Refresh" button on Products page
- Clear search filters
- Check if products are marked inactive
- Verify import results showed success

### Variant Grouping Not Working

**Problem**: Products should group but don't in POS

**Solutions**:
- Ensure Brand name is exactly the same
- Ensure Product name is exactly the same
- Check for extra spaces in Brand/Name
- Verify products are active

## Security & Permissions

### Who Can Import
- ✅ Admin role
- ✅ Manager role
- ❌ Cashier role

### Data Privacy
- Files are temporarily stored during import
- Files are deleted after processing
- No permanent file storage
- Import logs include user ID

## API Endpoints

For developers integrating with the system:

### Import Products
```
POST /api/products/import
Headers: Authorization: Bearer {token}
Body: multipart/form-data with 'file' field
Returns: ImportResult object
```

### Download Template
```
GET /api/products/import/template
Headers: Authorization: Bearer {token}
Returns: Excel file download
```

## Support

For issues with Excel import:
1. Check this guide first
2. Review error messages carefully
3. Try importing a small test file
4. Contact system administrator
5. Provide error details and sample data

## Future Enhancements

Planned improvements:
- Update existing products (not just insert)
- Import product images
- Bulk price updates
- Import from Google Sheets directly
- Scheduled imports
- Import templates for different product types
