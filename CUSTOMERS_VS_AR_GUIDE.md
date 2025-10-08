# Customers vs Accounts Receivable (AR) Separation

## Overview
The system now separates regular **Customers** from **Accounts Receivable (AR) Customers** for better organization and clarity.

## Two Customer Types

### 1. Regular Customers (`customers` table)
**Purpose**: Track ALL customers who have made purchases, regardless of payment method

**Storage**: `customers` table in database

**Characteristics**:
- ✅ Auto-created when name is entered in cart
- ✅ Used for all payment methods (Cash, GCash, Credit Card, etc.)
- ✅ Simple tracking: name, phone, email, total purchases, last purchase date
- ✅ No credit limits or account balances
- ✅ Appears in cart autocomplete

**Endpoint**: `/api/customers`

### 2. AR Customers (`customer_accounts` table)
**Purpose**: Track customers who buy on credit (Accounts Receivable)

**Storage**: `customer_accounts` table in database

**Characteristics**:
- ⚙️ Manually created by admin/manager
- ⚙️ Only used for A/R (Credit) payment method
- ⚙️ Has customer code, credit limits, current balance
- ⚙️ Tracks AR transactions and payments
- ⚙️ Appears only in A/R payment dialog

**Endpoint**: `/api/customer-accounts`

## How It Works

### Cart Flow (Regular Customers)

1. **User enters customer name in cart**
   ```
   Customer Name: John Doe Hardware ← Type here
   ```

2. **System behavior**:
   - Shows autocomplete dropdown with existing customers
   - User can select from list OR type new name
   - When user clicks away (onBlur), system checks:
     - If customer exists → Uses existing record
     - If new name → Auto-creates new customer record

3. **Auto-creation happens silently**:
   ```javascript
   POST /api/customers/find-or-create
   {
     "customerName": "John Doe Hardware"
   }
   
   Response:
   {
     "customer": { id: 123, customer_name: "John Doe Hardware", ... },
     "created": true  // or false if already existed
   }
   ```

4. **Customer name is saved with sale**:
   - Stored in `sales.customer_name` field
   - Customer's `total_purchases` increases
   - Customer's `last_purchase_date` updates

### A/R Payment Flow (AR Customers)

1. **User selects A/R payment method**
   ```
   Payment Method: [A/R (Credit)] ← Click here
   ```

2. **System shows AR customer dropdown**:
   - Only shows customers from `customer_accounts` table
   - These are manually created with credit limits
   - Format: `CUST001 - ABC Hardware (Credit: ₱5,000.00)`

3. **AR transaction is recorded**:
   - Balance increases in `customer_accounts.current_balance`
   - Transaction logged in `ar_transactions` table
   - Credit limit is validated

## Database Schema

### Customers Table (New)
```sql
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  notes TEXT,
  total_purchases DECIMAL(10,2) DEFAULT 0.00,
  last_purchase_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Customer Accounts Table (Existing - for AR only)
```sql
CREATE TABLE customer_accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_code VARCHAR(50) UNIQUE NOT NULL,  -- e.g., CUST001
  customer_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  credit_limit DECIMAL(10,2) DEFAULT 0.00,     -- Max credit allowed
  current_balance DECIMAL(10,2) DEFAULT 0.00,  -- Current AR balance
  is_active TINYINT(1) DEFAULT 1,
  notes TEXT,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## API Endpoints

### Regular Customers

#### GET `/api/customers`
Get all customers for autocomplete
```json
Response:
{
  "customers": [
    {
      "id": 1,
      "customer_name": "John Doe Hardware",
      "phone": "555-1234",
      "total_purchases": 15000.00,
      "last_purchase_date": "2025-10-03T10:30:00Z"
    }
  ],
  "total": 1
}
```

#### POST `/api/customers/find-or-create`
Find existing customer or create new one
```json
Request:
{
  "customerName": "New Customer Inc",
  "phone": "555-5678",  // optional
  "email": "customer@example.com"  // optional
}

Response:
{
  "customer": {
    "id": 2,
    "customer_name": "New Customer Inc",
    "phone": "555-5678",
    "total_purchases": 0.00,
    "last_purchase_date": "2025-10-04T08:00:00Z"
  },
  "created": true  // true if new, false if existing
}
```

#### GET `/api/customers/search?q=john`
Search customers by name or phone
```json
Response:
{
  "customers": [
    { "id": 1, "customer_name": "John Doe Hardware", ... }
  ]
}
```

### AR Customers (Unchanged)

#### GET `/api/customer-accounts`
Get all AR customer accounts (with credit limits, balances)

#### POST `/api/customer-accounts`
Create new AR customer account (admin only)

## User Interface

### Cart - Customer Name Input
```
┌─────────────────────────────────────────────┐
│ Customer Name (Optional)                    │
│ ┌─────────────────────────────────────────┐ │
│ │ John Doe                                │ │ ← Type here
│ └─────────────────────────────────────────┘ │
│                                             │
│ Suggestions:                                │
│ • John Doe Hardware (Last: Oct 1)          │ ← Existing customer
│ • John's Tools (Last: Sep 28)              │
└─────────────────────────────────────────────┘

When you click away:
  • If "John Doe" exists → Use existing
  • If new → Auto-create customer record
```

### Payment Dialog - A/R Selection
```
┌─────────────────────────────────────────────┐
│ Payment Method                              │
│ [ Cash ] [A/R (Credit)] [ GCash ] ...      │ ← Click A/R
└─────────────────────────────────────────────┘

When A/R is selected:
┌─────────────────────────────────────────────┐
│ Select Customer                             │
│ ┌─────────────────────────────────────────┐ │
│ │ CUST001 - ABC Hardware (Credit: ₱5,000)│ │ ← Only AR customers
│ └─────────────────────────────────────────┘ │
│                                             │
│ CUST001 - ABC Hardware (Credit: ₱5,000.00) │
│ CUST002 - XYZ Store (Credit: ₱3,500.00)    │
└─────────────────────────────────────────────┘
```

## Benefits

### 1. **Simplified Customer Entry**
- No need to create customer accounts for cash sales
- Just type the name and continue
- Customer history builds automatically

### 2. **Clear AR Management**
- AR customers are separate and controlled
- Only admin can create AR accounts with credit limits
- No confusion between regular and AR customers

### 3. **Better Analytics**
- Track all customers' purchase history
- Identify frequent customers
- Target marketing to repeat customers

### 4. **Security**
- Regular cashiers can't create AR accounts
- Credit limits controlled by management
- AR transactions require special customer selection

## Migration Notes

**For existing installations**:
1. The `customers` table is created automatically on server start
2. Existing sales with `customer_name` will continue to work
3. No data migration needed - new customers are created going forward
4. `customer_accounts` table remains unchanged

## Example Scenarios

### Scenario 1: Walk-in Cash Customer
```
1. Cart: Type "Maria Santos" → Autocomplete shows no match
2. Cart: Click Checkout (name auto-saved)
3. System: Creates customer record for "Maria Santos"
4. Payment: Cash ₱500 → Complete
5. Result: Sale saved with customer name, customer record created
```

### Scenario 2: Repeat Customer
```
1. Cart: Type "Maria" → Autocomplete shows "Maria Santos (Last: Oct 1)"
2. Cart: Select from dropdown → Name filled
3. Payment: Cash ₱800 → Complete
4. Result: Maria's total_purchases increases, last_purchase_date updates
```

### Scenario 3: AR Customer
```
1. Cart: Type "ABC Hardware Corp" (optional, can be blank)
2. Payment: Click [A/R (Credit)]
3. Dialog: Shows dropdown with only AR customers
4. Dialog: Select "CUST001 - ABC Hardware (Credit: ₱5,000)"
5. Dialog: Enter amount ₱1,500
6. Dialog: Complete Sale
7. Result: 
   - AR balance increases to ₱1,500
   - Transaction logged in ar_transactions
   - Sale saved with customer name from AR account
```

## Key Differences Summary

| Feature | Regular Customers | AR Customers |
|---------|------------------|--------------|
| **Table** | `customers` | `customer_accounts` |
| **Creation** | Auto-created on first purchase | Manually created by admin |
| **Usage** | All payment methods | A/R payment method only |
| **Tracking** | Total purchases, last date | Balance, credit limit, transactions |
| **Code** | No code | Customer code (e.g., CUST001) |
| **Credit** | No credit | Credit limits enforced |
| **Access** | Cart autocomplete | A/R payment dialog only |
| **Endpoint** | `/api/customers` | `/api/customer-accounts` |
