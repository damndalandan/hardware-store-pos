import React, { useState, useRef, useEffect } from 'react';
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
  Autocomplete
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
  AttachMoney,
  CheckCircle
} from '@mui/icons-material';
import { useCashierPOS } from '../contexts/CashierPOSContext';
import { useOffline } from '../contexts/OfflineContext';

// Import components we'll create
import EnhancedPaymentDialog from '../components/EnhancedPaymentDialog';
import ShiftDialog from '../components/ShiftDialog';
import ErrorBoundary from '../components/ErrorBoundary';

const POS: React.FC = () => {
  const theme = useTheme();
  const { isOffline } = useOffline();
  const {
    cart,
    addToCart,
    updateCartItem,
    updateCartItemDiscount,
    removeFromCart,
    clearCart,
    calculateTotals,
    searchProducts,
    getProductByBarcode,
    currentSale,
    currentShift,
    printReceipt,
    processEnhancedSale,
    isProcessing,
    error,
    clearError,
    offlineSales,
    syncOfflineSales,
    taxMode,
    setTaxMode,
    discountPercent
  } = useCashierPOS();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [groupedResults, setGroupedResults] = useState<any[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<{ [key: number]: any }>({});
  const [isSearching, setIsSearching] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState<'start' | 'end' | null>(null);
  const [customerInfo, setCustomerInfo] = useState({ name: '' });
  const [customers, setCustomers] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [discountMode, setDiscountMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Fetch customers for autocomplete
  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Auto-sync offline sales when coming back online
  useEffect(() => {
    if (!isOffline && offlineSales.length > 0) {
      syncOfflineSales();
    }
  }, [isOffline, offlineSales.length, syncOfflineSales]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 key for barcode scanner mode
      if (e.key === 'F2') {
        e.preventDefault();
        toggleScanner();
      }
      // F4 key for checkout
      if (e.key === 'F4' && cart.length > 0 && currentShift) {
        e.preventDefault();
        handleCheckout();
      }
      // Escape key to clear search or cart
      if (e.key === 'Escape') {
        if (searchResults.length > 0) {
          setSearchResults([]);
          setSearchTerm('');
        } else if (cart.length > 0) {
          clearCart();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, currentShift, searchResults.length]);

  const toggleScanner = () => {
    setIsScanning(!isScanning);
    if (!isScanning) {
      setSearchTerm('');
      searchInputRef.current?.focus();
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      // Immediate search on Enter: show results but do NOT auto-add to cart
      const results = await searchProducts(searchTerm);
      if (results.length > 0) {
        setSearchResults(results);
      } else {
        setSearchResults([]);
        addNotification('No products found');
      }
    } catch (error) {
      addNotification('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Group products by base name for variant display
  const groupProductsByVariants = (products: any[]) => {
    const groups = new Map<string, any>();
    
    products.forEach(product => {
      // Intelligently group by brand + name (ignore size, variety, color as they are variants)
      // Normalize strings for better matching
      const brandNorm = (product.brand || '').trim().toLowerCase();
      let nameNorm = (product.name || '').trim().toLowerCase();
      
      // Extract base name by removing common variant patterns from the name
      // e.g., "Interior Paint - Beige (1L)" → "interior paint"
      // e.g., "Interior Paint - Light Blue (1L)" → "interior paint"
      
      // Remove patterns like: " - color (size)", " - color", " (size)", " color"
      let baseName = nameNorm;
      
      // Remove size patterns like (1L), (4L), (10m), etc.
      baseName = baseName.replace(/\s*\([^)]*\)\s*$/g, '').trim();
      
      // Remove color/variant suffixes after dash: "Interior Paint - Beige" → "Interior Paint"
      baseName = baseName.replace(/\s*[-–—]\s*[a-z\s]+$/i, '').trim();
      
      // Remove trailing "base" word: "Interior Paint Base" → "Interior Paint"
      baseName = baseName.replace(/\s+base$/i, '').trim();
      
      // Use brand + base name as the primary grouping key
      const baseKey = `${brandNorm}_${baseName}`;
      
      // Extract embedded color/size from original name for variant detection
      const embeddedColor = extractEmbeddedVariant(product.name, baseName, 'color');
      const embeddedSize = extractEmbeddedVariant(product.name, baseName, 'size');
      
      // Use actual field values or extracted embedded values
      const effectiveColor = product.color || embeddedColor;
      const effectiveSize = product.size || embeddedSize;
      
      if (!groups.has(baseKey)) {
        groups.set(baseKey, {
          baseProduct: { ...product, name: capitalizeWords(baseName) }, // Use cleaned base name
          variants: [{ ...product, effectiveColor, effectiveSize }],
          hasSizeVariants: false,
          hasColorVariants: false,
          hasVarietyVariants: false
        });
      } else {
        const group = groups.get(baseKey)!;
        group.variants.push({ ...product, effectiveColor, effectiveSize });
        
        // Detect variant types using both field values and embedded values
        const variantColor = effectiveColor;
        const variantSize = effectiveSize;
        
        if (variantSize && variantSize !== group.variants[0].effectiveSize) {
          group.hasSizeVariants = true;
        }
        if (variantColor && variantColor !== group.variants[0].effectiveColor) {
          group.hasColorVariants = true;
        }
        if (product.variety && product.variety !== group.baseProduct.variety) {
          group.hasVarietyVariants = true;
        }
      }
    });
    
    return Array.from(groups.values());
  };
  
  // Helper function to extract embedded variant info from product name
  const extractEmbeddedVariant = (fullName: string, baseName: string, type: 'color' | 'size'): string | null => {
    if (!fullName || !baseName) return null;
    
    const remaining = fullName.toLowerCase().replace(baseName.toLowerCase(), '').trim();
    
    if (type === 'size') {
      // Extract size patterns like (1L), (4L), (10m), 5m, etc.
      const sizeMatch = remaining.match(/\(([^)]+)\)|(\d+\.?\d*\s*[a-z]+)/i);
      if (sizeMatch) return sizeMatch[1] || sizeMatch[2];
    }
    
    if (type === 'color') {
      // Extract color from patterns like "- Beige", "- Light Blue", "- Off White"
      const colorMatch = remaining.match(/[-–—]\s*([a-z\s]+?)(?:\s*\(|$)/i);
      if (colorMatch) return colorMatch[1].trim();
    }
    
    return null;
  };
  
  // Helper to capitalize words
  const capitalizeWords = (str: string): string => {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Debounced live-search: update results as the user types
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setGroupedResults([]);
      setSelectedVariants({});
      return;
    }

    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchProducts(term);
        setSearchResults(results);
        // Group results for variant display
        const grouped = groupProductsByVariants(results);
        setGroupedResults(grouped);
        
        // Auto-select first variant for each product group
        const preselectedVariants: { [key: number]: any } = {};
        grouped.forEach((group, index) => {
          if (group.variants.length > 0) {
            // Select the first variant with stock if available, otherwise just the first variant
            const variantWithStock = group.variants.find((v: any) => v.current_stock > 0);
            preselectedVariants[index] = variantWithStock || group.variants[0];
          }
        });
        setSelectedVariants(preselectedVariants);
      } catch (err) {
        console.error('Live search failed', err);
        setSearchResults([]);
        setGroupedResults([]);
        setSelectedVariants({});
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [searchTerm, searchProducts]);

  const addNotification = (message: string) => {
    setNotifications(prev => [...prev, message]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 3000);
  };

  const handleAddToCart = (product: any) => {
    if (product.current_stock <= 0) {
      addNotification('Product out of stock');
      return;
    }
    
    addToCart(product);
    addNotification(`Added ${product.name} to cart`);
    setSearchResults([]);
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      addNotification('Cart is empty');
      return;
    }
    
    if (!currentShift) {
      addNotification('Please start your shift first');
      setShowShiftDialog('start');
      return;
    }
    
    setShowPaymentDialog(true);
  };

  const handleEnhancedPayment = async (paymentData: {
    paymentSplits: Array<{ payment_method_code: string; amount: number; reference_number?: string | null }>;
    customerAccountId?: number | null;
    customerName?: string | null;
  }) => {
    const success = await processEnhancedSale(paymentData);
    if (success) {
      setShowPaymentDialog(false);
      setShowReceiptDialog(true);
      setCustomerInfo({ name: '' });
      addNotification('Sale completed successfully!');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    setShowReceiptDialog(true);
    setCustomerInfo({ name: '' });
    addNotification('Sale completed successfully!');
  };

  const { subtotal, tax, total, discount, ewt } = calculateTotals();

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 3, pb: 0 }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            <Receipt sx={{ mr: 1, verticalAlign: 'middle' }} />
            Cashier POS
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* Offline indicator */}
            {isOffline && (
              <Chip 
                icon={<OfflinePin />} 
                label="Offline Mode"
                color="warning"
                variant="filled"
                size="small"
              />
            )}
            
            {/* Pending sync indicator */}
            {offlineSales.length > 0 && (
              <Tooltip title="Offline sales pending sync">
                <Chip 
                  icon={<CloudSync />} 
                  label={`${offlineSales.length} pending`}
                  color="info"
                  variant="outlined"
                  size="small"
                  onClick={() => !isOffline && syncOfflineSales()}
                  clickable={!isOffline}
                />
              </Tooltip>
            )}
            
            {/* Shift status */}
            {currentShift ? (
              <Tooltip title="Active shift - Click to view details">
                <Chip 
                  icon={<AccessTime />} 
                  label={`$${Number(currentShift?.totalSales || 0).toFixed(2)} • ${currentShift?.totalTransactions ?? 0} sales`}
                  color="success"
                  variant="outlined"
                  size="small"
                  clickable
                  onClick={() => setShowShiftDialog('end')}
                />
              </Tooltip>
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={() => setShowShiftDialog('start')}
                startIcon={<AccessTime />}
                color="success"
              >
                Start Shift
              </Button>
            )}
            
          </Box>
        </Box>
      </Paper>

  <Grid container spacing={3} sx={{ flex: 1, overflow: 'hidden' }}>
        {/* Left Side - Product Search */}
        <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ pb: '16px !important' }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  inputRef={searchInputRef}
                  label={isScanning ? "Scan barcode or search product..." : "Search by name or barcode..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {isScanning ? <QrCodeScanner color="primary" /> : <Search />}
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isScanning ? alpha(theme.palette.primary.main, 0.05) : 'transparent'
                    }
                  }}
                />
                <Button 
                  variant="contained" 
                  onClick={handleSearch}
                  disabled={isSearching}
                  size="large"
                  startIcon={isSearching ? <CircularProgress size={20} /> : <Search />}
                >
                  Search
                </Button>
                <Button
                  variant={isScanning ? "contained" : "outlined"}
                  onClick={toggleScanner}
                  color={isScanning ? "success" : "primary"}
                  size="large"
                  title="Press F2 to toggle scanner"
                >
                  <QrCodeScanner />
                </Button>
              </Box>
              
              {/* Shortcuts Text */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Shortcuts: F2 - Scanner, F4 - Checkout, Esc - Clear
                </Typography>
              </Box>

              {/* Search Results Dropdown - Positioned Below Shortcuts */}
              {groupedResults.length > 0 && (
                <Box>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '560px', overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Price</TableCell>
                          <TableCell align="center">Stock</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {groupedResults.map((group, groupIndex) => {
                          // For products without variants, use baseProduct; otherwise use selected variant or null
                          const hasVariants = group.variants.length > 1;
                          const selectedVariant = hasVariants 
                            ? (selectedVariants[groupIndex] || null)
                            : group.baseProduct;
                          
                          const handleVariantSelect = (variant: any) => {
                            setSelectedVariants(prev => ({
                              ...prev,
                              [groupIndex]: variant
                            }));
                          };
                          
                          return (
                            <TableRow key={groupIndex} hover>
                              <TableCell>
                                <Box>
                                  {/* Top line: Product name + variant chips */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" fontWeight="medium">
                                      {group.baseProduct.name}
                                    </Typography>
                                    
                                    {/* Variant Selectors - Inline */}
                                    {hasVariants && (
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {/* Size variants */}
                                        {group.hasSizeVariants && (
                                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {group.variants
                                              .filter((v: any, i: number, arr: any[]) => 
                                                arr.findIndex((x: any) => (x.effectiveSize || x.size) === (v.effectiveSize || v.size)) === i
                                              )
                                              .map((variant: any) => (
                                                <Chip
                                                  key={variant.id}
                                                  label={variant.effectiveSize || variant.size || 'N/A'}
                                                  size="small"
                                                  onClick={() => handleVariantSelect(variant)}
                                                  color={selectedVariant?.id === variant.id ? 'primary' : 'default'}
                                                  sx={{ cursor: 'pointer', fontSize: '0.7rem', height: '22px' }}
                                                />
                                              ))
                                            }
                                          </Box>
                                        )}
                                        
                                        {/* Variety variants (e.g., paint finishes, product types) */}
                                        {group.hasVarietyVariants && (
                                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {group.variants
                                              .filter((v: any, i: number, arr: any[]) => 
                                                arr.findIndex((x: any) => x.variety === v.variety) === i
                                              )
                                              .map((variant: any) => (
                                                <Chip
                                                  key={variant.id}
                                                  label={variant.variety || 'N/A'}
                                                  size="small"
                                                  onClick={() => handleVariantSelect(variant)}
                                                  color={selectedVariant?.id === variant.id ? 'success' : 'default'}
                                                  sx={{ cursor: 'pointer', fontSize: '0.7rem', height: '22px' }}
                                                />
                                              ))
                                            }
                                          </Box>
                                        )}
                                        
                                        {/* Color variants */}
                                        {group.hasColorVariants && (
                                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {group.variants
                                              .filter((v: any, i: number, arr: any[]) => 
                                                arr.findIndex((x: any) => (x.effectiveColor || x.color) === (v.effectiveColor || v.color)) === i
                                              )
                                              .map((variant: any) => (
                                                <Chip
                                                  key={variant.id}
                                                  label={variant.effectiveColor || variant.color || 'N/A'}
                                                  size="small"
                                                  onClick={() => handleVariantSelect(variant)}
                                                  color={selectedVariant?.id === variant.id ? 'secondary' : 'default'}
                                                  sx={{ cursor: 'pointer', fontSize: '0.7rem', height: '22px' }}
                                                />
                                              ))
                                            }
                                          </Box>
                                        )}
                                      </Box>
                                    )}
                                  </Box>
                                  
                                  {/* Bottom line: Always present for consistent spacing */}
                                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', minHeight: '1.2em' }}>
                                    {group.baseProduct.brand && `${group.baseProduct.brand} \u2022 `}
                                    {group.baseProduct.category || '\u00A0'}
                                    {group.baseProduct.variety && ` \u2022 ${group.baseProduct.variety}`}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight="medium">
                                  ${Number(selectedVariant?.selling_price || group.baseProduct.selling_price || 0).toFixed(2)}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  per {selectedVariant?.unit || group.baseProduct.unit || 'unit'}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  size="small" 
                                  label={selectedVariant ? `${selectedVariant.current_stock || 0}` : '-'}
                                  color={
                                    !selectedVariant ? "default" :
                                    selectedVariant.current_stock > 10 ? "success" : 
                                    selectedVariant.current_stock > 0 ? "warning" : "error"
                                  }
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleAddToCart(selectedVariant)}
                                  disabled={!selectedVariant || !selectedVariant.current_stock || selectedVariant.current_stock <= 0}
                                  startIcon={<Add />}
                                >
                                  Add
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side - Shopping Cart */}
        <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', height: 'calc(113vh - 200px)' }}>
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6">
                    <Badge badgeContent={cart.length} color="primary">
                      <ShoppingCart />
                    </Badge>
                    <span style={{ marginLeft: 8 }}>Cart</span>
                  </Typography>
                  {cart.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant={discountMode ? "contained" : "outlined"}
                        onClick={() => setDiscountMode(!discountMode)}
                        color="secondary"
                      >
                        Discount
                      </Button>
                      <ButtonGroup size="small">
                        <Button
                          variant={taxMode === 'VAT' ? "contained" : "outlined"}
                          onClick={() => setTaxMode('VAT')}
                        >
                          VAT
                        </Button>
                        <Button
                          variant={taxMode === 'NON-VAT' ? "contained" : "outlined"}
                          onClick={() => setTaxMode('NON-VAT')}
                        >
                          NON-VAT
                        </Button>
                        <Button
                          variant={taxMode === 'EWT' ? "contained" : "outlined"}
                          onClick={() => setTaxMode('EWT')}
                        >
                          EWT
                        </Button>
                      </ButtonGroup>
                      <Button
                        size="small"
                        onClick={clearCart}
                        startIcon={<Clear />}
                        color="error"
                      >
                        Clear All
                      </Button>
                    </Box>
                  )}
                </Box>
                
                {cart.length === 0 ? (
                  <Box sx={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    textAlign: 'center',
                    color: 'text.secondary',
                    minHeight: 0
                  }}>
                    <Box>
                      <ShoppingCart sx={{ fontSize: 48, mb: 0, opacity: 0.5 }} />
                      <Typography variant="body1">Cart is empty</Typography>
                      <Typography variant="body2">Search and add products to start</Typography>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ flex: 1, overflow: 'auto', }}>
                      <List dense sx={{ pt: 0 }}>
                        {cart.map((item) => {
                        const itemSubtotal = Number(item.price) * item.quantity;
                        const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
                        const itemTotal = itemSubtotal - itemDiscount;
                        
                        return (
                          <ListItem 
                            key={item.id} 
                            divider
                            sx={{ 
                              px: 1,
                              alignItems: 'stretch',
                              '&:hover': { 
                                backgroundColor: alpha(theme.palette.primary.main, 0.04) 
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', width: '100%' }}>
                              <ListItemText
                                primary={
                                  <Typography variant="body2" fontWeight="medium">
                                    {item.name}
                                    {item.size && ` ${item.size}`}
                                    {item.color && ` ${item.color}`}
                                  </Typography>
                                }
                                secondary={
                                  <Box>
                                    <Typography variant="caption" color="textSecondary">
                                      {item.brand && `${item.brand} \u2022 `}
                                      ₱{Number(item.price).toFixed(2)}/{item.unit}
                                      {item.variety && ` \u2022 ${item.variety}`}
                                    </Typography>
                                    <br />
                                    {item.discount_percent && item.discount_percent > 0 ? (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" fontWeight="medium" color="primary">
                                          ₱{itemTotal.toFixed(2)}
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary" sx={{ textDecoration: 'line-through' }}>
                                          ₱{itemSubtotal.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" fontWeight="medium" color="error" component="span">
                                          -{item.discount_percent}%
                                        </Typography>
                                      </Box>
                                    ) : (
                                      <Typography variant="body2" fontWeight="medium" color="primary">
                                        ₱{itemSubtotal.toFixed(2)}
                                      </Typography>
                                    )}
                                  </Box>
                                }
                              />
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                                {/* Discount Controls - Only visible in discount mode */}
                                {discountMode && (
                                  <Button
                                    size="small"
                                    variant={item.discount_percent === discountPercent ? "contained" : "outlined"}
                                    onClick={() => {
                                      // Toggle discount: remove if already applied, apply if not
                                      const newDiscount = item.discount_percent === discountPercent ? 0 : discountPercent;
                                      updateCartItemDiscount(item.id, newDiscount);
                                    }}
                                    color="secondary"
                                    sx={{ minWidth: 60, mr: 0.5 }}
                                  >
                                    {discountPercent}%
                                  </Button>
                                )}
                                <IconButton
                                  size="small"
                                  onClick={() => updateCartItem(item.id, item.quantity - 1)}
                                >
                                  <Remove />
                                </IconButton>
                                <Typography 
                                  sx={{ 
                                    minWidth: 35, 
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    borderRadius: 1,
                                    px: 1
                                  }}
                                >
                                  {item.quantity}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => updateCartItem(item.id, item.quantity + 1)}
                                >
                                  <Add />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeFromCart(item.id)}
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            </Box>
                          </ListItem>
                        );
                      })}
                      </List>
                    </Box>

                    {/* Totals - Fixed at bottom */}
                    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, flexShrink: 0 }}>
                      {taxMode === 'NON-VAT' ? (
                        <>
                          {discount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="error">Discount:</Typography>
                              <Typography color="error">-₱{discount.toFixed(2)}</Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">NON-VAT Sale:</Typography>
                            <Typography>₱{subtotal.toFixed(2)}</Typography>
                          </Box>
                        </>
                      ) : (
                        <>
                          {discount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="error">Discount:</Typography>
                              <Typography color="error">-₱{discount.toFixed(2)}</Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">VATABLE SALE (Less VAT):</Typography>
                            <Typography>₱{subtotal.toFixed(2)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">VAT (12%):</Typography>
                            <Typography>₱{tax.toFixed(2)}</Typography>
                          </Box>
                          {taxMode === 'EWT' && ewt > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="warning.main">Less: EWT (1%):</Typography>
                              <Typography color="warning.main">-₱{ewt.toFixed(2)}</Typography>
                            </Box>
                          )}
                        </>
                      )}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {taxMode === 'EWT' ? 'NET AMOUNT DUE:' : 'TOTAL AMOUNT DUE:'}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                          ₱{total.toFixed(2)}
                        </Typography>
                      </Box>

                      {/* Customer Info */}
                      <Box sx={{ mb: 2 }}>
                        <Autocomplete
                          size="small"
                          freeSolo
                          options={customers}
                          getOptionLabel={(option: any) => 
                            typeof option === 'string' 
                              ? option 
                              : option.customer_name || ''
                          }
                          filterOptions={(options, { inputValue }) => {
                            if (!inputValue) return options;
                            const searchLower = inputValue.toLowerCase();
                            return options.filter((option: any) => {
                              const name = option.customer_name?.toLowerCase() || '';
                              const phone = option.phone?.toLowerCase() || '';
                              return name.includes(searchLower) || phone.includes(searchLower);
                            });
                          }}
                          value={customerInfo.name}
                          onChange={(_, newValue) => {
                            const name = typeof newValue === 'string' 
                              ? newValue 
                              : newValue?.customer_name || '';
                            setCustomerInfo({ name });
                          }}
                          onInputChange={(_, newInputValue) => {
                            setCustomerInfo({ name: newInputValue });
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Customer Name (Optional)"
                              placeholder="Start typing to search..."
                            />
                          )}
                          fullWidth
                        />
                      </Box>

                      {/* Checkout Button */}
                      <Button
                        fullWidth
                        variant="contained"
                        size="medium"
                        onClick={handleCheckout}
                        disabled={isProcessing || !currentShift}
                        startIcon={isProcessing ? <CircularProgress size={18} /> : <Payment />}
                        sx={{ 
                          height: 42, 
                          fontSize: '0.95rem', 
                          fontWeight: 'bold',
                          background: currentShift ? 
                            'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)' : 
                            undefined,
                        }}
                      >
                        {isProcessing ? 'Processing...' : 
                         !currentShift ? 'Start Shift First' : 
                         `Checkout (F4)`}
                      </Button>
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
        </Grid>
      </Grid>

      {/* Notifications */}
      {notifications.map((notification, index) => (
        <Snackbar
          key={index}
          open={true}
          message={notification}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ mt: 8 }}
        />
      ))}

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          onClose={clearError}
          sx={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 1400 }}
        >
          {error}
        </Alert>
      )}

      {/* Shift Dialog */}
      {showShiftDialog && (
        <ErrorBoundary>
          <ShiftDialog
            open={true}
            onClose={() => setShowShiftDialog(null)}
            type={showShiftDialog}
          />
        </ErrorBoundary>
      )}

      {/* Payment Dialog */}
      <EnhancedPaymentDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        totalAmount={total}
        customerName={customerInfo.name}
        onPaymentComplete={handleEnhancedPayment}
      />

      {/* Receipt Dialog */}
      {currentSale && (
        <Dialog open={showReceiptDialog} onClose={() => setShowReceiptDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            Sale Completed
          </DialogTitle>
          <DialogContent>
            <Paper elevation={1} sx={{ p: 2, fontFamily: 'monospace', bgcolor: 'grey.50' }}>
              <Typography variant="h6" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
                HARDWARE STORE
              </Typography>
              <Typography variant="body2" align="center" gutterBottom>
                Receipt #{currentSale.saleNumber}
              </Typography>
              <Typography variant="body2" align="center" gutterBottom>
                {new Date(currentSale.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body2" align="center" gutterBottom>
                Cashier: {currentSale.cashierName}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              {currentSale.items.map((item, index) => {
                const itemSubtotal = Number(item.price) * item.quantity;
                const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
                const itemTotal = itemSubtotal - itemDiscount;
                
                return (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.quantity} x ₱{Number(item.price).toFixed(2)}
                          {item.discount_percent && item.discount_percent > 0 && ` (-${item.discount_percent}%)`}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="medium">
                        ₱{itemTotal.toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
              
              <Divider sx={{ my: 2 }} />
              
              {taxMode === 'NON-VAT' ? (
                <>
                  {discount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="error">Discount:</Typography>
                      <Typography color="error">-₱{discount.toFixed(2)}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">NON-VAT Sale:</Typography>
                    <Typography>₱{Number(currentSale.subtotal).toFixed(2)}</Typography>
                  </Box>
                </>
              ) : (
                <>
                  {discount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="error">Discount:</Typography>
                      <Typography color="error">-₱{discount.toFixed(2)}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">VATABLE SALE (Less VAT):</Typography>
                    <Typography>₱{Number(currentSale.subtotal).toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">VAT (12%):</Typography>
                    <Typography>₱{Number(currentSale.tax).toFixed(2)}</Typography>
                  </Box>
                  {taxMode === 'EWT' && ewt > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="warning.main">Less: EWT (1%):</Typography>
                      <Typography color="warning.main">-₱{ewt.toFixed(2)}</Typography>
                    </Box>
                  )}
                </>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem' }}>
                <Typography fontWeight="bold">{taxMode === 'EWT' ? 'Net Amount:' : 'Total:'}</Typography>
                <Typography fontWeight="bold">₱{Number(currentSale.total).toFixed(2)}</Typography>
              </Box>
              
              {currentSale.payments.map((payment, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    {payment.method.toUpperCase()}: ${Number(payment.amount).toFixed(2)}
                  </Typography>
                </Box>
              ))}
              
              {currentSale.customerName && (
                <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                  Customer: {currentSale.customerName}
                </Typography>
              )}
              
              <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                Thank you for your business!
              </Typography>
              
              {isOffline && (
                <Typography variant="caption" align="center" display="block" color="warning.main" sx={{ mt: 1 }}>
                  * Processed offline - will sync when online
                </Typography>
              )}
            </Paper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowReceiptDialog(false)}>Close</Button>
            <Button 
              variant="contained" 
              onClick={() => printReceipt(currentSale)}
              startIcon={<Print />}
            >
              Print Receipt
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default POS;
