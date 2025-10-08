# Multi-Payment System Quick Start Guide

## Getting Started

### 1. Initialize Enhanced Database Schema

The enhanced schema will be automatically initialized when you start the backend server for the first time. Look for this log message:

```
Enhanced tables initialized successfully
Payment methods seeded successfully
```

### 2. Start the Development Servers

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 3. Access the New Features

Login with your credentials and navigate to the new menu items:

#### For Cashiers:
- **Customer Accounts** (`/customer-accounts`) - Add customers and record AR payments
- **Expenses** (`/expenses`) - Record daily expenses
- **Petty Cash** (`/petty-cash`) - Manage petty cash and advances

#### For Admins/Managers:
- All cashier features plus:
- **Daily Reports** (`/daily-reports`) - View comprehensive financial reports

## Common Tasks

### Adding a Customer
1. Navigate to **Customer Accounts**
2. Click **Add Customer**
3. Fill in: Customer Code, Name, Phone, Email, Credit Limit
4. Click **Add**

### Recording an Expense
1. Navigate to **Expenses**
2. Click **Add Expense**
3. Select category (Utilities, Rent, Supplies, etc.)
4. Enter description, amount, payment method
5. Add vendor and reference number if applicable
6. Click **Add**
7. Manager/Admin can approve/reject from the list

### Managing Petty Cash
1. Navigate to **Petty Cash**
2. Click **Add Transaction**
3. Select transaction type:
   - **Fund**: Add money to petty cash
   - **Advance**: Give cash advance to employee
   - **Replenish**: Add more funds
   - **Return**: Employee returns advance
4. Enter amount and details
5. Click **Add**

### Recording AR Payment
1. Navigate to **Customer Accounts**
2. Find the customer using search
3. Click the payment icon (💳)
4. Enter payment amount
5. Add notes if needed
6. Click **Record Payment**

### Viewing Daily Reports
1. Navigate to **Daily Reports** (Admin/Manager only)
2. Select date using the date picker
3. Optional: Filter by specific cashier
4. View summary cards:
   - Total Sales
   - Total Expenses
   - AR Charges
   - Cash for Deposit
5. Review detailed breakdowns:
   - Sales by Payment Method
   - Expenses by Category
   - AR Summary
   - Shift Performance

## Multi-Payment Sales (Future Enhancement)

Once the enhanced PaymentDialog is implemented, cashiers will be able to:

1. Add items to cart as usual
2. Click **Checkout**
3. Select multiple payment methods:
   - Check **Cash** and enter amount (e.g., ₱500)
   - Check **GCash** and enter amount (e.g., ₱300)
   - Check **AR** and select customer for remaining balance
4. Enter reference numbers for non-cash payments
5. System validates total matches sale amount
6. Complete sale

## Payment Methods Available

| Code | Name | Requires Reference? |
|------|------|---------------------|
| CASH | Cash | No |
| AR | Accounts Receivable | No (requires customer) |
| GCASH | GCash | Yes |
| BANK_TRANSFER | Bank Transfer | Yes |
| QR_PH | QR PH | Yes |
| CREDIT_CARD | Credit Card | Yes |
| CHECK | Check | Yes |

## Understanding Cash for Deposit

The system automatically calculates **Cash for Deposit** using this formula:

```
Cash for Deposit = Total Cash Sales - Total Cash Expenses
```

This represents the amount of physical cash that should be deposited to the bank at end of day.

## Expense Categories

- **Utilities**: Electricity, water, internet, phone bills
- **Rent**: Store or office rent
- **Supplies**: Office supplies, cleaning materials
- **Maintenance**: Repairs, upkeep
- **Transportation**: Delivery, fuel, vehicle expenses
- **Food & Beverages**: Staff meals, refreshments
- **Salaries**: Employee wages (use with caution - consider payroll system)
- **Advertising**: Marketing, promotions
- **Miscellaneous**: Other uncategorized expenses

## Petty Cash Transaction Types

- **Fund**: Initial funding or adding money to petty cash
- **Advance**: Cash given to employee (tracks employee name)
- **Replenish**: Restocking petty cash after depletion
- **Return**: Employee returning advance or unused cash

## AR Transaction Types

- **Charge**: Customer purchases on credit (increases balance)
- **Payment**: Customer pays down balance (decreases balance)
- **Adjustment**: Manual balance correction (admin only)

## Tips & Best Practices

### For Cashiers

1. **Always get approval before recording large expenses**
2. **Keep reference numbers for all non-cash transactions**
3. **Record expenses as they happen, not at end of day**
4. **Verify customer credit limit before AR sales**
5. **Keep petty cash balanced - don't advance more than available**

### For Managers/Admins

1. **Review and approve expenses daily**
2. **Monitor AR balances weekly**
3. **Reconcile petty cash regularly**
4. **Check daily reports for discrepancies**
5. **Verify cash for deposit matches physical count**

### Shift Management

1. **Start each shift with petty cash fund transaction**
2. **Record all expenses during shift**
3. **Count petty cash at end of shift**
4. **Return excess cash to petty cash fund**
5. **Review daily report after shift closes**

## Troubleshooting

### "Credit limit exceeded" error
- Customer's balance + new charge exceeds their credit limit
- Options: Record payment first, or increase credit limit

### "Insufficient petty cash balance" error
- Not enough cash for the advance
- Options: Record fund/replenish transaction first

### Expense not appearing in Daily Report
- Check expense status - only approved expenses show in reports
- Pending expenses need manager/admin approval

### Payment splits don't add up
- Total of all payment methods must equal sale total exactly
- Check for rounding errors
- Ensure all amounts are entered correctly

### Missing payment method in dropdown
- Payment method might be inactive
- Check `payment_methods` table or contact admin

## API Endpoints Reference

### Quick Reference for Frontend Integration

```typescript
// Customer Accounts
GET    /api/customer-accounts              // List customers
POST   /api/customer-accounts              // Create customer
GET    /api/customer-accounts/:id          // Get customer
PUT    /api/customer-accounts/:id          // Update customer
POST   /api/customer-accounts/transactions // AR transaction

// Expenses
GET    /api/expenses                       // List expenses
POST   /api/expenses                       // Create expense
GET    /api/expenses/:id                   // Get expense
PUT    /api/expenses/:id                   // Update/approve expense
DELETE /api/expenses/:id                   // Delete expense
GET    /api/expenses/meta/categories       // List categories
GET    /api/expenses/reports/summary       // Expense summary

// Petty Cash
GET    /api/petty-cash                     // List transactions
POST   /api/petty-cash                     // Create transaction
GET    /api/petty-cash/balance             // Current balance
GET    /api/petty-cash/:id                 // Get transaction
PUT    /api/petty-cash/:id                 // Update transaction
GET    /api/petty-cash/reports/summary     // Summary report

// Daily Reports
GET    /api/daily-reports/daily            // Daily summary
GET    /api/daily-reports/weekly           // Weekly summary
GET    /api/daily-reports/monthly          // Monthly summary
GET    /api/daily-reports/payment-methods  // Payment methods list
GET    /api/daily-reports/dashboard        // Dashboard data

// Enhanced Sales
POST   /api/sales/enhanced                 // Multi-payment sale
```

## Database Schema Quick Reference

### Key Tables

**payment_splits** - Stores payment breakdown for each sale
```sql
sale_id, payment_method_code, amount, reference_number
```

**customer_accounts** - Customer information and balances
```sql
customer_code, customer_name, current_balance, credit_limit
```

**ar_transactions** - AR transaction history
```sql
customer_account_id, transaction_type, amount, balance_after
```

**expenses** - Expense records
```sql
expense_number, category, amount, payment_method, status
```

**petty_cash** - Petty cash transactions
```sql
transaction_number, transaction_type, amount, balance_after
```

## Next Steps

1. **Test the system**: Create sample customers, expenses, and transactions
2. **Train staff**: Show cashiers how to use new features
3. **Set policies**: Define approval workflow and credit limits
4. **Monitor**: Check daily reports regularly
5. **Optimize**: Implement remaining enhancements as needed

## Support

For issues or questions:
1. Check this guide first
2. Review the main implementation document (`MULTI_PAYMENT_IMPLEMENTATION.md`)
3. Check application logs for error messages
4. Contact system administrator

## Summary

The multi-payment system is now fully integrated into your POS. The features are:
- ✅ Accessible through the navigation menu
- ✅ Role-based access control
- ✅ Automatic calculations and validations
- ✅ Comprehensive reporting
- ✅ Easy to use interface

Start by adding a few test customers and recording some expenses to familiarize yourself with the system!
