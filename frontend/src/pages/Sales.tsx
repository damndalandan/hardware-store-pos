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
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  FilterList as FilterListIcon,
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  Receipt as ReceiptIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Print as PrintIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

interface Sale {
  id: number;
  sale_number: string;
  sale_date: string;
  customer_name?: string;
  product_names?: string;
  total_amount: number;
  payment_method: string;
  cashier_username: string;
  item_count: number;
  status?: string;
  void_reason?: string;
  voided_by?: number;
  voided_at?: string;
}

// Default column order (excluding actions which is always last and sticky)
const defaultColumnOrder = [
  'sale_number',
  'sale_date',
  'customer_name',
  'product_names',
  'total_amount',
  'payment_method',
  'cashier_username',
  'item_count'
];

const Sales: React.FC = () => {
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Data states
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search and basic filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Multi-select filter states
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([]);
  const [cashierFilter, setCashierFilter] = useState<string[]>([]);
  
  // Column customization states
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sales_visible_columns');
    if (saved) {
      try {
        return JSON.parse(saved) as Record<string, boolean>;
      } catch (e) {
        // fallback to default
      }
    }
    return {
      sale_number: true,
      sale_date: true,
      customer_name: true,
      product_names: true,
      total_amount: true,
      payment_method: true,
      cashier_username: true,
      item_count: true,
      actions: true // always visible
    };
  });
  
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const raw = localStorage.getItem('sales_column_order');
    if (raw) {
      try {
        return JSON.parse(raw) as string[];
      } catch (e) {
        return defaultColumnOrder;
      }
    }
    return defaultColumnOrder;
  });
  
  const [columnMode, setColumnMode] = useState<'default' | 'all' | 'custom'>('custom');
  
  // Sort states
  const [sortBy, setSortBy] = useState<string>('sale_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Popover anchor states
  const [paymentMethodAnchor, setPaymentMethodAnchor] = useState<null | HTMLElement>(null);
  const [cashierAnchor, setCashierAnchor] = useState<null | HTMLElement>(null);
  const [colMenuAnchor, setColMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Temp selection for popovers (before confirming)
  const [tempPaymentMethodSelection, setTempPaymentMethodSelection] = useState<string[]>([]);
  const [tempCashierSelection, setTempCashierSelection] = useState<string[]>([]);
  
  // Available filter options (fetched from API)
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [cashiers, setCashiers] = useState<string[]>([]);
  
  // Dragging state for column reordering
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Notification
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Receipt and void dialogs
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  // Utility functions
  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num == null || isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '-';
    }
  };

  // Fetch sales data
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (paymentMethodFilter.length) params.append('payment_method', paymentMethodFilter.join(','));
      if (cashierFilter.length) params.append('cashier', cashierFilter.join(','));

      const response = await axios.get(`${API_BASE_URL}/sales?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setSales(response.data.sales || []);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      setNotification({ open: true, message: 'Failed to load sales data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, startDate, endDate, paymentMethodFilter, cashierFilter]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sales?limit=1000`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Extract unique payment methods and cashiers from data
      const allSales = response.data.sales || [];
      const uniquePaymentMethods = [...new Set(allSales.map((s: Sale) => s.payment_method))].filter(Boolean);
      const uniqueCashiers = [...new Set(allSales.map((s: Sale) => s.cashier_username))].filter(Boolean);
      
      setPaymentMethods(uniquePaymentMethods as string[]);
      setCashiers(uniqueCashiers as string[]);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Column management
  const openColMenu = (e: React.MouseEvent<HTMLElement>) => setColMenuAnchor(e.currentTarget);
  const closeColMenu = () => setColMenuAnchor(null);
  
  const toggleColumn = (col: string) => {
    if (col === 'actions') return; // always visible
    setVisibleColumns(prev => {
      const updated = { ...prev, [col]: !prev[col] };
      try {
        localStorage.setItem('sales_visible_columns', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });
    setColumnMode('custom');
  };

  const defaultVisibleColumns: Record<string, boolean> = {
    sale_number: true,
    sale_date: true,
    customer_name: true,
    product_names: true,
    total_amount: true,
    payment_method: true,
    cashier_username: true,
    item_count: true,
    actions: true
  };

  const setAllColumns = () => {
    setVisibleColumns(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => { if (k !== 'actions') copy[k] = true; });
      try {
        localStorage.setItem('sales_visible_columns', JSON.stringify(copy));
      } catch (e) {
        // ignore
      }
      return copy;
    });
  };

  const setDefaultColumns = () => {
    const defaults = { ...defaultVisibleColumns };
    setVisibleColumns(defaults);
    try {
      localStorage.setItem('sales_visible_columns', JSON.stringify(defaults));
    } catch (e) {
      // ignore
    }
  };

  const resetColumnOrderToDefault = () => {
    const def = defaultColumnOrder;
    setColumnOrder(def);
    persistColumnOrder(def);
  };

  const persistColumnOrder = (order: string[]) => {
    try {
      localStorage.setItem('sales_column_order', JSON.stringify(order));
    } catch (e) {
      // ignore
    }
  };

  const formatLabel = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  // Receipt handlers
  const handleViewReceipt = async (saleId: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sales/${saleId}/receipt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setReceiptData(response.data.receiptData);
      setReceiptDialogOpen(true);
    } catch (error) {
      setNotification({
        open: true,
        message: 'Failed to load receipt',
        severity: 'error'
      });
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Void handlers
  const handleOpenVoidDialog = (saleId: number) => {
    setSelectedSaleId(saleId);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  const handleVoidSale = async () => {
    if (!selectedSaleId) return;
    
    setVoidLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/sales/${selectedSaleId}/void`, 
        { reason: voidReason },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      setNotification({
        open: true,
        message: 'Sale voided successfully. Inventory has been restored.',
        severity: 'success'
      });
      
      setVoidDialogOpen(false);
      setSelectedSaleId(null);
      setVoidReason('');
      fetchSales();
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to void sale',
        severity: 'error'
      });
    } finally {
      setVoidLoading(false);
    }
  };

  // Drag and drop handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch (err) {}
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const draggedId = draggingId || e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === overId) return;
    setColumnOrder((prev) => {
      const copy = [...prev];
      const from = copy.indexOf(draggedId);
      const to = copy.indexOf(overId);
      if (from === -1 || to === -1) return prev;
      copy.splice(from, 1);
      copy.splice(to, 0, draggedId);
      persistColumnOrder(copy);
      setColumnMode('custom');
      return copy;
    });
    setDraggingId(null);
  };

  const onDragEndNative = () => setDraggingId(null);

  // Sort handler
  const handleRequestSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    setSortBy(field);
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSales(prev => {
      const copy = [...prev];
      copy.sort((a: any, b: any) => {
        const av = a[field];
        const bv = b[field];
        if (av == null && bv == null) return 0;
        if (av == null) return sortOrder === 'asc' ? -1 : 1;
        if (bv == null) return sortOrder === 'asc' ? 1 : -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return (sortOrder === 'asc' ? 1 : -1) * (av - bv);
        }
        const astr = String(av).toLowerCase();
        const bstr = String(bv).toLowerCase();
        if (astr < bstr) return sortOrder === 'asc' ? 1 : -1;
        if (astr > bstr) return sortOrder === 'asc' ? -1 : 1;
        return 0;
      });
      return copy;
    });
  };

  // Filter popover handlers
  const handleOpenPaymentMethodFilter = (e: React.MouseEvent<HTMLElement>) => {
    setTempPaymentMethodSelection(paymentMethodFilter);
    setPaymentMethodAnchor(e.currentTarget);
  };

  const handleOpenCashierFilter = (e: React.MouseEvent<HTMLElement>) => {
    setTempCashierSelection(cashierFilter);
    setCashierAnchor(e.currentTarget);
  };

  const handlePaymentMethodToggle = (method: string) => {
    setTempPaymentMethodSelection(prev => 
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  const handleCashierToggle = (cashier: string) => {
    setTempCashierSelection(prev =>
      prev.includes(cashier) ? prev.filter(c => c !== cashier) : [...prev, cashier]
    );
  };

  const handlePaymentMethodConfirm = () => {
    setPaymentMethodFilter(tempPaymentMethodSelection);
    setPaymentMethodAnchor(null);
  };

  const handleCashierConfirm = () => {
    setCashierFilter(tempCashierSelection);
    setCashierAnchor(null);
  };

  const handlePaymentMethodReset = () => {
    setTempPaymentMethodSelection([]);
  };

  const handleCashierReset = () => {
    setTempCashierSelection([]);
  };

  const isAllPaymentMethodsSelected = tempPaymentMethodSelection.length === 0;
  const isAllCashiersSelected = tempCashierSelection.length === 0;

  // Export functionality
  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sales/export?format=${format}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data]);
      const filename = `sales_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      saveAs(blob, filename);
      
      setNotification({ open: true, message: `Export successful: ${filename}`, severity: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      setNotification({ open: true, message: 'Export failed', severity: 'error' });
    }
  };

  // Styling constants
  const headerCellSx = {
    top: 0,
    position: 'sticky',
    backgroundColor: '#f7f7f7',
    zIndex: 1200,
    whiteSpace: 'nowrap'
  } as any;

  const cellSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 240
  } as any;

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: '#f7f8fA',
        minHeight: '100vh',
        '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiTableCell-root': {
          fontSize: '14px !important',
        }
      }}
    >
      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Sales History" icon={<HistoryIcon />} />
          <Tab label="Analytics" icon={<AnalyticsIcon />} />
        </Tabs>
      </Box>

      {/* Sales History Tab */}
      {activeTab === 0 && (
        <Card sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          {/* Toolbar */}
          <Card sx={{ mb: 3, backgroundColor: '#fff', borderRadius: 2, boxShadow: 1 }}>
            <CardContent sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search by sale number, customer, product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    variant="outlined"
                    size="small"
                    InputProps={{
                      sx: {
                        borderRadius: '20px',
                        backgroundColor: '#ffffff',
                        px: 1.5,
                        py: 0,
                        boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)',
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* Date Range */}
                    <TextField
                      type="date"
                      label="Start Date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 150 }}
                    />
                    <TextField
                      type="date"
                      label="End Date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 150 }}
                    />

                    {/* Payment Method Filter */}
                    <Button
                      size="small"
                      variant={paymentMethodFilter.length > 0 ? 'contained' : 'outlined'}
                      onClick={handleOpenPaymentMethodFilter}
                      endIcon={paymentMethodFilter.length > 0 && (
                        <Chip 
                          label={paymentMethodFilter.length} 
                          size="small" 
                          sx={{ 
                            height: 18, 
                            fontSize: '0.7rem',
                            bgcolor: 'rgba(255,255,255,0.3)',
                            color: 'inherit'
                          }} 
                        />
                      )}
                      sx={{
                        textTransform: 'none',
                        fontWeight: paymentMethodFilter.length > 0 ? 600 : 400,
                        borderRadius: 1
                      }}
                    >
                      Payment Method
                    </Button>

                    {/* Cashier Filter */}
                    <Button
                      size="small"
                      variant={cashierFilter.length > 0 ? 'contained' : 'outlined'}
                      onClick={handleOpenCashierFilter}
                      endIcon={cashierFilter.length > 0 && (
                        <Chip 
                          label={cashierFilter.length} 
                          size="small" 
                          sx={{ 
                            height: 18, 
                            fontSize: '0.7rem',
                            bgcolor: 'rgba(255,255,255,0.3)',
                            color: 'inherit'
                          }} 
                        />
                      )}
                      sx={{
                        textTransform: 'none',
                        fontWeight: cashierFilter.length > 0 ? 600 : 400,
                        borderRadius: 1
                      }}
                    >
                      Cashier
                    </Button>
                  </Box>
                </Grid>

                <Grid item xs={12} md={2}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Tooltip title="Refresh">
                      <IconButton onClick={fetchSales} size="small">
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Export CSV">
                      <IconButton onClick={() => handleExport('csv')} size="small">
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
              </Grid>

              {/* Filter Chips */}
              {(paymentMethodFilter.length > 0 || cashierFilter.length > 0) && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {paymentMethodFilter.map(method => (
                    <Chip
                      key={method}
                      label={`Payment: ${method}`}
                      onDelete={() => setPaymentMethodFilter(prev => prev.filter(m => m !== method))}
                      size="small"
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                  {cashierFilter.map(cashier => (
                    <Chip
                      key={cashier}
                      label={`Cashier: ${cashier}`}
                      onDelete={() => setCashierFilter(prev => prev.filter(c => c !== cashier))}
                      size="small"
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Paper sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, mb: 2, boxShadow: 'none' }} elevation={0}>
            <TableContainer
              sx={{
                position: 'relative',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Box sx={{
                maxHeight: 600,
                overflow: 'auto',
                '&::-webkit-scrollbar': { width: 1, height: 1 },
                '&::-webkit-scrollbar-button': { display: 'none', width: 0, height: 0 },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 999, minHeight: 20 },
                '&::-webkit-scrollbar-corner': { background: 'transparent' },
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.28) transparent'
              }}>
                <Table stickyHeader sx={{ minWidth: 1100, '& .MuiTableCell-root': { py: 0.5 }, '& .MuiTableRow-root': { height: 48 } }}>
                  <TableHead>
                    <TableRow sx={{ height: 48 }}>
                      {columnOrder.map((col) => {
                        if (!visibleColumns[col]) return null;
                        const label = formatLabel(col);
                        const sortable = ['sale_date', 'total_amount', 'sale_number'].includes(col);
                        
                        return (
                          <TableCell key={col} sx={{ ...headerCellSx, py: 0.5 }}>
                            {sortable ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: .5 }}>
                                <TableSortLabel
                                  active={sortBy === col}
                                  direction={sortBy === col ? sortOrder : 'asc'}
                                  onClick={() => handleRequestSort(col)}
                                >
                                  {label}
                                </TableSortLabel>
                                {col === 'payment_method' && (
                                  <IconButton
                                    size="small"
                                    onClick={handleOpenPaymentMethodFilter}
                                    sx={{ ml: .25 }}
                                  >
                                    <FilterListIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            ) : (
                              label
                            )}
                          </TableCell>
                        );
                      })}

                      {/* Actions Column */}
                      <TableCell
                        sx={{
                          ...headerCellSx,
                          right: 0,
                          backgroundColor: '#f7f7f7',
                          zIndex: 1200,
                          borderLeft: '1px solid',
                          borderColor: 'divider',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 1,
                          pr: 0,
                          height: 48,
                          minHeight: 48,
                          py: 0.5
                        }}
                      >
                        <Box sx={{ mr: 1 }}>Actions</Box>
                        <IconButton size="small" onClick={openColMenu} sx={{ p: 0.5 }}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={columnOrder.filter(c => visibleColumns[c]).length + 1} sx={{ textAlign: 'center', py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columnOrder.filter(c => visibleColumns[c]).length + 1} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography>No sales found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((sale) => (
                        <TableRow key={sale.id} hover sx={{ height: 48 }}>
                          {columnOrder.map((col) => {
                            if (!visibleColumns[col]) return null;
                            
                            switch (col) {
                              case 'sale_number':
                                return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{sale.sale_number}</TableCell>;
                              case 'sale_date':
                                return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{formatDate(sale.sale_date)}</TableCell>;
                              case 'customer_name':
                                return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{sale.customer_name || 'Walk-in'}</TableCell>;
                              case 'product_names':
                                return (
                                  <TableCell key={col} sx={{ ...cellSx, py: 0.5, maxWidth: 250 }}>
                                    <Tooltip title={sale.product_names || ''}>
                                      <Typography noWrap>{sale.product_names || '-'}</Typography>
                                    </Tooltip>
                                  </TableCell>
                                );
                              case 'total_amount':
                                return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{formatCurrency(sale.total_amount)}</TableCell>;
                              case 'payment_method':
                                return (
                                  <TableCell key={col} sx={{ ...cellSx, py: 0.5, whiteSpace: 'nowrap' }}>
                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap' }}>
                                      <Chip label={sale.payment_method} size="small" />
                                      {sale.status === 'voided' && (
                                        <Chip label="VOIDED" size="small" color="error" />
                                      )}
                                    </Box>
                                  </TableCell>
                                );
                              case 'cashier_username':
                                return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{sale.cashier_username}</TableCell>;
                              case 'item_count':
                                return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{sale.item_count}</TableCell>;
                              default:
                                return null;
                            }
                          })}

                          {/* Actions Cell */}
                          <TableCell
                            sx={{
                              position: 'sticky',
                              right: 0,
                              backgroundColor: 'background.paper',
                              zIndex: 1,
                              borderLeft: '1px solid',
                              borderColor: 'divider',
                              whiteSpace: 'nowrap',
                              height: 48,
                              minHeight: 48,
                              py: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Tooltip title="View Receipt">
                              <IconButton 
                                size="small"
                                onClick={() => handleViewReceipt(sale.id)}
                              >
                                <ReceiptIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print Receipt">
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  handleViewReceipt(sale.id);
                                  setTimeout(() => handlePrintReceipt(), 500);
                                }}
                              >
                                <PrintIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={sale.status === 'voided' ? 'Sale already voided' : 'Void Sale'}>
                              <span>
                                <IconButton 
                                  size="small"
                                  onClick={() => handleOpenVoidDialog(sale.id)}
                                  color="error"
                                  disabled={sale.status === 'voided'}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </TableContainer>
          </Paper>

          {/* Column Customization Menu */}
          <Menu
            anchorEl={colMenuAnchor}
            open={Boolean(colMenuAnchor)}
            onClose={closeColMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ 
              sx: { 
                minWidth: 130, 
                maxWidth: 220, 
                p: 0.2, 
                fontSize: '14px' 
              } 
            }}
          >
            <Box sx={{ p: .75, pt: 0 }}>
              <RadioGroup
                value={columnMode}
                onChange={(e) => setColumnMode(e.target.value as any)}
                sx={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'flex-start', pl: .25 }}
              >
                <FormControlLabel
                  value="default"
                  control={<Radio size="small" />}
                  label="Default"
                  onClick={() => { setDefaultColumns(); resetColumnOrderToDefault(); setColumnMode('default'); }}
                  sx={{ width: '100%', mb: 0 }}
                />
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" />}
                  label="All"
                  onClick={() => { setAllColumns(); setColumnMode('all'); }}
                  sx={{ width: '100%', mb: 0 }}
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio size="small" />}
                  label="Customize"
                  onClick={() => setColumnMode('custom')}
                  sx={{ width: '100%', mb: 0 }}
                />
              </RadioGroup>
            </Box>
            <Divider />
            <Box sx={{ 
              maxHeight: 320, 
              overflow: 'auto',
              '&::-webkit-scrollbar': { width: 1 },
              '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 999 },
              scrollbarWidth: 'thin'
            }}>
              <List dense sx={{ py: 0 }}>
                {columnOrder.map((col) => (
                  <ListItem
                    key={col}
                    draggable
                    onDragStart={(e) => onDragStart(e, col)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, col)}
                    onDragEnd={onDragEndNative}
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'default', gap: 0, px: .75, py: 0 }}
                  >
                    <Box sx={{ color: 'action.disabled', cursor: 'grab', display: 'flex', alignItems: 'center', mr: 0 }}>
                      <DragIndicatorIcon fontSize="small" sx={{ opacity: 0.9 }} />
                    </Box>
                    <Checkbox
                      checked={!!visibleColumns[col]}
                      onChange={() => toggleColumn(col)}
                      size="medium"
                      disableRipple
                      sx={{ ml: 0, mr: 0, transform: 'scale(0.98)' }}
                    />
                    <Typography sx={{ flex: 1, ml: 0, fontSize: '14px' }}>
                      {formatLabel(col)}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Menu>

          {/* Payment Method Filter Popover */}
          <Popover
            open={Boolean(paymentMethodAnchor)}
            anchorEl={paymentMethodAnchor}
            onClose={() => setPaymentMethodAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { borderRadius: 2, fontSize: '14px', minWidth: 200 } }}
          >
            <List sx={{ py: 1 }}>
              <ListItem button onClick={() => setTempPaymentMethodSelection([])}>
                <Checkbox checked={isAllPaymentMethodsSelected} />
                <Typography sx={{ ml: 1 }}>All</Typography>
              </ListItem>
              {paymentMethods.map(method => (
                <ListItem key={method} button onClick={() => handlePaymentMethodToggle(method)}>
                  <Checkbox checked={tempPaymentMethodSelection.includes(method)} />
                  <Typography sx={{ ml: 1 }}>{method}</Typography>
                </ListItem>
              ))}
            </List>
            <Divider />
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button size="small" onClick={handlePaymentMethodReset} sx={{ textTransform: 'none', borderRadius: 2 }}>
                Reset
              </Button>
              <Button size="small" variant="contained" onClick={handlePaymentMethodConfirm} sx={{ textTransform: 'none', borderRadius: 2 }}>
                Confirm
              </Button>
            </Box>
          </Popover>

          {/* Cashier Filter Popover */}
          <Popover
            open={Boolean(cashierAnchor)}
            anchorEl={cashierAnchor}
            onClose={() => setCashierAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { borderRadius: 2, fontSize: '14px', minWidth: 200 } }}
          >
            <List sx={{ py: 1 }}>
              <ListItem button onClick={() => setTempCashierSelection([])}>
                <Checkbox checked={isAllCashiersSelected} />
                <Typography sx={{ ml: 1 }}>All</Typography>
              </ListItem>
              {cashiers.map(cashier => (
                <ListItem key={cashier} button onClick={() => handleCashierToggle(cashier)}>
                  <Checkbox checked={tempCashierSelection.includes(cashier)} />
                  <Typography sx={{ ml: 1 }}>{cashier}</Typography>
                </ListItem>
              ))}
            </List>
            <Divider />
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button size="small" onClick={handleCashierReset} sx={{ textTransform: 'none', borderRadius: 2 }}>
                Reset
              </Button>
              <Button size="small" variant="contained" onClick={handleCashierConfirm} sx={{ textTransform: 'none', borderRadius: 2 }}>
                Confirm
              </Button>
            </Box>
          </Popover>
        </Card>
      )}

      {/* Analytics Tab Placeholder */}
      {activeTab === 1 && (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Analytics Dashboard</Typography>
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Analytics feature coming soon...
          </Typography>
        </Card>
      )}

      {/* Receipt Dialog */}
      <Dialog
        open={receiptDialogOpen}
        onClose={() => setReceiptDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            '@media print': {
              boxShadow: 'none',
              maxWidth: '80mm'
            }
          }
        }}
      >
        <DialogTitle sx={{ '@media print': { display: 'none' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Receipt</Typography>
            <Box>
              <IconButton onClick={handlePrintReceipt} size="small">
                <PrintIcon />
              </IconButton>
              <IconButton onClick={() => setReceiptDialogOpen(false)} size="small">
                <VisibilityIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {receiptData && (
            <Box sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
              <Box sx={{ textAlign: 'center', mb: 2, borderBottom: '2px dashed #000', pb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>HARDWARE STORE</Typography>
                <Typography variant="caption">Point of Sale Receipt</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography><strong>Sale #:</strong> {receiptData.saleNumber}</Typography>
                <Typography><strong>Date:</strong> {new Date(receiptData.saleDate).toLocaleString()}</Typography>
                <Typography><strong>Cashier:</strong> {receiptData.cashier}</Typography>
                {receiptData.customerName && (
                  <Typography><strong>Customer:</strong> {receiptData.customerName}</Typography>
                )}
              </Box>

              <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

              <Box sx={{ mb: 2 }}>
                {receiptData.items.map((item: any, index: number) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {item.productName} {item.brand && `(${item.brand})`}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 2 }}>
                      <Typography>
                        {item.quantity} x {formatCurrency(item.unitPrice)}
                      </Typography>
                      <Typography>{formatCurrency(item.totalPrice)}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Subtotal:</Typography>
                  <Typography>{formatCurrency(receiptData.subtotal)}</Typography>
                </Box>
                {receiptData.discountAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Discount:</Typography>
                    <Typography>-{formatCurrency(receiptData.discountAmount)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Tax:</Typography>
                  <Typography>{formatCurrency(receiptData.taxAmount)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', mt: 1 }}>
                  <Typography><strong>TOTAL:</strong></Typography>
                  <Typography><strong>{formatCurrency(receiptData.totalAmount)}</strong></Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

              <Box sx={{ mb: 2 }}>
                <Typography><strong>Payment Method:</strong> {receiptData.paymentMethod.toUpperCase()}</Typography>
              </Box>

              <Box sx={{ textAlign: 'center', mt: 3, fontSize: '10px' }}>
                <Typography variant="caption">Thank you for your business!</Typography>
                {receiptData.reprintDate && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                    Reprinted on: {new Date(receiptData.reprintDate).toLocaleString()}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog
        open={voidDialogOpen}
        onClose={() => setVoidDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Void Sale</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This action will void the sale and restore the inventory. This cannot be undone.
          </Typography>
          <TextField
            label="Reason for voiding (optional)"
            fullWidth
            multiline
            rows={3}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g., Customer return, Wrong item, etc."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidDialogOpen(false)} disabled={voidLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleVoidSale} 
            variant="contained" 
            color="error"
            disabled={voidLoading}
          >
            {voidLoading ? <CircularProgress size={20} /> : 'Void Sale'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Sales;
