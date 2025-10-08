# Enhanced Payment Integration Guide

## Overview
The EnhancedPaymentDialog component has been created to support multi-payment processing in the POS system. This guide explains how to integrate it into the CashierPOS checkout flow.

## Component Created

### EnhancedPaymentDialog.tsx
**Location**: `frontend/src/components/EnhancedPaymentDialog.tsx`

**Features**:
- Multi-payment method selection (Cash, AR, GCash, Bank Transfer, QR PH, Credit Card, Check)
- Split payment support with individual amount inputs
- Reference number entry for non-cash methods
- Customer selection for AR payments
- Real-time validation:
  - Total must equal sale amount
  - Customer required for AR
  - Reference numbers for applicable methods
  - Credit limit validation for AR
- Payment summary display
- Visual feedback with remaining amount

**Props**:
```typescript
interface EnhancedPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  onPaymentComplete: (paymentData: {
    paymentSplits: PaymentSplit[];
    customerAccountId?: number;
  }) => void;
}
```

## Integration Steps

### Option 1: Update Existing PaymentDialog (Recommended)

Replace the existing `PaymentDialog` component import and usage in `CashierPOS.tsx`:

1. **Update Import**:
```typescript
// Change from:
import PaymentDialog from '../components/PaymentDialog';

// To:
import EnhancedPaymentDialog from '../components/EnhancedPaymentDialog';
```

2. **Update Dialog Usage**:
```typescript
// Replace existing PaymentDialog with:
<EnhancedPaymentDialog
  open={showPaymentDialog}
  onClose={() => setShowPaymentDialog(false)}
  totalAmount={totals.total}
  onPaymentComplete={handleEnhancedPayment}
/>
```

3. **Add Handler Function**:
```typescript
const handleEnhancedPayment = async (paymentData: {
  paymentSplits: Array<{ payment_method_code: string; amount: number; reference_number?: string }>;
  customerAccountId?: number;
}) => {
  try {
    // Use the enhanced sale endpoint
    const response = await axios.post('/api/sales/enhanced', {
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        discount: 0,
      })),
      paymentSplits: paymentData.paymentSplits,
      customerAccountId: paymentData.customerAccountId,
      cashier_id: currentShift?.cashier_id,
      shift_id: currentShift?.id,
    });

    // Handle success
    setShowPaymentDialog(false);
    clearCart();
    showNotification('Sale completed successfully!', 'success');
    
    // Show receipt or perform other post-sale actions
    // ...
  } catch (error: any) {
    showNotification(error.response?.data?.message || 'Payment failed', 'error');
  }
};
```

### Option 2: Keep Both Dialogs (Advanced Users)

For backward compatibility, you can keep both dialogs and let cashiers choose:

1. **Add State**:
```typescript
const [useEnhancedPayment, setUseEnhancedPayment] = useState(false);
```

2. **Add Toggle Button**:
```typescript
<Button
  variant="outlined"
  onClick={() => setUseEnhancedPayment(!useEnhancedPayment)}
>
  {useEnhancedPayment ? 'Simple Payment' : 'Multi-Payment'}
</Button>
```

3. **Conditional Rendering**:
```typescript
{useEnhancedPayment ? (
  <EnhancedPaymentDialog
    open={showPaymentDialog}
    onClose={() => setShowPaymentDialog(false)}
    totalAmount={totals.total}
    onPaymentComplete={handleEnhancedPayment}
  />
) : (
  <PaymentDialog
    open={showPaymentDialog}
    onClose={() => setShowPaymentDialog(false)}
    customerInfo={customerInfo}
    onSuccess={handlePaymentSuccess}
  />
)}
```

## CashierPOSContext Updates

### Update processSale Function

The `CashierPOSContext` should be updated to support the enhanced sale endpoint:

```typescript
const processEnhancedSale = async (
  items: CartItem[],
  paymentData: {
    paymentSplits: PaymentSplit[];
    customerAccountId?: number;
  }
) => {
  setIsProcessing(true);
  setError(null);

  try {
    const saleData = {
      items: items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        discount: item.discount || 0,
      })),
      paymentSplits: paymentData.paymentSplits,
      customerAccountId: paymentData.customerAccountId,
      cashier_id: currentShift?.cashier_id,
      shift_id: currentShift?.id,
    };

    const response = await axios.post('/api/sales/enhanced', saleData);

    // Update current sale state
    setCurrentSale(response.data);

    // Clear cart
    setCart([]);

    // Return sale data for receipt generation
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 'Sale processing failed';
    setError(errorMessage);
    throw error;
  } finally {
    setIsProcessing(false);
  }
};
```

## Testing Checklist

### Frontend Testing
- [ ] EnhancedPaymentDialog opens when checkout is clicked
- [ ] All payment methods appear in checkbox list
- [ ] Can select/deselect multiple payment methods
- [ ] Amount inputs accept decimal values
- [ ] Reference number fields appear for applicable methods
- [ ] Customer dropdown appears when AR is selected
- [ ] Total validation works (must equal sale total)
- [ ] Customer credit limit validation works
- [ ] Error messages display for validation failures
- [ ] Payment summary shows correct breakdown
- [ ] Remaining amount updates in real-time

### Backend Integration
- [ ] Enhanced sale endpoint receives payment splits correctly
- [ ] Payment splits are saved to database
- [ ] AR transaction is created when customer selected
- [ ] Customer balance updates correctly
- [ ] Inventory is updated
- [ ] Shift totals are updated with payment breakdown
- [ ] Transaction rolls back on error

### User Experience
- [ ] Dialog is responsive on tablets
- [ ] Form validation provides clear feedback
- [ ] Auto-calculation of remaining amount works
- [ ] Customer search in dropdown is fast
- [ ] Can close dialog without completing payment
- [ ] Success notification appears on completion

## Usage Example

### Single Payment Method (Cash)
1. Add items to cart
2. Click "Checkout"
3. EnhancedPaymentDialog opens
4. Cash is pre-selected with full amount
5. Click "Complete Payment"
6. Sale processes successfully

### Split Payment (Cash + GCash)
1. Add items to cart (Total: ₱1000)
2. Click "Checkout"
3. Check "Cash" → Enter ₱600
4. Check "GCash" → Enter ₱400 → Enter reference: GC123456
5. Verify total shows ₱1000 and remaining shows ₱0
6. Click "Complete Payment"
7. Sale creates two payment splits

### AR Payment
1. Add items to cart (Total: ₱500)
2. Click "Checkout"
3. Uncheck "Cash"
4. Check "AR" → Amount shows ₱500
5. Customer dropdown appears
6. Search and select customer
7. Verify available credit is sufficient
8. Click "Complete Payment"
9. Customer balance increases by ₱500

### Mixed Payment (Cash + AR)
1. Add items to cart (Total: ₱1500)
2. Click "Checkout"
3. Keep "Cash" checked → Enter ₱1000
4. Check "AR" → Enter ₱500
5. Select customer
6. Verify customer has ₱500 available credit
7. Click "Complete Payment"
8. ₱1000 goes to cash register, ₱500 to customer AR

## Troubleshooting

### "Payment total must equal sale total" error
- Ensure sum of all payment method amounts equals exactly the sale total
- Check for rounding errors in decimal inputs

### "Please select a customer for AR payment" error
- AR payment method selected but no customer chosen
- Select a customer from the dropdown

### "Reference number required" error
- Non-cash payment method requires reference but field is empty
- Enter a reference number (e.g., transaction ID, check number)

### "AR amount exceeds available credit" error
- Customer doesn't have enough available credit
- Options:
  1. Reduce AR amount and pay more cash
  2. Record a payment first to free up credit
  3. Increase customer's credit limit

### Customer dropdown is empty
- No customers have been created yet
- Go to "Customer Accounts" page and add customers first

## Next Steps

1. **Implement Integration**: Follow Option 1 steps above
2. **Test Thoroughly**: Use the testing checklist
3. **Train Users**: Educate cashiers on multi-payment flow
4. **Monitor**: Check daily reports for payment method breakdown
5. **Optimize**: Gather feedback and make UI improvements

## Additional Enhancements (Future)

1. **Quick Amount Buttons**: Add preset buttons (₱100, ₱500, ₱1000)
2. **Payment History**: Show recent payment methods for quick selection
3. **Barcode Scanner**: Scan GCash/QR codes for reference numbers
4. **Calculator**: Built-in calculator for split amount calculations
5. **Templates**: Save common split patterns (e.g., 50/50 Cash/GCash)
6. **Keyboard Shortcuts**: Number pad support for faster entry
7. **Receipt Integration**: Show payment breakdown on printed receipt

## Files to Modify

### Required
- `frontend/src/pages/CashierPOS.tsx` - Integrate EnhancedPaymentDialog
- `frontend/src/contexts/CashierPOSContext.tsx` - Add processEnhancedSale function

### Optional
- `frontend/src/components/Receipt.tsx` - Show payment breakdown
- `frontend/src/pages/Sales.tsx` - Display payment splits in sales list

## Summary

The EnhancedPaymentDialog is fully implemented and ready for integration. It provides a comprehensive multi-payment interface with validation, customer selection, and real-time feedback. Follow the integration steps above to enable multi-payment support in your POS system.

All backend infrastructure is already in place:
- ✅ `/api/sales/enhanced` endpoint ready
- ✅ Payment splits table created
- ✅ AR integration working
- ✅ Customer credit limit validation
- ✅ Shift totals with payment breakdown

The only remaining step is to integrate the component into the checkout flow!
