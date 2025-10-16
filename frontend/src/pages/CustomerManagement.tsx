import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Grid,
  Tabs,
  Tab,
  Chip,
  Paper,
  Divider
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Visibility as ViewIcon,
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  PeopleAlt as AllCustomersIcon,
  AccountBalance as ARIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import PageContainer from '../components/common/PageContainer';
import { useNotification } from '../hooks/useNotification';
import axios from 'axios';

// Unified Customer Interface (includes A/R data if applicable)
interface Customer {
  id: number;
  customer_name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  total_purchases: number;
  last_purchase_date?: string;
  created_at: string;
  // A/R fields (from customer_accounts join)
  customer_code?: string;
  current_balance?: number;
  credit_limit?: number;
  is_active?: boolean;
  transaction_count?: number;
}

// AR Transaction Interface
interface ARTransaction {
  id: number;
  transaction_type: string;
  amount: number;
  balance_after: number;
  transaction_date: string;
  notes?: string;
  customer_name?: string;
  phone?: string;
  sale_number?: string;
  sale_id?: number;
  processed_by_name?: string;
}

// Purchase History Interface
interface PurchaseHistory {
  id: number;
  sale_number: string;
  sale_date: string;
  total_amount: number;
  payment_method: string;
  cashier_username: string;
  item_count: number;
}

const CustomerManagement: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { showNotification } = useNotification();

  // Unified Customers State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerHistoryDialogOpen, setCustomerHistoryDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [arTransactionsDialogOpen, setArTransactionsDialogOpen] = useState(false);
  const [partialPaymentDialogOpen, setPartialPaymentDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<ARTransaction | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [arTransactions, setArTransactions] = useState<ARTransaction[]>([]);

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    notes: ''
  });

  const [partialPaymentForm, setPartialPaymentForm] = useState({
    amount: '',
    notes: ''
  });

  // Fetch Customers (unified - includes A/R data)
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const endpoint = tabValue === 0 ? '/api/customers' : '/api/customers/with-ar';
      const response = await axios.get(endpoint, {
        params: {
          page: page + 1,
          limit: pageSize,
          search: search || undefined,
          hasArOnly: tabValue === 1 // Filter only customers with A/R accounts for tab 2
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setCustomers(response.data.customers || []);
      setTotal(response.data.pagination?.total || response.data.customers?.length || 0);
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when tab changes or page changes
  useEffect(() => {
    fetchCustomers();
  }, [tabValue, page, pageSize, search]);

  // Regular Customer Handlers
  const handleSaveCustomer = async () => {
    if (!editingCustomer?.customer_name?.trim()) {
      showNotification('Customer name is required', 'error');
      return;
    }

    try {
      if (editingCustomer.id) {
        await axios.put(`/api/customers/${editingCustomer.id}`, editingCustomer, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        showNotification('Customer updated successfully', 'success');
      } else {
        await axios.post('/api/customers/find-or-create', {
          customerName: editingCustomer.customer_name,
          phone: editingCustomer.phone,
          email: editingCustomer.email
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        showNotification('Customer added successfully', 'success');
      }
      setCustomerDialogOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to save customer', 'error');
    }
  };

  const handleViewCustomerHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerHistoryDialogOpen(true);
    try {
      const response = await axios.get(`/api/customers/${customer.id}/history`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPurchaseHistory(response.data.sales || []);
    } catch (error: any) {
      showNotification('Failed to load purchase history', 'error');
    }
  };

  // View A/R Transactions for customer
  const handleViewArTransactions = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setArTransactionsDialogOpen(true);
    try {
      const response = await axios.get(`/api/customers/${customer.id}/ar-transactions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Update selected customer with latest balance from response
      if (response.data.current_balance !== undefined) {
        setSelectedCustomer({
          ...customer,
          current_balance: response.data.current_balance,
          credit_limit: response.data.credit_limit || customer.credit_limit
        });
      }
      
      setArTransactions(response.data.transactions || []);
    } catch (error: any) {
      showNotification('Failed to load A/R transactions', 'error');
    }
  };

  // Refresh customer data after payment
  const refreshCustomerData = async (customerId: number) => {
    try {
      const response = await axios.get(`/api/customers/${customerId}/ar-transactions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data) {
        const updatedCustomer: Customer = {
          id: customerId,
          customer_name: response.data.customer_name || selectedCustomer?.customer_name || '',
          current_balance: response.data.current_balance || 0,
          credit_limit: response.data.credit_limit || selectedCustomer?.credit_limit || 0,
          phone: response.data.phone || selectedCustomer?.phone,
          email: response.data.email || selectedCustomer?.email,
          total_purchases: response.data.total_purchases || selectedCustomer?.total_purchases || 0,
          created_at: response.data.created_at || selectedCustomer?.created_at || '',
          transaction_count: response.data.transaction_count || selectedCustomer?.transaction_count
        };
        
        setSelectedCustomer(updatedCustomer);
        setArTransactions(response.data.transactions || []);
      }
    } catch (error: any) {
      console.error('Failed to refresh customer data:', error);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomer) return;

    try {
      const response = await axios.post(`/api/customers/${selectedCustomer.id}/ar-transactions`, {
        transactionType: 'payment',
        amount: parseFloat(paymentForm.amount),
        paymentMethod: 'CASH',
        notes: paymentForm.notes || null
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      showNotification(`Payment of ₱${paymentForm.amount} recorded successfully`, 'success');
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: '', notes: '' });
      
      // Refresh customer data and transactions
      await fetchCustomers();
      await refreshCustomerData(selectedCustomer.id);
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to record payment', 'error');
    }
  };

  const handlePartialPayment = async () => {
    if (!selectedCustomer || !selectedTransaction) return;

    const paymentAmount = parseFloat(partialPaymentForm.amount);
    if (paymentAmount <= 0) {
      showNotification('Payment amount must be greater than 0', 'error');
      return;
    }

    try {
      const response = await axios.post(`/api/customers/${selectedCustomer.id}/ar-transactions`, {
        transactionType: 'payment',
        amount: paymentAmount,
        paymentMethod: 'CASH',
        notes: partialPaymentForm.notes || `Payment for ${selectedTransaction.sale_number || 'transaction'}`,
        saleId: selectedTransaction.sale_id || null
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      showNotification(`Payment of ₱${paymentAmount.toFixed(2)} recorded successfully`, 'success');
      setPartialPaymentDialogOpen(false);
      setPartialPaymentForm({ amount: '', notes: '' });
      setSelectedTransaction(null);
      
      // Refresh customer data and transactions
      await fetchCustomers();
      await refreshCustomerData(selectedCustomer.id);
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to record payment', 'error');
    }
  };

  // Customer Columns (Tab 1: All Customers)
  const allCustomersColumns: GridColDef[] = [
    { field: 'customer_name', headerName: 'Customer Name', width: 250, flex: 1 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    { field: 'email', headerName: 'Email', width: 200 },
    {
      field: 'total_purchases',
      headerName: 'Total Purchases',
      width: 150,
      type: 'number',
      valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`
    },
    {
      field: 'last_purchase_date',
      headerName: 'Last Purchase',
      width: 150,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : 'Never'
    },
    {
      field: 'has_ar',
      headerName: 'A/R Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        params.row.customer_code ? (
          <Chip label="A/R Active" size="small" color="primary" />
        ) : null
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleViewCustomerHistory(params.row)}
            title="View Purchase History"
          >
            <HistoryIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setEditingCustomer(params.row);
              setCustomerDialogOpen(true);
            }}
            title="Edit Customer"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  // A/R Customers Columns (Tab 2: Only customers with A/R accounts)
  const arCustomersColumns: GridColDef[] = [
    { 
      field: 'customer_name', 
      headerName: 'Customer Name', 
      width: 250, 
      flex: 1,
      renderCell: (params: GridRenderCellParams) => (
        <Box
          sx={{ 
            cursor: 'pointer', 
            color: 'primary.main',
            fontWeight: 'medium',
            '&:hover': { textDecoration: 'underline' }
          }}
          onClick={() => handleViewArTransactions(params.row)}
        >
          {params.value}
        </Box>
      )
    },
    { field: 'phone', headerName: 'Phone', width: 130 },
    {
      field: 'current_balance',
      headerName: 'Balance',
      width: 130,
      type: 'number',
      valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`,
      cellClassName: (params) => (params.value || 0) > 0 ? 'text-warning' : ''
    },
    {
      field: 'credit_limit',
      headerName: 'Credit Limit',
      width: 130,
      type: 'number',
      valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`
    },
    {
      field: 'available_credit',
      headerName: 'Available',
      width: 130,
      valueGetter: (params) => (params.row.credit_limit || 0) - (params.row.current_balance || 0),
      valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`
    },
    {
      field: 'transaction_count',
      headerName: 'Transactions',
      width: 120,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={`${params.value || 0} txns`} 
          size="small" 
          color="info"
          variant="outlined"
        />
      )
    },
    {
      field: 'total_purchases',
      headerName: 'Total Purchases',
      width: 150,
      type: 'number',
      valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleViewArTransactions(params.row)}
            title="View A/R Transactions"
          >
            <ViewIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleViewCustomerHistory(params.row)}
            title="Purchase History"
          >
            <HistoryIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedCustomer(params.row);
              setPaymentDialogOpen(true);
            }}
            title="Record Payment"
            color="primary"
          >
            <PaymentIcon fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  return (
    <PageContainer>
      {/* Tabs - Sales Style */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="All Customers" icon={<AllCustomersIcon />} />
          <Tab label="A/R Customers" icon={<ARIcon />} />
        </Tabs>
      </Box>

      {/* Search and Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
        <TextField
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ width: 400 }}
        />
        {tabValue === 0 && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              setEditingCustomer({ customer_name: '' });
              setCustomerDialogOpen(true);
            }}
          >
            Add Customer
          </Button>
        )}
      </Box>

      {/* DataGrid */}
      <DataGrid
        rows={customers}
        columns={tabValue === 0 ? allCustomersColumns : arCustomersColumns}
        paginationModel={{ page, pageSize }}
        onPaginationModelChange={(model) => {
          setPage(model.page);
          setPageSize(model.pageSize);
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        rowCount={total}
        paginationMode="server"
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        sx={{ bgcolor: 'background.paper' }}
      />

      {/* Add/Edit Regular Customer Dialog */}
      <Dialog open={customerDialogOpen} onClose={() => setCustomerDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCustomer?.id ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Customer Name"
                value={editingCustomer?.customer_name || ''}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, customer_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={editingCustomer?.phone || ''}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editingCustomer?.email || ''}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={editingCustomer?.address || ''}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={editingCustomer?.notes || ''}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveCustomer}
            variant="contained"
            disabled={!editingCustomer?.customer_name?.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Customer Purchase History Dialog */}
      <Dialog 
        open={customerHistoryDialogOpen} 
        onClose={() => setCustomerHistoryDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Purchase History - {selectedCustomer?.customer_name}
        </DialogTitle>
        <DialogContent>
          {selectedCustomer && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total Purchases: <strong>₱{Number(selectedCustomer.total_purchases || 0).toFixed(2)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last Purchase: {selectedCustomer.last_purchase_date ? 
                  new Date(selectedCustomer.last_purchase_date).toLocaleString() : 'Never'}
              </Typography>
            </Box>
          )}
          <DataGrid
            rows={purchaseHistory}
            columns={[
              { field: 'sale_number', headerName: 'Sale #', width: 180 },
              { 
                field: 'sale_date', 
                headerName: 'Date', 
                width: 150,
                valueFormatter: (params) => new Date(params.value).toLocaleDateString()
              },
              { 
                field: 'total_amount', 
                headerName: 'Amount', 
                width: 120,
                valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`
              },
              { field: 'payment_method', headerName: 'Payment', width: 120 },
              { field: 'cashier_username', headerName: 'Cashier', width: 120 },
              { field: 'item_count', headerName: 'Items', width: 80, type: 'number' }
            ]}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[5, 10, 20]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* A/R Transactions Dialog */}
      <Dialog open={arTransactionsDialogOpen} onClose={() => setArTransactionsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          A/R Transaction History - {selectedCustomer?.customer_name}
        </DialogTitle>
        <DialogContent>
          {selectedCustomer && (
            <Box sx={{ mb: 3, mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary">Customer Name</Typography>
                    <Typography variant="h6" fontWeight="medium">
                      {selectedCustomer.customer_name}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: selectedCustomer.current_balance && selectedCustomer.current_balance > 0 ? 'warning.50' : 'success.50' }}>
                    <Typography variant="body2" color="text.secondary">Current Balance (Debt Owed)</Typography>
                    <Typography variant="h5" color={selectedCustomer.current_balance && selectedCustomer.current_balance > 0 ? 'warning.main' : 'success.main'} fontWeight="bold">
                      ₱{Number(selectedCustomer.current_balance || 0).toFixed(2)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary">Credit Limit</Typography>
                    <Typography variant="h6" fontWeight="medium">
                      ₱{Number(selectedCustomer.credit_limit || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Available: ₱{(Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.current_balance || 0)).toFixed(2)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Transaction History</Typography>
            {selectedCustomer && selectedCustomer.current_balance && selectedCustomer.current_balance > 0 && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<PaymentIcon />}
                onClick={() => {
                  setPaymentDialogOpen(true);
                }}
              >
                Pay Full Balance (₱{Number(selectedCustomer.current_balance).toFixed(2)})
              </Button>
            )}
          </Box>
          <DataGrid
            rows={arTransactions}
            columns={[
              { 
                field: 'transaction_date', 
                headerName: 'Date & Time', 
                width: 160,
                valueFormatter: (params) => new Date(params.value).toLocaleString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              },
              { 
                field: 'transaction_type', 
                headerName: 'Type', 
                width: 100,
                renderCell: (params: GridRenderCellParams) => (
                  <Chip
                    label={params.value?.toUpperCase()}
                    size="small"
                    color={params.value === 'payment' ? 'success' : params.value === 'charge' ? 'warning' : 'default'}
                  />
                )
              },
              { 
                field: 'amount', 
                headerName: 'Amount', 
                width: 120,
                type: 'number',
                valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`,
                cellClassName: (params) => 
                  params.row.transaction_type === 'payment' ? 'text-success' : 'text-warning'
              },
              { 
                field: 'balance_after', 
                headerName: 'Balance After', 
                width: 130,
                type: 'number',
                valueFormatter: (params) => `₱${Number(params.value || 0).toFixed(2)}`
              },
              { 
                field: 'sale_number', 
                headerName: 'Sale #', 
                width: 120
              },
              { 
                field: 'notes', 
                headerName: 'Notes', 
                flex: 1,
                minWidth: 150
              },
              {
                field: 'actions',
                headerName: 'Action',
                width: 100,
                sortable: false,
                renderCell: (params: GridRenderCellParams) => (
                  params.row.transaction_type === 'charge' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<PaymentIcon />}
                      onClick={() => {
                        setSelectedTransaction(params.row);
                        setPartialPaymentForm({
                          amount: params.row.amount.toString(),
                          notes: `Payment for ${params.row.sale_number || 'transaction'}`
                        });
                        setPartialPaymentDialogOpen(true);
                      }}
                    >
                      Pay
                    </Button>
                  ) : null
                )
              }
            ]}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArTransactionsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Partial Payment Dialog */}
      <Dialog open={partialPaymentDialogOpen} onClose={() => setPartialPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment for Transaction</DialogTitle>
        <DialogContent>
          {selectedTransaction && selectedCustomer && (
            <Box sx={{ mb: 2, mt: 1 }}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Customer</Typography>
                    <Typography variant="body1" fontWeight="medium">{selectedCustomer.customer_name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Current Balance</Typography>
                    <Typography variant="body1" fontWeight="medium" color="warning.main">
                      ₱{Number(selectedCustomer.current_balance || 0).toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Sale Number</Typography>
                    <Typography variant="body1">{selectedTransaction.sale_number || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Transaction Amount</Typography>
                    <Typography variant="body1">₱{Number(selectedTransaction.amount || 0).toFixed(2)}</Typography>
                  </Grid>
                </Grid>
              </Paper>
              <TextField
                fullWidth
                label="Payment Amount"
                type="number"
                value={partialPaymentForm.amount}
                onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, amount: e.target.value })}
                InputProps={{ startAdornment: '₱' }}
                sx={{ mb: 2 }}
                helperText="Enter the amount to pay (can be partial or full)"
                required
              />
              <TextField
                fullWidth
                label="Notes"
                value={partialPaymentForm.notes}
                onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPartialPaymentDialogOpen(false);
            setSelectedTransaction(null);
            setPartialPaymentForm({ amount: '', notes: '' });
          }}>Cancel</Button>
          <Button
            onClick={handlePartialPayment}
            variant="contained"
            disabled={!partialPaymentForm.amount || parseFloat(partialPaymentForm.amount) <= 0}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* AR Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Full Payment</DialogTitle>
        <DialogContent>
          {selectedCustomer && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Customer</Typography>
              <Typography variant="h6">{selectedCustomer.customer_name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Current Balance: <strong>₱{Number(selectedCustomer.current_balance || 0).toFixed(2)}</strong>
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            label="Payment Amount"
            type="number"
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            InputProps={{ startAdornment: '₱' }}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Notes"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRecordPayment}
            variant="contained"
            disabled={!paymentForm.amount}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default CustomerManagement;
