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
  Card,
  CardContent,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress
} from '@mui/material';
import {
  AccessTime,
  AttachMoney,
  Receipt,
  TrendingUp,
  Assessment,
  CheckCircle,
  Warning,
  LocalAtm,
  CreditCard,
  Smartphone,
  AccountBalance,
  Print
} from '@mui/icons-material';
import { useCashierPOS } from '../contexts/CashierPOSContext';

interface ShiftDialogProps {
  open: boolean;
  onClose: () => void;
  type: 'start' | 'end';
}

const ShiftDialog: React.FC<ShiftDialogProps> = ({ open, onClose, type }) => {
  const { 
    currentShift, 
    startShift, 
    endShift, 
    getShiftSummary,
    todaysSales,
    isProcessing,
    error,
    clearError
  } = useCashierPOS();

  const [startingCash, setStartingCash] = useState<string>('100.00');
  const [endingCash, setEndingCash] = useState<string>('');
  const [shiftEnded, setShiftEnded] = useState(false);
  const [endedShiftData, setEndedShiftData] = useState<any>(null);

  const handleStartShift = async () => {
    const amount = parseFloat(startingCash);
    if (isNaN(amount) || amount < 0) {
      return;
    }
    
    await startShift(amount);
    onClose();
  };

  const handleEndShift = async () => {
    const amount = parseFloat(endingCash);
    if (isNaN(amount) || amount < 0) {
      return;
    }
    
    try {
      const endedShift = await endShift(amount);
      setEndedShiftData(endedShift);
      setShiftEnded(true);
    } catch (error) {
      console.error('Failed to end shift');
    }
  };

  const summary = getShiftSummary();
  const expectedCash = currentShift ? 
    currentShift.startingCash + currentShift.totalCash : 0;
  const actualCash = parseFloat(endingCash) || 0;
  const cashDifference = actualCash - expectedCash;

  // Payment method breakdown
  const paymentBreakdown = currentShift ? [
    { method: 'Cash', amount: currentShift.totalCash, icon: <LocalAtm />, color: 'success' },
    { method: 'Card', amount: currentShift.totalCard, icon: <CreditCard />, color: 'primary' },
    { method: 'Mobile', amount: currentShift.totalMobile, icon: <Smartphone />, color: 'info' },
    { method: 'Check', amount: currentShift.totalCheck, icon: <AccountBalance />, color: 'secondary' },
  ] : [];

  const printShiftSummary = () => {
    if (!endedShiftData) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Shift Summary - ${endedShiftData.cashierName}</title>
            <style>
              body { font-family: 'Courier New', monospace; margin: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .section { margin: 15px 0; }
              .row { display: flex; justify-content: space-between; margin: 5px 0; }
              .total { border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; font-weight: bold; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>HARDWARE STORE</h2>
              <h3>SHIFT SUMMARY</h3>
              <p>Cashier: ${endedShiftData.cashierName}</p>
              <p>${new Date(endedShiftData.startTime).toLocaleString()} - ${new Date(endedShiftData.endTime).toLocaleString()}</p>
            </div>
            
            <div class="section">
              <h3>SALES SUMMARY</h3>
              <div class="row"><span>Total Transactions:</span><span>${endedShiftData.totalTransactions}</span></div>
              <div class="row"><span>Total Sales:</span><span>$${Number(endedShiftData.totalSales).toFixed(2)}</span></div>
            </div>
            
            <div class="section">
              <h3>PAYMENT BREAKDOWN</h3>
              <div class="row"><span>Cash:</span><span>$${Number(endedShiftData.totalCash).toFixed(2)}</span></div>
              <div class="row"><span>Card:</span><span>$${Number(endedShiftData.totalCard).toFixed(2)}</span></div>
              <div class="row"><span>Mobile:</span><span>$${Number(endedShiftData.totalMobile).toFixed(2)}</span></div>
              <div class="row"><span>Check:</span><span>$${Number(endedShiftData.totalCheck).toFixed(2)}</span></div>
            </div>
            
            <div class="section">
              <h3>CASH RECONCILIATION</h3>
              <div class="row"><span>Starting Cash:</span><span>$${Number(endedShiftData.startingCash).toFixed(2)}</span></div>
              <div class="row"><span>Cash Sales:</span><span>$${Number(endedShiftData.totalCash).toFixed(2)}</span></div>
              <div class="row"><span>Expected Cash:</span><span>$${(Number(endedShiftData.startingCash) + Number(endedShiftData.totalCash)).toFixed(2)}</span></div>
              <div class="row"><span>Actual Cash:</span><span>$${Number(endedShiftData.endingCash).toFixed(2)}</span></div>
              <div class="total"><span>Cash Difference:</span><span>$${Number(endedShiftData.cashDifference || 0).toFixed(2)}</span></div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p>Shift completed at ${new Date().toLocaleString()}</p>
            </div>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
    }
  };

  const renderStartShiftContent = () => (
    <>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          Starting a new shift will initialize your cash drawer and begin tracking your sales.
        </Alert>

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <AccessTime sx={{ mr: 1, verticalAlign: 'middle' }} />
              Shift Start
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Starting Cash Amount"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                }}
                helperText="Enter the amount of cash in the drawer at the start of your shift"
                sx={{ mb: 2 }}
              />
              
              <Typography variant="body2" color="textSecondary">
                • Count all bills and coins in the cash drawer
                • Include any starting change fund
                • This amount will be tracked for end-of-shift reconciliation
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isProcessing}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleStartShift}
          disabled={isProcessing || !startingCash || parseFloat(startingCash) < 0}
          startIcon={isProcessing ? <CircularProgress size={20} /> : <CheckCircle />}
          color="success"
        >
          {isProcessing ? 'Starting...' : 'Start Shift'}
        </Button>
      </DialogActions>
    </>
  );

  const renderEndShiftContent = () => {
    if (shiftEnded && endedShiftData) {
      return (
        <>
          <DialogContent>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h4" color="success.main" gutterBottom>
                Shift Complete!
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Thank you for your hard work today.
              </Typography>
            </Box>
            
            <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
              <Typography variant="h6" align="center" gutterBottom>
                SHIFT SUMMARY
              </Typography>
              <Typography variant="body2" align="center" gutterBottom color="textSecondary">
                {endedShiftData.cashierName}
              </Typography>
              <Typography variant="body2" align="center" gutterBottom color="textSecondary">
                {new Date(endedShiftData.startTime).toLocaleString()} - {new Date(endedShiftData.endTime).toLocaleString()}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {endedShiftData.totalTransactions}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Transactions
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main" fontWeight="bold">
                      ${Number(endedShiftData.totalSales).toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Sales
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Cash Difference:</Typography>
                <Typography 
                  color={
                    Math.abs(endedShiftData.cashDifference || 0) < 0.01 ? 'success.main' :
                    Math.abs(endedShiftData.cashDifference || 0) <= 5 ? 'warning.main' : 'error.main'
                  }
                  fontWeight="bold"
                >
                  ${(endedShiftData.cashDifference || 0).toFixed(2)}
                  {(endedShiftData.cashDifference || 0) > 0 ? ' (Over)' : 
                   (endedShiftData.cashDifference || 0) < 0 ? ' (Short)' : ' (Perfect)'}
                </Typography>
              </Box>
            </Paper>
          </DialogContent>

          <DialogActions>
            <Button onClick={onClose}>Close</Button>
            <Button 
              variant="contained" 
              onClick={printShiftSummary}
              startIcon={<Print />}
            >
              Print Summary
            </Button>
          </DialogActions>
        </>
      );
    }

    return (
      <>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Ending your shift will close your current session and generate a shift summary.
          </Alert>

          {summary && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Shift Summary
                    </Typography>
                    
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Shift Start" 
                          secondary={new Date(currentShift?.startTime || '').toLocaleString()}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Duration" 
                          secondary={`${Math.round((Date.now() - new Date(currentShift?.startTime || '').getTime()) / (1000 * 60 * 60))} hours`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Total Transactions" 
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">{summary.totalTransactions}</Typography>
                              <Chip size="small" label="transactions" color="primary" />
                            </Box>
                          }
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Total Sales" 
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" color="success.main" fontWeight="bold">
                                ${summary.totalSales.toFixed(2)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>

                {/* Payment Breakdown */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Payment Breakdown
                    </Typography>
                    
                    {paymentBreakdown.map((payment) => (
                      <Box 
                        key={payment.method}
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          mb: 1,
                          p: 1,
                          borderRadius: 1,
                          bgcolor: payment.amount > 0 ? `${payment.color}.50` : 'transparent'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {payment.icon}
                          <Typography>{payment.method}</Typography>
                        </Box>
                        <Typography fontWeight="bold">
                          ${payment.amount.toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Cash Reconciliation
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>Starting Cash:</Typography>
                        <Typography>${summary.shift.startingCash.toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>Cash Sales:</Typography>
                        <Typography>${summary.paymentBreakdown.cash.toFixed(2)}</Typography>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography fontWeight="bold">Expected Cash:</Typography>
                        <Typography fontWeight="bold">
                          ${summary.expectedCash.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <TextField
                      fullWidth
                      label="Actual Cash Count"
                      value={endingCash}
                      onChange={(e) => setEndingCash(e.target.value)}
                      type="number"
                      inputProps={{ min: 0, step: 0.01 }}
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                      }}
                      helperText="Count all cash in the drawer"
                      sx={{ mb: 2 }}
                    />
                    
                    {endingCash && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography>Expected Cash:</Typography>
                          <Typography>${expectedCash.toFixed(2)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography>Actual Cash:</Typography>
                          <Typography>${actualCash.toFixed(2)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography fontWeight="bold">Difference:</Typography>
                          <Typography 
                            fontWeight="bold"
                            color={
                              Math.abs(cashDifference) < 0.01 ? 'success.main' :
                              Math.abs(cashDifference) <= 5 ? 'warning.main' : 'error.main'
                            }
                          >
                            ${cashDifference.toFixed(2)}
                            {cashDifference > 0 ? ' (Over)' : 
                             cashDifference < 0 ? ' (Short)' : ' (Perfect)'}
                          </Typography>
                        </Box>
                        
                        {Math.abs(cashDifference) > 5 && (
                          <Alert 
                            severity="warning" 
                            sx={{ mt: 2 }}
                          >
                            Large cash difference detected. Please recount and verify all transactions.
                          </Alert>
                        )}
                        
                        {Math.abs(cashDifference) < 0.01 && (
                          <Alert 
                            severity="success" 
                            sx={{ mt: 2 }}
                          >
                            Perfect! Cash count matches expected amount.
                          </Alert>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleEndShift}
            disabled={isProcessing || !endingCash || parseFloat(endingCash) < 0}
            color={Math.abs(cashDifference) > 5 ? "warning" : "success"}
            startIcon={isProcessing ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {isProcessing ? 'Ending Shift...' : 'End Shift'}
          </Button>
        </DialogActions>
      </>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={shiftEnded}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime color="primary" />
          <Typography variant="h6">
            {type === 'start' ? 'Start New Shift' : 'End Current Shift'}
          </Typography>
        </Box>
      </DialogTitle>
      
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      
      {type === 'start' && renderStartShiftContent()}
      {type === 'end' && renderEndShiftContent()}
    </Dialog>
  );
};

export default ShiftDialog;