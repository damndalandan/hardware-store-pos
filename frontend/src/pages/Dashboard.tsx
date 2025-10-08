import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  IconButton,
  Tooltip,
  Avatar,
  Stack,
  Divider
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Inventory,
  ShoppingCart,
  AttachMoney,
  People,
  Warning,
  LocalShipping,
  Receipt,
  ArrowForward,
  Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const [statsRes, lowStockRes, recentSalesRes, topProductsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/reports/dashboard?start_date=${thirtyDaysAgo}&end_date=${today}`),
        axios.get(`${API_BASE_URL}/products?low_stock=true`),
        axios.get(`${API_BASE_URL}/sales?limit=5`),
        axios.get(`${API_BASE_URL}/products?sort=sales&limit=5`)
      ]);

      setDashboardData({
        stats: statsRes.data,
        lowStock: lowStockRes.data.products || [],
        recentSales: recentSalesRes.data.sales || [],
        topProducts: topProductsRes.data.products || []
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => `$${Number(amount || 0).toFixed(2)}`;
  const formatNumber = (num: number) => new Intl.NumberFormat().format(Number(num || 0));

  const MetricCard = ({ title, value, subtitle, icon, color = 'primary', trend, onClick }: any) => (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: `${color}.main`, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {trend >= 0 ? (
              <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />
            ) : (
              <TrendingDown sx={{ color: 'error.main', fontSize: 20 }} />
            )}
            <Typography variant="body2" color={trend >= 0 ? 'success.main' : 'error.main'}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% from last period
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box
      sx={{
        backgroundColor: '#f7f8fA',
        minHeight: '100vh',
        '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiPaper-root, & .MuiTableCell-root': {
          fontSize: '14px !important',
        },
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>
            Dashboard Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back! Here's what's happening with your store today.
          </Typography>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton onClick={fetchDashboardData} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}
      
      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Revenue"
            value={dashboardData ? formatCurrency(dashboardData.stats.sales?.total_revenue) : '$0.00'}
            subtitle={dashboardData ? `${formatNumber(dashboardData.stats.sales?.total_transactions)} transactions` : '0 transactions'}
            icon={<AttachMoney sx={{ fontSize: 32 }} />}
            color="success"
            trend={dashboardData?.stats.sales?.growth?.revenue}
            onClick={() => navigate('/sales')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Products"
            value={dashboardData ? formatNumber(dashboardData.stats.inventory?.total_products) : '0'}
            subtitle={dashboardData ? `${formatCurrency(dashboardData.stats.inventory?.inventory_value)} value` : '$0.00 value'}
            icon={<ShoppingCart sx={{ fontSize: 32 }} />}
            color="primary"
            onClick={() => navigate('/products')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Low Stock Alerts"
            value={dashboardData ? formatNumber(dashboardData.stats.inventory?.low_stock_items) : '0'}
            subtitle={dashboardData ? `${formatNumber(dashboardData.stats.inventory?.out_of_stock_items)} out of stock` : '0 out of stock'}
            icon={<Warning sx={{ fontSize: 32 }} />}
            color="warning"
            onClick={() => navigate('/inventory')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Suppliers"
            value={dashboardData ? formatNumber(dashboardData.stats.suppliers?.total_suppliers) : '0'}
            subtitle={dashboardData ? `${formatNumber(dashboardData.stats.suppliers?.total_purchase_orders)} orders` : '0 orders'}
            icon={<LocalShipping sx={{ fontSize: 32 }} />}
            color="info"
            onClick={() => navigate('/suppliers')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Sales */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Receipt /> Recent Sales
                </Typography>
                <IconButton size="small" onClick={() => navigate('/sales')}>
                  <ArrowForward />
                </IconButton>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {dashboardData?.recentSales && dashboardData.recentSales.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Sale ID</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Payment</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboardData.recentSales.map((sale: any) => (
                        <TableRow key={sale.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/sales')}>
                          <TableCell>#{sale.id}</TableCell>
                          <TableCell>{new Date(sale.sale_date).toLocaleString()}</TableCell>
                          <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                          <TableCell>
                            <Chip label={sale.payment_method} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">{formatCurrency(sale.total_amount)}</TableCell>
                          <TableCell>
                            {sale.status === 'voided' ? (
                              <Chip label="VOIDED" size="small" color="error" />
                            ) : (
                              <Chip label="Completed" size="small" color="success" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No recent sales
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Low Stock & Top Products */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Low Stock Alerts */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning color="warning" /> Low Stock Alerts
                  </Typography>
                  <IconButton size="small" onClick={() => navigate('/inventory')}>
                    <ArrowForward />
                  </IconButton>
                </Box>
                <Divider sx={{ mb: 2 }} />
                {dashboardData?.lowStock && dashboardData.lowStock.length > 0 ? (
                  <Stack spacing={1.5}>
                    {dashboardData.lowStock.slice(0, 5).map((product: any) => (
                      <Box key={product.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {product.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {product.sku}
                          </Typography>
                        </Box>
                        <Chip 
                          label={`${product.stock_quantity} left`}
                          size="small"
                          color={product.stock_quantity === 0 ? 'error' : 'warning'}
                        />
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    All products well stocked!
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Top Selling Products */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp color="success" /> Top Products
                  </Typography>
                  <IconButton size="small" onClick={() => navigate('/products')}>
                    <ArrowForward />
                  </IconButton>
                </Box>
                <Divider sx={{ mb: 2 }} />
                {dashboardData?.stats?.topProducts && dashboardData.stats.topProducts.length > 0 ? (
                  <Stack spacing={1.5}>
                    {dashboardData.stats.topProducts.slice(0, 5).map((product: any, index: number) => (
                      <Box key={index}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {product.name}
                          </Typography>
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                            {formatCurrency(product.total_revenue)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={Math.min((product.total_sold / dashboardData.stats.topProducts[0].total_sold) * 100, 100)} 
                            sx={{ flex: 1, height: 6, borderRadius: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {product.total_sold} sold
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No sales data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;