import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  Chip, Alert, Snackbar, Tooltip, IconButton, Tab, Tabs, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Accordion, AccordionSummary, AccordionDetails, Divider, CircularProgress, Menu
} from '@mui/material';
import {
  Search as SearchIcon, Download as DownloadIcon, Print as PrintIcon,
  Refresh as RefreshIcon, Receipt as ReceiptIcon, Undo as ReturnIcon,
  Analytics as AnalyticsIcon, History as HistoryIcon, Person as CustomerIcon,
  ExpandMore as ExpandMoreIcon, TrendingUp as TrendingUpIcon,
  Assessment as ReportIcon, Today as TodayIcon, MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import dataGridStickySx from '../utils/dataGridSticky';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';

interface Sale {
  id: number;
  sale_number: string;
  sale_date: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  cashier_username: string;
  item_count: number;
  product_names?: string;
}

interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  brand?: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SaleDetail extends Sale {
  cashier_first_name: string;
  cashier_last_name: string;
  items: SaleItem[];
}

interface Analytics {
  summary: {
    total_transactions: number;
    total_revenue: number;
    average_sale: number;
    total_discounts: number;
    total_tax: number;
    period: { start_date: string; end_date: string };
  };
  dailySales: Array<{
    sale_date: string;
    transaction_count: number;
    daily_revenue: number;
    average_sale: number;
  }>;
  paymentMethods: Array<{
    payment_method: string;
    transaction_count: number;
    total_amount: number;
  }>;
  topProducts: Array<{
    name: string;
    sku: string;
    brand?: string;
    total_quantity: number;
    total_revenue: number;
    sale_count: number;
  }>;
  cashierPerformance: Array<{
    username: string;
    first_name: string;
    last_name: string;
    transaction_count: number;
    total_sales: number;
    average_sale: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Sales: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [sales, setSales] = useState<Sale[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<GridRowSelectionModel>([]);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Dialog states
  const [detailDialog, setDetailDialog] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [returnDialog, setReturnDialog] = useState(false);
  
  // Form states
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date | null>(() => new Date());
  const [cashierFilter, setCashierFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSales, setTotalSales] = useState(0);
  
  // Return form
  const [returnItems, setReturnItems] = useState<Array<{saleItemId: number; returnQuantity: number}>>([]);
  const [returnReason, setReturnReason] = useState('');
  
  // Notifications
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Paper,
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Menu,
  Chip,
  Popover,
  List,
  ListItem,
  Checkbox,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TableSortLabel,
  Tooltip
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VisibilityIcon from '@mui/icons-material/Visibility';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  // Utility functions
  const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num == null || isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  };

  // Fetch functions
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '25');
      
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      if (cashierFilter !== 'all') params.append('cashier_id', cashierFilter);
      if (paymentMethodFilter !== 'all') params.append('payment_method', paymentMethodFilter);
      
      const response = await axios.get(`${API_BASE_URL}/sales?${params}`);
      setSales(response.data.sales || []);
      setTotalPages(response.data.pagination?.pages || 1);
      setTotalSales(response.data.pagination?.total || 0);
    } catch (error: any) {
      console.error('Failed to fetch sales:', error);
      showNotification(error.response?.data?.message || 'Failed to fetch sales', 'error');
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [page, startDate, endDate, cashierFilter, paymentMethodFilter, API_BASE_URL, showNotification]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      if (cashierFilter !== 'all') params.append('cashier_id', cashierFilter);
      
      const response = await axios.get(`${API_BASE_URL}/sales/analytics/summary?${params}`);
      setAnalytics(response.data);
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      showNotification(error.response?.data?.message || 'Failed to fetch analytics', 'error');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, cashierFilter, API_BASE_URL, showNotification]);

  useEffect(() => {
    if (activeTab === 0) fetchSales();
    else if (activeTab === 1) fetchAnalytics();
  }, [activeTab, fetchSales, fetchAnalytics]);

  // CRUD operations
  const fetchSaleDetail = async (saleId: number) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/sales/${saleId}`);
      setSelectedSale(response.data);
      setDetailDialog(true);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch sale details';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptReprint = async (saleId: number) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/sales/${saleId}/receipt`);
      setSelectedSale({ ...response.data.receiptData, id: saleId } as any);
      setReceiptDialog(true);
      showNotification('Receipt data loaded successfully');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to load receipt';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedSale || returnItems.length === 0) return;

    try {
      setLoading(true);
      
      if (!returnReason.trim()) {
        showNotification('Please provide a reason for the return', 'error');
        return;
      }

      await axios.post(`${API_BASE_URL}/sales/${selectedSale.id}/return`, {
        items: returnItems,
        reason: returnReason
      });

      showNotification('Return processed successfully');
      setReturnDialog(false);
      setReturnItems([]);
      setReturnReason('');
      setSelectedSale(null);
      fetchSales();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to process return';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export function
  const handleExport = async (format: 'csv' | 'excel', includeItems = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
      if (cashierFilter !== 'all') params.append('cashier_id', cashierFilter);
      if (paymentMethodFilter !== 'all') params.append('payment_method', paymentMethodFilter);
      params.append('include_items', includeItems.toString());
      
      const response = await axios.get(`${API_BASE_URL}/sales/export/${format}?${params}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data]);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `sales-export-${timestamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      saveAs(blob, filename);
      
      showNotification(`Sales data exported successfully`);
    } catch (error) {
      showNotification('Failed to export sales data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Data Grid columns
  const salesColumns: GridColDef[] = [
    { field: 'sale_number', headerName: 'Sale #', width: 140, disableColumnMenu: true },
    { 
      field: 'sale_date', 
      headerName: 'Date', 
      width: 160, 
      valueFormatter: (params) => params.value ? formatDate(params.value) : '', 
      disableColumnMenu: true 
    },
    { field: 'customer_name', headerName: 'Customer', width: 150, disableColumnMenu: true },
    { field: 'product_names', headerName: 'Products', width: 250, disableColumnMenu: true },
    { 
      field: 'total_amount', 
      headerName: 'Total', 
      width: 100, 
      type: 'number', 
      valueFormatter: (params) => params.value != null ? formatCurrency(params.value) : '$0.00', 
      disableColumnMenu: true 
    },
    { field: 'payment_method', headerName: 'Payment', width: 100, disableColumnMenu: true },
    { field: 'cashier_username', headerName: 'Cashier', width: 120, disableColumnMenu: true },
    { field: 'item_count', headerName: 'Items', width: 80, type: 'number', disableColumnMenu: true },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      headerAlign: 'center',
      align: 'center',
      renderHeader: () => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center', width: '100%' }}>
          <Typography variant="body2" fontWeight="medium">Actions</Typography>
          <IconButton
            size="small"
            onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
            sx={{ p: 0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          <Tooltip title="View Receipt">
            <IconButton size="small" onClick={() => fetchSaleDetail(params.row.id)}>
              <ReceiptIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Return">
            <IconButton
              size="small"
              onClick={() => {
                fetchSaleDetail(params.row.id);
                setReturnDialog(true);
              }}
              color="error"
            >
              <ReturnIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
      disableColumnMenu: false
    }
  ];

  // Error boundary
  if (hasError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Something went wrong</Typography>
          <Typography variant="body2">{errorMessage || 'An unexpected error occurred while loading the Sales page.'}</Typography>
          <Button 
            variant="outlined" 
            onClick={() => {
              setHasError(false);
              setErrorMessage('');
              window.location.reload();
            }}
            sx={{ mt: 2 }}
          >
            Reload Page
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
  <Box
    sx={{
      backgroundColor: '#f7f8fA',
      minHeight: '100vh',
      // enforce 14px globally for Material components to match Inventory styling
      '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiPaper-root, & .MuiTableCell-root': {
        fontSize: '14px !important',
      },
      p: 3,
    }}
  >
        <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
          Sales History & Analytics
        </Typography>

        {/* Tabs */}
        <Box sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Sales History" icon={<HistoryIcon />} />
            <Tab label="Analytics & Reports" icon={<AnalyticsIcon />} />
          </Tabs>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
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
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={paymentMethodFilter}
                    label="Payment Method"
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Methods</MenuItem>
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="card">Card</MenuItem>
                    <MenuItem value="check">Check</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('csv')}
                    disabled={loading}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('excel')}
                    disabled={loading}
                  >
                    Export Excel
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      if (activeTab === 0) fetchSales();
                      else if (activeTab === 1) fetchAnalytics();
                    }}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Content based on active tab */}
        {activeTab === 0 && (
          <Card>
            <Box sx={{ height: 600, width: '100%', minWidth: 700, overflowX: 'auto', overflowY: 'auto' }}>
              <DataGrid
                rows={sales}
                columns={salesColumns}
                loading={loading}
                checkboxSelection
                disableRowSelectionOnClick
                rowSelectionModel={selectedItems}
                onRowSelectionModelChange={setSelectedItems}
                pageSizeOptions={[25, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25 } }
                }}
                sx={{
                  ...dataGridStickySx,
                  '& .MuiDataGrid-columnHeader[data-field="actions"]': {
                    position: 'sticky !important',
                    right: 0,
                    zIndex: 3,
                    backgroundColor: 'background.paper',
                    borderLeft: '2px solid',
                    borderColor: 'divider',
                    minWidth: 150,
                    boxShadow: '-4px 0 8px rgba(0,0,0,0.1)'
                  },
                  '& .MuiDataGrid-cell[data-field="actions"]': {
                    position: 'sticky !important',
                    right: 0,
                    zIndex: 1,
                    backgroundColor: 'background.paper',
                    borderLeft: '2px solid',
                    borderColor: 'divider',
                    minWidth: 150,
                    boxShadow: '-4px 0 8px rgba(0,0,0,0.1)'
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    position: 'sticky',
                    top: 0,
                    zIndex: 2
                  }
                }}
              />
            </Box>
          </Card>
        )}

        {activeTab === 1 && (
          loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : analytics ? (
          <Grid container spacing={3}>
            {/* Summary Cards */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {analytics.summary.total_transactions}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Transactions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(analytics.summary.total_revenue)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Revenue
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {formatCurrency(analytics.summary.average_sale)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average Sale
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {formatCurrency(analytics.summary.total_discounts)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Discounts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Daily Sales Chart */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Daily Sales Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.dailySales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="sale_date" />
                      <YAxis />
                      <ChartTooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Line type="monotone" dataKey="daily_revenue" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Payment Methods Chart */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Payment Methods
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.paymentMethods}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ payment_method, percent }) => `${payment_method} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total_amount"
                      >
                        {analytics.paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Products */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Selling Products
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.topProducts.slice(0, 10).map((product, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {product.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {product.sku} {product.brand && `- ${product.brand}`}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{product.total_quantity}</TableCell>
                            <TableCell align="right">{formatCurrency(product.total_revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Cashier Performance */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Cashier Performance
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Cashier</TableCell>
                          <TableCell align="right">Sales</TableCell>
                          <TableCell align="right">Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.cashierPerformance.map((cashier, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Typography variant="body2">
                                {cashier.first_name} {cashier.last_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                @{cashier.username}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{cashier.transaction_count}</TableCell>
                            <TableCell align="right">{formatCurrency(cashier.total_sales)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          ) : (
            <Card>
              <CardContent>
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                  No analytics data available for the selected period.
                </Typography>
              </CardContent>
            </Card>
          )
        )}

        {/* Sale Detail Dialog */}
        <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Sale Details - {selectedSale?.sale_number}
          </DialogTitle>
          <DialogContent>
            {selectedSale && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Date:</Typography>
                    <Typography>{formatDate(selectedSale.sale_date)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Cashier:</Typography>
                    <Typography>{selectedSale.cashier_first_name} {selectedSale.cashier_last_name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Customer:</Typography>
                    <Typography>{selectedSale.customer_name || 'Walk-in'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Payment Method:</Typography>
                    <Typography>{selectedSale.payment_method}</Typography>
                  </Grid>
                </Grid>

                <Typography variant="h6" gutterBottom>Items</Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedSale.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {item.product_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku} {item.brand && `- ${item.brand}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{item.quantity} {item.unit}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.total_price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 3, textAlign: 'right' }}>
                  <Typography>Subtotal: {formatCurrency(selectedSale.subtotal)}</Typography>
                  <Typography>Tax: {formatCurrency(selectedSale.tax_amount)}</Typography>
                  <Typography>Discount: -{formatCurrency(selectedSale.discount_amount)}</Typography>
                  <Typography variant="h6">Total: {formatCurrency(selectedSale.total_amount)}</Typography>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialog(false)}>Close</Button>
            <Button 
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => handleReceiptReprint(selectedSale!.id)}
            >
              Reprint Receipt
            </Button>
          </DialogActions>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog open={receiptDialog} onClose={() => setReceiptDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Receipt Preview</DialogTitle>
          <DialogContent>
            {selectedSale && (
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.2 }}>
                <Typography align="center" sx={{ fontWeight: 'bold', mb: 2 }}>
                  HARDWARE STORE POS
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Typography>Sale #: {selectedSale.sale_number}</Typography>
                <Typography>Date: {formatDate(selectedSale.sale_date)}</Typography>
                <Typography>Cashier: {selectedSale.cashier_username}</Typography>
                {selectedSale.customer_name && (
                  <Typography>Customer: {selectedSale.customer_name}</Typography>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                {selectedSale.items?.map((item: any, index: number) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Typography>{item.productName}</Typography>
                    <Typography sx={{ ml: 2 }}>
                      {item.quantity} x {formatCurrency(item.unitPrice)} = {formatCurrency(item.totalPrice)}
                    </Typography>
                  </Box>
                ))}
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ textAlign: 'right' }}>
                  <Typography>Subtotal: {formatCurrency(selectedSale.subtotal)}</Typography>
                  <Typography>Tax: {formatCurrency(selectedSale.tax_amount)}</Typography>
                  <Typography>Discount: -{formatCurrency(selectedSale.discount_amount)}</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                    Total: {formatCurrency(selectedSale.total_amount)}
                  </Typography>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                <Typography align="center">Thank you for your business!</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReceiptDialog(false)}>Close</Button>
            <Button 
              variant="contained"
              onClick={() => window.print()}
            >
              Print
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          <Alert 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
            severity={snackbar.severity}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* Column Customization Menu */}
        <Menu
          anchorEl={columnMenuAnchor}
          open={Boolean(columnMenuAnchor)}
          onClose={() => setColumnMenuAnchor(null)}
        >
          <MenuItem disabled>
            <Typography variant="caption" color="text.secondary">
              Column Customization (Coming Soon)
            </Typography>
          </MenuItem>
        </Menu>
      </Box>
    </LocalizationProvider>
  );
};

export default Sales;