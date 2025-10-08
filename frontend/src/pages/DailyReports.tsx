import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  Payments as PaymentsIcon
} from '@mui/icons-material';
import PageContainer from '../components/common/PageContainer';
import { useNotification } from '../hooks/useNotification';
import axios from 'axios';

interface DailyReport {
  date: string;
  sales: {
    summary: {
      total_transactions: number;
      total_amount: number;
      total_subtotal: number;
      total_tax: number;
      total_discount: number;
    };
    byPaymentMethod: Array<{
      payment_method_code: string;
      payment_method_name: string;
      transaction_count: number;
      total_amount: number;
    }>;
  };
  expenses: {
    summary: {
      total: number;
      count: number;
    };
    byCategory: Array<{
      category: string;
      payment_method: string;
      count: number;
      total_amount: number;
    }>;
  };
  accountsReceivable: {
    transactions: Array<{
      transaction_type: string;
      count: number;
      total_amount: number;
    }>;
    totalCharges: number;
    totalPayments: number;
  };
  cashForDeposit: number;
  shifts: any[];
}

const DailyReports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [reportData, setReportData] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCashier, setSelectedCashier] = useState('');
  const [cashiers, setCashiers] = useState<any[]>([]);

  const { showNotification } = useNotification();
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  const fetchCashiers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      const users = response.data.users || response.data || [];
      setCashiers(users.filter((u: any) => u.role === 'cashier'));
    } catch (error: any) {
      console.error('Failed to load cashiers:', error);
      setCashiers([]);
    }
  };

  const fetchDailyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { date: selectedDate };
      if (selectedCashier) params.cashierId = selectedCashier;

      const response = await axios.get(`${API_BASE_URL}/daily-reports/daily`, { params });
      setReportData(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load report';
      console.error('Failed to load daily report:', error);
      setError(errorMsg);
      showNotification(errorMsg, 'error');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashiers();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchDailyReport();
    }
  }, [selectedDate, selectedCashier]);

  const renderSummaryCards = () => {
    if (!reportData) return null;

    const cards = [
      {
        title: 'Total Sales',
        value: `₱${Number(reportData.sales?.summary?.total_amount || 0).toFixed(2)}`,
        subtitle: `${reportData.sales?.summary?.total_transactions || 0} transactions`,
        icon: <ReceiptIcon fontSize="large" />,
        color: '#4caf50'
      },
      {
        title: 'Total Expenses',
        value: `₱${Number(reportData.expenses?.summary?.total || 0).toFixed(2)}`,
        subtitle: `${reportData.expenses?.summary?.count || 0} expenses`,
        icon: <PaymentsIcon fontSize="large" />,
        color: '#f44336'
      },
      {
        title: 'AR Charges',
        value: `₱${Number(reportData.accountsReceivable?.totalCharges || 0).toFixed(2)}`,
        subtitle: 'Accounts Receivable',
        icon: <AccountBalanceIcon fontSize="large" />,
        color: '#ff9800'
      },
      {
        title: 'Cash for Deposit',
        value: `₱${Number(reportData.cashForDeposit || 0).toFixed(2)}`,
        subtitle: 'Cash - Expenses',
        icon: <TrendingUpIcon fontSize="large" />,
        color: '#2196f3'
      }
    ];

    return (
      <Grid container spacing={3}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{card.title}</Typography>
                    <Typography variant="h5" sx={{ mt: 1 }}>{card.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
                  </Box>
                  <Box sx={{ color: card.color }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const renderPaymentBreakdown = () => {
    if (!reportData || !reportData.sales) return null;

    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Sales by Payment Method</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Payment Method</TableCell>
                  <TableCell align="right">Transactions</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.sales.byPaymentMethod && reportData.sales.byPaymentMethod.length > 0 ? reportData.sales.byPaymentMethod.map((method, index) => (
                  <TableRow key={index}>
                    <TableCell>{method.payment_method_name || method.payment_method_code}</TableCell>
                    <TableCell align="right">{method.transaction_count}</TableCell>
                    <TableCell align="right">₱{Number(method.total_amount).toFixed(2)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No payment method data available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {reportData.sales.byPaymentMethod && reportData.sales.byPaymentMethod.length > 0 && (
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell><strong>Total</strong></TableCell>
                  <TableCell align="right">
                    <strong>{reportData.sales?.summary?.total_transactions || 0}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>₱{Number(reportData.sales?.summary?.total_amount || 0).toFixed(2)}</strong>
                  </TableCell>
                </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };

  const renderExpensesBreakdown = () => {
    if (!reportData || !reportData.expenses || !reportData.expenses.byCategory) return null;

    const expensesByCategory = reportData.expenses.byCategory.reduce((acc: any, exp) => {
      if (!acc[exp.category]) {
        acc[exp.category] = 0;
      }
      acc[exp.category] += Number(exp.total_amount);
      return acc;
    }, {});

    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Expenses by Category</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(expensesByCategory).map(([category, amount], index) => (
                  <TableRow key={index}>
                    <TableCell>{category}</TableCell>
                    <TableCell align="right">₱{(amount as number).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell><strong>Total</strong></TableCell>
                  <TableCell align="right">
                    <strong>₱{Number(reportData.expenses?.summary?.total || 0).toFixed(2)}</strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };

  const renderShiftSummary = () => {
    if (!reportData || !reportData.shifts.length) return null;

    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Shift Summary</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Cashier</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>End Time</TableCell>
                  <TableCell align="right">Starting Cash</TableCell>
                  <TableCell align="right">Ending Cash</TableCell>
                  <TableCell align="right">Total Sales</TableCell>
                  <TableCell align="right">Difference</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.shifts.map((shift, index) => (
                  <TableRow key={index}>
                    <TableCell>{shift.cashier_name}</TableCell>
                    <TableCell>{new Date(shift.start_time).toLocaleTimeString()}</TableCell>
                    <TableCell>
                      {shift.end_time ? new Date(shift.end_time).toLocaleTimeString() : 'Active'}
                    </TableCell>
                    <TableCell align="right">₱{Number(shift.starting_cash).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {shift.ending_cash ? `₱${Number(shift.ending_cash).toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell align="right">₱{Number(shift.total_sales).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {shift.cash_difference !== null ? `₱${Number(shift.cash_difference).toFixed(2)}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <ErrorBoundary>
    <PageContainer>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          type="date"
          label="Report Date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          select
          label="Cashier"
          value={selectedCashier}
          onChange={(e) => setSelectedCashier(e.target.value)}
          size="small"
          sx={{ width: 200 }}
        >
          <MenuItem value="">All Cashiers</MenuItem>
          {cashiers && cashiers.length > 0 && cashiers.map((cashier) => (
            <MenuItem key={cashier.id} value={cashier.id}>
              {cashier.first_name} {cashier.last_name}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={fetchDailyReport} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Typography>Loading...</Typography>
      ) : reportData ? (
        <>
          {renderSummaryCards()}
          {renderPaymentBreakdown()}
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12} md={6}>
              {renderExpensesBreakdown()}
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Accounts Receivable</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>Charges:</Typography>
                      <Typography color="error">
                        ₱{Number(reportData.accountsReceivable?.totalCharges || 0).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>Payments:</Typography>
                      <Typography color="success.main">
                        ₱{Number(reportData.accountsReceivable?.totalPayments || 0).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography><strong>Net AR:</strong></Typography>
                      <Typography>
                        <strong>₱{(Number(reportData.accountsReceivable?.totalCharges || 0) - Number(reportData.accountsReceivable?.totalPayments || 0)).toFixed(2)}</strong>
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          {renderShiftSummary()}
        </>
      ) : (
        <Typography>No data available for selected date</Typography>
      )}
    </PageContainer>
    </ErrorBoundary>
  );
};

export default DailyReports;
