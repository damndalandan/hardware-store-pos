import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Typography,
  Grid,
  Tab,
  Tabs
} from '@mui/material';
import {
  Add as AddIcon,
  Payment as PaymentIcon,
  Visibility as ViewIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import PageContainer from '../components/common/PageContainer';
import { useNotification } from '../hooks/useNotification';
import axios from 'axios';

interface CustomerAccount {
  id: number;
  customer_code: string;
  customer_name: string;
  phone?: string;
  email?: string;
  current_balance: number;
  credit_limit: number;
  is_active: boolean;
}

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
  processed_by_name?: string;
}

const CustomerAccounts: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<ARTransaction[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  
  // For all transactions view
  const [allTransactions, setAllTransactions] = useState<ARTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsTotalCount, setTransactionsTotalCount] = useState(0);
  const [transactionsPage, setTransactionsPage] = useState(0);
  const [transactionsPageSize, setTransactionsPageSize] = useState(25);
  const [transactionsSearchText, setTransactionsSearchText] = useState('');

  const [newCustomerForm, setNewCustomerForm] = useState({
    customerCode: '',
    customerName: '',
    phone: '',
    email: '',
    creditLimit: '5000'
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    notes: ''
  });

  const { showNotification } = useNotification();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/customers/with-ar', {
        params: {
          page: page + 1,
          limit: pageSize,
          search: searchText || undefined,
          hasArOnly: false
        }
      });
      setCustomers(response.data.customers);
      setTotalCount(response.data.pagination.total);
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, pageSize, searchText]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchAllTransactions();
    }
  }, [transactionsPage, transactionsPageSize, transactionsSearchText, activeTab]);

  const fetchAllTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const response = await axios.get('/api/customers/ar-transactions/all', {
        params: {
          page: transactionsPage + 1,
          limit: transactionsPageSize,
          search: transactionsSearchText || undefined
        }
      });
      setAllTransactions(response.data.transactions);
      setTransactionsTotalCount(response.data.pagination.total);
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to load transactions', 'error');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    try {
      const payload = {
        customerName: newCustomerForm.customerName,
        customerCode: newCustomerForm.customerCode || null,
        phone: newCustomerForm.phone || null,
        email: newCustomerForm.email || null,
        creditLimit: parseFloat(newCustomerForm.creditLimit)
      };

      await axios.post('/api/customers', payload);
      showNotification('Customer created successfully', 'success');
      setDialogOpen(false);
      setNewCustomerForm({
        customerCode: '',
        customerName: '',
        phone: '',
        email: '',
        creditLimit: '5000'
      });
      fetchCustomers();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to create customer', 'error');
    }
  };

  const handleViewCustomer = async (customer: CustomerAccount) => {
    setSelectedCustomer(customer);
    try {
      const response = await axios.get(`/api/customers/${customer.id}/ar-transactions`);
      setCustomerTransactions(response.data.transactions || []);
    } catch (error: any) {
      showNotification('Failed to load customer details', 'error');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomer) return;

    try {
      await axios.post(`/api/customers/${selectedCustomer.id}/ar-transactions`, {
        transactionType: 'payment',
        amount: parseFloat(paymentForm.amount),
        paymentMethod: 'CASH',
        notes: paymentForm.notes || null
      });

      showNotification('Payment recorded successfully', 'success');
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: '', notes: '' });
      fetchCustomers();
      if (selectedCustomer) {
        handleViewCustomer(selectedCustomer);
      }
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to record payment', 'error');
    }
  };

  const columns: GridColDef[] = [
    { 
      field: 'customer_code', 
      headerName: 'Code', 
      width: 120,
      valueGetter: (params) => params.row.customer_code || 'N/A'
    },
    { field: 'customer_name', headerName: 'Customer Name', width: 250, flex: 1 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    {
      field: 'current_balance',
      headerName: 'AR Balance',
      width: 130,
      type: 'number',
      valueGetter: (params) => params.row.current_balance || 0,
      valueFormatter: (params) => `₱${(params.value || 0).toFixed(2)}`,
      cellClassName: (params) => (params.value || 0) > 0 ? 'text-warning' : ''
    },
    {
      field: 'credit_limit',
      headerName: 'Credit Limit',
      width: 130,
      type: 'number',
      valueGetter: (params) => params.row.credit_limit || 0,
      valueFormatter: (params) => `₱${(params.value || 0).toFixed(2)}`
    },
    {
      field: 'available_credit',
      headerName: 'Available',
      width: 130,
      valueGetter: (params) => {
        const limit = params.row.credit_limit || 0;
        const balance = params.row.current_balance || 0;
        return limit - balance;
      },
      valueFormatter: (params) => `₱${(params.value || 0).toFixed(2)}`
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
            onClick={() => handleViewCustomer(params.row)}
            title="View Details"
          >
            <ViewIcon fontSize="small" />
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

  const transactionColumns: GridColDef[] = [
    {
      field: 'transaction_date',
      headerName: 'Date',
      width: 160,
      valueFormatter: (params) => new Date(params.value).toLocaleString()
    },
    { 
      field: 'customer_name', 
      headerName: 'Customer', 
      width: 200,
      flex: 1
    },
    {
      field: 'transaction_type',
      headerName: 'Type',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value.toUpperCase()}
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
      valueFormatter: (params) => `₱${params.value.toFixed(2)}`
    },
    {
      field: 'balance_after',
      headerName: 'Balance After',
      width: 130,
      type: 'number',
      valueFormatter: (params) => `₱${params.value.toFixed(2)}`
    },
    {
      field: 'sale_number',
      headerName: 'Sale #',
      width: 120
    },
    {
      field: 'processed_by_name',
      headerName: 'Processed By',
      width: 130
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 200,
      flex: 1
    }
  ];

  return (
    <PageContainer title="Customer Accounts (AR)">
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
        <Tab label="Customers" />
        <Tab label="All AR Transactions" />
      </Tabs>

      {activeTab === 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
            <TextField
              placeholder="Search by name, code, or phone..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="small"
              sx={{ width: 400 }}
            />
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              Add Customer
            </Button>
          </Box>

          <DataGrid
            rows={customers}
            columns={columns}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            rowCount={totalCount}
            paginationMode="server"
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            sx={{ bgcolor: 'background.paper' }}
          />
        </>
      )}

      {activeTab === 1 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
            <TextField
              placeholder="Search by customer name, phone, or sale number..."
              value={transactionsSearchText}
              onChange={(e) => setTransactionsSearchText(e.target.value)}
              size="small"
              sx={{ width: 400 }}
            />
          </Box>

          <DataGrid
            rows={allTransactions}
            columns={transactionColumns}
            paginationModel={{ page: transactionsPage, pageSize: transactionsPageSize }}
            onPaginationModelChange={(model) => {
              setTransactionsPage(model.page);
              setTransactionsPageSize(model.pageSize);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            rowCount={transactionsTotalCount}
            paginationMode="server"
            loading={transactionsLoading}
            autoHeight
            disableRowSelectionOnClick
            sx={{ bgcolor: 'background.paper' }}
          />
        </>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Customer</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Customer Code"
                value={newCustomerForm.customerCode}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customerCode: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Credit Limit"
                type="number"
                value={newCustomerForm.creditLimit}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, creditLimit: e.target.value })}
                InputProps={{ startAdornment: '₱' }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Customer Name"
                value={newCustomerForm.customerName}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customerName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={newCustomerForm.phone}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newCustomerForm.email}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateCustomer}
            variant="contained"
            disabled={!newCustomerForm.customerCode || !newCustomerForm.customerName}
          >
            Create Customer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          {selectedCustomer && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Customer</Typography>
              <Typography variant="h6">{selectedCustomer.customer_name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Current Balance: <strong>₱{selectedCustomer.current_balance.toFixed(2)}</strong>
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

export default CustomerAccounts;
