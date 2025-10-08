import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Grid,
  Card,
  CardContent,
  ButtonGroup,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  Chip,
  InputAdornment,
  Paper,
  CircularProgress
} from '@mui/material';
import {
  LocalAtm,
  CreditCard,
  Smartphone,
  AccountBalance,
  Delete,
  Add,
  Calculate,
  Receipt,
  AttachMoney,
  CheckCircle,
  Warning,
  Cancel
} from '@mui/icons-material';
import { useCashierPOS, Payment } from '../contexts/CashierPOSContext';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  customerInfo: { name: string; email: string };
  onSuccess: () => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  customerInfo,
  onSuccess
}) => {
  const { calculateTotals, processSale, isProcessing, error, clearError } = useCashierPOS();
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentPayment, setCurrentPayment] = useState<Partial<Payment>>({
    method: 'cash',
    amount: 0
  });
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [showChange, setShowChange] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  
  const { subtotal, tax, total } = calculateTotals();
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = cashReceived > 0 ? Math.max(0, cashReceived - total) : 0;

  useEffect(() => {
    if (open) {
      // Reset payment state when dialog opens
      setPayments([]);
      setCurrentPayment({ method: 'cash', amount: remaining });
      setCashReceived(0);
      setShowChange(false);
      setCustomAmount(remaining.toFixed(2));
      clearError();
    }
  }, [open, remaining, clearError]);

  const paymentMethods = [
    { key: 'cash', label: 'Cash', icon: <LocalAtm />, color: 'success' as const },
    { key: 'card', label: 'Card', icon: <CreditCard />, color: 'primary' as const },
    { key: 'mobile', label: 'Mobile Pay', icon: <Smartphone />, color: 'info' as const },
    { key: 'check', label: 'Check', icon: <AccountBalance />, color: 'secondary' as const }
  ];

  const quickAmounts = [5, 10, 20, 50, 100];

  const handlePaymentMethodChange = (method: string) => {
    setCurrentPayment({ 
      ...currentPayment, 
      method: method as Payment['method'],
      amount: remaining 
    });
    setCustomAmount(remaining.toFixed(2));
  };

  const handleAmountChange = (amount: number) => {
    setCurrentPayment({ ...currentPayment, amount });
    setCustomAmount(amount.toFixed(2));
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value) || 0;
    setCurrentPayment({ ...currentPayment, amount: numValue });
  };

  const addPayment = () => {
    if (!currentPayment.method || !currentPayment.amount || currentPayment.amount <= 0) {
      return;
    }

    if (currentPayment.amount > remaining) {
      setCurrentPayment({ ...currentPayment, amount: remaining });
      setCustomAmount(remaining.toFixed(2));
      return;
    }

    const payment: Payment = {
      method: currentPayment.method,
      amount: currentPayment.amount,
      reference: currentPayment.reference
    };

    setPayments([...payments, payment]);
    
    const newRemaining = remaining - currentPayment.amount;
    if (newRemaining > 0) {
      setCurrentPayment({ 
        method: 'cash', 
        amount: newRemaining,
        reference: undefined 
      });
      setCustomAmount(newRemaining.toFixed(2));
    } else {
      setCurrentPayment({ method: 'cash', amount: 0, reference: undefined });
      setCustomAmount('0.00');
    }
  };

  const removePayment = (index: number) => {
    const newPayments = payments.filter((_, i) => i !== index);
    setPayments(newPayments);
    
    const newTotalPaid = newPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const newRemaining = Math.max(0, total - newTotalPaid);
    setCurrentPayment({ 
      method: currentPayment.method || 'cash',
      amount: newRemaining 
    });
    setCustomAmount(newRemaining.toFixed(2));
  };

  const handleQuickCashSelect = (amount: number) => {
    // Just update the amount field, don't process payment yet
    setCustomAmount(amount.toFixed(2));
    setCurrentPayment({ ...currentPayment, amount: amount });
    setCashReceived(amount);
    setShowChange(amount >= total);
  };

  const completeSale = async () => {
    if (totalPaid < total) {
      return;
    }

    const success = await processSale(payments, customerInfo);
    if (success) {
      onSuccess();
    }
  };

  const canAddPayment = (currentPayment.amount || 0) > 0 && remaining > 0;
  const canComplete = totalPaid >= total;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachMoney color="primary" />
          <Typography variant="h6">Process Payment</Typography>
          {isProcessing && <CircularProgress size={20} />}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Order Summary */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: 'primary.50' }}>
              <Typography variant="h6" gutterBottom color="primary">
                <Receipt sx={{ mr: 1, verticalAlign: 'middle' }} />
                Order Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Subtotal:</Typography>
                <Typography>${subtotal.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Tax (8%):</Typography>
                <Typography>${tax.toFixed(2)}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Total:</Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  ${total.toFixed(2)}
                </Typography>
              </Box>
              
              {customerInfo.name && (
                <Typography variant="body2" color="textSecondary">
                  Customer: {customerInfo.name}
                </Typography>
              )}
            </Paper>

            {/* Payment Status */}
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                Payment Status
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Total Due:</Typography>
                <Typography>${total.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Amount Paid:</Typography>
                <Typography color={totalPaid >= total ? 'success.main' : 'text.primary'}>
                  ${totalPaid.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Remaining:</Typography>
                <Typography color={remaining > 0 ? 'warning.main' : 'success.main'}>
                  ${remaining.toFixed(2)}
                </Typography>
              </Box>
              
              {showChange && change > 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  mt: 2, 
                  p: 2, 
                  bgcolor: 'success.50', 
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: 'success.main'
                }}>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    CHANGE DUE:
                  </Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    ${change.toFixed(2)}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Payment Methods */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>Select Payment Method</Typography>
            
            <ButtonGroup fullWidth sx={{ mb: 2 }}>
              {paymentMethods.map((method) => (
                <Button
                  key={method.key}
                  variant={currentPayment.method === method.key ? 'contained' : 'outlined'}
                  onClick={() => handlePaymentMethodChange(method.key)}
                  startIcon={method.icon}
                  sx={{ flex: 1, minWidth: 0 }}
                  color={currentPayment.method === method.key ? method.color : 'inherit'}
                >
                  {method.label}
                </Button>
              ))}
            </ButtonGroup>

            {/* Cash Quick Select */}
            {currentPayment.method === 'cash' && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>Quick Cash Amounts:</Typography>
                <Grid container spacing={1}>
                  {quickAmounts.map((amount) => (
                    <Grid item xs={4} key={amount}>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => handleQuickCashSelect(amount)}
                        size="small"
                        sx={{ 
                          bgcolor: amount >= total ? 'success.50' : 'transparent',
                          '&:hover': { bgcolor: 'success.100' }
                        }}
                      >
                        ${amount}
                      </Button>
                    </Grid>
                  ))}
                  <Grid item xs={4}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleQuickCashSelect(total)}
                      size="small"
                      color="success"
                      startIcon={<CheckCircle />}
                    >
                      Exact
                    </Button>
                  </Grid>
                  <Grid item xs={4}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => handleQuickCashSelect(Math.ceil(total))}
                      size="small"
                      color="info"
                    >
                      ${Math.ceil(total)}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Amount Input */}
            <TextField
              fullWidth
              label={`Amount (${currentPayment.method?.toUpperCase()})`}
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              type="number"
              inputProps={{ min: 0, max: remaining, step: 0.01 }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              sx={{ mb: 2 }}
              error={parseFloat(customAmount) > remaining}
              helperText={parseFloat(customAmount) > remaining ? 'Amount exceeds remaining balance' : ''}
            />

            {/* Reference Number for Card/Check */}
            {(currentPayment.method === 'card' || currentPayment.method === 'check' || currentPayment.method === 'mobile') && (
              <TextField
                fullWidth
                label={
                  currentPayment.method === 'card' ? 'Card Last 4 Digits' :
                  currentPayment.method === 'check' ? 'Check Number' : 
                  'Transaction Reference'
                }
                value={currentPayment.reference || ''}
                onChange={(e) => setCurrentPayment({ 
                  ...currentPayment, 
                  reference: e.target.value 
                })}
                sx={{ mb: 2 }}
                placeholder={
                  currentPayment.method === 'card' ? '1234' :
                  currentPayment.method === 'check' ? '12345' : 
                  'REF123'
                }
              />
            )}

            <Button
              fullWidth
              variant="contained"
              onClick={addPayment}
              disabled={!canAddPayment}
              startIcon={<Add />}
              size="large"
              color="primary"
              sx={{ mb: 2 }}
            >
              Add ${(currentPayment.amount || 0).toFixed(2)} Payment
            </Button>
          </Grid>
        </Grid>

        {/* Applied Payments */}
        {payments.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Applied Payments</Typography>
            <List dense>
              {payments.map((payment, index) => {
                const method = paymentMethods.find(m => m.key === payment.method);
                return (
                  <ListItem 
                    key={index} 
                    sx={{ 
                      bgcolor: 'grey.50', 
                      mb: 1, 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, color: `${method?.color}.main` }}>
                      {method?.icon}
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight="medium">{method?.label}</Typography>
                          <Chip 
                            label={`$${Number(payment.amount).toFixed(2)}`} 
                            color="success"
                            size="small"
                          />
                        </Box>
                      }
                      secondary={payment.reference ? `Ref: ${payment.reference}` : undefined}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => removePayment(index)}
                        color="error"
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
        <Button 
          onClick={onClose} 
          size="large"
          startIcon={<Cancel />}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={completeSale}
            disabled={!canComplete || isProcessing}
            size="large"
            startIcon={isProcessing ? <CircularProgress size={20} /> : <CheckCircle />}
            color="success"
            sx={{ minWidth: 200 }}
          >
            {isProcessing ? 'Processing...' : `Complete Sale ($${total.toFixed(2)})`}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;