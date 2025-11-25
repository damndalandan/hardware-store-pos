-- Enhanced Purchase Orders Schema
-- This migration adds support for:
-- - Payment tracking with split payments
-- - Partial/batch receiving
-- - File attachments
-- - Inventory history logging

-- Purchase Orders table enhancements
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'Net 30',
ADD COLUMN IF NOT EXISTS custom_payment_terms VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_status ENUM('Unpaid', 'Paid this month', 'To be paid next month', 'Partially Paid') DEFAULT 'Unpaid',
ADD COLUMN IF NOT EXISTS receiving_status ENUM('Awaiting', 'Partially Received', 'Received') DEFAULT 'Awaiting';

-- Purchase Order Payments table
CREATE TABLE IF NOT EXISTS po_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  notes TEXT,
  recorded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_payments_po_id (purchase_order_id),
  INDEX idx_po_payments_date (payment_date)
);

-- Purchase Order Receiving Sessions
-- Tracks each receiving session for partial deliveries
CREATE TABLE IF NOT EXISTS po_receiving_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  received_date DATE NOT NULL,
  received_by INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_receiving_po_id (purchase_order_id),
  INDEX idx_po_receiving_date (received_date)
);

-- Purchase Order Receiving Items
-- Tracks quantities received per item per session
CREATE TABLE IF NOT EXISTS po_receiving (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id INT NOT NULL,
  po_item_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_received INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES po_receiving_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_po_receiving_session (session_id),
  INDEX idx_po_receiving_item (po_item_id),
  INDEX idx_po_receiving_product (product_id)
);

-- Purchase Order Attachments
-- Supports file uploads (invoices, receipts, etc.)
CREATE TABLE IF NOT EXISTS po_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_attachments_po_id (purchase_order_id)
);

-- Inventory History table
-- Comprehensive log of all inventory movements
CREATE TABLE IF NOT EXISTS inventory_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  event_type ENUM('received', 'returned', 'adjusted', 'sold', 'transferred') NOT NULL,
  quantity INT NOT NULL,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  supplier_id INT,
  purchase_order_id INT,
  sale_id INT,
  reference_number VARCHAR(100),
  reason VARCHAR(255),
  performed_by INT,
  notes TEXT,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_inv_history_product (product_id),
  INDEX idx_inv_history_event_type (event_type),
  INDEX idx_inv_history_date (date),
  INDEX idx_inv_history_po (purchase_order_id),
  INDEX idx_inv_history_supplier (supplier_id)
);

-- Payment reminders/notifications table
CREATE TABLE IF NOT EXISTS po_payment_reminders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  reminder_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_due DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'sent', 'paid', 'overdue') DEFAULT 'pending',
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  INDEX idx_po_reminders_po_id (purchase_order_id),
  INDEX idx_po_reminders_date (reminder_date),
  INDEX idx_po_reminders_status (status)
);

-- Update existing purchase_orders to set default values
UPDATE purchase_orders
SET payment_status = 'Unpaid'
WHERE payment_status IS NULL;

UPDATE purchase_orders
SET receiving_status = CASE
  WHEN status = 'received' THEN 'Received'
  WHEN status = 'sent' THEN 'Awaiting'
  ELSE 'Awaiting'
END
WHERE receiving_status IS NULL;

-- Create views for reporting

-- View: Unpaid Purchase Orders
CREATE OR REPLACE VIEW vw_unpaid_purchase_orders AS
SELECT 
  po.id,
  po.order_number,
  s.name as supplier_name,
  po.order_date,
  po.total_amount,
  COALESCE(SUM(pp.amount), 0) as amount_paid,
  po.total_amount - COALESCE(SUM(pp.amount), 0) as amount_due,
  po.payment_terms,
  CASE 
    WHEN po.payment_terms = 'Net 30' THEN DATE_ADD(po.order_date, INTERVAL 30 DAY)
    WHEN po.payment_terms = 'Immediate' THEN po.order_date
    ELSE NULL
  END as due_date,
  DATEDIFF(CURRENT_DATE, CASE 
    WHEN po.payment_terms = 'Net 30' THEN DATE_ADD(po.order_date, INTERVAL 30 DAY)
    WHEN po.payment_terms = 'Immediate' THEN po.order_date
    ELSE NULL
  END) as days_overdue
FROM purchase_orders po
JOIN suppliers s ON po.supplier_id = s.id
LEFT JOIN po_payments pp ON po.id = pp.purchase_order_id
WHERE po.payment_status IN ('Unpaid', 'Partially Paid')
GROUP BY po.id
HAVING amount_due > 0
ORDER BY due_date ASC;

-- View: Inventory Movement Summary
CREATE OR REPLACE VIEW vw_inventory_movement_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.sku,
  SUM(CASE WHEN ih.event_type = 'received' THEN ih.quantity ELSE 0 END) as total_received,
  SUM(CASE WHEN ih.event_type = 'returned' THEN ih.quantity ELSE 0 END) as total_returned,
  SUM(CASE WHEN ih.event_type = 'adjusted' THEN ih.quantity ELSE 0 END) as total_adjusted,
  COUNT(DISTINCT ih.id) as event_count,
  MAX(ih.date) as last_movement_date
FROM products p
LEFT JOIN inventory_history ih ON p.id = ih.product_id
GROUP BY p.id;
