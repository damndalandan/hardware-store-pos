# Quick Reference: Product Variants & Excel Import

## Product Variant Grouping 🎯

### How Products Group
Products with **same Brand + Name** = Grouped as variants

```
Brand: ElecTest + Name: Electrical Wire
  → Size 10m (variant)
  → Size 5m (variant)
  
Brand: ProBrand + Name: ProPaint
  → Variety: Flat Finish (variant)
  → Variety: Glossy (variant)
```

### Variant Types
- **Size** → Blue chips (10m, 5m, 1L, 4L)
- **Variety** → Green chips (Flat, Glossy, Matte)
- **Color** → Purple chips (White, Red, Blue)

### In POS Search
1. Type product name
2. See grouped results
3. Click variant chip to select
4. Add selected variant to cart

---

## Excel Import 📊

### Quick Steps
1. **Products page** → Click "Import Excel"
2. **Download Template** → Pre-formatted .xlsx file
3. **Fill template** → Your products (keep header row!)
4. **Upload** → Select file
5. **Import** → Click import button
6. **Review** → Check success/error summary

### Required Columns
- ✅ **SKU** (unique)
- ✅ **Name**
- ✅ **Unit** (roll, can, piece, etc.)
- ✅ **Selling_Price** (> 0)

### Optional Columns
- Brand, Category, Supplier
- Size, Variety, Color (for variants!)
- Cost_Price, Initial_Stock
- Min/Max Stock Levels
- Description, Barcode

### Creating Variants in Excel

**Same Brand + Name + Different Attributes:**

```excel
SKU          Name        Brand     Size   Variety
PAINT-F-1L   Wall Paint  PaintCo   1L     Matte
PAINT-F-4L   Wall Paint  PaintCo   4L     Matte
PAINT-G-1L   Wall Paint  PaintCo   1L     Glossy
```

→ Creates 1 product with selectable size + variety variants in POS

### Common SKU Patterns

```
PREFIX-PRODUCT-VARIANT-SIZE

Examples:
ELEC-WIRE-10M    (Electrical-Wire-10meters)
ELEC-WIRE-5M     (Electrical-Wire-5meters)
PAINT-PRO-FLAT   (Paint-ProPaint-Flat)
PAINT-PRO-GLOSS  (Paint-ProPaint-Glossy)
```

### Auto-Creation
- ✅ New categories auto-created
- ✅ New suppliers auto-created
- ✅ Inventory records auto-created
- ✅ Initial stock transactions logged

### Error Handling
❌ Duplicate SKU → Rejected
❌ Missing required field → Rejected
❌ Invalid price → Rejected
✅ Other rows continue importing
📊 Detailed error report provided

---

## Examples

### Example 1: Electrical Wire (Size Variants)
```excel
SKU          Name             Brand      Size   Unit   Cost   Price  Stock
WIRE-10M     Electrical Wire  ElecTest   10m    roll   45.00  65.00  50
WIRE-5M      Electrical Wire  ElecTest   5m     roll   25.00  35.00  75
```

**POS Result:**
```
Electrical Wire
ElecTest • Electrical
[10m] [5m]  ← Click to select variant
₱65.00  Stock: 50  [Add to Cart]
```

### Example 2: ProPaint (Variety Variants)
```excel
SKU              Name      Brand      Variety        Unit  Cost    Price   Stock
PAINT-PRO-FLAT   ProPaint  ProBrand   Flat Finish    can   120.00  180.00  20
PAINT-PRO-GLOSS  ProPaint  ProBrand   Glossy Finish  can   130.00  195.00  15
PAINT-PRO-SEMI   ProPaint  ProBrand   Semi-Gloss     can   125.00  187.50  18
```

**POS Result:**
```
ProPaint
ProBrand • Paint
[Flat Finish] [Glossy Finish] [Semi-Gloss]  ← Click to select
₱180.00  Stock: 20  [Add to Cart]
```

### Example 3: Complete Product (All Fields)
```excel
SKU: HAMMER-001
Barcode: 1234567890
Name: Claw Hammer
Brand: Stanley
Category: Hand Tools
Size: 16oz
Color: Yellow
Unit: piece
Cost_Price: 12.50
Selling_Price: 19.99
Min_Stock_Level: 10
Max_Stock_Level: 100
Initial_Stock: 50
Description: Professional grade claw hammer
Supplier: Hardware Supplies Inc.
```

---

## Permissions

### Who Can Import?
- ✅ Admin
- ✅ Manager
- ❌ Cashier

### Who Can See Variants?
- ✅ Everyone (in POS)
- Automatic grouping in search results

---

## File Formats

### Import Excel
- ✅ .xlsx (Excel 2007+)
- ✅ .xls (Excel 97-2003)
- ❌ .csv (use separate "Import CSV" button)
- Max size: 10 MB

### Template
- Download from Import Dialog
- Pre-formatted with examples
- Column widths optimized
- 4 sample products included

---

## Troubleshooting

### Variants Not Grouping?
```
Check: Brand name matches exactly
Check: Product name matches exactly
Check: Products are active
Fix: Remove extra spaces from names
```

### Import Failed?
```
Check: File is .xlsx or .xls
Check: Header row not modified
Check: SKUs are unique
Check: Required fields filled
View: Error table for details
```

### Template Won't Download?
```
Check: Browser popup blocker
Check: User is Admin/Manager
Try: Different browser
```

---

## Tips

### ✅ Do
- Use unique SKUs for each product
- Keep brand names consistent
- Use descriptive variant values
- Test with small batch first
- Review error messages

### ❌ Don't
- Modify template headers
- Use duplicate SKUs
- Leave required fields empty
- Upload files > 10 MB
- Close dialog during import

---

## Documentation Files

📘 **PRODUCT_VARIANT_GROUPING.md**
   - Detailed variant grouping guide
   - Technical implementation
   - Edge cases and troubleshooting

📗 **EXCEL_IMPORT_GUIDE.md**
   - Complete import manual
   - Template column reference
   - Error handling details

📙 **POS_OPTIMIZATION_SUMMARY.md**
   - Full implementation summary
   - Files modified list
   - Testing checklist

📖 **QUICK_REFERENCE.md** (this file)
   - Quick lookup guide
   - Common examples
   - Fast troubleshooting

---

**Need More Help?**
→ Check full documentation files
→ Review template examples
→ Contact system administrator

**Version**: October 2025
**Status**: Production Ready ✅
