import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Grid,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  ButtonGroup,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  InputAdornment,
  Autocomplete
} from '@mui/material';
import {
  LocalAtm,
  CreditCard,
  Smartphone,
  AccountBalance,
  Receipt,
  AttachMoney,
  CheckCircle,
  Cancel,
  Delete,
  Add,
  QrCode2,
  AccountBalanceWallet,
  Person
} from '@mui/icons-material';
import axios from 'axios';
import { useNotification } from '../hooks/useNotification';

interface PaymentMethod {
  code: string;
  name: string;
  requires_reference: boolean;
}

interface PaymentSplit {
  payment_method_code: string;
  amount: number;
  reference_number?: string | null;
}

interface Customer {
  id: number;
  customer_code?: string;
  customer_name: string;
  current_balance?: number;
  credit_limit?: number;
  phone?: string;
  email?: string;
}

interface EnhancedPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  customerName?: string;
  onPaymentComplete: (paymentData: {
    paymentSplits: PaymentSplit[];
    customerAccountId?: number | null;
    customerName?: string | null;
  }) => void;
}

const EnhancedPaymentDialog: React.FC<EnhancedPaymentDialogProps> = ({
  open,
  onClose,
  totalAmount,
  customerName: customerNameProp,
  onPaymentComplete,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Current payment being added
  const [currentMethod, setCurrentMethod] = useState<string>('CASH');
  const [currentAmount, setCurrentAmount] = useState<string>('');
  const [currentReference, setCurrentReference] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [showChange, setShowChange] = useState(false);
  const [customerName, setCustomerName] = useState<string>(customerNameProp || '');
  
  // Split payment state
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number; reference?: string }>>([]);

  const { showNotification } = useNotification();

  // Calculate totals - only recorded tender (cashReceived) counts toward completion
  const tendered = isSplitPayment ? getSplitTotalPaid() : cashReceived;
  const totalPaid = tendered && tendered >= totalAmount ? totalAmount : 0;
  const remaining = Math.max(0, totalAmount - totalPaid);
  const canComplete = isSplitPayment ? (getSplitTotalPaid() >= totalAmount) : (!!tendered && tendered >= totalAmount);
  const change = tendered && tendered > totalAmount ? tendered - totalAmount : 0;
  
  // Split payment helpers
  function getSplitTotalPaid() {
    return splitPayments.reduce((sum, p) => sum + p.amount, 0);
  }
  
  function getSplitRemaining() {
    return Math.max(0, totalAmount - getSplitTotalPaid());
  }
  
  function addSplitPayment() {
    if (getSplitRemaining() > 0) {
      setSplitPayments([...splitPayments, { method: 'CASH', amount: 0, reference: '' }]);
    }
  }
  
  function updateSplitPayment(index: number, field: 'method' | 'amount' | 'reference', value: any) {
    const updated = [...splitPayments];
    if (field === 'amount') {
      updated[index].amount = Number(value);
    } else if (field === 'method') {
      updated[index].method = value;
      updated[index].reference = '';
    } else {
      updated[index].reference = value;
    }
    setSplitPayments(updated);
  }
  
  function removeSplitPayment(index: number) {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  }
  
  function toggleSplitPayment() {
    if (!isSplitPayment) {
      setSplitPayments([]);
    } else {
      setSplitPayments([]);
    }
    setIsSplitPayment(!isSplitPayment);
  }

  // Available payment methods with icons
  const availableMethods = [
    { code: 'CASH', label: 'Cash', icon: <LocalAtm />, color: 'success' as const },
    { code: 'AR', label: 'A/R (Credit)', icon: <Person />, color: 'warning' as const },
    { code: 'GCASH', label: 'GCash', icon: <Smartphone />, color: 'info' as const },
    { code: 'BANK_TRANSFER', label: 'Bank Transfer', icon: <AccountBalance />, color: 'secondary' as const },
    { code: 'QR_PH', label: 'QR PH', icon: <QrCode2 />, color: 'info' as const },
    { code: 'CREDIT_CARD', label: 'Credit Card', icon: <CreditCard />, color: 'primary' as const },
    { code: 'CHECK', label: 'Check', icon: <AccountBalanceWallet />, color: 'secondary' as const }
  ];

  const quickCashAmounts = [20, 50, 100, 200, 500, 1000];

  const suggestNearest = (amt: number) => {
    if (amt <= 50) return 50;
    if (amt < 100) return 100;
    if (amt < 1000) return Math.ceil(amt / 100) * 100;
    if (amt < 10000) return Math.ceil(amt / 1000) * 1000;
    return Math.ceil(amt / 10000) * 10000;
  };

  useEffect(() => {
    if (open) {
      fetchPaymentMethods();
      fetchCustomers();
      // Reset state
      setCurrentMethod('CASH');
      setCurrentAmount(totalAmount.toFixed(2));
      setCurrentReference('');
      setSelectedCustomer(null);
      setCustomerName(customerNameProp || '');
      setError('');
      setCashReceived(0);
      setShowChange(false);
      setIsSplitPayment(false);
      setSplitPayments([]);
    }
  }, [open, totalAmount, customerNameProp]);

  useEffect(() => {
    // Ensure currentAmount stays at least the totalAmount when dialog opens
    if (parseFloat(currentAmount || '0') < totalAmount) {
      setCurrentAmount(totalAmount.toFixed(2));
    }
  }, [totalAmount]);

  const fetchPaymentMethods = async () => {
    try {
      const methods: PaymentMethod[] = availableMethods.map(m => ({
        code: m.code,
        name: m.label,
        requires_reference: !['CASH', 'AR'].includes(m.code)
      }));
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Failed to load payment methods');
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/customers/with-ar');
      setCustomers(response.data.customers || response.data || []);
    } catch (error) {
      console.error('Failed to load customers');
    }
  };

  const handleMethodChange = (methodCode: string) => {
    setCurrentMethod(methodCode);
    setCurrentReference('');
    if (methodCode === 'AR') {
      setSelectedCustomer(null);
      // Auto-focus customer dropdown
      setTimeout(() => {
        const customerInput = document.querySelector('input[placeholder="Search by code or name"]') as HTMLInputElement;
        if (customerInput) {
          customerInput.focus();
        }
      }, 100);
    }
  };

  const handleQuickCash = (amount: number) => {
    setCurrentAmount(amount.toString());
    setCashReceived(amount);
    setShowChange(amount > totalAmount);
    setCurrentMethod('CASH');
  };
  // No partial payments mode: we don't collect multiple applied payments anymore

  const handleComplete = async () => {
    // Enforce full payment only
    if (!canComplete) {
      const needed = isSplitPayment ? getSplitRemaining() : (totalAmount - (cashReceived || 0));
      setError(`Payment incomplete! Still need ₱${needed.toFixed(2)}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      let paymentSplits: PaymentSplit[];
      let customerAccountId: number | null = null;
      
      if (isSplitPayment) {
        // Build payment splits from split payment entries
        paymentSplits = splitPayments.map(sp => ({
          payment_method_code: sp.method,
          amount: sp.amount,
          reference_number: sp.reference || null
        }));
        
        // Check if any payment is AR
        const arPayment = splitPayments.find(sp => sp.method === 'AR');
        if (arPayment) {
          customerAccountId = selectedCustomer?.id ?? null;
        }
      } else {
        // Single payment mode
        paymentSplits = [
          {
            payment_method_code: currentMethod,
            amount: totalAmount,
            reference_number: currentReference ? currentReference : null
          }
        ];
        customerAccountId = currentMethod === 'AR' ? selectedCustomer?.id ?? null : null;
      }

      await onPaymentComplete({
        paymentSplits,
        customerAccountId,
        customerName: customerName || null
      });

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const getMethodIcon = (code: string) => {
    const method = availableMethods.find(m => m.code === code);
    return method?.icon || <AttachMoney />;
  };

  const getMethodColor = (code: string) => {
    const method = availableMethods.find(m => m.code === code);
    return method?.color || 'default';
  };

  const currentMethodDef = paymentMethods.find(m => m.code === currentMethod);
  const currentMethodInfo = availableMethods.find(m => m.code === currentMethod);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachMoney color="primary" />
          <Typography variant="h6">Process Payment</Typography>
          {loading && <CircularProgress size={20} />}
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Payment Status */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                Payment Status
              </Typography>
              {customerName && (
                <Box sx={{ mb: 2, p: 1, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person color="info" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Customer</Typography>
                      <Typography variant="body2" fontWeight="bold">{customerName}</Typography>
                    </Box>
                  </Box>
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Total Due:</Typography>
                  <Typography>₱{totalAmount.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Cash Given:</Typography>
                  <Typography>₱{(cashReceived || 0).toFixed(2)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography fontWeight="bold">Change:</Typography>
                  <Typography fontWeight="bold" color={change > 0 ? 'success.main' : 'text.primary'}>
                    ₱{change.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Payments Applied List - Below Payment Status (Only in Split Payment Mode) */}
            {isSplitPayment && splitPayments.length > 0 && (
              <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Payments Applied
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                  {splitPayments.map((payment, index) => {
                    const methodInfo = availableMethods.find(m => m.code === payment.method);
                    return (
                      <Box 
                        key={index} 
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {methodInfo?.icon}
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {methodInfo?.label || payment.method}
                            </Typography>
                            {payment.reference && (
                              <Typography variant="caption" color="text.secondary">
                                Ref: {payment.reference}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" fontWeight="bold">
                            ₱{Number(payment.amount || 0).toFixed(2)}
                          </Typography>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeSplitPayment(index)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                
                <Divider sx={{ mb: 1 }} />
                
                {/* Payment Summary */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Total Amount:</Typography>
                    <Typography fontWeight="bold">₱{totalAmount.toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Total Paid:</Typography>
                    <Typography fontWeight="bold" color="success.main">
                      ₱{getSplitTotalPaid().toFixed(2)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight="bold">
                      {getSplitTotalPaid() >= totalAmount ? 'Change:' : 'Remaining:'}
                    </Typography>
                    <Typography 
                      fontWeight="bold" 
                      color={getSplitTotalPaid() >= totalAmount ? 'success.main' : 'error.main'}
                    >
                      ₱{getSplitTotalPaid() >= totalAmount 
                        ? (getSplitTotalPaid() - totalAmount).toFixed(2)
                        : getSplitRemaining().toFixed(2)
                      }
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}
          </Grid>

          {/* Payment Methods */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Payment Method</Typography>
              <Button
                size="small"
                variant={isSplitPayment ? 'contained' : 'outlined'}
                onClick={toggleSplitPayment}
                sx={{ fontSize: '0.75rem' }}
              >
                {isSplitPayment ? 'Single Payment' : 'Split Payment'}
              </Button>
            </Box>

            {!isSplitPayment ? (
              <>
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  {availableMethods.map((method) => (
                    <Grid item xs={6} sm={4} key={method.code}>
                      <Button
                        fullWidth
                        variant={currentMethod === method.code ? 'contained' : 'outlined'}
                        onClick={() => handleMethodChange(method.code)}
                        startIcon={method.icon}
                        color={currentMethod === method.code ? method.color : 'inherit'}
                        size="small"
                        sx={{ py: 1 }}
                      >
                        {method.label}
                      </Button>
                    </Grid>
                  ))}
                </Grid>

                {/* Quick Cash Buttons */}
                {currentMethod === 'CASH' && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>Quick Cash Amounts:</Typography>
                    <Grid container spacing={1}>
                      {quickCashAmounts.map((amount) => (
                        <Grid item xs={4} key={amount}>
                          <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => handleQuickCash(amount)}
                            size="small"
                            sx={{
                              bgcolor: amount >= remaining ? 'success.50' : 'transparent',
                              '&:hover': { bgcolor: 'success.100' }
                            }}
                          >
                            ₱{amount}
                          </Button>
                        </Grid>
                      ))}
                      <Grid item xs={4}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={() => handleQuickCash(suggestNearest(remaining))}
                          size="small"
                          color="success"
                        >
                          ₱{suggestNearest(remaining)}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Amount Input */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                  <TextField
                    fullWidth
                    label={`Amount (${currentMethodInfo?.label})`}
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setCurrentAmount(totalAmount.toFixed(2))}
                    size="small"
                    sx={{ minWidth: '80px' }}
                  >
                    Exact
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => {
                      const amt = parseFloat(currentAmount || '0');
                      if (amt > 0) {
                        setCashReceived(amt);
                        setShowChange(amt > totalAmount);
                      }
                }}
                size="small"
              >
                Given
              </Button>
            </Box>

            {/* Reference Number */}
            {currentMethodDef?.requires_reference && (
              <TextField
                fullWidth
                label={
                  currentMethod === 'CREDIT_CARD' ? 'Card Last 4 Digits' :
                  currentMethod === 'CHECK' ? 'Check Number' :
                  currentMethod === 'GCASH' ? 'GCash Reference' :
                  'Transaction Reference'
                }
                value={currentReference}
                onChange={(e) => setCurrentReference(e.target.value)}
                sx={{ mb: 2 }}
                placeholder="Enter reference number"
              />
            )}

            {/* Customer Selection for AR */}
            {currentMethod === 'AR' && (
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => {
                  if (option.customer_code) {
                    const owed = Number(option.current_balance || 0);
                    return `${option.customer_code} - ${option.customer_name} (Owes: ₱${owed.toFixed(2)})`;
                  }
                  return option.customer_name;
                }}
                value={selectedCustomer}
                onChange={(_, newValue) => {
                  setSelectedCustomer(newValue);
                  setCustomerName(newValue ? newValue.customer_name : '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Customer"
                    placeholder="Search by code or name"
                    required
                  />
                )}
                sx={{ mb: 2 }}
              />
            )}
              </>
            ) : (
              <>
                {/* Split Payment - Single Payment Method Interface */}
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  {availableMethods.map((method) => (
                    <Grid item xs={6} sm={4} key={method.code}>
                      <Button
                        fullWidth
                        variant={currentMethod === method.code ? 'contained' : 'outlined'}
                        onClick={() => handleMethodChange(method.code)}
                        startIcon={method.icon}
                        color={currentMethod === method.code ? method.color : 'inherit'}
                        size="small"
                        sx={{ py: 1 }}
                      >
                        {method.label}
                      </Button>
                    </Grid>
                  ))}
                </Grid>

                {/* Quick Cash Buttons for Split Payment */}
                {currentMethod === 'CASH' && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>Quick Cash Amounts:</Typography>
                    <Grid container spacing={1}>
                      {quickCashAmounts.map((amount) => (
                        <Grid item xs={4} key={amount}>
                          <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => setCurrentAmount(amount.toString())}
                            size="small"
                            sx={{
                              bgcolor: amount >= getSplitRemaining() ? 'success.50' : 'transparent',
                              '&:hover': { bgcolor: 'success.100' }
                            }}
                          >
                            ₱{amount}
                          </Button>
                        </Grid>
                      ))}
                      <Grid item xs={4}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={() => setCurrentAmount(suggestNearest(getSplitRemaining()).toString())}
                          size="small"
                          color="success"
                        >
                          ₱{suggestNearest(getSplitRemaining())}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Amount Input */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                  <TextField
                    fullWidth
                    label={`Amount (${currentMethodInfo?.label})`}
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setCurrentAmount(getSplitRemaining().toFixed(2))}
                    size="small"
                    sx={{ minWidth: '80px' }}
                  >
                    Exact
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => {
                      const amt = parseFloat(currentAmount || '0');
                      if (amt > 0) {
                        // Add to split payments
                        setSplitPayments([...splitPayments, {
                          method: currentMethod,
                          amount: amt,
                          reference: currentReference || undefined
                        }]);
                        // Reset form
                        setCurrentAmount('');
                        setCurrentReference('');
                        setCurrentMethod('CASH');
                      }
                    }}
                    disabled={!currentAmount || parseFloat(currentAmount) <= 0 || getSplitRemaining() <= 0}
                    size="small"
                  >
                    Given
                  </Button>
                </Box>

                {/* Reference Number */}
                {currentMethodDef?.requires_reference && (
                  <TextField
                    fullWidth
                    label={
                      currentMethod === 'CREDIT_CARD' ? 'Card Last 4 Digits' :
                      currentMethod === 'CHECK' ? 'Check Number' :
                      currentMethod === 'GCASH' ? 'GCash Reference' :
                      'Transaction Reference'
                    }
                    value={currentReference}
                    onChange={(e) => setCurrentReference(e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="Enter reference number"
                  />
                )}

                {/* Customer Selection for AR */}
                {currentMethod === 'AR' && (
                  <Autocomplete
                    options={customers}
                    getOptionLabel={(option) => 
                      `${option.customer_code} - ${option.customer_name} (Credit: ₱${((option.credit_limit || 0) - (option.current_balance || 0)).toFixed(2)})`
                    }
                    value={selectedCustomer}
                    onChange={(_, newValue) => {
                      setSelectedCustomer(newValue);
                      setCustomerName(newValue ? newValue.customer_name : '');
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Customer"
                        placeholder="Search by code or name"
                      />
                    )}
                    sx={{ mb: 2 }}
                  />
                )}

              </>
            )}

            {/* No Add Payment button in single-tender flow */}
          </Grid>
        </Grid>

        {/* Applied payments removed - single-tender flow only */}
      </DialogContent>

      <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
        <Button
          onClick={onClose}
          size="large"
          startIcon={<Cancel />}
          disabled={loading}
        >
          Cancel
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={!canComplete || loading}
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
            color="success"
            sx={{ minWidth: 200 }}
          >
            {loading ? 'Processing...' : `Complete Sale (₱${totalAmount.toFixed(2)})`}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedPaymentDialog;
