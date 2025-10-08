# Customer Sales Tracking - Complete Implementation

## Overview

This system now automatically tracks ALL customer purchases (not just A/R transactions) to maintain a comprehensive sales history for every customer. Every sale is linked to a customer record, allowing you to:

- View complete purchase history for any customer
- Track total purchase amounts per customer
- See when customers last made a purchase
- Identify your most valuable customers
- Analyze customer buying patterns

## Key Features

### 1. **Automatic Customer Creation**
When a customer name is entered in the POS cart:
- System checks if customer exists (case-insensitive match)
- If found: Links sale to existing customer
- If not found: Creates new customer record automatically
- All happens silently in the background during checkout

### 2. **Comprehensive Purchase Tracking**
For every customer, the system tracks:
- **Total Purchases**: Cumulative dollar amount of all purchases
- **Last Purchase Date**: When they last made a purchase
- **Purchase History**: Complete list of all sales with details
- **Sales Count**: Number of transactions

### 3. **Separation from A/R Accounts**
- **Regular Customers**: Auto-created, simple tracking (all payment methods)
- **A/R Customers**: Manual creation, credit limits, balance tracking
- Both can exist independently or overlap

## Database Structure

### `customers` Table
```sql
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  notes TEXT,
  total_purchases DECIMAL(10,2) DEFAULT 0.00,  -- Auto-updated on each sale
  last_purchase_date DATETIME,                  -- Auto-updated on each sale
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_name (customer_name),
  INDEX idx_phone (phone),
  INDEX idx_last_purchase (last_purchase_date)
);
```

### `sales` Table (Updated)
```sql
CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT,                               -- NEW: Links to customers table
  customer_name VARCHAR(100),                    -- Kept for backward compatibility
  customer_email VARCHAR(100),
  customer_phone VARCHAR(20),
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'completed',
  cashier_id INT NOT NULL,
  sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_offline_sale TINYINT(1) DEFAULT 0,
  sync_status VARCHAR(20) DEFAULT 'synced',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cashier_id) REFERENCES users (id),
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  INDEX idx_customer_id (customer_id),
  INDEX idx_sale_date (sale_date)
);
```

## API Endpoints

### Get All Customers
```http
GET /api/customers
Authorization: Bearer <token>
```

**Query Parameters:**
- `search` (optional): Search by name, phone, or email

**Response:**
```json
{
  "customers": [
    {
      "id": 1,
      "customer_name": "John Doe",
      "phone": "555-1234",
      "email": "john@example.com",
      "total_purchases": 1250.50,
      "last_purchase_date": "2025-10-03T10:30:00Z"
    }
  ]
}
```

### Find or Create Customer
```http
POST /api/customers/find-or-create
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerName": "Jane Smith",
  "phone": "555-5678",
  "email": "jane@example.com"
}
```

**Response:**
```json
{
  "customer": {
    "id": 2,
    "customer_name": "Jane Smith",
    "phone": "555-5678",
    "email": "jane@example.com",
    "total_purchases": 0,
    "last_purchase_date": null
  },
  "created": true
}
```

### Get Customer Purchase History
```http
GET /api/customers/:id/history
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Response:**
```json
{
  "customer": {
    "id": 1,
    "customer_name": "John Doe",
    "phone": "555-1234",
    "email": "john@example.com",
    "total_purchases": 1250.50,
    "last_purchase_date": "2025-10-03T10:30:00Z"
  },
  "sales": [
    {
      "id": 45,
      "sale_number": "SALE-1727956800000-1234",
      "sale_date": "2025-10-03T10:30:00Z",
      "total_amount": 125.50,
      "payment_method": "CASH",
      "cashier_username": "cashier1",
      "item_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  }
}
```

### Get Customer Sale Details
```http
GET /api/customers/:customerId/sales/:saleId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 45,
  "sale_number": "SALE-1727956800000-1234",
  "customer_id": 1,
  "customer_name": "John Doe",
  "sale_date": "2025-10-03T10:30:00Z",
  "total_amount": 125.50,
  "payment_method": "CASH",
  "cashier_username": "cashier1",
  "items": [
    {
      "id": 120,
      "product_name": "Hammer",
      "sku": "HAM-001",
      "brand": "Stanley",
      "quantity": 2,
      "unit_price": 25.00,
      "total_price": 50.00
    }
  ]
}
```

## How It Works

### Sale Flow with Customer Tracking

```
┌─────────────────────────────────────────────────────────────┐
│  1. Cashier enters customer name in POS cart                │
│     (e.g., "Maria Santos")                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Customer types/selects name from autocomplete            │
│     - Dropdown shows existing customers                      │
│     - Can type new name if not in list                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. OnBlur event triggers find-or-create                     │
│     POST /api/customers/find-or-create                       │
│     - Checks if "Maria Santos" exists (case-insensitive)     │
│     - If yes: Returns existing customer                      │
│     - If no: Creates new customer record                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Cashier completes sale (add items, checkout)             │
│     - Proceeds with normal POS flow                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. During sale processing:                                  │
│     a) Find/create customer by name (case-insensitive)       │
│     b) Create sale record with customer_id link              │
│     c) Add sale items                                        │
│     d) Update customer purchase statistics:                  │
│        - total_purchases += sale amount                      │
│        - last_purchase_date = NOW()                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Sale completed - customer tracked!                       │
│     - Receipt shows customer name                            │
│     - Customer purchase history updated                      │
│     - Can now view all Maria's purchases in system           │
└─────────────────────────────────────────────────────────────┘
```

### Backend Processing

**In Enhanced Sales Service** (`enhancedSalesService.ts`):
```typescript
// 1. Find or create customer
let customerId: number | null = null;
if (customerName && customerName.trim()) {
  // Check if customer exists (case-insensitive)
  const [existingCustomers] = await connection.execute(
    'SELECT id FROM customers WHERE LOWER(customer_name) = LOWER(?)',
    [customerName.trim()]
  );

  if (existingCustomers.length > 0) {
    customerId = existingCustomers[0].id;
  } else {
    // Create new customer
    const [customerResult] = await connection.execute(`
      INSERT INTO customers (customer_name, phone, email, total_purchases, last_purchase_date)
      VALUES (?, ?, ?, 0, NOW())
    `, [customerName.trim(), customerPhone || null, customerEmail || null]);
    customerId = customerResult.insertId;
  }
}

// 2. Create sale with customer link
await connection.execute(`
  INSERT INTO sales (
    sale_number, customer_id, customer_name, customer_email, customer_phone,
    subtotal, tax_amount, discount_amount, total_amount,
    payment_method, payment_status, cashier_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
`, [saleNumber, customerId, customerName, ...]);

// 3. Update customer purchase statistics
if (customerId) {
  await connection.execute(`
    UPDATE customers 
    SET total_purchases = total_purchases + ?,
        last_purchase_date = NOW()
    WHERE id = ?
  `, [totalAmount, customerId]);
}
```

## Migration

### Automatic Migration on Server Start

When you restart the backend server, it will automatically:

1. **Check** if `customer_id` column exists in `sales` table
2. **Add** column if missing (with indexes and foreign key)
3. **Link** existing sales to customers based on matching names
4. **Update** customer purchase statistics from historical data

**Migration File**: `backend/src/database/migrations/addCustomerIdToSales.ts`

### Manual Migration

Run the migration script manually:
```bash
cd backend
npm run migrate
```

## Benefits

### 1. Customer Insights
- Identify top customers by total purchases
- Track customer loyalty (last purchase date)
- Analyze customer buying frequency

### 2. Marketing & Sales
- Target inactive customers (haven't purchased recently)
- Reward high-value customers
- Personalized promotions based on purchase history

### 3. Customer Service
- Quick lookup of customer purchase history
- Verify previous purchases
- Handle returns/exchanges more efficiently
- Better customer relationship management

### 4. Business Analytics
- Customer lifetime value (CLV) tracking
- Repeat customer rate
- Average purchase value per customer
- Customer segmentation for analysis

## Example Use Cases

### Use Case 1: Walk-in Customer (First Time)
```
Customer: "Jose Reyes"
Status: New customer

Flow:
1. Cashier types "Jose Reyes" in cart
2. OnBlur triggers auto-creation
3. New customer created silently
4. Sale processed with customer link
5. Jose's purchase history now starts tracking
```

### Use Case 2: Returning Customer
```
Customer: "Maria Santos" (purchased before)
Status: Existing customer

Flow:
1. Cashier starts typing "Maria"
2. Autocomplete shows "Maria Santos"
3. Cashier selects from dropdown
4. Sale linked to existing customer record
5. Maria's total_purchases updated
6. Maria's last_purchase_date updated
```

### Use Case 3: View Customer History
```
Customer requests purchase history

Flow:
1. Search for "Maria Santos" in Customers page
2. Click to view customer details
3. See complete purchase history:
   - All sales with dates and amounts
   - Total lifetime purchases
   - Last purchase date
   - Can drill down into individual sales
```

### Use Case 4: A/R Customer Who Also Pays Cash
```
Customer: "ABC Hardware Supply"
Status: Has A/R account + regular customer record

Flow:
1. Cash purchase: Links to regular customer record
2. A/R purchase: Links to customer_accounts + customer record
3. Can see ALL purchases (cash + A/R) in customer history
4. A/R balance tracked separately in customer_accounts
```

## Differences: Regular Customers vs A/R Customers

| Feature | Regular Customers | A/R Customers |
|---------|------------------|---------------|
| **Creation** | Auto-created on first purchase | Manually created by admin |
| **Purpose** | Track all purchases | Credit/payment terms |
| **Table** | `customers` | `customer_accounts` |
| **Tracking** | Total purchases, last purchase | Current balance, credit limit |
| **Payment** | All methods (cash, card, etc.) | A/R (Credit) payment only |
| **Use in Cart** | Autocomplete for name entry | Not used in cart |
| **Use in Payment** | Display only | A/R payment method selection |
| **Endpoint** | `/api/customers` | `/api/customer-accounts` |

## Configuration

No configuration needed! The system works automatically once the migration is complete.

### Optional: Disable Auto-Creation

If you want to manually manage customers instead of auto-creation, you can:

1. Remove the `onBlur` handler in `CashierPOS.tsx`
2. Keep the find-or-create endpoint for manual customer creation
3. Add a button to manually create customers before sale

## Testing Checklist

- [x] TypeScript compilation (backend & frontend) - PASS
- [ ] Database migration runs successfully
- [ ] New customer auto-created on first purchase
- [ ] Existing customer linked on repeat purchase
- [ ] Customer purchase statistics update correctly
- [ ] Customer history API returns correct data
- [ ] Sale details show customer link
- [ ] A/R customers still work separately
- [ ] Autocomplete shows all customers
- [ ] Search customers by name/phone works

## Troubleshooting

### Issue: Migration fails with "customer_id column already exists"
**Solution**: Migration is designed to check and skip if already exists. Safe to ignore.

### Issue: Customers not linking to sales
**Solution**: 
1. Check that `customers` table exists
2. Verify migration ran successfully
3. Check server logs for customer creation errors
4. Ensure customer name is not empty when processing sale

### Issue: Customer statistics not updating
**Solution**:
1. Check that `customer_id` is being set in sales
2. Verify the update query runs after sale insert
3. Check logs for update errors (non-fatal, logged as warnings)

### Issue: Duplicate customers created
**Solution**:
- Uses case-insensitive LOWER() matching to prevent duplicates
- If duplicates exist, they have slightly different spellings
- Can be merged manually in database if needed

## Future Enhancements

1. **Customer Dashboard Page**
   - View all customers with stats
   - Sort by total purchases, last purchase
   - Export customer data

2. **Customer Loyalty Program**
   - Points based on purchases
   - Rewards for repeat customers
   - Tiered customer levels

3. **Customer Communications**
   - SMS/Email for promotions
   - Birthday greetings
   - Re-engagement campaigns

4. **Advanced Analytics**
   - Customer segmentation (RFM analysis)
   - Purchase pattern recognition
   - Predictive analytics for customer churn

5. **Customer Merge Tool**
   - Detect potential duplicate customers
   - Merge customer records
   - Combine purchase histories

## Summary

✅ **Automatic customer tracking** on all sales  
✅ **Purchase history** maintained per customer  
✅ **Statistics auto-update** (total purchases, last purchase date)  
✅ **Case-insensitive matching** prevents duplicates  
✅ **Backward compatible** with existing sales  
✅ **Separate from A/R** for clear distinction  
✅ **Full API support** for customer history  
✅ **Auto-migration** on server start  

Your POS system now provides comprehensive customer tracking without any manual intervention required!
