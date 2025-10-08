import express from 'express';
import Joi from 'joi';
import { getPool } from '../database/connection';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Dashboard overview - key metrics
router.get('/dashboard', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    start_date = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0]
  } = req.query;

  const pool = await getPool();

  // Sales metrics
  const [salesRows] = await pool.execute(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as average_sale,
      SUM(discount_amount) as total_discounts,
      COUNT(DISTINCT customer_name) as unique_customers
    FROM sales 
    WHERE DATE(sale_date) >= DATE(?) AND DATE(sale_date) <= DATE(?)
  `, [start_date, end_date]);
  const salesMetrics = (salesRows as any[])[0];

  // Compare with previous period
  const prevStart = new Date(start_date as string);
  prevStart.setDate(prevStart.getDate() - (new Date(end_date as string).getTime() - new Date(start_date as string).getTime()) / (1000 * 60 * 60 * 24));
  
  const [prevSalesRows] = await pool.execute(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(total_amount) as total_revenue
    FROM sales 
    WHERE DATE(sale_date) >= DATE(?) AND DATE(sale_date) < DATE(?)
  `, [prevStart.toISOString().split('T')[0], start_date]);
  const prevSalesMetrics = (prevSalesRows as any[])[0];

  // Inventory metrics
  const [inventoryRows] = await pool.execute(`
    SELECT 
      COUNT(*) as total_products,
      SUM(CASE WHEN i.current_stock <= p.min_stock_level THEN 1 ELSE 0 END) as low_stock_items,
      SUM(CASE WHEN i.current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock_items,
      SUM(i.current_stock * p.cost_price) as inventory_value
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    WHERE p.is_active = 1
  `);
  const inventoryMetrics = (inventoryRows as any[])[0];

  // Recent inventory movements
  const [movementRows] = await pool.execute(`
    SELECT 
      it.transaction_type,
      COUNT(*) as count,
      SUM(ABS(it.quantity_change)) as total_quantity
    FROM inventory_transactions it
    WHERE DATE(it.created_at) >= DATE(?) AND DATE(it.created_at) <= DATE(?)
    GROUP BY it.transaction_type
  `, [start_date, end_date]);
  const recentMovements = movementRows as any[];

  // Top selling products
  const [topRows] = await pool.execute(`
    SELECT 
      p.name,
      p.sku,
      SUM(si.quantity) as total_sold,
      SUM(si.total_price) as total_revenue
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE DATE(s.sale_date) >= DATE(?) AND DATE(s.sale_date) <= DATE(?)
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 10
  `, [start_date, end_date]);
  const topProducts = topRows as any[];

  // Daily sales trend
  const [dailyRows] = await pool.execute(`
    SELECT 
      DATE(sale_date) as date,
      COUNT(*) as transactions,
      SUM(total_amount) as revenue
    FROM sales
    WHERE DATE(sale_date) >= DATE(?) AND DATE(sale_date) <= DATE(?)
    GROUP BY DATE(sale_date)
    ORDER BY date
  `, [start_date, end_date]);
  const dailySales = dailyRows as any[];

  // Supplier metrics
  const [supplierRows] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT s.id) as total_suppliers,
      COUNT(DISTINCT po.id) as total_purchase_orders,
      SUM(po.total_amount) as total_spent
    FROM suppliers s
    LEFT JOIN purchase_orders po ON s.id = po.supplier_id
    WHERE s.is_active = 1 
      AND (po.order_date IS NULL OR (DATE(po.order_date) >= DATE(?) AND DATE(po.order_date) <= DATE(?)))
  `, [start_date, end_date]);
  const supplierMetrics = (supplierRows as any[])[0];

  res.json({
    period: { start_date, end_date },
    sales: {
      ...salesMetrics,
      growth: {
        revenue: prevSalesMetrics.total_revenue > 0 
          ? ((salesMetrics.total_revenue - prevSalesMetrics.total_revenue) / prevSalesMetrics.total_revenue * 100)
          : 0,
        transactions: prevSalesMetrics.total_transactions > 0 
          ? ((salesMetrics.total_transactions - prevSalesMetrics.total_transactions) / prevSalesMetrics.total_transactions * 100)
          : 0
      }
    },
    inventory: inventoryMetrics,
    movements: recentMovements,
    topProducts,
    dailySales,
    suppliers: supplierMetrics
  });
}));

// Sales analytics
router.get('/sales', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    start_date = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0],
    group_by = 'day',
    cashier_id
  } = req.query;

  const pool = await getPool();
  let whereClause = 'WHERE DATE(s.sale_date) >= DATE(?) AND DATE(s.sale_date) <= DATE(?)';
  let params = [start_date, end_date];

  if (cashier_id) {
    whereClause += ' AND s.cashier_id = ?';
    params.push(cashier_id as string);
  }

  let groupByClause;
  let selectClause;
  
  switch (group_by) {
    case 'hour':
      groupByClause = "DATE_FORMAT(s.sale_date, '%Y-%m-%d %H:00:00')";
      selectClause = "DATE_FORMAT(s.sale_date, '%Y-%m-%d %H:00:00') as period";
      break;
    case 'week':
      groupByClause = "DATE_FORMAT(s.sale_date, '%Y-W%v')";
      selectClause = "DATE_FORMAT(s.sale_date, '%Y-W%v') as period";
      break;
    case 'month':
      groupByClause = "DATE_FORMAT(s.sale_date, '%Y-%m')";
      selectClause = "DATE_FORMAT(s.sale_date, '%Y-%m') as period";
      break;
    default: // day
      groupByClause = "DATE(s.sale_date)";
      selectClause = "DATE(s.sale_date) as period";
  }

  // Sales by period
  const [periodRows] = await pool.execute(`
    SELECT 
      ${selectClause},
      COUNT(*) as transaction_count,
      SUM(s.total_amount) as total_revenue,
      AVG(s.total_amount) as average_sale,
      SUM(s.discount_amount) as total_discounts,
      COUNT(DISTINCT s.customer_name) as unique_customers
    FROM sales s
    ${whereClause}
    GROUP BY ${groupByClause}
    ORDER BY period
  `, params);
  const salesByPeriod = periodRows as any[];

  // Payment method breakdown
  const [paymentRows] = await pool.execute(`
    SELECT 
      s.payment_method,
      COUNT(*) as transaction_count,
      SUM(s.total_amount) as total_amount,
      AVG(s.total_amount) as average_amount
    FROM sales s
    ${whereClause}
    GROUP BY s.payment_method
    ORDER BY total_amount DESC
  `, params);
  const paymentMethods = paymentRows as any[];

  // Hourly sales pattern
  const [hourlyRows] = await pool.execute(`
    SELECT 
      DATE_FORMAT(s.sale_date, '%H') as hour,
      COUNT(*) as transaction_count,
      SUM(s.total_amount) as total_revenue,
      AVG(s.total_amount) as average_sale
    FROM sales s
    ${whereClause}
    GROUP BY DATE_FORMAT(s.sale_date, '%H')
    ORDER BY hour
  `, params);
  const hourlySales = hourlyRows as any[];

  // Product category performance
  const [categoryRows] = await pool.execute(`
    SELECT 
      c.name as category_name,
      COUNT(DISTINCT si.product_id) as unique_products,
      SUM(si.quantity) as total_quantity,
      SUM(si.total_price) as total_revenue,
      AVG(si.unit_price) as average_price
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    ${whereClause}
    GROUP BY c.id
    ORDER BY total_revenue DESC
  `, params);
  const categoryPerformance = categoryRows as any[];

  res.json({
    period: { start_date, end_date, group_by },
    salesByPeriod,
    paymentMethods,
    hourlySales,
    categoryPerformance
  });
}));

// Inventory analytics
router.get('/inventory', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    location,
    category_id
  } = req.query;

  const pool = await getPool();
  let whereClause = 'WHERE p.is_active = 1';
  let params: any[] = [];

  if (location) {
    whereClause += ' AND i.location = ?';
    params.push(location);
  }

  if (category_id) {
    whereClause += ' AND p.category_id = ?';
    params.push(category_id);
  }

  // Current inventory status
  const [statusRows] = await pool.execute(`
    SELECT 
      c.name as category_name,
      COUNT(*) as product_count,
      SUM(i.current_stock) as total_stock,
      SUM(i.current_stock * p.cost_price) as total_value,
      SUM(CASE WHEN i.current_stock <= i.min_stock_level THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN i.current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock_count
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    ${whereClause}
    GROUP BY c.id
    ORDER BY total_value DESC
  `, params);
  const inventoryStatus = statusRows as any[];

  // Inventory turnover analysis
  const [turnoverRows] = await pool.execute(`
    SELECT 
      p.name,
      p.sku,
      c.name as category_name,
      i.current_stock,
      i.min_stock_level,
      COALESCE(sales_data.total_sold_30d, 0) as sold_last_30_days,
      CASE 
        WHEN COALESCE(sales_data.total_sold_30d, 0) > 0 THEN 
          ROUND(i.current_stock / (sales_data.total_sold_30d / 30.0), 1)
        ELSE NULL
      END as days_of_stock,
      i.current_stock * p.cost_price as inventory_value
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN (
      SELECT 
        si.product_id,
        SUM(si.quantity) as total_sold_30d
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date >= date('now', '-30 days')
      GROUP BY si.product_id
    ) sales_data ON p.id = sales_data.product_id
    ${whereClause}
    ORDER BY sold_last_30_days DESC
    LIMIT 50
  `, params);
  const turnoverAnalysis = turnoverRows as any[];

  // Stock movement trends
  const [trendRows] = await pool.execute(`
    SELECT 
      DATE(it.created_at) as date,
      it.transaction_type,
      COUNT(*) as transaction_count,
      SUM(ABS(it.quantity_change)) as total_quantity
    FROM inventory_transactions it
    WHERE it.created_at >= date('now', '-30 days')
    GROUP BY DATE(it.created_at), it.transaction_type
    ORDER BY date, it.transaction_type
  `);
  const movementTrends = trendRows as any[];

  res.json({
    inventoryStatus,
    turnoverAnalysis,
    movementTrends
  });
}));

// Profitability analysis
router.get('/profitability', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    start_date = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0],
    category_id
  } = req.query;

  const pool = await getPool();
  let whereClause = 'WHERE DATE(s.sale_date) >= DATE(?) AND DATE(s.sale_date) <= DATE(?)';
  let params = [start_date, end_date];

  if (category_id) {
    whereClause += ' AND p.category_id = ?';
    params.push(category_id);
  }

  // Product profitability
  const [productRows] = await pool.execute(`
    SELECT 
      p.name,
      p.sku,
      c.name as category_name,
      SUM(si.quantity) as total_sold,
      SUM(si.total_price) as total_revenue,
      SUM(si.quantity * p.cost_price) as total_cost,
      SUM(si.total_price - (si.quantity * p.cost_price)) as total_profit,
      ROUND(
        (SUM(si.total_price - (si.quantity * p.cost_price)) / SUM(si.total_price)) * 100, 
        2
      ) as profit_margin_percent
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    ${whereClause}
    GROUP BY p.id
    HAVING total_sold > 0
    ORDER BY total_profit DESC
    LIMIT 50
  `, params);
  const productProfitability = productRows as any[];

  // Category profitability
  const [catProfitRows] = await pool.execute(`
    SELECT 
      c.name as category_name,
      COUNT(DISTINCT p.id) as product_count,
      SUM(si.quantity) as total_sold,
      SUM(si.total_price) as total_revenue,
      SUM(si.quantity * p.cost_price) as total_cost,
      SUM(si.total_price - (si.quantity * p.cost_price)) as total_profit,
      ROUND(
        (SUM(si.total_price - (si.quantity * p.cost_price)) / SUM(si.total_price)) * 100, 
        2
      ) as profit_margin_percent
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    ${whereClause}
    GROUP BY c.id
    ORDER BY total_profit DESC
  `, params);
  const categoryProfitability = catProfitRows as any[];

  // Daily profit trends
  const [dailyProfitRows] = await pool.execute(`
    SELECT 
      DATE(s.sale_date) as date,
      COUNT(DISTINCT s.id) as transaction_count,
      SUM(si.total_price) as total_revenue,
      SUM(si.quantity * p.cost_price) as total_cost,
      SUM(si.total_price - (si.quantity * p.cost_price)) as total_profit,
      ROUND(
        (SUM(si.total_price - (si.quantity * p.cost_price)) / SUM(si.total_price)) * 100, 
        2
      ) as profit_margin_percent
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    ${whereClause}
    GROUP BY DATE(s.sale_date)
    ORDER BY date
  `, params);
  const dailyProfits = dailyProfitRows as any[];

  res.json({
    period: { start_date, end_date },
    productProfitability,
    categoryProfitability,
    dailyProfits
  });
}));

// Supplier performance
router.get('/suppliers', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const {
    start_date = new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0]
  } = req.query;

  const pool = await getPool();
  const whereClause = 'WHERE po.order_date >= DATE(?) AND po.order_date <= DATE(?)';
  const params = [start_date, end_date];

  // Supplier performance metrics
  const [performanceRows] = await pool.execute(`
    SELECT 
      s.name as supplier_name,
      s.city,
      s.state,
      COUNT(po.id) as total_orders,
      SUM(po.total_amount) as total_spent,
      AVG(po.total_amount) as average_order,
      COUNT(CASE WHEN po.status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN po.status = 'cancelled' THEN 1 END) as cancelled_orders,
      AVG(CASE 
        WHEN po.status = 'completed' AND po.received_date IS NOT NULL THEN 
          julianday(po.received_date) - julianday(po.order_date)
      END) as avg_delivery_days,
      ROUND(
        (COUNT(CASE WHEN po.status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 
        1
      ) as completion_rate,
      MAX(po.order_date) as last_order_date
    FROM suppliers s
    JOIN purchase_orders po ON s.id = po.supplier_id
    ${whereClause}
    GROUP BY s.id
    ORDER BY total_spent DESC
  `, params);
  const supplierPerformance = performanceRows as any[];

  // Supplier spending trends
  const [spendingRows] = await pool.execute(`
    SELECT 
      DATE_FORMAT(po.order_date, '%Y-%m') as month,
      COUNT(DISTINCT po.supplier_id) as unique_suppliers,
      COUNT(*) as total_orders,
      SUM(po.total_amount) as total_spent,
      AVG(po.total_amount) as average_order
    FROM purchase_orders po
    ${whereClause}
    GROUP BY DATE_FORMAT(po.order_date, '%Y-%m')
    ORDER BY month
  `, params);
  const spendingTrends = spendingRows as any[];

  res.json({
    period: { start_date, end_date },
    supplierPerformance,
    spendingTrends
  });
}));

// Export reports
router.get('/export/:reportType/:format', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { reportType, format } = req.params;
  const {
    start_date = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date = new Date().toISOString().split('T')[0]
  } = req.query;

  if (!['csv', 'excel'].includes(format)) {
    throw createError('Invalid export format. Use csv or excel', 400);
  }

  if (!['sales', 'inventory', 'profitability', 'suppliers'].includes(reportType)) {
    throw createError('Invalid report type', 400);
  }

  const pool = await getPool();
  let data: any[] = [];
  let filename = '';

  // Generate data based on report type
  switch (reportType) {
    case 'sales':
      const [salesData] = await pool.execute(`
        SELECT 
          s.sale_number,
          s.sale_date,
          s.customer_name,
          s.total_amount,
          s.payment_method,
          u.username as cashier,
          COUNT(si.id) as item_count
        FROM sales s
        JOIN users u ON s.cashier_id = u.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE DATE(s.sale_date) >= DATE(?) AND DATE(s.sale_date) <= DATE(?)
        GROUP BY s.id
        ORDER BY s.sale_date DESC
      `, [start_date, end_date]);
      data = salesData as any[];
      filename = 'sales-report';
      break;

    case 'inventory':
      const [inventoryData] = await pool.execute(`
        SELECT 
          p.name,
          p.sku,
          c.name as category,
          i.current_stock,
          i.min_stock_level,
          i.location,
          p.cost_price,
          p.selling_price,
          (i.current_stock * p.cost_price) as inventory_value
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1
        ORDER BY p.name
      `);
      data = inventoryData as any[];
      filename = 'inventory-report';
      break;

    case 'profitability':
      const [profitData] = await pool.execute(`
        SELECT 
          p.name,
          p.sku,
          c.name as category,
          SUM(si.quantity) as total_sold,
          SUM(si.total_price) as total_revenue,
          SUM(si.quantity * p.cost_price) as total_cost,
          SUM(si.total_price - (si.quantity * p.cost_price)) as total_profit,
          ROUND(
            (SUM(si.total_price - (si.quantity * p.cost_price)) / SUM(si.total_price)) * 100, 
            2
          ) as profit_margin_percent
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.sale_date) >= DATE(?) AND DATE(s.sale_date) <= DATE(?)
        GROUP BY p.id
        HAVING total_sold > 0
        ORDER BY total_profit DESC
      `, [start_date, end_date]);
      data = profitData as any[];
      filename = 'profitability-report';
      break;

    case 'suppliers':
      const [suppliersData] = await pool.execute(`
        SELECT 
          s.name as supplier_name,
          s.contact_person,
          s.email,
          s.phone,
          s.city,
          s.state,
          COUNT(po.id) as total_orders,
          SUM(po.total_amount) as total_spent,
          AVG(po.total_amount) as average_order
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id
        WHERE s.is_active = 1
        GROUP BY s.id
        ORDER BY total_spent DESC
      `);
      data = suppliersData as any[];
      filename = 'suppliers-report';
      break;
  }

  if (format === 'csv') {
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const path = require('path');
    const fs = require('fs').promises;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const csvFilename = `${filename}-${timestamp}.csv`;
    const filepath = path.join(__dirname, '../../uploads', csvFilename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const csvWriter = createCsvWriter({
      path: filepath,
      header: Object.keys(data[0] || {}).map(key => ({ id: key, title: key.replace(/_/g, ' ').toUpperCase() }))
    });
    
    await csvWriter.writeRecords(data);
    
    res.download(filepath, csvFilename, (err) => {
      if (err) logger.error('Error downloading report:', err);
      fs.unlink(filepath).catch(console.error);
    });
  } else {
    const XLSX = require('xlsx');
    const path = require('path');
    const fs = require('fs').promises;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const xlsxFilename = `${filename}-${timestamp}.xlsx`;
    const filepath = path.join(__dirname, '../../uploads', xlsxFilename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    
    XLSX.writeFile(wb, filepath);
    
    res.download(filepath, xlsxFilename, (err) => {
      if (err) logger.error('Error downloading report:', err);
      fs.unlink(filepath).catch(console.error);
    });
  }
}));

export default router;