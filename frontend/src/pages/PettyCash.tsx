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
  Card,
  CardContent
} from '@mui/material';
import { Add as AddIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import PageContainer from '../components/common/PageContainer';
import { useNotification } from '../hooks/useNotification';
import axios from 'axios';

interface PettyCashTransaction {
  id: number;
  transaction_number: string;
  transaction_type: 'fund' | 'advance' | 'replenish' | 'return';
  amount: number;
  balance_after: number;
  purpose: string;
  employee_name?: string;
  status: string;
  transaction_date: string;
  processed_by_name: string;
}

const TRANSACTION_TYPES = [
  { value: 'fund', label: 'Fund (Add Money)' },
  { value: 'advance', label: 'Cash Advance' },
  { value: 'replenish', label: 'Replenish' },
  { value: 'return', label: 'Return Advance' }
];

const PettyCash: React.FC = () => {
  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    transactionType: 'fund' as 'fund' | 'advance' | 'replenish' | 'return',
    amount: '',
    purpose: '',
    employeeName: '',
    notes: ''
  });

  const { showNotification } = useNotification();

  const fetchBalance = async () => {
    try {
      const response = await axios.get('/api/petty-cash/balance');
      setCurrentBalance(response.data.balance);
    } catch (error: any) {
      console.error('Failed to load balance:', error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/petty-cash', {
        params: { page: page + 1, limit: pageSize }
      });
      setTransactions(response.data.transactions);
      setTotalCount(response.data.pagination.total);
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, [page, pageSize]);

  const handleSubmit = async () => {
    try {
      const payload = {
        transactionType: formData.transactionType,
        amount: parseFloat(formData.amount),
        purpose: formData.purpose,
        employeeName: formData.employeeName || null,
        notes: formData.notes || null
      };

      await axios.post('/api/petty-cash', payload);
      showNotification('Transaction recorded successfully', 'success');
      setDialogOpen(false);
      setFormData({
        transactionType: 'fund',
        amount: '',
        purpose: '',
        employeeName: '',
        notes: ''
      });
      fetchBalance();
      fetchTransactions();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'Failed to record transaction', 'error');
    }
  };

  const columns: GridColDef[] = [
    { field: 'transaction_number', headerName: 'Transaction #', width: 150 },
    {
      field: 'transaction_date',
      headerName: 'Date',
      width: 160,
      valueFormatter: (params) => new Date(params.value).toLocaleString()
    },
    {
      field: 'transaction_type',
      headerName: 'Type',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const color =
          params.value === 'fund' || params.value === 'replenish' || params.value === 'return'
            ? 'success'
            : 'warning';
        return <Chip label={params.value} color={color} size="small" />;
      }
    },
    { field: 'purpose', headerName: 'Purpose', width: 250, flex: 1 },
    { field: 'employee_name', headerName: 'Employee', width: 150 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      type: 'number',
      valueFormatter: (params) => `₱${params.value?.toFixed(2)}`
    },
    {
      field: 'balance_after',
      headerName: 'Balance After',
      width: 130,
      type: 'number',
      valueFormatter: (params) => `₱${params.value?.toFixed(2)}`
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams) => {
        const color = params.value === 'settled' ? 'success' : params.value === 'active' ? 'info' : 'error';
        return <Chip label={params.value} color={color} size="small" />;
      }
    },
    { field: 'processed_by_name', headerName: 'Processed By', width: 130 }
  ];

  return (
    <PageContainer>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Current Balance</Typography>
              <Typography variant="h3" color="primary">₱{currentBalance.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Quick Actions</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setDialogOpen(true)}
                >
                  New Transaction
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <DataGrid
        rows={transactions}
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Petty Cash Transaction</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Transaction Type"
                value={formData.transactionType}
                onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as any })}
                required
              >
                {TRANSACTION_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Purpose"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                multiline
                rows={2}
                required
              />
            </Grid>
            {formData.transactionType === 'advance' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Employee Name"
                  value={formData.employeeName}
                  onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                  required
                />
              </Grid>
            )}
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.amount || !formData.purpose}
          >
            Record Transaction
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default PettyCash;
