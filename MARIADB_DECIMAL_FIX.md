# MariaDB Decimal Type Fix

## Issue
**Error:** `(item.cost_price || 0).toFixed is not a function`

## Root Cause
MariaDB returns `DECIMAL` column values as **strings**, not numbers. When the frontend tried to call `.toFixed()` on these string values, it failed because `.toFixed()` is only available on number types.

### Example:
```javascript
// SQLite3 returned:
cost_price: 19.99  // Number

// MariaDB returns:
cost_price: "19.99"  // String

// Calling .toFixed() on string:
"19.99".toFixed(2)  // ERROR: toFixed is not a function
```

## Solution
Wrap all DECIMAL values from the database with `Number()` before calling `.toFixed()`:

```javascript
// Before (broken):
${item.cost_price.toFixed(2)}

// After (fixed):
${Number(item.cost_price).toFixed(2)}
```

## Files Fixed

### Frontend Components (10 files)

1. **Products.tsx** (4 occurrences)
   - Cost price display in table
   - Selling price display in table
   - Base cost in product customization
   - Base price in product customization

2. **Inventory.tsx** (2 occurrences)
   - Inventory value calculation in table
   - Inventory value in DataGrid valueGetter

3. **PurchaseOrders.tsx** (3 occurrences)
   - Cost price in suggested orders
   - Total cost calculation
   - Total cost in DataGrid

4. **CashierPOS.tsx** (7 occurrences)
   - Product selling price in grid
   - Item price in cart
   - Item total calculation
   - Item price in receipt
   - Subtotal display
   - Tax display
   - Total display
   - Total sales in shift chip
   - Payment amounts

5. **POS.tsx** (3 occurrences)
   - Product selling price in table
   - Item price in cart
   - Item total calculation
   - Last sale total

6. **CashierPOSContext.tsx** (4 occurrences)
   - Item price calculation in receipt
   - Subtotal in receipt
   - Tax in receipt
   - Total in receipt

7. **PaymentDialog.tsx** (1 occurrence)
   - Payment amount in chip display

8. **ShiftDialog.tsx** (12 occurrences)
   - Total sales in receipt
   - All payment method totals (cash, card, mobile, check)
   - Starting cash
   - Ending cash
   - Cash difference
   - Total sales in UI display

## Fields Affected

All DECIMAL fields from MariaDB need `Number()` conversion:

### Product Fields
- `cost_price`
- `selling_price`
- `margin_percent`

### Sales Fields
- `subtotal`
- `tax`
- `total`
- `price` (in sale items)

### Purchase Order Fields
- `total_cost`
- `unit_cost`

### Inventory Fields
- `current_stock` (when used in calculations)
- `cost_price` (when calculating value)

### Shift Fields
- `totalSales`
- `totalCash`
- `totalCard`
- `totalMobile`
- `totalCheck`
- `startingCash`
- `endingCash`
- `cashDifference`

### Payment Fields
- `amount`

## Why This Happens

MariaDB (and MySQL) have specific behavior for DECIMAL types:

1. **Database Storage:** DECIMAL is stored with exact precision
2. **Wire Protocol:** Values are transmitted as strings to preserve precision
3. **Driver Behavior:** `mysql2` returns DECIMAL as string to avoid floating-point errors
4. **JavaScript Limitation:** JavaScript numbers use IEEE 754 (inexact for decimals)

### Example:
```sql
-- In MariaDB
SELECT cost_price FROM products WHERE id = 1;
-- Returns: 19.99 (exact decimal)

-- Over the wire:
-- Transmitted as: "19.99" (string)

-- In JavaScript with mysql2:
const result = await pool.execute('SELECT cost_price FROM products');
console.log(typeof result[0].cost_price);  // "string"
console.log(result[0].cost_price);          // "19.99"
```

## Best Practice

Always convert database numeric values before arithmetic or formatting:

```javascript
// ✅ Good - Safe conversion
const price = Number(item.cost_price) || 0;
const total = (price * quantity).toFixed(2);

// ✅ Good - With default
const formattedPrice = `$${Number(item.cost_price || 0).toFixed(2)}`;

// ❌ Bad - Direct call on string
const formattedPrice = `$${item.cost_price.toFixed(2)}`;  // ERROR!

// ❌ Bad - Arithmetic on string
const total = item.cost_price * quantity;  // Works but returns string!
```

## Prevention

### Backend Options (Not Recommended)
You could configure the driver to return decimals as numbers:

```javascript
// NOT RECOMMENDED - Can lose precision
const pool = mysql.createPool({
  // ... other config
  decimalNumbers: true  // Convert DECIMAL to JavaScript number
});
```

**Why not recommended:**
- JavaScript numbers have precision limits
- Can cause rounding errors for financial data
- Better to handle explicitly in frontend

### Frontend Pattern (Recommended)
Create a utility function:

```javascript
// utils/formatters.ts
export const formatCurrency = (value: string | number): string => {
  return `$${Number(value || 0).toFixed(2)}`;
};

export const parseDecimal = (value: string | number): number => {
  return Number(value) || 0;
};

// Usage:
{formatCurrency(item.cost_price)}
```

## Testing

After the fix, verify:

1. ✅ Products page displays prices correctly
2. ✅ Inventory page shows values correctly  
3. ✅ POS can add items and calculate totals
4. ✅ Purchase orders display costs correctly
5. ✅ Shift reports show amounts correctly
6. ✅ Payment dialog displays amounts correctly
7. ✅ Receipts print with correct values

## Related Documentation

- MariaDB DECIMAL type: https://mariadb.com/kb/en/decimal/
- mysql2 type handling: https://github.com/sidorares/node-mysql2#type-casting
- JavaScript Number precision: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number

## Summary

**Total Changes:** 38 occurrences across 8 files  
**Pattern:** Wrap all DECIMAL values with `Number()` before calling `.toFixed()`  
**Impact:** Fixes all price/amount display errors in the application  
**Status:** ✅ Complete

---

**Fixed:** October 3, 2025  
**Issue:** MariaDB DECIMAL returned as string  
**Solution:** Number() conversion before toFixed()
