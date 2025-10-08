import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Paper,
  Chip,
  Fab,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  InputAdornment,
  ButtonGroup,
  useTheme,
  alpha,
  Tooltip,
  CircularProgress,
  Avatar,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add,
  Remove,
  Delete,
  Receipt,
  ShoppingCart,
  Search,
  QrCodeScanner,
  Payment,
  Print,
  AccessTime,
  Warning,
  Clear,
  KeyboardArrowUp,
  KeyboardArrowDown,
  Refresh,
  OfflinePin,
  CloudSync,
  CameraAlt,
  ShoppingBag,
  LocalOffer,
  AttachMoney,
  TrendingUp,
  Person,
  CheckCircle
} from '@mui/icons-material';
import { useCashierPOS } from '../contexts/CashierPOSContext';

interface CartItem {
  id: number;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  unit: string;
  brand?: string;
  discount?: number;
}

const POS: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [note, setNote] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ 
    open: false, message: '', severity: 'success' 
  });
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // F2 - Focus search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F3 - Clear cart
      if (e.key === 'F3') {
        e.preventDefault();
        clearCart();
      }
      // F4 - Complete sale
      if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        processSale();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart]);

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    if (discountType === 'percent') {
      return (subtotal * discount) / 100;
    }
    return discount;
  };

  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - calculateDiscount());
  };

  const addSplitPayment = () => {
    const remaining = getRemainingAmount();
    if (remaining > 0) {
      setSplitPayments([...splitPayments, { method: 'CASH', amount: 0 }]);
    }
  };

  const updateSplitPayment = (index: number, field: 'method' | 'amount', value: string | number) => {
    const updated = [...splitPayments];
    if (field === 'method') {
      updated[index].method = value as string;
    } else {
      updated[index].amount = Number(value);
    }
    setSplitPayments(updated);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const getTotalPaid = () => {
    return splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getRemainingAmount = () => {
    return calculateTotal() - getTotalPaid();
  };

  const toggleSplitPayment = () => {
    if (!isSplitPayment) {
      // Enable split payment with first payment method
      setSplitPayments([{ method: 'CASH', amount: 0 }]);
    } else {
      // Disable split payment
      setSplitPayments([]);
    }
    setIsSplitPayment(!isSplitPayment);
  };

  // Perform product search (includes brand and name matching on backend)
  const { searchProducts } = useCashierPOS();

  // Debounced live search: calls backend as the user types and updates `searchResults`.
  useEffect(() => {
    const term = searchTerm.trim();

    // If search box is empty, clear results and avoid requests
    if (!term) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchProducts(term);
        setSearchResults(results);
      } catch (err) {
        console.error('Live search failed', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handle);
  }, [searchTerm, searchProducts]);

  // Immediate search (Enter key) - uses the same underlying searchProducts
  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setIsSearching(true);
    try {
      const results = await searchProducts(term);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
      setSnackbar({ open: true, message: `Increased ${product.name} quantity`, severity: 'success' });
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.selling_price,
        quantity: 1,
        unit: product.unit
      }]);
      setSnackbar({ open: true, message: `Added ${product.name} to cart`, severity: 'success' });
    }
    
    // Clear search after adding
    setSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(id);
      return;
    }
    
    setCart(cart.map(item =>
      item.id === id
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setDiscount(0);
    setNote('');
    setIsSplitPayment(false);
    setSplitPayments([]);
    setSnackbar({ open: true, message: 'Cart cleared', severity: 'info' });
  };

  const processSale = async () => {
    if (cart.length === 0) return;

    // Validate split payment
    if (isSplitPayment) {
      const totalPaid = getTotalPaid();
      const totalDue = calculateTotal();
      
      if (totalPaid < totalDue) {
        setSnackbar({ 
          open: true, 
          message: `Payment incomplete! Still need $${(totalDue - totalPaid).toFixed(2)}`, 
          severity: 'error' 
        });
        return;
      }
    }

    setIsProcessing(true);
    try {
      // Prepare payment data
      const paymentData = isSplitPayment 
        ? { 
            isSplit: true, 
            payments: splitPayments,
            totalPaid: getTotalPaid()
          }
        : { 
            isSplit: false, 
            method: paymentMethod 
          };

      // Simulate API call
      const saleData = {
        customerName,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
          name: item.name,
          price: item.price
        })),
        payment: paymentData,
        paymentMethod: isSplitPayment ? 'SPLIT' : paymentMethod,
        discount: discount,
        discountType: discountType,
        subtotal: calculateSubtotal(),
        discountAmount: calculateDiscount(),
        total: calculateTotal(),
        note: note
      };

      // Mock successful sale
      setLastSale({
        saleNumber: `SALE-${Date.now()}`,
        ...saleData,
        cashier: user?.username,
        saleDate: new Date().toISOString()
      });

      clearCart();
      setShowReceipt(true);
    } catch (error) {
      console.error('Sale processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: '#f7f8fA',
        minHeight: '100vh',
        '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiPaper-root, & .MuiTableCell-root': {
          fontSize: '14px !important',
        },
        p: 3,
      }}
    >
      {/* Header with Stats */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>
            Point of Sale
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Press F2 to search • F3 to clear • F4 to complete sale
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Card sx={{ px: 2, py: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ShoppingBag color="primary" />
              <Box>
                <Typography variant="caption" color="text.secondary">Items</Typography>
                <Typography variant="h6">{cart.reduce((sum, item) => sum + item.quantity, 0)}</Typography>
              </Box>
            </Stack>
          </Card>
          <Card sx={{ px: 2, py: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AttachMoney color="success" />
              <Box>
                <Typography variant="caption" color="text.secondary">Total</Typography>
                <Typography variant="h6" color="success.main">${calculateTotal().toFixed(2)}</Typography>
              </Box>
            </Stack>
          </Card>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Product Search and Scanner */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  label="Search products or scan barcode"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter') { handleSearch(); } }}
                  placeholder="Enter product name, SKU, brand, or barcode"
                  inputRef={searchInputRef}
                  autoFocus
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        {isSearching && <CircularProgress size={20} />}
                      </InputAdornment>
                    )
                  }}
                />
                <Tooltip title="Scan barcode">
                  <Button
                    variant="outlined"
                    startIcon={<CameraAlt />}
                    sx={{ minWidth: 120 }}
                  >
                    Scan
                  </Button>
                </Tooltip>
              </Box>
              
              {searchTerm && searchResults.length === 0 && !isSearching && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No products found. Try a different search term.
                </Alert>
              )}

              {/* Search results */}
              {searchResults.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {searchResults.length} product{searchResults.length > 1 ? 's' : ''} found
                  </Typography>
                  <TableContainer sx={{ maxHeight: 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Price</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Stock</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {searchResults.map(product => (
                          <TableRow 
                            key={product.id} 
                            hover 
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                            onDoubleClick={() => addToCart(product)}
                          >
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">{product.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {product.brand && `${product.brand} • `}{product.category_name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip label={product.sku} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                ${Number(product.selling_price || 0).toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={product.current_stock ?? 0} 
                                size="small" 
                                color={product.current_stock > 10 ? 'success' : product.current_stock > 0 ? 'warning' : 'error'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Button 
                                size="small" 
                                variant="contained" 
                                onClick={() => addToCart(product)} 
                                startIcon={<Add />}
                                disabled={product.current_stock <= 0}
                              >
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {!searchTerm && searchResults.length === 0 && (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
                  <Search sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    Start typing to search for products
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Or scan a barcode to quickly add items
                  </Typography>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Shopping Cart */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 16 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShoppingBag /> Shopping Cart
                </Typography>
                {cart.length > 0 && (
                  <Chip 
                    label={`${cart.reduce((sum, item) => sum + item.quantity, 0)} items`} 
                    color="primary" 
                    size="small"
                  />
                )}
              </Box>

              {cart.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
                  <ShoppingBag sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Cart is empty
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Add products to start a transaction
                  </Typography>
                </Paper>
              ) : (
                <>
                  <List sx={{ maxHeight: 300, overflow: 'auto', mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    {cart.map((item, index) => (
                      <React.Fragment key={item.id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          sx={{ py: 1.5 }}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => removeFromCart(item.id)} size="small" color="error">
                              <Delete />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight="medium" gutterBottom>
                                {item.name}
                              </Typography>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {item.brand && `${item.brand} • `}{item.sku}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                    <Remove sx={{ fontSize: 16 }} />
                                  </IconButton>
                                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 20, textAlign: 'center' }}>
                                    {item.quantity}
                                  </Typography>
                                  <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                    <Add sx={{ fontSize: 16 }} />
                                  </IconButton>
                                  <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>×</Typography>
                                  <Typography variant="body2" fontWeight="medium">
                                    ${Number(item.price || 0).toFixed(2)}
                                  </Typography>
                                  <Typography variant="body2" color="primary.main" fontWeight="bold" sx={{ ml: 'auto' }}>
                                    = ${(item.price * item.quantity).toFixed(2)}
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>

                  <Divider sx={{ my: 2 }} />

                  {/* Discount Controls */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="medium" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocalOffer fontSize="small" /> Discount
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                        >
                          <MenuItem value="percent">Percentage</MenuItem>
                          <MenuItem value="fixed">Fixed Amount</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={discount || ''}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        placeholder={discountType === 'percent' ? '0%' : '$0.00'}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {discountType === 'percent' ? '%' : '$'}
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Stack>
                  </Box>

                  {/* Payment Method */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight="medium" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AttachMoney fontSize="small" /> Payment Method
                      </Typography>
                      <Button
                        size="small"
                        variant={isSplitPayment ? 'contained' : 'outlined'}
                        onClick={toggleSplitPayment}
                        sx={{ fontSize: '0.7rem', py: 0.5 }}
                      >
                        {isSplitPayment ? 'Single Payment' : 'Split Payment'}
                      </Button>
                    </Box>

                    {!isSplitPayment ? (
                      <FormControl fullWidth size="small">
                        <Select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                          <MenuItem value="CASH">💵 Cash</MenuItem>
                          <MenuItem value="CARD">💳 Card</MenuItem>
                          <MenuItem value="GCASH">📱 GCash</MenuItem>
                          <MenuItem value="MAYA">📱 Maya</MenuItem>
                          <MenuItem value="BANK_TRANSFER">🏦 Bank Transfer</MenuItem>
                        </Select>
                      </FormControl>
                    ) : (
                      <Box>
                        {splitPayments.map((payment, index) => (
                          <Box key={index} sx={{ mb: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <FormControl size="small" sx={{ minWidth: 110 }}>
                                <Select
                                  value={payment.method}
                                  onChange={(e) => updateSplitPayment(index, 'method', e.target.value)}
                                >
                                  <MenuItem value="CASH">💵 Cash</MenuItem>
                                  <MenuItem value="CARD">💳 Card</MenuItem>
                                  <MenuItem value="GCASH">📱 GCash</MenuItem>
                                  <MenuItem value="MAYA">📱 Maya</MenuItem>
                                  <MenuItem value="BANK_TRANSFER">🏦 Bank</MenuItem>
                                </Select>
                              </FormControl>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                value={payment.amount || ''}
                                onChange={(e) => updateSplitPayment(index, 'amount', e.target.value)}
                                placeholder="Amount"
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                }}
                              />
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => removeSplitPayment(index)}
                                disabled={splitPayments.length === 1}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Box>
                        ))}
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, p: 1, bgcolor: getTotalPaid() >= calculateTotal() ? 'success.light' : 'warning.light', borderRadius: 1 }}>
                          <Typography variant="caption" fontWeight="bold">
                            {getTotalPaid() >= calculateTotal() ? '✓ Paid:' : 'Remaining:'}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold" color={getTotalPaid() >= calculateTotal() ? 'success.dark' : 'warning.dark'}>
                            ${getTotalPaid() >= calculateTotal() ? getTotalPaid().toFixed(2) : getRemainingAmount().toFixed(2)}
                          </Typography>
                        </Box>

                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          startIcon={<Add />}
                          onClick={addSplitPayment}
                          disabled={getRemainingAmount() <= 0}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          Add Payment Method
                        </Button>
                      </Box>
                    )}
                  </Box>

                  {/* Customer Note */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="medium" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Person fontSize="small" /> Customer / Notes
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add customer name or transaction notes..."
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Totals */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        ${calculateSubtotal().toFixed(2)}
                      </Typography>
                    </Box>
                    {discount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="success.main">
                          Discount ({discountType === 'percent' ? `${discount}%` : 'Fixed'}):
                        </Typography>
                        <Typography variant="body2" color="success.main" fontWeight="medium">
                          -${calculateDiscount().toFixed(2)}
                        </Typography>
                      </Box>
                    )}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" fontWeight="bold">Total:</Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary.main">
                        ${calculateTotal().toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Action Buttons */}
                  <Stack spacing={1}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<CheckCircle />}
                      onClick={processSale}
                      disabled={isProcessing || (isSplitPayment && getTotalPaid() < calculateTotal())}
                      sx={{ 
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        bgcolor: 'success.main',
                        '&:hover': { bgcolor: 'success.dark' }
                      }}
                    >
                      {isProcessing ? <CircularProgress size={24} /> : 'Complete Sale (F4)'}
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Clear />}
                      onClick={clearCart}
                      color="error"
                    >
                      Clear Cart (F3)
                    </Button>
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onClose={() => setShowReceipt(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h5">Sale Completed!</Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {lastSale && (
            <Paper elevation={3} sx={{ p: 3, fontFamily: 'monospace', bgcolor: 'grey.50' }}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  HARDWARE STORE
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sale #{lastSale.saleNumber}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(lastSale.saleDate).toLocaleString()}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  Cashier: {lastSale.cashier}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                ITEMS:
              </Typography>
              {lastSale.items?.map((item: any, index: number) => (
                <Box key={index} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight="medium">
                      {item.name}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${(Number(item.price) * item.quantity).toFixed(2)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {item.quantity} × ${Number(item.price).toFixed(2)} each
                  </Typography>
                </Box>
              ))}
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">${calculateSubtotal().toFixed(2)}</Typography>
                </Box>
                {discount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="success.main">
                      Discount ({discountType === 'percent' ? `${discount}%` : 'Fixed'}):
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      -${calculateDiscount().toFixed(2)}
                    </Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight="bold">TOTAL:</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.main">
                    ${Number(lastSale.total || 0).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  PAYMENT:
                </Typography>
                {lastSale.payment?.isSplit ? (
                  <Box>
                    {lastSale.payment.payments.map((payment: any, index: number) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {payment.method}:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          ${Number(payment.amount).toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight="bold">
                        Total Paid:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        ${Number(lastSale.payment.totalPaid).toFixed(2)}
                      </Typography>
                    </Box>
                    {lastSale.payment.totalPaid > lastSale.total && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="body2" color="success.main">
                          Change:
                        </Typography>
                        <Typography variant="body2" color="success.main" fontWeight="bold">
                          ${(lastSale.payment.totalPaid - lastSale.total).toFixed(2)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Method: <strong>{lastSale.paymentMethod}</strong>
                  </Typography>
                )}
                {note && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Notes: {note}
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ textAlign: 'center', mt: 3, pt: 2, borderTop: '2px dashed', borderColor: 'divider' }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Thank you for your business!
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Please come again
                </Typography>
              </Box>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button 
            variant="outlined" 
            onClick={() => setShowReceipt(false)} 
            startIcon={<Clear />}
          >
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => window.print()} 
            startIcon={<Print />}
          >
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default POS;