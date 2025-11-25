# Quick Integration Guide

## Steps to integrate the new Supplier & Purchase Order system

### 1. Database Migration

Run the SQL migration to add new tables:

```bash
# Connect to your database
mysql -u root -p pos_system

# Run the migration
source backend/src/database/migrations/enhanced-purchase-orders.sql
```

Or copy the contents and run in your MySQL client.

### 2. Backend Setup

#### Create uploads directory:
```bash
mkdir -p backend/uploads/purchase-orders
chmod 755 backend/uploads/purchase-orders
```

#### Install multer for file uploads (if not already installed):
```bash
cd backend
npm install multer
npm install @types/multer --save-dev
```

#### Update backend/src/index.ts:
```typescript
// Add the new route
import purchaseOrdersEnhanced from './routes/purchaseOrdersEnhanced';

// Register the route (add this line)
app.use('/api', purchaseOrdersEnhanced);
```

### 3. Frontend Setup

#### Update App.tsx routing:

```typescript
// Add imports at the top
import SuppliersNew from './pages/SuppliersNew';
import PurchaseOrdersNew from './pages/PurchaseOrdersNew';
import InventoryHistory from './pages/InventoryHistory';

// Update routes (replace old Suppliers and PurchaseOrders routes)
<Route path="/suppliers" element={<SuppliersNew />} />
<Route path="/purchase-orders" element={<PurchaseOrdersNew />} />
<Route path="/inventory-history" element={<InventoryHistory />} />
```

#### Update Layout.tsx navigation (if needed):

```typescript
// Add inventory history to menu
{
  text: 'Inventory History',
  icon: <HistoryIcon />,
  path: '/inventory-history',
  roles: ['admin', 'manager']
}
```

### 4. Test the Integration

#### Test Database:
```sql
-- Verify tables were created
SHOW TABLES LIKE 'po_%';
SHOW TABLES LIKE 'inventory_history';

-- Check purchase_orders columns
DESCRIBE purchase_orders;
```

#### Test Backend:
```bash
# Start backend
cd backend
npm run dev

# Test endpoint (in another terminal)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/purchase-orders
```

#### Test Frontend:
```bash
# Start frontend
cd frontend
npm run dev

# Open browser to http://localhost:5173
# Navigate to Suppliers page
```

### 5. Optional: Keep Old Pages

If you want to keep old pages while testing:

```typescript
// In App.tsx
<Route path="/suppliers-old" element={<Suppliers />} />
<Route path="/suppliers" element={<SuppliersNew />} />
<Route path="/purchase-orders-old" element={<PurchaseOrders />} />
<Route path="/purchase-orders" element={<PurchaseOrdersNew />} />
```

### 6. Sample Data (Optional)

Insert some test data:

```sql
-- Create a test receiving session
INSERT INTO po_receiving_sessions (purchase_order_id, received_date, received_by, notes)
VALUES (1, CURDATE(), 1, 'Test receiving session');

-- Create a test payment
INSERT INTO po_payments (purchase_order_id, payment_date, amount, payment_method, recorded_by)
VALUES (1, CURDATE(), 500.00, 'Cash', 1);

-- Create test inventory history
INSERT INTO inventory_history (product_id, event_type, quantity, previous_quantity, new_quantity, performed_by, notes)
VALUES (1, 'received', 10, 0, 10, 1, 'Initial stock');
```

### 7. Environment Variables

Ensure your .env files are configured:

**backend/.env:**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pos_system
JWT_SECRET=your_secret_key
PORT=5000
```

**frontend/.env:**
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### 8. Common Issues & Solutions

#### Issue: "Cannot find module 'multer'"
```bash
cd backend
npm install multer @types/multer
```

#### Issue: "Table doesn't exist"
- Verify migration ran successfully
- Check database name
- Verify user has CREATE TABLE permissions

#### Issue: "File upload fails"
- Check uploads directory exists
- Verify directory permissions: `chmod 755 uploads/purchase-orders`
- Check disk space

#### Issue: "401 Unauthorized"
- Verify JWT token is valid
- Check user role (admin or manager required)
- Ensure authenticateToken middleware is working

### 9. Verification Checklist

- [ ] Database migration completed successfully
- [ ] New tables exist (po_payments, po_receiving_sessions, etc.)
- [ ] Backend starts without errors
- [ ] Backend endpoints respond (test with curl/Postman)
- [ ] Frontend starts without errors
- [ ] Suppliers page loads and displays data
- [ ] Can create a purchase order
- [ ] Can receive items
- [ ] Can record payments
- [ ] Can upload attachments
- [ ] Inventory history displays correctly

### 10. Production Deployment

Before deploying to production:

1. **Backup database**:
```bash
mysqldump -u root -p pos_system > backup_before_migration_$(date +%Y%m%d).sql
```

2. **Test in staging environment first**

3. **Run migration during low-traffic period**

4. **Monitor logs after deployment**:
```bash
# Backend logs
tail -f backend/logs/error.log

# Check for migration errors
grep -i error backend/logs/*.log
```

5. **Verify all features work in production**

6. **Keep backup for at least 30 days**

### 11. Rollback Plan (if needed)

If something goes wrong:

```sql
-- Drop new tables
DROP TABLE IF EXISTS po_payment_reminders;
DROP TABLE IF EXISTS inventory_history;
DROP TABLE IF EXISTS po_attachments;
DROP TABLE IF EXISTS po_receiving;
DROP TABLE IF EXISTS po_receiving_sessions;
DROP TABLE IF EXISTS po_payments;

-- Restore columns
ALTER TABLE purchase_orders
DROP COLUMN expected_delivery_date,
DROP COLUMN payment_terms,
DROP COLUMN custom_payment_terms,
DROP COLUMN payment_status,
DROP COLUMN receiving_status;

-- Restore from backup if needed
mysql -u root -p pos_system < backup_before_migration_20250115.sql
```

### 12. Support

For issues or questions:
- Check the main documentation: SUPPLIER_PURCHASE_ORDER_GUIDE.md
- Review error logs in backend/logs/
- Check browser console for frontend errors
- Verify API responses with browser DevTools Network tab

---

## Quick Commands Reference

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev

# Database
mysql -u root -p pos_system < backend/src/database/migrations/enhanced-purchase-orders.sql

# Test API
curl -X GET http://localhost:5000/api/purchase-orders \
  -H "Authorization: Bearer YOUR_TOKEN"

# View logs
tail -f backend/logs/combined.log
```

## Success Indicators

You'll know everything is working when:
- ✅ Suppliers page shows two-pane layout
- ✅ Clicking a supplier shows their purchase orders
- ✅ Can filter POs by payment and receiving status
- ✅ Can create new POs with custom payment terms
- ✅ Can receive items with partial quantities
- ✅ Can record split payments
- ✅ Can upload and view attachments
- ✅ Inventory History page shows all events
- ✅ No console errors in browser or backend logs
