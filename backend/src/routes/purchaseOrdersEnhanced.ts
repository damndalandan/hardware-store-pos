import express from 'express';
import { getPool } from '../database/connection';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/purchase-orders/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Role-based access control
const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: express.Response, next: Function) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
};

// Get purchase orders with filters
router.get('/purchase-orders', authenticateToken, requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  const { supplier_id, status, payment_status, receiving_status } = req.query;
  
  let query = `
    SELECT 
      po.id,
      po.order_number,
      po.supplier_id,
      s.name as supplier_name,
      po.order_date,
      po.expected_delivery_date,
      po.payment_terms,
      po.custom_payment_terms,
      po.status,
      po.payment_status,
      po.receiving_status,
      po.total_amount,
      po.notes,
      po.created_by,
      u.username as created_by_username,
      COUNT(DISTINCT poi.id) as item_count,
      GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as items_summary
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    LEFT JOIN products p ON poi.product_id = p.id
    LEFT JOIN users u ON po.created_by = u.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (supplier_id) {
    query += ' AND po.supplier_id = ?';
    params.push(supplier_id);
  }
  
  if (status && status !== 'all') {
    query += ' AND po.status = ?';
    params.push(status);
  }
  
  if (payment_status && payment_status !== 'all') {
    query += ' AND po.payment_status = ?';
    params.push(payment_status);
  }
  
  if (receiving_status && receiving_status !== 'all') {
    query += ' AND po.receiving_status = ?';
    params.push(receiving_status);
  }
  
  query += ' GROUP BY po.id ORDER BY po.order_date DESC';
  
  const [rows] = await pool.execute(query, params);
  
  res.json({ orders: rows });
}));

// Get purchase order details
router.get('/purchase-orders/:id/details', authenticateToken, requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  const { id } = req.params;
  
  // Get PO header
  const [poRows] = await pool.execute(`
    SELECT 
      po.*,
      s.name as supplier_name,
      s.contact_person,
      s.email,
      s.phone,
      u.username as created_by_username
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.created_by = u.id
    WHERE po.id = ?
  `, [id]);
  
  if ((poRows as any[]).length === 0) {
    res.status(404).json({ message: 'Purchase order not found' });
    return;
  }
  
  const po = (poRows as any[])[0];
  
  // Get PO items with received quantities
  const [itemRows] = await pool.execute(`
    SELECT 
      poi.id,
      poi.product_id,
      p.name as product_name,
      p.sku,
      poi.quantity,
      COALESCE(SUM(por.quantity_received), 0) as received_quantity,
      poi.unit_price,
      poi.total as total
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    LEFT JOIN po_receiving por ON poi.id = por.po_item_id
    WHERE poi.purchase_order_id = ?
    GROUP BY poi.id
  `, [id]);
  
  // Get payment history
  const [paymentRows] = await pool.execute(`
    SELECT 
      id,
      payment_date,
      amount,
      payment_method as method,
      notes
    FROM po_payments
    WHERE purchase_order_id = ?
    ORDER BY payment_date DESC
  `, [id]);
  
  // Get receiving history
  const [receivingRows] = await pool.execute(`
    SELECT 
      prs.id,
      prs.received_date,
      u.username as received_by,
      prs.notes
    FROM po_receiving_sessions prs
    LEFT JOIN users u ON prs.received_by = u.id
    WHERE prs.purchase_order_id = ?
    ORDER BY prs.received_date DESC
  `, [id]);
  
  // Get items for each receiving session
  for (const session of receivingRows as any[]) {
    const [items] = await pool.execute(`
      SELECT 
        p.name as product_name,
        por.quantity_received as quantity
      FROM po_receiving por
      JOIN products p ON por.product_id = p.id
      WHERE por.session_id = ?
    `, [session.id]);
    
    session.items = items;
  }
  
  // Get attachments
  const [attachmentRows] = await pool.execute(`
    SELECT 
      id,
      filename,
      file_path as url
    FROM po_attachments
    WHERE purchase_order_id = ?
    ORDER BY uploaded_at DESC
  `, [id]);
  
  res.json({
    ...po,
    items: itemRows,
    payment_history: paymentRows,
    receiving_history: receivingRows,
    attachments: attachmentRows
  });
}));

// Create purchase order
router.post('/purchase-orders', authenticateToken, requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  const {
    supplier_id,
    order_date,
    expected_delivery_date,
    payment_terms,
    custom_payment_terms,
    notes,
    items
  } = req.body;
  
  if (!supplier_id || !items || items.length === 0) {
    res.status(400).json({ message: 'Supplier and items are required' });
    return;
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Generate PO number
    const [poCountRows] = await connection.execute('SELECT COUNT(*) as count FROM purchase_orders');
    const poCount = (poCountRows as any[])[0].count + 1;
    const order_number = `PO-${new Date().getFullYear()}-${String(poCount).padStart(5, '0')}`;
    
    // Calculate total
    const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
    
    // Insert PO header
    const [result] = await connection.execute(`
      INSERT INTO purchase_orders (
        order_number,
        supplier_id,
        order_date,
        expected_delivery_date,
        payment_terms,
        custom_payment_terms,
        status,
        payment_status,
        receiving_status,
        total_amount,
        notes,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'Open', 'Unpaid', 'Awaiting', ?, ?, ?)
    `, [
      order_number,
      supplier_id,
      order_date,
      expected_delivery_date || null,
      payment_terms,
      custom_payment_terms || null,
      total_amount,
      notes || null,
      req.user?.id
    ]);
    
    const po_id = (result as any).insertId;
    
    // Insert PO items
    for (const item of items) {
      await connection.execute(`
        INSERT INTO purchase_order_items (
          purchase_order_id,
          product_id,
          quantity,
          unit_price,
          total
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        po_id,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.quantity * item.unit_price
      ]);
    }
    
    await connection.commit();
    
    logger.info(`Purchase order ${order_number} created by user ${req.user?.username}`);
    
    res.status(201).json({
      message: 'Purchase order created successfully',
      order_number,
      id: po_id
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Receive items (partial receiving)
router.post('/purchase-orders/:id/receive', authenticateToken, requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  const { id } = req.params;
  const { received_date, items, notes } = req.body;
  
  if (!items || items.length === 0) {
    res.status(400).json({ message: 'Items are required' });
    return;
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Create receiving session
    const [sessionResult] = await connection.execute(`
      INSERT INTO po_receiving_sessions (
        purchase_order_id,
        received_date,
        received_by,
        notes
      ) VALUES (?, ?, ?, ?)
    `, [id, received_date, req.user?.id, notes || null]);
    
    const session_id = (sessionResult as any).insertId;
    
    // Process each item
    for (const item of items) {
      if (item.quantity_received > 0) {
        // Get PO item ID
        const [poItemRows] = await connection.execute(`
          SELECT id FROM purchase_order_items
          WHERE purchase_order_id = ? AND product_id = ?
        `, [id, item.product_id]);
        
        if ((poItemRows as any[]).length === 0) continue;
        
        const po_item_id = (poItemRows as any[])[0].id;
        
        // Record receiving
        await connection.execute(`
          INSERT INTO po_receiving (
            session_id,
            po_item_id,
            product_id,
            quantity_received
          ) VALUES (?, ?, ?, ?)
        `, [session_id, po_item_id, item.product_id, item.quantity_received]);
        
        // Update inventory
        await connection.execute(`
          INSERT INTO inventory (product_id, current_stock)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE
          current_stock = current_stock + VALUES(current_stock)
        `, [item.product_id, item.quantity_received]);
        
        // Log inventory event
        const [invRows] = await connection.execute(
          'SELECT current_stock FROM inventory WHERE product_id = ?',
          [item.product_id]
        );
        const currentStock = (invRows as any[])[0]?.current_stock || 0;
        
        await connection.execute(`
          INSERT INTO inventory_history (
            product_id,
            event_type,
            quantity,
            previous_quantity,
            new_quantity,
            purchase_order_id,
            performed_by,
            notes
          ) VALUES (?, 'received', ?, ?, ?, ?, ?, ?)
        `, [
          item.product_id,
          item.quantity_received,
          currentStock - item.quantity_received,
          currentStock,
          id,
          req.user?.id,
          `Received from PO via session ${session_id}`
        ]);
      }
    }
    
    // Update PO receiving status
    const [allItemsRows] = await connection.execute(`
      SELECT 
        poi.quantity,
        COALESCE(SUM(por.quantity_received), 0) as received
      FROM purchase_order_items poi
      LEFT JOIN po_receiving por ON poi.id = por.po_item_id
      WHERE poi.purchase_order_id = ?
      GROUP BY poi.id
    `, [id]);
    
    const allItems = allItemsRows as any[];
    const allReceived = allItems.every((item: any) => item.received >= item.quantity);
    const noneReceived = allItems.every((item: any) => item.received === 0);
    
    let receiving_status = 'Partially Received';
    if (allReceived) receiving_status = 'Received';
    if (noneReceived) receiving_status = 'Awaiting';
    
    await connection.execute(`
      UPDATE purchase_orders
      SET receiving_status = ?,
          status = CASE WHEN ? = 'Received' THEN 'Received' ELSE status END
      WHERE id = ?
    `, [receiving_status, receiving_status, id]);
    
    await connection.commit();
    
    logger.info(`Items received for PO ${id} by user ${req.user?.username}`);
    
    res.json({ message: 'Items received successfully' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Add payment
router.post('/purchase-orders/:id/payments', authenticateToken, requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  const { id } = req.params;
  const { payment_date, amount, payment_method, notes } = req.body;
  
  if (!amount || amount <= 0) {
    res.status(400).json({ message: 'Valid payment amount is required' });
    return;
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Record payment
    await connection.execute(`
      INSERT INTO po_payments (
        purchase_order_id,
        payment_date,
        amount,
        payment_method,
        notes,
        recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [id, payment_date, amount, payment_method, notes || null, req.user?.id]);
    
    // Get PO total and total payments
    const [poRows] = await connection.execute(`
      SELECT total_amount FROM purchase_orders WHERE id = ?
    `, [id]);
    
    const total_amount = (poRows as any[])[0].total_amount;
    
    const [paymentRows] = await connection.execute(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM po_payments
      WHERE purchase_order_id = ?
    `, [id]);
    
    const total_paid = (paymentRows as any[])[0].total_paid;
    
    // Update payment status
    let payment_status = 'Partially Paid';
    if (total_paid >= total_amount) payment_status = 'Paid this month';
    if (total_paid === 0) payment_status = 'Unpaid';
    
    await connection.execute(`
      UPDATE purchase_orders
      SET payment_status = ?
      WHERE id = ?
    `, [payment_status, id]);
    
    await connection.commit();
    
    logger.info(`Payment recorded for PO ${id} by user ${req.user?.username}`);
    
    res.json({ message: 'Payment recorded successfully' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Upload attachment
router.post('/purchase-orders/:id/attachments', authenticateToken, requireRole(['admin', 'manager']), upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  const { id } = req.params;
  
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }
  
  await pool.execute(`
    INSERT INTO po_attachments (
      purchase_order_id,
      filename,
      file_path,
      uploaded_by
    ) VALUES (?, ?, ?, ?)
  `, [id, req.file.originalname, req.file.path, req.user?.id]);
  
  logger.info(`Attachment uploaded for PO ${id} by user ${req.user?.username}`);
  
  res.json({ message: 'File uploaded successfully', filename: req.file.originalname });
}));

// Get inventory history
router.get('/inventory/history', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  const { 
    page = 1, 
    limit = 25, 
    search, 
    event_type, 
    supplier_id, 
    date_from, 
    date_to 
  } = req.query;
  
  let query = `
    SELECT 
      ih.id,
      ih.event_type,
      ih.date,
      ih.product_id,
      p.name as product_name,
      p.sku,
      ih.quantity,
      ih.previous_quantity,
      ih.new_quantity,
      ih.supplier_id,
      s.name as supplier_name,
      ih.purchase_order_id,
      po.order_number as purchase_order_number,
      ih.reference_number,
      ih.reason,
      u.username as performed_by,
      ih.notes
    FROM inventory_history ih
    JOIN products p ON ih.product_id = p.id
    LEFT JOIN suppliers s ON ih.supplier_id = s.id
    LEFT JOIN purchase_orders po ON ih.purchase_order_id = po.id
    LEFT JOIN users u ON ih.performed_by = u.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (search) {
    query += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (event_type && event_type !== 'all') {
    query += ' AND ih.event_type = ?';
    params.push(event_type);
  }
  
  if (supplier_id && supplier_id !== 'all') {
    query += ' AND ih.supplier_id = ?';
    params.push(supplier_id);
  }
  
  if (date_from) {
    query += ' AND ih.date >= ?';
    params.push(date_from);
  }
  
  if (date_to) {
    query += ' AND ih.date <= ?';
    params.push(date_to);
  }
  
  query += ' ORDER BY ih.date DESC';
  
  // Get total count
  const [countRows] = await pool.execute(
    query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM'),
    params
  );
  const total = (countRows as any[])[0].total;
  
  // Add pagination
  const offset = (Number(page) - 1) * Number(limit);
  query += ' LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  
  const [rows] = await pool.execute(query, params);
  
  res.json({
    events: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    total_pages: Math.ceil(total / Number(limit))
  });
}));

export default router;
