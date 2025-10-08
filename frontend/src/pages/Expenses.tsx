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
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import PageContainer from '../components/common/PageContainer';
import { useNotification } from '../hooks/useNotification';
import axios from 'axios';

interface Expense {
  id: number;
  expense_number: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  expense_date: string;
  vendor_name?: string;
  recorded_by_name: string;
  approved_by_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  'Utilities',
  'Rent',
  'Supplies',
  'Maintenance',
  'Transportation',
  'Food & Beverages',
  'Salaries',
  'Advertising',
  'Miscellaneous'
];

const PAYMENT_METHODS = [
  { code: 'CASH', name: 'Cash' },
  { code: 'BANK_TRANSFER', name: 'Bank Transfer' },
  { code: 'CHECK', name: 'Check' },
  { code: 'CREDIT_CARD', name: 'Credit Card' }
];

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    paymentMethod: 'CASH',
    referenceNumber: '',
    expenseDate: new Date().toISOString().split('T')[0],
    vendorName: '',
    notes: ''
  });

  const { showNotification } = useNotification();

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: page + 1,
        limit: pageSize
      };

      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await axios.get('/api/expenses', { params });
      setExpenses(response.data.expenses);
      setTotalCount(response.data.pagination.total);
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to load expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [page, pageSize, filters]);

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        category: expense.category,
        description: expense.description,
        amount: expense.amount.toString(),
        paymentMethod: expense.payment_method,
        referenceNumber: expense.reference_number || '',
        expenseDate: expense.expense_date.split('T')[0],
        vendorName: expense.vendor_name || '',
        notes: expense.notes || ''
      });
    } else {
      setEditingExpense(null);
      setFormData({
        category: '',
        description: '',
        amount: '',
        paymentMethod: 'CASH',
        referenceNumber: '',
        expenseDate: new Date().toISOString().split('T')[0],
        vendorName: '',
        notes: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber || null,
        expenseDate: formData.expenseDate,
        vendorName: formData.vendorName || null,
        notes: formData.notes || null
      };

      if (editingExpense) {
        await axios.put(`/api/expenses/${editingExpense.id}`, payload);
        showNotification('Expense updated successfully', 'success');
      } else {
        await axios.post('/api/expenses', payload);
        showNotification('Expense created successfully', 'success');
      }

      handleCloseDialog();
      fetchExpenses();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to save expense', 'error');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await axios.put(`/api/expenses/${id}`, { status: 'approved' });
      showNotification('Expense approved', 'success');
      fetchExpenses();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to approve expense', 'error');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await axios.put(`/api/expenses/${id}`, { status: 'rejected' });
      showNotification('Expense rejected', 'success');
      fetchExpenses();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to reject expense', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      await axios.delete(`/api/expenses/${id}`);
      showNotification('Expense deleted', 'success');
      fetchExpenses();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to delete expense', 'error');
    }
  };

  const columns: GridColDef[] = [
    { field: 'expense_number', headerName: 'Expense #', width: 150 },
    { field: 'expense_date', headerName: 'Date', width: 120 },
    { field: 'category', headerName: 'Category', width: 130 },
    { field: 'description', headerName: 'Description', width: 250, flex: 1 },
    { field: 'vendor_name', headerName: 'Vendor', width: 150 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      type: 'number',
      valueFormatter: (params) => `₱${params.value?.toFixed(2)}`
    },
    { field: 'payment_method', headerName: 'Payment', width: 130 },
    { field: 'reference_number', headerName: 'Reference', width: 130 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const color = params.value === 'approved' ? 'success' : params.value === 'rejected' ? 'error' : 'warning';
        return <Chip label={params.value} color={color} size="small" />;
      }
    },
    { field: 'recorded_by_name', headerName: 'Recorded By', width: 130 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          {params.row.status === 'pending' && (
            <>
              <IconButton size="small" onClick={() => handleApprove(params.row.id)} title="Approve">
                <ApproveIcon fontSize="small" color="success" />
              </IconButton>
              <IconButton size="small" onClick={() => handleReject(params.row.id)} title="Reject">
                <RejectIcon fontSize="small" color="error" />
              </IconButton>
            </>
          )}
          <IconButton size="small" onClick={() => handleOpenDialog(params.row)} title="Edit">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(params.row.id)} title="Delete" color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  return (
    <PageContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            select
            label="Category"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            size="small"
            sx={{ width: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            {EXPENSE_CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            size="small"
            sx={{ width: 130 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </TextField>
          <TextField
            type="date"
            label="From"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="To"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Expense
        </Button>
      </Box>

      <DataGrid
        rows={expenses}
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                fullWidth
                label="Expense Date"
                value={formData.expenseDate}
                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                InputProps={{ startAdornment: '₱' }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vendor"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Payment Method"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                required
              >
                {PAYMENT_METHODS.map((method) => (
                  <MenuItem key={method.code} value={method.code}>{method.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Reference Number"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.category || !formData.description || !formData.amount}>
            {editingExpense ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default Expenses;
