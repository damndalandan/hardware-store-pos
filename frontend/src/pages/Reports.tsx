import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Grid, Card, CardContent, Tab, Tabs, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem, Divider, Chip, Alert, Snackbar,
  CircularProgress
} from '@mui/material';
import ErrorBoundary from '../components/ErrorBoundary';
import PageContainer from '../components/common/PageContainer';
import { useNotification } from '../hooks/useNotification';
import {
  Dashboard as DashboardIcon, TrendingUp as TrendingUpIcon, Assessment as ReportIcon,
  Inventory as InventoryIcon, Business as SuppliersIcon, MonetizationOn as ProfitIcon,
  Download as DownloadIcon, Refresh as RefreshIcon, DateRange as DateIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';

interface DashboardData {
  period: { start_date: string; end_date: string };
  sales: {
    total_transactions: number;
    total_revenue: number;
    average_sale: number;
    total_discounts: number;
    unique_customers: number;
    growth: {
      revenue: number;
      transactions: number;
    };
  };
  inventory: {
    total_products: number;
    low_stock_items: number;
    out_of_stock_items: number;
    inventory_value: number;
  };
  movements: Array<{
    transaction_type: string;
    count: number;
    total_quantity: number;
  }>;
  topProducts: Array<{
    name: string;
    sku: string;
    total_sold: number;
    total_revenue: number;
  }>;
  dailySales: Array<{
    date: string;
    transactions: number;
    revenue: number;
  }>;
  suppliers: {
    total_suppliers: number;
    total_purchase_orders: number;
    total_spent: number;
  };
}

interface SalesAnalytics {
  period: { start_date: string; end_date: string; group_by: string };
  salesByPeriod: Array<{
    period: string;
    transaction_count: number;
    total_revenue: number;
    average_sale: number;
    total_discounts: number;
    unique_customers: number;
  }>;
  paymentMethods: Array<{
    payment_method: string;
    transaction_count: number;
    total_amount: number;
    average_amount: number;
  }>;
  hourlySales: Array<{
    hour: string;
    transaction_count: number;
    total_revenue: number;
    average_sale: number;
  }>;
  categoryPerformance: Array<{
    category_name: string;
    unique_products: number;
    total_quantity: number;
    total_revenue: number;
    average_price: number;
  }>;
}

interface InventoryAnalytics {
  inventoryStatus: Array<{
    category_name: string;
    product_count: number;
    total_stock: number;
    total_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
  }>;
  turnoverAnalysis: Array<{
    name: string;
    sku: string;
    category_name: string;
    current_stock: number;
    sold_last_30_days: number;
    days_of_stock: number | null;
    inventory_value: number;
  }>;
  movementTrends: Array<{
    date: string;
    transaction_type: string;
    transaction_count: number;
    total_quantity: number;
  }>;
}

interface ProfitabilityAnalytics {
  period: { start_date: string; end_date: string };
  productProfitability: Array<{
    name: string;
    sku: string;
    category_name: string;
    total_sold: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    profit_margin_percent: number;
  }>;
  categoryProfitability: Array<{
    category_name: string;
    product_count: number;
    total_sold: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    profit_margin_percent: number;
  }>;
  dailyProfits: Array<{
    date: string;
    transaction_count: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    profit_margin_percent: number;
  }>;
}

interface SupplierAnalytics {
  period: { start_date: string; end_date: string };
  supplierPerformance: Array<{
    supplier_name: string;
    city?: string;
    state?: string;
    total_orders: number;
    total_spent: number;
    average_order: number;
    completed_orders: number;
    cancelled_orders: number;
    avg_delivery_days: number | null;
    completion_rate: number;
    last_order_date: string;
  }>;
  spendingTrends: Array<{
    month: string;
    unique_suppliers: number;
    total_orders: number;
    total_spent: number;
    average_order: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Reports: React.FC = () => {
  const { user } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize dates safely
  const getStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  };
  
  const [startDate, setStartDate] = useState<Date | null>(getStartDate());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  
  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryAnalytics | null>(null);
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityAnalytics | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierAnalytics | null>(null);

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // Utility functions
  const formatCurrency = (amount: number | string) => `$${Number(amount || 0).toFixed(2)}`;
  const formatNumber = (num: number | string) => new Intl.NumberFormat().format(Number(num || 0));
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();
  const formatPercent = (num: number | string) => `${Number(num || 0).toFixed(1)}%`;

  // Fetch functions
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      
      const response = await axios.get(`${API_BASE_URL}/reports/dashboard?${params}`);
      setDashboardData(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch dashboard data';
      console.error('Failed to fetch dashboard data:', error);
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, API_BASE_URL, showNotification]);

  const fetchSalesAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      params.append('group_by', 'day');
      
      const response = await axios.get(`${API_BASE_URL}/reports/sales?${params}`);
      setSalesData(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch sales analytics';
      console.error('Failed to fetch sales analytics:', error);
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      setSalesData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, API_BASE_URL, showNotification]);

  const fetchInventoryAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/reports/inventory`);
      setInventoryData(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch inventory analytics';
      console.error('Failed to fetch inventory analytics:', error);
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      setInventoryData(null);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, showNotification]);

  const fetchProfitabilityAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      
      const response = await axios.get(`${API_BASE_URL}/reports/profitability?${params}`);
      setProfitabilityData(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch profitability analytics';
      console.error('Failed to fetch profitability analytics:', error);
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      setProfitabilityData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, API_BASE_URL, showNotification]);

  const fetchSupplierAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      
      const response = await axios.get(`${API_BASE_URL}/reports/suppliers?${params}`);
      setSupplierData(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch supplier analytics';
      console.error('Failed to fetch supplier analytics:', error);
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      setSupplierData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, API_BASE_URL, showNotification]);

  useEffect(() => {
    switch (activeTab) {
      case 0: fetchDashboard(); break;
      case 1: fetchSalesAnalytics(); break;
      case 2: fetchInventoryAnalytics(); break;
      case 3: fetchProfitabilityAnalytics(); break;
      case 4: fetchSupplierAnalytics(); break;
    }
  }, [activeTab, fetchDashboard, fetchSalesAnalytics, fetchInventoryAnalytics, fetchProfitabilityAnalytics, fetchSupplierAnalytics]);

  // Export function
  const handleExport = async (reportType: string, format: 'csv' | 'excel') => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      
      const response = await axios.get(`${API_BASE_URL}/reports/export/${reportType}/${format}?${params}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data]);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `${reportType}-report-${timestamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      saveAs(blob, filename);
      showNotification(`Report exported successfully as ${format.toUpperCase()}`, 'success');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to export report';
      console.error('Failed to export report:', error);
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <PageContainer>
        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={hideNotification}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert onClose={hideNotification} severity={notification.severity} sx={{ width: '100%' }}>
            {notification.message}
          </Alert>
        </Snackbar>

        {/* Date Range Controls (show for Dashboard, Sales, Profitability, and Supplier tabs) */}
        {(activeTab === 0 || activeTab === 1 || activeTab === 3 || activeTab === 4) && (
        <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: '#fff' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={2}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      switch (activeTab as number) {
                        case 0: fetchDashboard(); break;
                        case 1: fetchSalesAnalytics(); break;
                        case 2: fetchInventoryAnalytics(); break;
                        case 3: fetchProfitabilityAnalytics(); break;
                        case 4: fetchSupplierAnalytics(); break;
                      }
                    }}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                  {(activeTab as number) !== 2 && (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => {
                          const reportTypes = ['dashboard', 'sales', 'inventory', 'profitability', 'suppliers'];
                          handleExport(reportTypes[activeTab], 'csv');
                        }}
                        disabled={loading}
                      >
                        Export CSV
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => {
                          const reportTypes = ['dashboard', 'sales', 'inventory', 'profitability', 'suppliers'];
                          handleExport(reportTypes[activeTab], 'excel');
                        }}
                        disabled={loading}
                      >
                        Export Excel
                      </Button>
                    </>
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        )}

        {/* Tabs */}
        <Box sx={{ mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Dashboard Overview" icon={<DashboardIcon />} />
            <Tab label="Sales Analytics" icon={<TrendingUpIcon />} />
            <Tab label="Inventory Reports" icon={<InventoryIcon />} />
            <Tab label="Profitability Analysis" icon={<ProfitIcon />} />
            <Tab label="Supplier Performance" icon={<SuppliersIcon />} />
          </Tabs>
        </Box>

        {/* Dashboard Overview */}
        {activeTab === 0 && !loading && !error && dashboardData && (dashboardData.sales || dashboardData.dailySales) && (
          <Grid container spacing={3}>
            {/* Summary Cards */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {formatNumber(dashboardData.sales.total_transactions)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Transactions
                  </Typography>
                  <Chip
                    label={`${dashboardData.sales.growth.transactions > 0 ? '+' : ''}${formatPercent(dashboardData.sales.growth.transactions)}`}
                    color={dashboardData.sales.growth.transactions >= 0 ? 'success' : 'error'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(dashboardData.sales.total_revenue)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Revenue
                  </Typography>
                  <Chip
                    label={`${dashboardData.sales.growth.revenue > 0 ? '+' : ''}${formatPercent(dashboardData.sales.growth.revenue)}`}
                    color={dashboardData.sales.growth.revenue >= 0 ? 'success' : 'error'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {formatCurrency(dashboardData.sales.average_sale)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average Sale
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {formatCurrency(dashboardData.inventory.inventory_value)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inventory Value
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Daily Sales Chart */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Daily Sales Trend
                  </Typography>
                  {dashboardData.dailySales && dashboardData.dailySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dashboardData.dailySales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No sales data available for this period
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Top Products */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Top Selling Products
                  </Typography>
                  {dashboardData.topProducts && dashboardData.topProducts.length > 0 ? (
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 320, overflow: 'auto' }}>
                    <Table size="small" stickyHeader sx={{ '& .MuiTableRow-root': { height: 40 }, '& .MuiTableCell-root': { py: 0.5 } }}>
                      <TableHead>
                        <TableRow sx={{ height: 40 }}>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Product</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Sold</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dashboardData.topProducts.slice(0, 8).map((product, index) => (
                          <TableRow key={index} hover sx={{ height: 40 }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {product.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {product.sku}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{product.total_sold}</TableCell>
                            <TableCell align="right">{formatCurrency(product.total_revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No product sales data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Inventory Status */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Inventory Status
                  </Typography>
                  <Grid container spacing={2} sx={{ textAlign: 'center' }}>
                    <Grid item xs={3}>
                      <Typography variant="h5" color="primary">
                        {formatNumber(dashboardData.inventory.total_products)}
                      </Typography>
                      <Typography variant="caption">Total Products</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="h5" color="warning.main">
                        {formatNumber(dashboardData.inventory.low_stock_items)}
                      </Typography>
                      <Typography variant="caption">Low Stock</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="h5" color="error.main">
                        {formatNumber(dashboardData.inventory.out_of_stock_items)}
                      </Typography>
                      <Typography variant="caption">Out of Stock</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="h5" color="success.main">
                        {formatCurrency(dashboardData.inventory.inventory_value)}
                      </Typography>
                      <Typography variant="caption">Total Value</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Supplier Metrics */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Supplier Metrics
                  </Typography>
                  <Grid container spacing={2} sx={{ textAlign: 'center' }}>
                    <Grid item xs={4}>
                      <Typography variant="h5" color="primary">
                        {formatNumber(dashboardData.suppliers.total_suppliers)}
                      </Typography>
                      <Typography variant="caption">Active Suppliers</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="h5" color="info.main">
                        {formatNumber(dashboardData.suppliers.total_purchase_orders)}
                      </Typography>
                      <Typography variant="caption">Purchase Orders</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="h5" color="success.main">
                        {formatCurrency(dashboardData.suppliers.total_spent)}
                      </Typography>
                      <Typography variant="caption">Total Spent</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Sales Analytics */}
        {activeTab === 1 && !loading && !error && salesData && (
          <Grid container spacing={3}>
            {/* Sales Trend */}
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Sales Trend
                  </Typography>
                  {salesData.salesByPeriod && salesData.salesByPeriod.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={salesData.salesByPeriod}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Line type="monotone" dataKey="total_revenue" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No sales data available for this period
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Payment Methods */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Payment Methods
                  </Typography>
                  {salesData.paymentMethods && salesData.paymentMethods.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={salesData.paymentMethods}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ payment_method, percent }) => `${payment_method} ${(Number(percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total_amount"
                      >
                        {salesData.paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No payment method data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Hourly Sales Pattern */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Hourly Sales Pattern
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={salesData.hourlySales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="total_revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Category Performance */}
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Category Performance
                  </Typography>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                    <Table stickyHeader sx={{ '& .MuiTableRow-root': { height: 40 }, '& .MuiTableCell-root': { py: 0.5 } }}>
                      <TableHead>
                        <TableRow sx={{ height: 40 }}>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Category</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Products</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Quantity Sold</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Revenue</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Avg Price</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {salesData.categoryPerformance.map((category, index) => (
                          <TableRow key={index} hover sx={{ height: 40 }}>
                            <TableCell>
                              <Typography fontWeight="bold">{category.category_name}</Typography>
                            </TableCell>
                            <TableCell align="right">{formatNumber(category.unique_products)}</TableCell>
                            <TableCell align="right">{formatNumber(category.total_quantity)}</TableCell>
                            <TableCell align="right">{formatCurrency(category.total_revenue)}</TableCell>
                            <TableCell align="right">{formatCurrency(category.average_price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Inventory Reports */}
        {activeTab === 2 && inventoryData && (
          <Grid container spacing={3}>
            {/* Inventory Status by Category */}
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Inventory Status by Category
                  </Typography>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                    <Table stickyHeader sx={{ '& .MuiTableRow-root': { height: 40 }, '& .MuiTableCell-root': { py: 0.5 } }}>
                      <TableHead>
                        <TableRow sx={{ height: 40 }}>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Category</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Products</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Total Stock</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Value</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Low Stock</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Out of Stock</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inventoryData.inventoryStatus.map((category, index) => (
                          <TableRow key={index} hover sx={{ height: 40 }}>
                            <TableCell>
                              <Typography fontWeight="bold">{category.category_name}</Typography>
                            </TableCell>
                            <TableCell align="right">{formatNumber(category.product_count)}</TableCell>
                            <TableCell align="right">{formatNumber(category.total_stock)}</TableCell>
                            <TableCell align="right">{formatCurrency(category.total_value)}</TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={category.low_stock_count}
                                color={category.low_stock_count > 0 ? 'warning' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={category.out_of_stock_count}
                                color={category.out_of_stock_count > 0 ? 'error' : 'default'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Inventory Turnover Analysis */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Inventory Turnover Analysis (Top 20)
                  </Typography>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 500, overflow: 'auto' }}>
                    <Table stickyHeader sx={{ '& .MuiTableRow-root': { height: 40 }, '& .MuiTableCell-root': { py: 0.5 } }}>
                      <TableHead>
                        <TableRow sx={{ height: 40 }}>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Product</TableCell>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Category</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Current Stock</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Sold (30d)</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Days of Stock</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inventoryData.turnoverAnalysis.slice(0, 20).map((product, index) => (
                          <TableRow key={index} hover sx={{ height: 40 }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {product.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {product.sku}
                              </Typography>
                            </TableCell>
                            <TableCell>{product.category_name}</TableCell>
                            <TableCell align="right">{formatNumber(product.current_stock)}</TableCell>
                            <TableCell align="right">{formatNumber(product.sold_last_30_days)}</TableCell>
                            <TableCell align="right">
                              {product.days_of_stock ? (
                                <Chip
                                  label={`${product.days_of_stock} days`}
                                  color={product.days_of_stock < 7 ? 'error' : 
                                         product.days_of_stock < 14 ? 'warning' : 'success'}
                                  size="small"
                                />
                              ) : 'N/A'}
                            </TableCell>
                            <TableCell align="right">{formatCurrency(product.inventory_value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Profitability Analysis */}
        {activeTab === 3 && profitabilityData && (
          <Grid container spacing={3}>
            {/* Daily Profit Trend */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Daily Profit Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={profitabilityData.dailyProfits}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="total_profit" stroke="#00C49F" strokeWidth={2} name="Profit" />
                      <Line type="monotone" dataKey="profit_margin_percent" stroke="#FF8042" strokeWidth={2} name="Margin %" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Category Profitability */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Category Profitability
                  </Typography>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                    <Table stickyHeader sx={{ '& .MuiTableRow-root': { height: 40 }, '& .MuiTableCell-root': { py: 0.5 } }}>
                      <TableHead>
                        <TableRow sx={{ height: 40 }}>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Category</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Revenue</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Cost</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Profit</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Margin %</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {profitabilityData.categoryProfitability.map((category, index) => (
                          <TableRow key={index} hover sx={{ height: 40 }}>
                            <TableCell>
                              <Typography fontWeight="bold">{category.category_name}</Typography>
                            </TableCell>
                            <TableCell align="right">{formatCurrency(category.total_revenue)}</TableCell>
                            <TableCell align="right">{formatCurrency(category.total_cost)}</TableCell>
                            <TableCell align="right">{formatCurrency(category.total_profit)}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={formatPercent(category.profit_margin_percent)}
                                color={category.profit_margin_percent >= 25 ? 'success' :
                                       category.profit_margin_percent >= 15 ? 'warning' : 'error'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Profitable Products */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Profitable Products
                  </Typography>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                    <Table size="small" stickyHeader sx={{ '& .MuiTableRow-root': { height: 40 }, '& .MuiTableCell-root': { py: 0.5 } }}>
                      <TableHead>
                        <TableRow sx={{ height: 40 }}>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Product</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Profit</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {profitabilityData.productProfitability.slice(0, 10).map((product, index) => (
                          <TableRow key={index} hover sx={{ height: 40 }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {product.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatPercent(product.profit_margin_percent)} margin
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{formatCurrency(product.total_profit)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Supplier Performance */}
        {activeTab === 4 && supplierData && (
          <Grid container spacing={3}>
            {/* Spending Trends */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Monthly Spending Trends
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={supplierData.spendingTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="total_spent" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Supplier Performance Table */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Supplier Performance
                  </Typography>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 500, overflow: 'auto' }}>
                    <Table stickyHeader sx={{ '& .MuiTableRow-root': { height: 40 }, '& .MuiTableCell-root': { py: 0.5 } }}>
                      <TableHead>
                        <TableRow sx={{ height: 40 }}>
                          <TableCell sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Supplier</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Orders</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Total Spent</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Avg Order</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Completion Rate</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Avg Delivery</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f7f7f7', fontWeight: 600 }}>Last Order</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {supplierData.supplierPerformance.map((supplier, index) => (
                          <TableRow key={index} hover sx={{ height: 40 }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {supplier.supplier_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {supplier.city}, {supplier.state}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{formatNumber(supplier.total_orders)}</TableCell>
                            <TableCell align="right">{formatCurrency(supplier.total_spent)}</TableCell>
                            <TableCell align="right">{formatCurrency(supplier.average_order)}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={formatPercent(supplier.completion_rate)}
                                color={supplier.completion_rate >= 90 ? 'success' :
                                       supplier.completion_rate >= 75 ? 'warning' : 'error'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              {supplier.avg_delivery_days ? `${Number(supplier.avg_delivery_days).toFixed(1)} days` : 'N/A'}
                            </TableCell>
                            <TableCell align="right">{formatDate(supplier.last_order_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={40} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              Loading {activeTab === 0 ? 'dashboard' : activeTab === 1 ? 'sales' : activeTab === 2 ? 'inventory' : activeTab === 3 ? 'profitability' : 'supplier'} data...
            </Typography>
          </Box>
        )}

        {/* No Data State */}
        {!loading && !error && (
          (activeTab === 0 && !dashboardData) ||
          (activeTab === 1 && !salesData) ||
          (activeTab === 2 && !inventoryData) ||
          (activeTab === 3 && !profitabilityData) ||
          (activeTab === 4 && !supplierData)
        ) && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No data available for the selected date range.
            </Typography>
          </Box>
        )}
      </PageContainer>
    </LocalizationProvider>
    </ErrorBoundary>
  );
};

export default Reports;