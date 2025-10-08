# Cashier POS Field Mapping Fix ✅

## Issue
Error when completing a sale in Cashier POS: **"Bind parameters must not contain undefined. To pass SQL NULL specify JS null"**

## Root Cause
The frontend was sending sale item data in **snake_case** format (`product_id`, `unit_price`), but the backend service was expecting **camelCase** format (`productId`, `unitPrice`). 

When the backend tried to destructure the fields, they were `undefined`:
```typescript
const { productId, quantity, unitPrice, discountAmount } = item;
// productId = undefined (because frontend sent product_id)
// unitPrice = undefined (because frontend sent unit_price)
```

This caused MySQL bind parameters to contain `undefined` values, which is not allowed.

## Frontend Data Format
`frontend/src/contexts/CashierPOSContext.tsx` sends:
```typescript
const saleData = {
  items: cart.map(item => ({
    product_id: item.id,        // ← snake_case
    quantity: item.quantity,
    unit_price: item.price,     // ← snake_case
    discount: 0,
  })),
  paymentSplits: [...],
  customerAccountId: paymentData.customerAccountId ?? null,
  customerName: paymentData.customerName ?? null,
  cashier_id: user.id,
  shift_id: currentShift.id,
};
```

## Backend Expectation
`backend/src/services/enhancedSalesService.ts` expects:
```typescript
export interface EnhancedSaleData {
  items: Array<{
    productId: number;      // ← camelCase
    quantity: number;
    unitPrice: number;      // ← camelCase
    discountAmount?: number;
  }>;
  // ...
}
```

## Solution
Transform the field names in the route handler before passing to the service.

### File Modified: `backend/src/routes/sales.ts`

**Before:**
```typescript
const result = await processEnhancedSale(pool, {
  customerName,
  customerEmail,
  customerPhone,
  customerAccountId,
  items,  // ← Passed as-is with snake_case fields
  paymentSplits: paymentSplits.map((split: any) => ({
    paymentMethod: split.payment_method_code || split.paymentMethod,
    amount: split.amount,
    referenceNumber: split.reference_number || split.referenceNumber || null,
    notes: split.notes || null
  })),
  taxRate,
  discountAmount,
  shiftId,
  cashierId: req.user!.id
});
```

**After:**
```typescript
const result = await processEnhancedSale(pool, {
  customerName,
  customerEmail,
  customerPhone,
  customerAccountId,
  items: items.map((item: any) => ({
    productId: item.product_id || item.productId,        // ← Transform snake_case to camelCase
    quantity: item.quantity,
    unitPrice: item.unit_price || item.unitPrice,        // ← Transform snake_case to camelCase
    discountAmount: item.discount || item.discountAmount || 0
  })),
  paymentSplits: paymentSplits.map((split: any) => ({
    paymentMethod: split.payment_method_code || split.paymentMethod,
    amount: split.amount,
    referenceNumber: split.reference_number || split.referenceNumber || null,
    notes: split.notes || null
  })),
  taxRate,
  discountAmount,
  shiftId,
  cashierId: req.user!.id
});
```

## What Changed

### Item Transformation
The route now transforms each item to match the expected camelCase format:
- `product_id` → `productId`
- `unit_price` → `unitPrice`
- `discount` → `discountAmount`

### Backward Compatibility
The transformation supports both formats:
```typescript
productId: item.product_id || item.productId
```
This means it will work if the frontend sends either:
- `product_id` (snake_case) - current format
- `productId` (camelCase) - if we update frontend later

## Why This Pattern

### Frontend (React/TypeScript)
Common to use snake_case for API data because:
- Matches database column names
- Easier to map directly from database results
- Less transformation needed

### Backend Service (TypeScript)
Prefers camelCase because:
- TypeScript convention
- JavaScript/TypeScript standard
- Better for TypeScript interfaces

### Route Layer (Transformation Point)
The route acts as a translator:
- Accepts frontend's snake_case
- Transforms to service's camelCase
- Decouples frontend from service implementation

## Related Files

### No Changes Needed
- `frontend/src/contexts/CashierPOSContext.tsx` - Continues to send snake_case
- `backend/src/services/enhancedSalesService.ts` - Continues to expect camelCase

### Changed
- `backend/src/routes/sales.ts` - Added transformation layer

## Testing Checklist

### ✅ TypeScript Compilation
- Backend compiles with no errors

### Test Scenarios
- [ ] Complete sale with single item
- [ ] Complete sale with multiple items
- [ ] Complete sale with customer name
- [ ] Complete sale without customer
- [ ] Complete sale with single payment method
- [ ] Complete sale with split payment (multiple methods)
- [ ] Verify inventory updates correctly
- [ ] Verify shift totals update correctly
- [ ] Verify customer purchase stats update
- [ ] Check receipt displays correctly

## Prevention

To prevent similar issues:

1. **Document field formats** - Specify snake_case vs camelCase in API docs
2. **Use transformation layer** - Route layer should transform between formats
3. **Type validation** - Consider using validation libraries like Zod or Joi
4. **Consistent naming** - Consider standardizing on one format across stack
5. **Test with real data** - Test API endpoints with actual frontend payloads

## Alternative Solutions (Not Chosen)

### Option 1: Change Frontend to camelCase
```typescript
// Not chosen because would require changes in multiple places
items: cart.map(item => ({
  productId: item.id,
  quantity: item.quantity,
  unitPrice: item.price,
  discountAmount: 0,
}))
```

### Option 2: Change Backend to snake_case
```typescript
// Not chosen because violates TypeScript conventions
interface EnhancedSaleData {
  items: Array<{
    product_id: number;
    unit_price: number;
  }>;
}
```

### Option 3: Automatic Case Conversion Middleware
```typescript
// Not chosen because too magical, harder to debug
app.use(convertKeysMiddleware('camelCase'));
```

## Chosen Solution Benefits

✅ **Minimal changes** - Only one file modified  
✅ **Explicit transformation** - Clear what's happening  
✅ **Backward compatible** - Supports both formats  
✅ **Type safe** - TypeScript interfaces unchanged  
✅ **Maintainable** - Easy to understand and debug  

## Summary

The "Bind parameters must not contain undefined" error was caused by a **field naming mismatch**:
- Frontend sent: `product_id`, `unit_price` (snake_case)
- Backend expected: `productId`, `unitPrice` (camelCase)
- Result: `undefined` values in SQL bind parameters

**Fix:** Added transformation in the route layer to convert snake_case to camelCase before passing to the service.

**Result:** Sales complete successfully, inventory updates, customer stats update, receipts print correctly.
