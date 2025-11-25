import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, Snackbar, Alert, IconButton, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Select, MenuItem, FormControl, InputLabel, Divider, List, ListItem,
  ListItemText, Stack, Tooltip, Badge, Tab, Tabs
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Save as SaveIcon,
  Receipt as ReceiptIcon, AttachFile as AttachFileIcon, Payment as PaymentIcon,
  Inventory as InventoryIcon, Close as CloseIcon, CheckCircle as CheckCircleIcon,
  Warning as WarningIcon, Schedule as ScheduleIcon, Download as DownloadIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  payment_terms?: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  cost_price: number;
  current_stock: number;
}

interface POItem {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PurchaseOrder {
  id?: number;
  order_number?: string;
  supplier_id: number;
  supplier_name?: string;
  order_date: string;
  expected_delivery_date?: string;
  payment_terms: 'Immediate' | 'Net 30' | 'Custom';
  custom_payment_terms?: string;
  status: 'Open' | 'Partial' | 'Received' | 'Closed';
  payment_status: 'Unpaid' | 'Paid this month' | 'To be paid next month' | 'Partially Paid';
  receiving_status: 'Awaiting' | 'Partially Received' | 'Received';
  notes?: string;
  items: POItem[];
  total_amount: number;
}

interface ReceivingSession {
  po_id: number;
  received_date: string;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity_received: number;
  }>;
  received_by: string;
  notes?: string;
}

const PurchaseOrdersNew: React.FC = () => {
  const { user } = useAuth();

  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [createDialog, setCreateDialog] = useState(false);
  const [receiveDialog, setReceiveDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form state
  const [formData, setFormData] = useState<PurchaseOrder>({
    supplier_id: 0,
    order_date: new Date().toISOString().split('T')[0],
    payment_terms: 'Net 30',
    status: 'Open',
    payment_status: 'Unpaid',
    receiving_status: 'Awaiting',
    items: [],
    total_amount: 0
  });

  // Current items being added
  const [currentItem, setCurrentItem] = useState<POItem>({
    product_id: 0,
    product_name: '',
    sku: '',
    quantity: 1,
    unit_price: 0,
    total: 0
  });

  // Receiving session
  const [receivingSession, setReceivingSession] = useState<ReceivingSession>({
    po_id: 0,
    received_date: new Date().toISOString().split('T')[0],
    items: [],
    received_by: user?.username || ''
  });

  // File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'partial' | 'received' | 'closed'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'paid' | 'tobepaid'>('all');

  // Notifications
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // Fetch data
  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchPurchaseOrders();
  }, [statusFilter, paymentFilter]);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/suppliers`);
      setSuppliers(response.data.suppliers || []);
    } catch (error) {
      showNotification('Failed to fetch suppliers', 'error');
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products`);
      setProducts(response.data.products || []);
    } catch (error) {
      showNotification('Failed to fetch products', 'error');
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentFilter !== 'all') params.append('payment_status', paymentFilter);

      const response = await axios.get(`${API_BASE_URL}/purchase-orders?${params}`);
      setPurchaseOrders(response.data.orders || []);
    } catch (error) {
      showNotification('Failed to fetch purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Add item to PO
  const handleAddItem = () => {
    if (!currentItem.product_id || currentItem.quantity <= 0) {
      showNotification('Please select a product and enter a valid quantity', 'error');
      return;
    }

    const product = products.find(p => p.id === currentItem.product_id);
    if (!product) return;

    const newItem: POItem = {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      quantity: currentItem.quantity,
      unit_price: currentItem.unit_price || product.cost_price,
      total: currentItem.quantity * (currentItem.unit_price || product.cost_price)
    };

    const updatedItems = [...formData.items, newItem];
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0);

    setFormData({
      ...formData,
      items: updatedItems,
      total_amount: total
    });

    // Reset current item
    setCurrentItem({
      product_id: 0,
      product_name: '',
      sku: '',
      quantity: 1,
      unit_price: 0,
      total: 0
    });
  };

  // Remove item from PO
  const handleRemoveItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const total = updatedItems.reduce((sum, item) => sum + item.total, 0);

    setFormData({
      ...formData,
      items: updatedItems,
      total_amount: total
    });
  };

  // Create PO
  const handleCreatePO = async () => {
    if (!formData.supplier_id || formData.items.length === 0) {
      showNotification('Please select a supplier and add at least one item', 'error');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/purchase-orders`, formData);
      showNotification('Purchase order created successfully', 'success');
      setCreateDialog(false);
      fetchPurchaseOrders();
      
      // Reset form
      setFormData({
        supplier_id: 0,
        order_date: new Date().toISOString().split('T')[0],
        payment_terms: 'Net 30',
        status: 'Open',
        payment_status: 'Unpaid',
        receiving_status: 'Awaiting',
        items: [],
        total_amount: 0
      });
    } catch (error) {
      showNotification('Failed to create purchase order', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Partial receiving
  const handleReceiveItems = async () => {
    if (receivingSession.items.length === 0) {
      showNotification('Please enter quantities for items to receive', 'error');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/purchase-orders/${selectedPO?.id}/receive`, receivingSession);
      showNotification('Items received successfully', 'success');
      setReceiveDialog(false);
      fetchPurchaseOrders();
    } catch (error) {
      showNotification('Failed to receive items', 'error');
    } finally {
      setLoading(false);
    }
  };

  // File upload
  const handleFileUpload = async (poId: number) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('po_id', poId.toString());

    try {
      await axios.post(`${API_BASE_URL}/purchase-orders/${poId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showNotification('File uploaded successfully', 'success');
      setSelectedFile(null);
    } catch (error) {
      showNotification('Failed to upload file', 'error');
    }
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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3, backgroundColor: '#f7f8fA', minHeight: '100vh' }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Purchase Orders
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialog(true)}
          >
            Create Purchase Order
          </Button>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="partial">Partially Received</MenuItem>
                    <MenuItem value="received">Received</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    value={paymentFilter}
                    label="Payment Status"
                    onChange={(e) => setPaymentFilter(e.target.value as any)}
                  >
                    <MenuItem value="all">All Payments</MenuItem>
                    <MenuItem value="unpaid">Unpaid</MenuItem>
                    <MenuItem value="paid">Paid this month</MenuItem>
                    <MenuItem value="tobepaid">To be paid next month</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button variant="outlined" startIcon={<DownloadIcon />}>
                    Export
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Purchase Orders Table */}
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Expected Delivery</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Payment Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Receiving Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Payment Terms</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id} hover>
                    <TableCell>{po.order_number}</TableCell>
                    <TableCell>{po.supplier_name}</TableCell>
                    <TableCell>{formatDate(po.order_date)}</TableCell>
                    <TableCell>
                      {po.expected_delivery_date ? formatDate(po.expected_delivery_date) : 'N/A'}
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
                        label={po.receiving_status}
                        size="small"
                        color={getReceivingStatusColor(po.receiving_status)}
                      />
                    </TableCell>
                    <TableCell>{po.payment_terms}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Receive Items">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedPO(po);
                              setReceiveDialog(true);
                            }}
                          >
                            <InventoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Add Payment">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedPO(po);
                              setPaymentDialog(true);
                            }}
                          >
                            <PaymentIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Create PO Dialog */}
        <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Create Purchase Order</Typography>
              <IconButton onClick={() => setCreateDialog(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={3}>
              {/* Supplier Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Supplier *</InputLabel>
                  <Select
                    value={formData.supplier_id}
                    label="Supplier *"
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value as number })}
                  >
                    <MenuItem value={0}>Select Supplier</MenuItem>
                    {suppliers.map((supplier) => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        {supplier.name} - {supplier.contact_person}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Order Date */}
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="Order Date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Expected Delivery */}
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="Expected Delivery"
                  value={formData.expected_delivery_date || ''}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Payment Terms */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Terms</InputLabel>
                  <Select
                    value={formData.payment_terms}
                    label="Payment Terms"
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value as any })}
                  >
                    <MenuItem value="Immediate">Immediate</MenuItem>
                    <MenuItem value="Net 30">Net 30</MenuItem>
                    <MenuItem value="Custom">Custom</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Custom Payment Terms */}
              {formData.payment_terms === 'Custom' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Custom Payment Terms"
                    value={formData.custom_payment_terms || ''}
                    onChange={(e) => setFormData({ ...formData, custom_payment_terms: e.target.value })}
                  />
                </Grid>
              )}

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Add Items Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>Add Items</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Product</InputLabel>
                      <Select
                        value={currentItem.product_id}
                        label="Product"
                        onChange={(e) => {
                          const productId = e.target.value as number;
                          const product = products.find(p => p.id === productId);
                          if (product) {
                            setCurrentItem({
                              ...currentItem,
                              product_id: productId,
                              product_name: product.name,
                              sku: product.sku,
                              unit_price: product.cost_price
                            });
                          }
                        }}
                      >
                        <MenuItem value={0}>Select Product</MenuItem>
                        {products.map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Quantity"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Unit Price"
                      value={currentItem.unit_price}
                      onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₱</InputAdornment>
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddItem}
                    >
                      Add Item
                    </Button>
                  </Grid>
                </Grid>
              </Grid>

              {/* Items List */}
              <Grid item xs={12}>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Unit Price</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {formData.items.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="right" sx={{ fontWeight: 600 }}>
                            Total:
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCurrency(formData.total_amount)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* File Upload */}
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AttachFileIcon />}
                >
                  Attach Invoice/Document
                  <input
                    type="file"
                    hidden
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </Button>
                {selectedFile && (
                  <Typography variant="caption" sx={{ ml: 2 }}>
                    {selectedFile.name}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleCreatePO}
              disabled={loading}
            >
              Create Purchase Order
            </Button>
          </DialogActions>
        </Dialog>

        {/* Receive Items Dialog */}
        <Dialog open={receiveDialog} onClose={() => setReceiveDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Receive Items - {selectedPO?.order_number}
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the quantities received for each item. You can perform partial receiving.
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Ordered</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Already Received</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Receive Now</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedPO?.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">0</TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          sx={{ width: 100 }}
                          inputProps={{ min: 0, max: item.quantity }}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 0;
                            setReceivingSession({
                              ...receivingSession,
                              items: [
                                ...receivingSession.items.filter(i => i.product_id !== item.product_id),
                                {
                                  product_id: item.product_id,
                                  product_name: item.product_name,
                                  quantity_received: qty
                                }
                              ]
                            });
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notes"
              sx={{ mt: 2 }}
              value={receivingSession.notes || ''}
              onChange={(e) => setReceivingSession({ ...receivingSession, notes: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReceiveDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={handleReceiveItems}
              disabled={loading}
            >
              Confirm Receipt
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
    </LocalizationProvider>
  );
};

export default PurchaseOrdersNew;
