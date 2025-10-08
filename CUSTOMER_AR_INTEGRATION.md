# Customer A/R Integration in Payment Dialog

## Overview
The payment dialog has been enhanced to automatically detect and display customer information when using the A/R (Accounts Receivable) payment method.

## Changes Made

### 1. Database NULL Parameter Fix
**Problem**: Backend was receiving `undefined` values which MySQL rejects - "Bind parameters must not contain undefined. To pass SQL NULL specify JS null"

**Solution**: All optional parameters are now properly converted to `null` instead of `undefined`:
- `reference_number`: Now explicitly converts empty values to `null`
- `customerAccountId`: Uses nullish coalescing operator (`??`) to ensure `null` instead of `undefined`
- `customerName`: Same null handling for consistency

### 2. Auto-Detection of Customer for A/R Payments
**Features**:
- When you select "A/R (Credit)" payment method, the customer dropdown automatically focuses
- Once you select a customer, their name is stored and displayed in the Payment Status panel
- Customer information persists across the payment dialog until the sale is completed
- The customer's name is passed to the backend and stored with the sale record

### 3. Customer Name Display
**Location**: Payment Status panel (left side of payment dialog)

**What's Shown**:
```
┌─────────────────────────────────┐
│ 👤 Customer                     │
│    John Doe Hardware Store      │
└─────────────────────────────────┘
```

The customer info box appears with:
- Light blue background with info color border
- Person icon
- "Customer" label (small text)
- Customer name (bold text)

### 4. Enhanced Data Flow

**Frontend → Backend**:
```typescript
{
  paymentSplits: [
    {
      payment_method_code: 'AR',
      amount: 1500.00,
      reference_number: null  // ← Was undefined, now properly null
    }
  ],
  customerAccountId: 123,      // ← Customer ID (or null)
  customerName: "John Doe"     // ← Customer name (or null)
}
```

**Backend Storage**:
- Sale record includes `customer_name` field
- Payment splits properly handle null reference numbers
- AR transactions link to customer account

## Usage Example

### Scenario: A/R Payment with Cash Split
1. Add items to cart: Total = ₱2,500.00
2. Click "Checkout"
3. Click "A/R (Credit)" button → Customer dropdown automatically focuses
4. Select customer: "CUST001 - ABC Hardware (Credit: ₱5,000.00)"
5. Customer name "ABC Hardware" appears in Payment Status panel
6. Enter amount: ₱1,500.00
7. Click "Add Payment"
8. Click "CASH" button
9. Amount auto-fills with remaining ₱1,000.00
10. Click "Add Payment"
11. Click "Complete Sale"

**Result**: 
- Sale saved with customer name "ABC Hardware"
- Payment splits: AR ₱1,500 + Cash ₱1,000
- Customer AR balance increases by ₱1,500
- All reference fields properly stored as NULL (not undefined)

## Technical Details

### Files Modified

1. **frontend/src/components/EnhancedPaymentDialog.tsx**
   - Added `customerName` state variable
   - Track customer name when customer is selected from dropdown
   - Auto-focus customer dropdown when A/R is clicked
   - Display customer info box in Payment Status panel
   - Convert all undefined to null in payment completion

2. **frontend/src/pages/CashierPOS.tsx**
   - Updated `handleEnhancedPayment` signature to accept `customerName`
   - Pass customer name to context's `processEnhancedSale`

3. **frontend/src/contexts/CashierPOSContext.tsx**
   - Updated `processEnhancedSale` interface to accept `customerName`
   - Ensure all nullable fields use `?? null` for proper null conversion
   - Pass customer name to backend API

4. **backend/src/routes/sales.ts**
   - Already handles `customerName` parameter
   - Maps payment method codes correctly
   - Converts undefined to null for database compatibility

5. **backend/src/services/enhancedSalesService.ts**
   - Already properly handles nullable customer fields
   - Stores customer name in sales table
   - Creates AR transactions with proper null handling

## Validation

### Before Payment
✅ Customer must be selected for A/R payments
✅ AR amount cannot exceed available credit
✅ Reference numbers required for card/check/digital payments

### During Payment
✅ Customer name tracked and displayed
✅ Customer dropdown auto-focuses on A/R selection
✅ All payments validate against remaining balance

### Database Insert
✅ No undefined values - all nullable fields use `null`
✅ Customer name stored in `sales.customer_name`
✅ AR transaction links to customer account
✅ Payment splits properly reference sale

## Benefits

1. **Better UX**: Users see exactly which customer they're charging to A/R
2. **Data Integrity**: Proper NULL handling prevents database errors
3. **Audit Trail**: Customer name stored with every sale for reporting
4. **Automatic Focus**: Reduces clicks and speeds up A/R transactions
5. **Visual Feedback**: Clear display of customer info during checkout

## Testing Checklist

- [ ] A/R payment with customer selection shows customer name
- [ ] Customer name persists until dialog closes
- [ ] Customer name appears in receipt/sale record
- [ ] Split payments (A/R + Cash) work correctly
- [ ] No "undefined" database errors
- [ ] Customer dropdown auto-focuses when A/R selected
- [ ] Can complete sale without customer if not using A/R
- [ ] Customer credit limit validation works
