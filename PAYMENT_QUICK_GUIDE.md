# 🎯 Quick Payment Guide

## Payment Methods Available (7)

1. **Cash** - Quick buttons for fast checkout
2. **A/R (Credit)** - Accounts Receivable (requires customer selection)
3. **GCash** - Mobile payment (requires reference)
4. **Bank Transfer** - Direct bank transfer (requires reference)
5. **QR PH** - QR Philippines (requires reference)
6. **Credit Card** - Card payment (requires reference)
7. **Check** - Check payment (requires reference)

---

## 💰 Quick Cash Feature

### How It Works:

**When you select "Cash" as payment method:**

1. **Quick Amount Buttons** appear:
   - ₱20, ₱50, ₱100, ₱200, ₱500, ₱1000
   - **"Exact"** button - pays exact remaining amount
   - **Round Up** button - rounds to nearest ₱100

2. **Click any amount:**
   - If amount ≥ total → Full payment (completes checkout)
   - If amount < total → Partial payment (adds to list, enables split payment)

### Example: Split Payment

**Scenario:** Total = ₱850

1. Click **₱500** (Cash) → Adds ₱500 Cash payment
2. Remaining shows: ₱350
3. Dialog switches to **Credit Card** automatically
4. You can:
   - Enter ₱350 + reference → Add Payment
   - OR switch to GCash and enter ₱350 + reference
5. When total paid = ₱850 → "Complete Sale" button enables

---

## 🛒 Payment Flow Examples

### Example 1: Simple Cash Payment
```
Total: ₱125
1. Select "Cash"
2. Click "Exact" button
3. ✅ Payment complete: ₱125 Cash
4. Click "Complete Sale"
```

### Example 2: Split Payment (Cash + GCash)
```
Total: ₱1,500
1. Select "Cash"
2. Click "₱1000" button → Adds ₱1000 Cash
3. Remaining: ₱500
4. Select "GCash"
5. Enter reference: "GC123456"
6. Click "Add ₱500.00 Payment"
7. ✅ Total paid: ₱1,500
8. Click "Complete Sale"
```

### Example 3: A/R (Customer Account)
```
Total: ₱2,500
1. Select "A/R (Credit)"
2. Select customer from dropdown
3. Amount auto-fills: ₱2,500
4. Click "Add ₱2500.00 Payment"
5. ✅ Customer account will be charged
6. Click "Complete Sale"
```

### Example 4: Multiple Payment Methods
```
Total: ₱3,000
1. Cash: Click "₱1000" → ₱1000 Cash added
2. Remaining: ₱2,000
3. Select "Credit Card"
4. Enter amount: ₱1,200
5. Enter reference: "4532"
6. Click "Add Payment" → ₱1,200 Card added
7. Remaining: ₱800
8. Select "A/R (Credit)"
9. Select customer
10. Amount: ₱800
11. Click "Add Payment" → ₱800 AR added
12. ✅ Total: ₱3,000 (Cash + Card + AR)
13. Click "Complete Sale"
```

---

## 🎨 Visual Guide

### Payment Status Panel
```
Total Due:      ₱1,500.00
Amount Paid:    ₱1,000.00
Remaining:      ₱500.00    ← Updates in real-time
```

### Applied Payments List
```
✅ Cash                 ₱1,000.00    [🗑️]
✅ GCash               ₱500.00      [🗑️]
   Ref: GC123456
```

---

## ⚠️ Validation Rules

1. **Total Must Match:**
   - Amount Paid must equal Total Due
   - "Complete Sale" only enabled when matched

2. **Reference Numbers:**
   - Required for: GCash, Bank Transfer, QR PH, Credit Card, Check
   - NOT required for: Cash, A/R

3. **A/R Requirements:**
   - Customer must be selected
   - Amount cannot exceed available credit
   - Shows: "Credit: ₱10,000.00" in customer dropdown

4. **Amount Validation:**
   - Cannot add payment > remaining balance
   - Must be > ₱0.00

---

## 🔄 Making Changes

### Remove a Payment:
- Click the 🗑️ (delete) icon next to any applied payment
- Remaining balance updates automatically

### Change Method:
- Remove old payment
- Select new method
- Add payment again

### Edit Amount:
- Remove payment
- Enter new amount
- Add payment

---

## 💡 Pro Tips

1. **Use Quick Cash Buttons** for speed - one click checkout!

2. **"Exact" Button** is your friend for exact cash payments

3. **Split Payments** - Great for:
   - Customer pays partial cash + card
   - Mixed payment methods
   - Large transactions

4. **A/R Customers** - Check available credit in dropdown before selecting

5. **Round Up Button** - Automatically rounds to nearest ₱100 for easier change

---

## 🐛 Common Issues

**Issue: "Complete Sale" button disabled**
- ✅ Check: Total Paid must equal Total Due
- ✅ Add more payments to cover remaining balance

**Issue: Can't add GCash payment**
- ✅ Check: Did you enter a reference number?
- ✅ Reference field appears below amount input

**Issue: A/R payment error**
- ✅ Check: Is customer selected?
- ✅ Check: Does customer have enough credit?

**Issue: Quick cash not working**
- ✅ Make sure "Cash" method is selected
- ✅ Buttons only appear for Cash method

---

**Happy Selling!** 🚀
