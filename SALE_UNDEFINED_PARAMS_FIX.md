# Sale Undefined Parameters Fix ✅

## Issue
Error when completing a sale: **"Bind parameters must not contain undefined. To pass SQL NULL specify JS null"**

## Root Cause
The `enhancedSalesService.ts` had two issues when inserting sales:

1. **Missing `shift_id` in INSERT statement**: The service was receiving `shiftId` from the frontend but not including it in the INSERT query
2. **`customerId` could be undefined**: When `customerId` was `null`, it needed to be explicitly passed as `null` instead of potentially being `undefined`

## Files Modified

### `backend/src/services/enhancedSalesService.ts`

**Fix 1: Extract shiftId from saleData**
```typescript
// Before
const {
  customerName,
  customerEmail,
  customerPhone,
  customerAccountId,
  items,
  paymentSplits,
  taxRate = 0,
  discountAmount = 0,
  cashierId
} = saleData;

// After
const {
  customerName,
  customerEmail,
  customerPhone,
  customerAccountId,
  items,
  paymentSplits,
  taxRate = 0,
  discountAmount = 0,
  shiftId,  // ← Added
  cashierId
} = saleData;
```

**Fix 2: Include shift_id in INSERT statement and ensure null values**
```typescript
// Before
const [saleResult] = await connection.execute(`
  INSERT INTO sales (
    sale_number, customer_id, customer_name, customer_email, customer_phone,
    subtotal, tax_amount, discount_amount, total_amount,
    payment_method, payment_status, cashier_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
`, [
  saleNumber,
  customerId,  // ← Could be undefined
  customerName || null,
  customerEmail || null,
  customerPhone || null,
  subtotal,
  taxAmount,
  discountAmount,
  totalAmount,
  primaryPayment.paymentMethod,
  cashierId
  // ← Missing shift_id
]) as any;

// After
const [saleResult] = await connection.execute(`
  INSERT INTO sales (
    sale_number, customer_id, customer_name, customer_email, customer_phone,
    subtotal, tax_amount, discount_amount, total_amount,
    payment_method, payment_status, cashier_id, shift_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
`, [
  saleNumber,
  customerId || null,  // ← Explicitly null if undefined
  customerName || null,
  customerEmail || null,
  customerPhone || null,
  subtotal,
  taxAmount,
  discountAmount,
  totalAmount,
  primaryPayment.paymentMethod,
  cashierId,
  shiftId || null  // ← Added with explicit null
]) as any;
```

## What Changed

### INSERT Statement
- **Added column**: `shift_id` to the column list
- **Added parameter**: `shiftId || null` to the values array
- **Fixed**: `customerId || null` to ensure it's explicitly `null` instead of `undefined`

### Parameter Binding
The MySQL2 library requires that all bind parameters be either:
- A valid value (string, number, boolean, etc.)
- Explicitly `null` (for SQL NULL)
- **NOT** `undefined` (will throw error)

By using the `|| null` pattern, we ensure that if a value is falsy (undefined, empty string, etc.), it becomes `null` which MySQL accepts.

## Why This Happened

The frontend was sending:
```typescript
const saleData = {
  items: [...],
  paymentSplits: [...],
  customerAccountId: paymentData.customerAccountId ?? null,
  customerName: paymentData.customerName ?? null,
  cashier_id: user.id,
  shift_id: currentShift.id,  // ← This was being sent
};
```

But the backend wasn't:
1. Extracting `shiftId` from the destructured `saleData`
2. Including `shift_id` in the INSERT statement

Additionally, when `customerId` was falsy after the customer lookup, it was `undefined` instead of `null`, causing the MySQL bind parameter error.

## Testing

### TypeScript Compilation
✅ Backend compiles successfully with no errors

### Expected Behavior After Fix
1. User completes a sale in the POS
2. Sale is created with:
   - Customer ID (if customer exists/created, otherwise NULL)
   - Shift ID (from current shift)
   - All payment splits recorded
   - Inventory updated
   - Customer purchase stats updated
3. No "Bind parameters must not contain undefined" error
4. Receipt displays correctly

## Related Files

### Frontend (No Changes Needed)
- `frontend/src/contexts/CashierPOSContext.tsx` - Already sends shift_id correctly

### Backend (Fixed)
- `backend/src/services/enhancedSalesService.ts` - Fixed INSERT statement and parameter binding

### Database Schema
The `sales` table already has the `shift_id` column, so no migration needed:
```sql
CREATE TABLE sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'completed',
  cashier_id INT,
  shift_id INT,  -- ← Column exists
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- ... other columns
);
```

## Prevention

To prevent similar issues in the future:

1. **Always use explicit null**: `value || null` instead of just `value`
2. **Match frontend/backend fields**: Ensure destructured variables match the sent data
3. **Include all columns**: Don't omit columns that should be populated
4. **Test with optional values**: Test sales with and without customers, shifts, etc.

## Summary

The error was caused by:
1. Missing `shift_id` in the INSERT statement despite it being sent from frontend
2. `customerId` potentially being `undefined` instead of `null`

The fix:
1. Extract `shiftId` from `saleData`
2. Add `shift_id` to INSERT columns
3. Add `shiftId || null` to INSERT values
4. Change `customerId` to `customerId || null`

This ensures all bind parameters are either valid values or explicitly `null`, which MySQL2 requires.
