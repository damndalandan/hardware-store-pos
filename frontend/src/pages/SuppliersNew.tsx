import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, Snackbar, Alert, IconButton, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Tabs, Tab, Divider, MenuItem, Select, FormControl, InputLabel, Tooltip,
  List, ListItem, ListItemText, ListItemButton, Badge, Stack
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
  Refresh as RefreshIcon, FilterList as FilterIcon, Download as DownloadIcon,
  Upload as UploadIcon, Payment as PaymentIcon, Inventory as InventoryIcon,
  Receipt as ReceiptIcon, AttachFile as AttachFileIcon, Close as CloseIcon,
  CheckCircle as CheckCircleIcon, Warning as WarningIcon, Schedule as ScheduleIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  payment_terms?: string;
  is_active: boolean;
  total_orders: number;
  pending_orders: number;
  total_purchased: number;
}

interface PurchaseOrder {
  id: number;
  order_number: string;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  expected_delivery_date?: string;
  status: 'Open' | 'Partial' | 'Received' | 'Closed';
  payment_status: 'Unpaid' | 'Paid this month' | 'To be paid next month' | 'Partially Paid';
  receiving_status: 'Awaiting' | 'Partially Received' | 'Received';
  total_amount: number;
  items_summary: string;
  notes?: string;
}

interface POItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  total: number;
}

interface PODetail extends PurchaseOrder {
  items: POItem[];
  payment_history: Array<{
    id: number;
    payment_date: string;
    amount: number;
    method: string;
    notes?: string;
  }>;
  receiving_history: Array<{
    id: number;
    received_date: string;
    items: Array<{
      product_name: string;
      quantity: number;
    }>;
    received_by: string;
  }>;
  attachments: Array<{
    id: number;
    filename: string;
    url: string;
  }>;
}

const SuppliersNew: React.FC = () => {
  const { user } = useAuth();
  
  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Search and filters
  const [supplierSearch, setSupplierSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [poPaymentFilter, setPoPaymentFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial'>('all');
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | 'open' | 'partial' | 'received' | 'closed'>('all');
  
  // Dialogs
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [poDialog, setPODialog] = useState(false);
  const [poDetailDialog, setPODetailDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  
  // Active tab for right side
  const [rightTab, setRightTab] = useState(0); // 0: POs, 1: Inventory History
  
  // Notifications
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (supplierSearch) params.append('search', supplierSearch);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await axios.get(`${API_BASE_URL}/suppliers?${params}`);
      setSuppliers(response.data.suppliers || []);
    } catch (error) {
      showNotification('Failed to fetch suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase orders for selected supplier
  const fetchPurchaseOrders = async (supplierId: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('supplier_id', supplierId.toString());
      if (poPaymentFilter !== 'all') params.append('payment_status', poPaymentFilter);
      if (poStatusFilter !== 'all') params.append('status', poStatusFilter);
      
      const response = await axios.get(`${API_BASE_URL}/purchase-orders?${params}`);
      setPurchaseOrders(response.data.orders || []);
    } catch (error) {
      showNotification('Failed to fetch purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch PO details
  const fetchPODetails = async (poId: number) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/purchase-orders/${poId}/details`);
      setSelectedPO(response.data);
      setPODetailDialog(true);
    } catch (error) {
      showNotification('Failed to fetch purchase order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [supplierSearch, statusFilter]);

  useEffect(() => {
    if (selectedSupplier) {
      fetchPurchaseOrders(selectedSupplier.id);
    } else {
      setPurchaseOrders([]);
    }
  }, [selectedSupplier, poPaymentFilter, poStatusFilter]);

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid this month': return 'success';
      case 'Unpaid': return 'error';
      case 'To be paid next month': return 'warning';
      case 'Partially Paid': return 'info';
      default: return 'default';
    }
  };

  const getReceivingStatusColor = (status: string) => {
    switch (status) {
      case 'Received': return 'success';
      case 'Partially Received': return 'warning';
      case 'Awaiting': return 'error';
      default: return 'default';
    }
  };

  const getReceivingStatusIcon = (status: string) => {
    switch (status) {
      case 'Received': return <CheckCircleIcon fontSize="small" />;
      case 'Partially Received': return <WarningIcon fontSize="small" />;
      case 'Awaiting': return <ScheduleIcon fontSize="small" />;
      default: return undefined;
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  return (
    <Box sx={{ p: 3, backgroundColor: '#f7f8fA', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Suppliers & Purchase Orders
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingSupplier({});
              setSupplierDialog(true);
            }}
          >
            Add Supplier
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setPODialog(true)}
            disabled={!selectedSupplier}
          >
            Create Purchase Order
          </Button>
        </Box>
      </Box>

      {/* Two-Pane Layout */}
      <Grid container spacing={3} sx={{ height: 'calc(100vh - 200px)' }}>
        {/* Left Pane - Suppliers List */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Suppliers
                </Typography>
                <IconButton size="small" onClick={fetchSuppliers}>
                  <RefreshIcon />
                </IconButton>
              </Box>
              
              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search suppliers..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 2 }}
              />

              {/* Status Filter */}
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </CardContent>

            {/* Supplier List */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
              <List dense>
                {filteredSuppliers.map((supplier) => (
                  <ListItem
                    key={supplier.id}
                    disablePadding
                    sx={{ mb: 0.5 }}
                  >
                    <ListItemButton
                      selected={selectedSupplier?.id === supplier.id}
                      onClick={() => setSelectedSupplier(supplier)}
                      sx={{
                        borderRadius: 1,
                        '&.Mui-selected': {
                          backgroundColor: 'primary.light',
                          '&:hover': {
                            backgroundColor: 'primary.light',
                          }
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {supplier.name}
                            </Typography>
                            <Badge badgeContent={supplier.pending_orders} color="error" />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block" color="text.secondary">
                              {supplier.contact_person || 'No contact'}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              {supplier.phone || 'No phone'}
                            </Typography>
                            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                              <Chip
                                label={supplier.is_active ? 'Active' : 'Inactive'}
                                size="small"
                                color={supplier.is_active ? 'success' : 'default'}
                                sx={{ height: 20, fontSize: 10 }}
                              />
                              <Chip
                                label={`${supplier.total_orders} orders`}
                                size="small"
                                sx={{ height: 20, fontSize: 10 }}
                              />
                            </Box>
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSupplier(supplier);
                            setSupplierDialog(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Card>
        </Grid>

        {/* Right Pane - Purchase Orders / Inventory History */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedSupplier ? (
              <>
                <CardContent sx={{ p: 2, pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {selectedSupplier.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedSupplier.contact_person} • {selectedSupplier.phone}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setPODialog(true)}
                    >
                      New Purchase Order
                    </Button>
                  </Box>

                  {/* Tabs */}
                  <Tabs value={rightTab} onChange={(e, v) => setRightTab(v)}>
                    <Tab label="Purchase Orders" />
                    <Tab label="Inventory History" />
                  </Tabs>
                </CardContent>

                <Divider />

                {/* Tab Content */}
                {rightTab === 0 && (
                  <>
                    {/* PO Filters */}
                    <CardContent sx={{ p: 2, pb: 1 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Payment Status</InputLabel>
                            <Select
                              value={poPaymentFilter}
                              label="Payment Status"
                              onChange={(e) => setPoPaymentFilter(e.target.value as any)}
                            >
                              <MenuItem value="all">All</MenuItem>
                              <MenuItem value="unpaid">Unpaid</MenuItem>
                              <MenuItem value="paid">Paid</MenuItem>
                              <MenuItem value="partial">Partially Paid</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Receiving Status</InputLabel>
                            <Select
                              value={poStatusFilter}
                              label="Receiving Status"
                              onChange={(e) => setPoStatusFilter(e.target.value as any)}
                            >
                              <MenuItem value="all">All</MenuItem>
                              <MenuItem value="open">Open</MenuItem>
                              <MenuItem value="partial">Partially Received</MenuItem>
                              <MenuItem value="received">Received</MenuItem>
                              <MenuItem value="closed">Closed</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </CardContent>

                    {/* Purchase Orders Table */}
                    <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
                      <TableContainer>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Order #</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Items</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Payment</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Receiving</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {purchaseOrders.map((po) => (
                              <TableRow
                                key={po.id}
                                hover
                                sx={{ cursor: 'pointer' }}
                                onClick={() => fetchPODetails(po.id)}
                              >
                                <TableCell>{po.order_number}</TableCell>
                                <TableCell>{formatDate(po.order_date)}</TableCell>
                                <TableCell>
                                  <Typography variant="caption" noWrap>
                                    {po.items_summary}
                                  </Typography>
                                </TableCell>
                                <TableCell>{formatCurrency(po.total_amount)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={po.payment_status}
                                    size="small"
                                    color={getPaymentStatusColor(po.payment_status)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    icon={getReceivingStatusIcon(po.receiving_status)}
                                    label={po.receiving_status}
                                    size="small"
                                    color={getReceivingStatusColor(po.receiving_status)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fetchPODetails(po.id);
                                    }}
                                  >
                                    <ReceiptIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </>
                )}

                {rightTab === 1 && (
                  <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Inventory history will be displayed here
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body1" color="text.secondary">
                  Select a supplier to view purchase orders
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* PO Detail Dialog */}
      <Dialog
        open={poDetailDialog}
        onClose={() => setPODetailDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Purchase Order: {selectedPO?.order_number}
            </Typography>
            <IconButton onClick={() => setPODetailDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPO && (
            <Grid container spacing={3}>
              {/* Order Info */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Order Date</Typography>
                      <Typography variant="body2">{formatDate(selectedPO.order_date)}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Expected Delivery</Typography>
                      <Typography variant="body2">
                        {selectedPO.expected_delivery_date ? formatDate(selectedPO.expected_delivery_date) : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Payment Status</Typography>
                      <Chip
                        label={selectedPO.payment_status}
                        size="small"
                        color={getPaymentStatusColor(selectedPO.payment_status)}
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Receiving Status</Typography>
                      <Chip
                        icon={getReceivingStatusIcon(selectedPO.receiving_status)}
                        label={selectedPO.receiving_status}
                        size="small"
                        color={getReceivingStatusColor(selectedPO.receiving_status)}
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Items */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Order Items
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Ordered</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Received</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Unit Price</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedPO.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={item.received_quantity === item.quantity ? 'success.main' : 'warning.main'}
                            >
                              {item.received_quantity}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} align="right" sx={{ fontWeight: 600 }}>
                          Total:
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(selectedPO.total_amount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Payment History */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Payment History
                </Typography>
                <Paper sx={{ p: 2 }}>
                  {selectedPO.payment_history.length > 0 ? (
                    <List dense>
                      {selectedPO.payment_history.map((payment) => (
                        <ListItem key={payment.id} divider>
                          <ListItemText
                            primary={formatCurrency(payment.amount)}
                            secondary={`${formatDate(payment.payment_date)} • ${payment.method}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No payments recorded
                    </Typography>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PaymentIcon />}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Add Payment
                  </Button>
                </Paper>
              </Grid>

              {/* Receiving History */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Receiving History
                </Typography>
                <Paper sx={{ p: 2 }}>
                  {selectedPO.receiving_history.length > 0 ? (
                    <List dense>
                      {selectedPO.receiving_history.map((receiving) => (
                        <ListItem key={receiving.id} divider>
                          <ListItemText
                            primary={formatDate(receiving.received_date)}
                            secondary={`${receiving.items.map(i => `${i.product_name} (${i.quantity})`).join(', ')}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No items received yet
                    </Typography>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<InventoryIcon />}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Receive Items
                  </Button>
                </Paper>
              </Grid>

              {/* Attachments */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Attachments
                </Typography>
                <Paper sx={{ p: 2 }}>
                  {selectedPO.attachments.length > 0 ? (
                    <Stack spacing={1}>
                      {selectedPO.attachments.map((attachment) => (
                        <Chip
                          key={attachment.id}
                          icon={<AttachFileIcon />}
                          label={attachment.filename}
                          onClick={() => window.open(attachment.url, '_blank')}
                          onDelete={() => {/* Handle delete */}}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No attachments
                    </Typography>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UploadIcon />}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Upload File
                  </Button>
                </Paper>
              </Grid>

              {/* Notes */}
              {selectedPO.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Notes
                  </Typography>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="body2">{selectedPO.notes}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPODetailDialog(false)}>Close</Button>
          <Button variant="contained" startIcon={<EditIcon />}>
            Edit Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SuppliersNew;
