import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField, Tab, Tabs,
  Alert, Snackbar, FormControl, InputLabel, Select, MenuItem, Switch,
  FormControlLabel, Divider, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Chip, List, ListItem, ListItemText, Accordion,
  AccordionSummary, AccordionDetails, Checkbox, Badge, Tooltip, 
  TablePagination, InputAdornment, ButtonGroup
} from '@mui/material';
import {
  Add as AddIcon, ShoppingCart as OrderIcon, LocalShipping as SupplierIcon,
  Warning as LowStockIcon, ExpandMore as ExpandMoreIcon, Edit as EditIcon,
  Delete as DeleteIcon, Search as SearchIcon, FilterList as FilterIcon,
  GetApp as ReceiveIcon, Print as PrintIcon, Email as EmailIcon,
  Inventory as StockIcon, TrendingDown as CriticalIcon, CheckCircle as CompleteIcon,
  CheckCircle,
  Schedule as PendingIcon, Cancel as CancelIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Product {
  id: number;
  sku: string;
  name: string;
  brand?: string;
  current_stock: number;
  min_stock_level: number;
  max_stock_level: number;
  cost_price: number;
  unit: string;
  supplier_id: number;
  supplier_name: string;
  category_name?: string;
  stock_status: 'ok' | 'low' | 'critical' | 'out';
  suggested_order_qty: number;
}

interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  products: Product[];
  low_stock_count: number;
  total_products: number;
  estimated_order_value: number;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  order_date: string;
  expected_date?: string;
  received_date?: string;
  total_amount: number;
  item_count: number;
  notes?: string;
  created_by_username: string;
}

interface PurchaseOrderItem {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received_quantity?: number;
}

const PurchaseOrders: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  // Data states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);

  // Filter states
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'critical' | 'out'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  // Dialog states
  const [createOrderDialog, setCreateOrderDialog] = useState(false);
  const [orderPreviewDialog, setOrderPreviewDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suppliersRes, ordersRes] = await Promise.all([
        axios.get('/api/purchase-orders/suppliers-with-stock').catch(err => {
          console.error('Suppliers with stock error:', err);
          throw err;
        }),
        axios.get('/api/purchase-orders').catch(err => {
          console.error('Purchase orders error:', err);
          throw err;
        })
      ]);
      
      setSuppliers(suppliersRes.data.suppliers || []);
      setPurchaseOrders(ordersRes.data.orders || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      setAlert({ message: `Failed to load purchase order data: ${error.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Filter suppliers based on search and stock status
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(supplierSearch.toLowerCase());
    const hasLowStock = stockFilter === 'all' || supplier.low_stock_count > 0;
    return matchesSearch && hasLowStock;
  });

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'error';
      case 'low': return 'warning';
      case 'out': return 'error';
      default: return 'success';
    }
  };

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <CriticalIcon />;
      case 'low': return <LowStockIcon />;
      case 'out': return <CancelIcon />;
      default: return <CheckCircle />;
    }
  };

  const calculateSuggestedOrderQty = (product: Product) => {
    if (product.current_stock >= product.min_stock_level) return 0;
    const deficit = product.min_stock_level - product.current_stock;
    const bufferQty = Math.ceil((product.max_stock_level - product.min_stock_level) * 0.5);
    return deficit + bufferQty;
  };

  const startCreateOrder = (supplier: Supplier) => {
    setSelectedSupplier(supplier.id);
    const lowStockProducts = supplier.products.filter(p => 
      p.stock_status === 'low' || p.stock_status === 'critical' || p.stock_status === 'out'
    );
    setSelectedProducts(lowStockProducts);
    
    // Pre-populate order items with suggested quantities
    const items = lowStockProducts.map(product => ({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      quantity: calculateSuggestedOrderQty(product),
      unit_cost: product.cost_price,
      total_cost: calculateSuggestedOrderQty(product) * product.cost_price,
      received_quantity: 0
    }));
    
    setOrderItems(items);
    setCreateOrderDialog(true);
  };

  const updateOrderItem = (productId: number, field: 'quantity' | 'unit_cost', value: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        const updated = { ...item, [field]: value };
        updated.total_cost = updated.quantity * updated.unit_cost;
        return updated;
      }
      return item;
    }));
  };

  const removeOrderItem = (productId: number) => {
    setOrderItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const createPurchaseOrder = async () => {
    if (!selectedSupplier || orderItems.length === 0) {
      setAlert({ message: 'Please select supplier and add items to order', severity: 'error' });
      return;
    }

    try {
      const totalAmount = orderItems.reduce((sum, item) => sum + item.total_cost, 0);
      
      const orderData = {
        supplier_id: selectedSupplier,
        items: orderItems,
        total_amount: totalAmount,
        notes: `Auto-generated order for low stock items - ${new Date().toLocaleDateString()}`
      };

      await axios.post('/api/purchase-orders', orderData);
      
      setCreateOrderDialog(false);
      setSelectedSupplier(null);
      setOrderItems([]);
      await loadData();
      
      setAlert({ message: 'Purchase order created successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      setAlert({ message: 'Failed to create purchase order', severity: 'error' });
    }
  };

  const renderSupplierStockView = () => (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search suppliers..."
          value={supplierSearch}
          onChange={(e) => setSupplierSearch(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200 }}
        />
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Stock Status</InputLabel>
          <Select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            label="Stock Status"
          >
            <MenuItem value="all">All Suppliers</MenuItem>
            <MenuItem value="low">With Low Stock</MenuItem>
            <MenuItem value="critical">Critical Stock</MenuItem>
          </Select>
        </FormControl>
        
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
        >
          Refresh
        </Button>
      </Box>

      {filteredSuppliers.map((supplier) => (
        <Accordion key={supplier.id} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <SupplierIcon />
              <Typography variant="h6">{supplier.name}</Typography>
              
              {supplier.low_stock_count > 0 && (
                <Badge badgeContent={supplier.low_stock_count} color="error">
                  <LowStockIcon color="warning" />
                </Badge>
              )}
              
              <Box sx={{ flexGrow: 1 }} />
              
              <Chip 
                label={`${supplier.total_products} products`} 
                size="small" 
                variant="outlined" 
              />
              
              {supplier.estimated_order_value > 0 && (
                <Chip 
                  label={`Est. Order: $${supplier.estimated_order_value.toFixed(2)}`} 
                  size="small" 
                  color="primary" 
                />
              )}
            </Box>
          </AccordionSummary>
          
          <AccordionDetails>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Contact: {supplier.contact_person || 'N/A'} | 
                Email: {supplier.email || 'N/A'} | 
                Phone: {supplier.phone || 'N/A'}
              </Typography>
            </Box>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Current Stock</TableCell>
                    <TableCell>Min/Max</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Suggested Qty</TableCell>
                    <TableCell>Unit Cost</TableCell>
                    <TableCell>Est. Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplier.products
                    .filter(product => 
                      stockFilter === 'all' || 
                      (stockFilter === 'low' && ['low', 'critical', 'out'].includes(product.stock_status))
                    )
                    .map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{product.name}</Typography>
                          {product.brand && (
                            <Typography variant="caption" color="text.secondary">
                              {product.brand}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>
                        <Typography 
                          color={product.current_stock <= product.min_stock_level ? 'error' : 'inherit'}
                          fontWeight={product.current_stock <= product.min_stock_level ? 'bold' : 'normal'}
                        >
                          {product.current_stock} {product.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {product.min_stock_level} / {product.max_stock_level}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStockStatusIcon(product.stock_status)}
                          label={product.stock_status.toUpperCase()}
                          color={getStockStatusColor(product.stock_status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="bold">
                          {product.suggested_order_qty} {product.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>${Number(product.cost_price).toFixed(2)}</TableCell>
                      <TableCell>
                        <Typography fontWeight="bold">
                          ${(product.suggested_order_qty * Number(product.cost_price)).toFixed(2)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {supplier.low_stock_count > 0 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<OrderIcon />}
                  onClick={() => startCreateOrder(supplier)}
                  disabled={user?.role === 'cashier'}
                >
                  Create Purchase Order ({supplier.low_stock_count} items)
                </Button>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const renderPurchaseOrdersList = () => {
    const columns: GridColDef[] = [
      { field: 'po_number', headerName: 'PO Number', width: 130 },
      { field: 'supplier_name', headerName: 'Supplier', width: 200 },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        renderCell: (params) => (
          <Chip
            label={params.value.toUpperCase()}
            color={
              params.value === 'received' ? 'success' :
              params.value === 'sent' ? 'info' :
              params.value === 'cancelled' ? 'error' : 'default'
            }
            size="small"
          />
        )
      },
      { field: 'order_date', headerName: 'Order Date', width: 110 },
      { field: 'expected_date', headerName: 'Expected', width: 110 },
      {
        field: 'total_amount',
        headerName: 'Total',
        width: 100,
        renderCell: (params) => `$${Number(params.value).toFixed(2)}`
      },
      { field: 'item_count', headerName: 'Items', width: 80 },
      { field: 'created_by_username', headerName: 'Created By', width: 120 }
    ];

    return (
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={purchaseOrders}
          columns={columns}
          checkboxSelection
          disableRowSelectionOnClick
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25, page: 0 }
            }
          }}
        />
      </Box>
    );
  };

  const tabs = [
    { label: 'Supplier Stock View', icon: <SupplierIcon /> },
  { label: 'Purchase Order', icon: <OrderIcon /> }
  ];

  if (user?.role === 'cashier') {
    return (
  <Box
    sx={{
      backgroundColor: '#f7f8fA',
      minHeight: '100vh',
      '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiPaper-root, & .MuiTableCell-root': {
        fontSize: '14px !important',
      },
  p: 3,
  pt: 1,
    }}
  >
        <Alert severity="error">
          Access denied. Only administrators and managers can access purchase order.
        </Alert>
      </Box>
    );
  }

  return (
  <Box
    sx={{
      backgroundColor: '#f7f8fA',
      minHeight: '100vh',
      '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiPaper-root, & .MuiTableCell-root': {
        fontSize: '14px !important',
      },
  p: 3,
  pt: 1,
    }}
  >
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={(e, value) => setCurrentTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      <Box>
        {currentTab === 0 && renderSupplierStockView()}
        {currentTab === 1 && renderPurchaseOrdersList()}
      </Box>

      {/* Create Purchase Order Dialog */}
      <Dialog 
        open={createOrderDialog} 
        onClose={() => setCreateOrderDialog(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Create Purchase Order</DialogTitle>
        <DialogContent>
          {selectedSupplier && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Supplier: {suppliers.find(s => s.id === selectedSupplier)?.name}
              </Typography>
              
              <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 320, position: 'relative', overflow: 'auto' }}>
                <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Product</TableCell>
                      <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Current Stock</TableCell>
                      <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Quantity to Order</TableCell>
                      <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Unit Cost</TableCell>
                      <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Total</TableCell>
                      <TableCell sx={{ top: 0, position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1400, WebkitBackgroundClip: 'padding-box', backgroundClip: 'padding-box', boxShadow: '-6px 0 12px rgba(0,0,0,0.04)', borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' }} data-field="actions">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderItems.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">{item.product_name}</Typography>
                            <Typography variant="caption">{item.sku}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {selectedProducts.find(p => p.id === item.product_id)?.current_stock || 0}
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateOrderItem(item.product_id, 'quantity', parseInt(e.target.value) || 0)}
                            size="small"
                            inputProps={{ min: 1 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) => updateOrderItem(item.product_id, 'unit_cost', parseFloat(e.target.value) || 0)}
                            size="small"
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight="bold">
                            ${Number(item.total_cost).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell data-field="actions" sx={{ position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1400, WebkitBackgroundClip: 'padding-box', backgroundClip: 'padding-box', boxShadow: '-6px 0 12px rgba(0,0,0,0.04)', borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
                          <IconButton onClick={() => removeOrderItem(item.product_id)} size="small">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="h6">
                  Total Order Value: ${orderItems.reduce((sum, item) => sum + Number(item.total_cost), 0).toFixed(2)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOrderDialog(false)}>Cancel</Button>
          <Button 
            onClick={createPurchaseOrder} 
            variant="contained"
            disabled={orderItems.length === 0}
          >
            Create Purchase Order
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!alert}
        autoHideDuration={6000}
        onClose={() => setAlert(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setAlert(null)} severity={alert?.severity || 'info'}>
          {alert?.message || ''}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PurchaseOrders;