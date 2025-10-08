import express from 'express';
import { getPool } from '../database/connection';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Role-based access control
const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: express.Response, next: Function) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
};

// Get suppliers with their stock status for ordering
router.get('/suppliers-with-stock', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  
  const [rows] = await pool.execute(`
    SELECT 
      s.id,
      s.name,
      s.contact_person,
      s.email,
      s.phone,
      s.address,
      s.city,
      s.state
    FROM suppliers s
    WHERE s.is_active = 1
    ORDER BY s.name
  `);
  const suppliers = rows as any[];

  const suppliersWithStock = [];

  for (const supplier of suppliers) {
    // Get products for this supplier with stock information
    const [productRows] = await pool.execute(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.brand,
        p.unit,
        p.cost_price,
        p.min_stock_level,
        p.max_stock_level,
        COALESCE(i.current_stock, 0) as current_stock,
        c.name as category_name,
        CASE 
          WHEN COALESCE(i.current_stock, 0) = 0 THEN 'out'
          WHEN COALESCE(i.current_stock, 0) <= (p.min_stock_level * 0.5) THEN 'critical'
          WHEN COALESCE(i.current_stock, 0) <= p.min_stock_level THEN 'low'
          ELSE 'ok'
        END as stock_status
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.supplier_id = ? AND p.is_active = 1
      ORDER BY 
        CASE 
          WHEN COALESCE(i.current_stock, 0) = 0 THEN 1
          WHEN COALESCE(i.current_stock, 0) <= (p.min_stock_level * 0.5) THEN 2
          WHEN COALESCE(i.current_stock, 0) <= p.min_stock_level THEN 3
          ELSE 4
        END,
        p.name
    `, [supplier.id]);
    const products = productRows as any[];

    // Calculate suggested order quantities and statistics
    let lowStockCount = 0;
    let estimatedOrderValue = 0;
    
    const processedProducts = products.map(product => {
      const suggestedOrderQty = calculateSuggestedOrderQty(product);
      if (suggestedOrderQty > 0) {
        lowStockCount++;
        estimatedOrderValue += suggestedOrderQty * product.cost_price;
      }
      
      return {
        ...product,
        suggested_order_qty: suggestedOrderQty
      };
    });

    suppliersWithStock.push({
      ...supplier,
      products: processedProducts,
      total_products: products.length,
      low_stock_count: lowStockCount,
      estimated_order_value: estimatedOrderValue
    });
  }

  res.json({ suppliers: suppliersWithStock });
}));

// Helper function to calculate suggested order quantity
function calculateSuggestedOrderQty(product: any): number {
  const currentStock = product.current_stock || 0;
  const minStock = product.min_stock_level || 0;
  const maxStock = product.max_stock_level || minStock * 2;
  
  if (currentStock >= minStock) return 0;
  
  const deficit = minStock - currentStock;
  const bufferQty = Math.ceil((maxStock - minStock) * 0.5);
  return Math.max(deficit + bufferQty, 1);
}

// Get all purchase orders
router.get('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const pool = await getPool();
  
  const { page = 1, limit = 25, status, supplier_id } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  
  if (status) {
    whereClause += ' AND po.status = ?';
    params.push(status);
  }
  
  if (supplier_id) {
    whereClause += ' AND po.supplier_id = ?';
    params.push(supplier_id);
  }

  const [rows] = await pool.execute(`
    SELECT 
      po.id,
      po.po_number,
      po.supplier_id,
      s.name as supplier_name,
      po.status,
      po.order_date,
      po.expected_date,
      po.received_date,
      po.total_amount,
      po.notes,
      po.created_at,
      u.username as created_by_username,
      COUNT(poi.id) as item_count
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN users u ON po.created_by = u.id
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    ${whereClause}
    GROUP BY po.id, po.po_number, po.supplier_id, s.name, po.status, 
             po.order_date, po.expected_date, po.received_date, po.total_amount, 
             po.notes, po.created_at, u.username
    ORDER BY po.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const orders = rows as any[];

  const [countRows] = await pool.execute(`
    SELECT COUNT(*) as count
    FROM purchase_orders po
    ${whereClause}
  `, params);
  const totalCount = (countRows as any[])[0];

  res.json({
    orders,
    pagination: {
      current_page: Number(page),
      total_pages: Math.ceil(totalCount.count / Number(limit)),
      total_items: totalCount.count,
      items_per_page: Number(limit)
    }
  });
}));

// Create purchase order
router.post('/', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { supplier_id, items, expected_date, notes } = req.body;
  const pool = await getPool();

  if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'Supplier ID and items are required' });
    return;
  }

  // Validate supplier exists
  const [supplierRows] = await pool.execute('SELECT id, name FROM suppliers WHERE id = ? AND is_active = 1', [supplier_id]);
  const supplier = (supplierRows as any[])[0];
  if (!supplier) {
    res.status(404).json({ message: 'Supplier not found' });
    return;
  }

  // Generate PO number
  const [lastPORows] = await pool.execute(`
    SELECT po_number FROM purchase_orders 
    WHERE po_number LIKE 'PO%' 
    ORDER BY id DESC LIMIT 1
  `);
  const lastPO = (lastPORows as any[])[0];
  
  let poNumber = 'PO001';
  if (lastPO) {
    const lastNumber = parseInt(lastPO.po_number.substring(2));
    poNumber = `PO${String(lastNumber + 1).padStart(3, '0')}`;
  }

  // Calculate total amount
  const totalAmount = items.reduce((sum: number, item: any) => {
    return sum + (item.quantity * item.unit_cost);
  }, 0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Create purchase order
    const [poResult] = await connection.execute(`
      INSERT INTO purchase_orders (
        po_number, supplier_id, status, order_date, expected_date, 
        total_amount, notes, created_by
      ) VALUES (?, ?, 'draft', CURDATE(), ?, ?, ?, ?)
    `, [poNumber, supplier_id, expected_date || null, notes || null, req.user?.id]) as any;

    const purchaseOrderId = poResult.insertId;

    // Add items to purchase order
    for (const item of items) {
      await connection.execute(`
        INSERT INTO purchase_order_items (
          purchase_order_id, product_id, quantity, unit_cost
        ) VALUES (?, ?, ?, ?)
      `, [purchaseOrderId, item.product_id, item.quantity, item.unit_cost]);
    }

    await connection.commit();
    connection.release();

    logger.info(`Purchase order created: ${poNumber}`, {
      userId: req.user?.id,
      username: req.user?.username,
      supplierId: supplier_id,
      supplierName: supplier.name,
      itemCount: items.length,
      totalAmount
    });

    res.json({
      message: 'Purchase order created successfully',
      po_number: poNumber,
      id: purchaseOrderId,
      total_amount: totalAmount
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Get purchase order details
router.get('/:id', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const pool = await getPool();

  const [orderRows] = await pool.execute(`
    SELECT 
      po.*,
      s.name as supplier_name,
      s.contact_person,
      s.email,
      s.phone,
      u.username as created_by_username
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN users u ON po.created_by = u.id
    WHERE po.id = ?
  `, [id]);
  const order = (orderRows as any[])[0];

  if (!order) {
    res.status(404).json({ message: 'Purchase order not found' });
    return;
  }

  const [itemRows] = await pool.execute(`
    SELECT 
      poi.*,
      p.name as product_name,
      p.sku,
      p.unit,
      p.brand
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.purchase_order_id = ?
    ORDER BY p.name
  `, [id]);
  const items = itemRows as any[];

  res.json({
    order: { ...order, items }
  });
}));

// Update purchase order status
router.put('/:id/status', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const { status, received_date } = req.body;
  const pool = await getPool();

  if (!['draft', 'sent', 'received', 'cancelled'].includes(status)) {
    res.status(400).json({ message: 'Invalid status' });
    return;
  }

  const updateFields = ['status = ?'];
  const updateParams = [status];

  if (status === 'received' && received_date) {
    updateFields.push('received_date = ?');
    updateParams.push(received_date);
  }

  updateParams.push(id);

  await pool.execute(`
    UPDATE purchase_orders 
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, updateParams);

  logger.info(`Purchase order status updated: ${id} -> ${status}`, {
    userId: req.user?.id,
    username: req.user?.username
  });

  res.json({ message: 'Purchase order status updated successfully' });
}));

// Receive purchase order items
router.post('/:id/receive', requireRole(['admin', 'manager']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const { items } = req.body; // Array of { product_id, received_quantity }
  const pool = await getPool();

  if (!items || !Array.isArray(items)) {
    res.status(400).json({ message: 'Items array is required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update received quantities for purchase order items
    for (const item of items) {
      await connection.execute(`
        UPDATE purchase_order_items 
        SET received_quantity = ?
        WHERE purchase_order_id = ? AND product_id = ?
      `, [item.received_quantity, id, item.product_id]);

      // Update inventory
      const [inventoryRows] = await connection.execute(`
        SELECT current_stock FROM inventory WHERE product_id = ? AND (location IS NULL OR location = '')
      `, [item.product_id]);
      const existingInventory = (inventoryRows as any[])[0];

      if (existingInventory) {
        await connection.execute(`
          UPDATE inventory 
          SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ? AND (location IS NULL OR location = '')
        `, [item.received_quantity, item.product_id]);
      } else {
        await connection.execute(`
          INSERT INTO inventory (product_id, current_stock, location, updated_at)
          VALUES (?, ?, '', CURRENT_TIMESTAMP)
        `, [item.product_id, item.received_quantity]);
      }

      // Add inventory transaction
      await connection.execute(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, reference_id, 
          reference_type, notes, created_by
        ) VALUES (?, 'purchase', ?, ?, 'purchase_order', 'Received from PO', ?)
      `, [item.product_id, item.received_quantity, id, req.user?.id]);
    }

    // Check if all items are fully received
    const [pendingRows] = await connection.execute(`
      SELECT COUNT(*) as pending_count
      FROM purchase_order_items
      WHERE purchase_order_id = ? AND (received_quantity < quantity OR received_quantity IS NULL)
    `, [id]);
    const pendingItems = (pendingRows as any[])[0];

    if (pendingItems.pending_count === 0) {
      // Mark order as received
      await connection.execute(`
        UPDATE purchase_orders 
        SET status = 'received', received_date = CURDATE(), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [id]);
    }

    await connection.commit();
    connection.release();

    logger.info(`Purchase order items received: ${id}`, {
      userId: req.user?.id,
      username: req.user?.username,
      itemsReceived: items.length
    });

    res.json({ message: 'Items received successfully' });

  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}));

// Delete purchase order (only drafts)
router.delete('/:id', requireRole(['admin']), asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  const pool = await getPool();

  const [orderRows] = await pool.execute('SELECT status FROM purchase_orders WHERE id = ?', [id]);
  const order = (orderRows as any[])[0];
  if (!order) {
    res.status(404).json({ message: 'Purchase order not found' });
    return;
  }

  if (order.status !== 'draft') {
    res.status(400).json({ message: 'Can only delete draft orders' });
    return;
  }

  await pool.execute('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
  await pool.execute('DELETE FROM purchase_orders WHERE id = ?', [id]);

  logger.info(`Purchase order deleted: ${id}`, {
    userId: req.user?.id,
    username: req.user?.username
  });

  res.json({ message: 'Purchase order deleted successfully' });
}));

export default router;