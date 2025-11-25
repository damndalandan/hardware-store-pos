# Enhanced Supplier & Purchase Order Management

This document outlines the new comprehensive supplier and purchase order management system with advanced features for tracking payments, partial receiving, inventory history, and attachments.

## 📋 Overview

The enhanced system provides a complete solution for managing suppliers and purchase orders with the following key capabilities:

- **Two-Pane Layout**: Suppliers list on the left, purchase orders on the right
- **Payment Tracking**: Split payments, scheduled payments, overdue tracking
- **Partial Receiving**: Track deliveries as they arrive with session-based receiving
- **Inventory History**: Complete audit trail of all inventory movements
- **File Attachments**: Upload invoices, receipts, and supporting documents
- **Payment Reminders**: Notifications for upcoming and overdue payments

## 🎨 New Components

### 1. SuppliersNew.tsx
**Location**: `frontend/src/pages/SuppliersNew.tsx`

**Features**:
- Left panel with searchable supplier list
- Right panel showing purchase orders for selected supplier
- Tabs for Purchase Orders and Inventory History
- Real-time filtering by payment and receiving status
- Badge indicators for pending orders
- Quick actions for adding suppliers and creating POs

**Key UI Elements**:
- Supplier search with real-time filtering
- Status filters (Active/Inactive)
- Purchase order filters (Payment Status, Receiving Status)
- Detailed PO view with expandable sections

### 2. PurchaseOrdersNew.tsx
**Location**: `frontend/src/pages/PurchaseOrdersNew.tsx`

**Features**:
- Create purchase orders with custom payment terms
- Add multiple items with real-time total calculation
- Set expected delivery dates
- Choose payment terms: Immediate, Net 30, or Custom
- Partial receiving dialog for batch deliveries
- Payment recording with multiple payment support
- File attachment support

**Payment Terms**:
- **Immediate**: Payment due on order date
- **Net 30**: Payment due 30 days after order date
- **Custom**: User-defined payment terms

**Payment Status**:
- **Unpaid**: No payments recorded
- **Paid this month**: Fully paid within current month
- **To be paid next month**: Scheduled for future payment
- **Partially Paid**: Some payments made, balance remaining

**Receiving Status**:
- **Awaiting**: No items received yet
- **Partially Received**: Some items received
- **Received**: All items received

### 3. InventoryHistory.tsx
**Location**: `frontend/src/pages/InventoryHistory.tsx`

**Features**:
- Complete audit trail of inventory movements
- Filterable by event type, supplier, date range
- Searchable by product name or SKU
- Event types: Received, Returned, Adjusted
- Linked to purchase orders and suppliers
- Export to CSV functionality
- Detailed event view with full context

**Event Types**:
- **Received**: Items added to inventory from PO
- **Returned**: Items returned to supplier
- **Adjusted**: Manual stock adjustments

## 🔧 Backend Enhancements

### Enhanced Routes
**Location**: `backend/src/routes/purchaseOrdersEnhanced.ts`

**New Endpoints**:

#### Get Purchase Orders
```
GET /api/purchase-orders?supplier_id=1&status=open&payment_status=unpaid
```
- Filter by supplier, status, payment status, receiving status
- Returns aggregated order data with item summaries

#### Get PO Details
```
GET /api/purchase-orders/:id/details
```
- Returns complete PO information including:
  - Order header and supplier details
  - All line items with received quantities
  - Payment history
  - Receiving history with session details
  - File attachments

#### Create Purchase Order
```
POST /api/purchase-orders
```
Body:
```json
{
  "supplier_id": 1,
  "order_date": "2025-01-15",
  "expected_delivery_date": "2025-02-15",
  "payment_terms": "Net 30",
  "custom_payment_terms": null,
  "notes": "Urgent order",
  "items": [
    {
      "product_id": 10,
      "quantity": 50,
      "unit_price": 25.00
    }
  ]
}
```

#### Receive Items (Partial Receiving)
```
POST /api/purchase-orders/:id/receive
```
Body:
```json
{
  "received_date": "2025-02-01",
  "notes": "First batch received",
  "items": [
    {
      "product_id": 10,
      "quantity_received": 25
    }
  ]
}
```
- Creates a receiving session
- Updates inventory
- Logs inventory history
- Updates receiving status automatically

#### Add Payment
```
POST /api/purchase-orders/:id/payments
```
Body:
```json
{
  "payment_date": "2025-02-15",
  "amount": 500.00,
  "payment_method": "Bank Transfer",
  "notes": "First installment"
}
```
- Records payment
- Updates payment status automatically
- Supports split payments

#### Upload Attachment
```
POST /api/purchase-orders/:id/attachments
```
- Multipart form data with file upload
- Stores file with metadata
- Returns file reference

#### Get Inventory History
```
GET /api/inventory/history?event_type=received&supplier_id=1&date_from=2025-01-01
```
- Paginated results
- Filterable by event type, supplier, date range
- Searchable by product name/SKU

## 🗄️ Database Schema

### New Tables

#### po_payments
Tracks all payments for purchase orders:
```sql
CREATE TABLE po_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  notes TEXT,
  recorded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
);
```

#### po_receiving_sessions
Groups receiving events:
```sql
CREATE TABLE po_receiving_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  received_date DATE NOT NULL,
  received_by INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
);
```

#### po_receiving
Details of items received per session:
```sql
CREATE TABLE po_receiving (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id INT NOT NULL,
  po_item_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_received INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES po_receiving_sessions(id)
);
```

#### po_attachments
File uploads for purchase orders:
```sql
CREATE TABLE po_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
);
```

#### inventory_history
Complete audit trail:
```sql
CREATE TABLE inventory_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  event_type ENUM('received', 'returned', 'adjusted') NOT NULL,
  quantity INT NOT NULL,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  supplier_id INT,
  purchase_order_id INT,
  reference_number VARCHAR(100),
  reason VARCHAR(255),
  performed_by INT,
  notes TEXT,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

#### po_payment_reminders
Automated payment reminders:
```sql
CREATE TABLE po_payment_reminders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  reminder_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_due DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'sent', 'paid', 'overdue') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
);
```

### Enhanced Columns

Added to `purchase_orders` table:
- `expected_delivery_date DATE`
- `payment_terms VARCHAR(50)` - 'Immediate', 'Net 30', 'Custom'
- `custom_payment_terms VARCHAR(255)`
- `payment_status ENUM` - Payment tracking status
- `receiving_status ENUM` - Receiving tracking status

## 📊 Reporting Views

### vw_unpaid_purchase_orders
Shows all unpaid/partially paid orders with due dates:
```sql
SELECT * FROM vw_unpaid_purchase_orders
WHERE days_overdue > 0;
```

### vw_inventory_movement_summary
Aggregates inventory movements by product:
```sql
SELECT * FROM vw_inventory_movement_summary
WHERE total_received > 100;
```

## 🚀 Usage Examples

### Creating a Purchase Order
1. Navigate to Suppliers page
2. Select a supplier from the left panel
3. Click "New Purchase Order" button
4. Fill in order details:
   - Order date
   - Expected delivery date
   - Payment terms
   - Notes (optional)
5. Add items:
   - Select product
   - Enter quantity
   - Verify unit price
   - Click "Add Item"
6. Upload invoice/receipt (optional)
7. Click "Create Purchase Order"

### Receiving Items (Partial Delivery)
1. Find the purchase order
2. Click the "Receive Items" icon
3. Enter quantities received for each item
4. Add receiving notes
5. Click "Confirm Receipt"
6. Inventory is automatically updated
7. Receiving status updates to "Partially Received" or "Received"

### Recording Payments
1. Find the purchase order
2. Click the "Add Payment" icon
3. Enter payment details:
   - Payment date
   - Amount
   - Payment method
   - Notes
4. Click "Record Payment"
5. Payment status updates automatically

### Viewing Inventory History
1. Navigate to Inventory History page
2. Use filters to narrow results:
   - Event type (Received, Returned, Adjusted)
   - Date range
   - Supplier
   - Product search
3. Click on any event to view full details
4. Export to CSV for reporting

## 🔒 Security & Permissions

All purchase order and inventory operations require:
- Authentication via JWT token
- Role-based access control (Admin or Manager)
- User activity logging
- Audit trail in database

## 📁 File Upload Configuration

Configure file upload directory:
```javascript
// backend configuration
const uploadDir = 'uploads/purchase-orders/';
// Ensure directory exists and has proper permissions
```

Supported file types:
- PDF documents
- Images (JPG, PNG)
- Excel/CSV files
- Text documents

## 🔔 Payment Reminders (Future Enhancement)

The system includes a table for payment reminders that can be used to:
- Send notifications for upcoming payments
- Alert on overdue payments
- Schedule payment due dates
- Track reminder status

## 🎯 Best Practices

1. **Always record partial deliveries** - Track each shipment separately for better visibility
2. **Attach invoices immediately** - Upload documents when creating or receiving orders
3. **Use payment notes** - Document check numbers, wire transfer IDs, etc.
4. **Review inventory history** - Regular audits help catch discrepancies
5. **Set realistic delivery dates** - Helps with inventory planning
6. **Use consistent payment terms** - Makes financial tracking easier

## 🐛 Troubleshooting

### PO not showing in supplier view
- Check supplier_id relationship
- Verify order is not deleted
- Check status filters

### Inventory not updating after receiving
- Verify receiving session completed
- Check product_id mapping
- Review inventory_history for events

### Payment status not updating
- Verify total payments vs PO amount
- Check payment records in po_payments
- Ensure no orphaned payment records

## 📈 Migration Guide

To migrate from old system:

1. **Backup database**
```bash
mysqldump -u root -p pos_system > backup.sql
```

2. **Run migration script**
```bash
mysql -u root -p pos_system < backend/src/database/migrations/enhanced-purchase-orders.sql
```

3. **Update routes in backend**
```typescript
// In backend/src/index.ts
import purchaseOrdersEnhanced from './routes/purchaseOrdersEnhanced';
app.use('/api', purchaseOrdersEnhanced);
```

4. **Update frontend imports**
```typescript
// Replace old components
import SuppliersNew from './pages/SuppliersNew';
import PurchaseOrdersNew from './pages/PurchaseOrdersNew';
import InventoryHistory from './pages/InventoryHistory';
```

## 📚 Additional Resources

- [Material-UI Documentation](https://mui.com/)
- [React TypeScript Guide](https://react-typescript-cheatsheet.netlify.app/)
- [Express.js Documentation](https://expressjs.com/)
- [MySQL Documentation](https://dev.mysql.com/doc/)

## 🤝 Contributing

When adding new features:
1. Update database schema in migrations/
2. Add backend routes with proper authentication
3. Create TypeScript interfaces for data structures
4. Implement frontend components with Material-UI
5. Add logging for important operations
6. Update this documentation

## 📝 Changelog

### Version 2.0 (2025-01-15)
- Added two-pane supplier/PO layout
- Implemented partial receiving with sessions
- Added payment tracking with split payments
- Created inventory history audit trail
- Added file attachment support
- Implemented payment reminders structure
- Enhanced backend routes with new endpoints
- Created database views for reporting
