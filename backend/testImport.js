const xlsx = require('xlsx');
const path = require('path');

// Usage: node backend/testImport.js "path/to/your/file.xlsx"
const filePath = process.argv[2];

if (!filePath) {
  console.log('\nUsage: node backend/testImport.js "path/to/your/file.xlsx"\n');
  process.exit(1);
}

try {
  console.log('\n=== TESTING EXCEL FILE ===');
  console.log('File:', filePath);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  console.log('Sheet:', sheetName);
  
  const worksheet = workbook.Sheets[sheetName];
  const products = xlsx.utils.sheet_to_json(worksheet);
  
  console.log('\n=== FILE CONTENTS ===');
  console.log('Total rows:', products.length);
  
  if (products.length > 0) {
    console.log('\nColumn headers found:');
    const headers = Object.keys(products[0]);
    headers.forEach(h => console.log('  -', h));
    
    console.log('\n=== VALIDATION RESULTS ===\n');
    
    const errors = [];
    const warnings = [];
    let validCount = 0;
    
    products.forEach((row, i) => {
      const rowNum = i + 2; // Account for header row
      const issues = [];
      
      // Check required fields
      const name = row.Name || row.name || row['Product Name'];
      const costPrice = parseFloat(row.Cost_Price || row['Cost Price'] || row.costPrice || '0');
      const sellingPrice = parseFloat(row.Selling_Price || row['Selling Price'] || row.sellingPrice || '0');
      
      if (!name || name.trim() === '') {
        issues.push('Missing Name');
      }
      
      if (isNaN(costPrice) || costPrice <= 0) {
        issues.push(`Invalid Cost_Price: ${row.Cost_Price || row['Cost Price'] || row.costPrice || 'missing'}`);
      }
      
      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        issues.push(`Invalid Selling_Price: ${row.Selling_Price || row['Selling Price'] || row.sellingPrice || 'missing'}`);
      }
      
      if (costPrice >= sellingPrice && costPrice > 0 && sellingPrice > 0) {
        warnings.push(`Row ${rowNum}: Cost price (${costPrice}) >= Selling price (${sellingPrice}) for "${name}"`);
      }
      
      if (issues.length > 0) {
        errors.push(`Row ${rowNum}: ${issues.join(', ')}`);
      } else {
        validCount++;
      }
    });
    
    console.log('Valid rows:', validCount);
    console.log('Rows with errors:', errors.length);
    console.log('Warnings:', warnings.length);
    
    if (errors.length > 0) {
      console.log('\n=== ERRORS (must fix) ===');
      errors.forEach(e => console.log('❌', e));
    }
    
    if (warnings.length > 0) {
      console.log('\n=== WARNINGS (review) ===');
      warnings.forEach(w => console.log('⚠️ ', w));
    }
    
    if (errors.length === 0 && validCount > 0) {
      console.log('\n✅ File looks good! All rows have required fields.\n');
    } else if (validCount === 0) {
      console.log('\n❌ No valid rows found. Please fix the errors above.\n');
    }
    
    console.log('\n=== SAMPLE DATA (First 3 rows) ===\n');
    products.slice(0, 3).forEach((row, i) => {
      console.log(`Row ${i + 2}:`);
      console.log('  Name:', row.Name || row.name || row['Product Name'] || 'MISSING');
      console.log('  Cost Price:', row.Cost_Price || row['Cost Price'] || row.costPrice || 'MISSING');
      console.log('  Selling Price:', row.Selling_Price || row['Selling Price'] || row.sellingPrice || 'MISSING');
      console.log('  SKU:', row.SKU || row.sku || '(will auto-generate)');
      console.log('  Brand:', row.Brand || row.brand || '');
      console.log('  Category:', row.Category || row.category || '');
      console.log('');
    });
  }
  
} catch (error) {
  console.error('\n❌ Error reading file:', error.message);
  console.error('\nMake sure:');
  console.error('  1. The file path is correct');
  console.error('  2. The file is a valid Excel file (.xlsx)');
  console.error('  3. The file is not open in Excel\n');
}
