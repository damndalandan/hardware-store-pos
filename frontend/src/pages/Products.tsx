import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  Chip, Alert, Snackbar, Tooltip, IconButton, LinearProgress, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Popover, Menu, List, ListItem, ListItemIcon, ListItemText, Divider, Checkbox, TableSortLabel,
  RadioGroup, FormControlLabel, Radio, Tabs, Tab, InputAdornment, TablePagination
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
  QrCodeScanner as ScanIcon, Download as DownloadIcon, Upload as UploadIcon,
  Refresh as RefreshIcon, Warning as WarningIcon, FilterList as FilterListIcon
} from '@mui/icons-material';
import { ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon, DragIndicator as DragIndicatorIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import dataGridStickySx from '../utils/dataGridSticky';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../contexts/AuthContext';

interface Product {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  brand?: string;
  description?: string;
  material?: string;
  category_name?: string;
  category_id?: number;
  size?: string;
  variety?: string;
  color?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
  supplier_name?: string;
  supplier_id?: number;
  current_stock: number;
  reserved_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
}

interface Supplier {
  id: number;
  name: string;
  is_active: boolean;
}

const Products: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<GridRowSelectionModel>([]);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isMounted = useRef(false);
  
  // Add component crash protection
  const [componentError, setComponentError] = useState<Error | null>(null);
  
  // Wrap all state setters with error protection
  const safeSetProducts = (data: Product[]) => {
    try {
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error setting products:', error);
      setProducts([]);
    }
  };
  
  // Dialog states
  const [productDialog, setProductDialog] = useState(false);
  const [barcodeDialog, setBarcodeDialog] = useState(false);
  const [variantWizardOpen, setVariantWizardOpen] = useState(false);
  const [excelImportDialog, setExcelImportDialog] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [baseProduct, setBaseProduct] = useState<Partial<Product>>({});
  const [variants, setVariants] = useState<Array<{size?: string; color?: string; sku?: string; costPrice?: number; sellingPrice?: number; stock?: number}>>([]);
  const [saveAndCreateNew, setSaveAndCreateNew] = useState(false);
  // Category creation dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState<number | ''>('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<number | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  // Subpage toggle: 'product' | 'category'
  const [productSubPage, setProductSubPage] = useState<'product' | 'category'>('product');
  
  // Form states
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({});
  // Local UI state for profit margin (percentage)
  const [localMargin, setLocalMargin] = useState<number | ''>('');
  const [marginError, setMarginError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [debouncedFilterBrand, setDebouncedFilterBrand] = useState('');
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Table UI: sorting and filter popovers (category/brand)
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [colMenuAnchor, setColMenuAnchor] = useState<null | HTMLElement>(null);
  const [categoryAnchor, setCategoryAnchor] = useState<null | HTMLElement>(null);
  const [brandAnchor, setBrandAnchor] = useState<null | HTMLElement>(null);
  const [tempCategorySelection, setTempCategorySelection] = useState<string[]>([]);
  const [tempBrandSelection, setTempBrandSelection] = useState<string[]>([]);

  // selection helpers (mirror Inventory style)
  const isAllSelected = products.length > 0 && (selectedProducts as number[]).length === products.length;
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedProducts([]);
    else setSelectedProducts(products.map(p => p.id));
  };
  const toggleRowSelected = (id: number) => {
    setSelectedProducts((prev) => {
      const set = new Set(prev as number[]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  };
  
  // Barcode scanner
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  
  // Notifications
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // Debounce search and filter inputs to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterBrand(filterBrand);
    }, 500);
    return () => clearTimeout(timer);
  }, [filterBrand]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      if (filterCategory) params.append('category', filterCategory);
      if (debouncedFilterBrand) params.append('brand', debouncedFilterBrand);
      
      console.log('Fetching products from:', `${API_BASE_URL}/products?${params}`);
      const response = await axios.get(`${API_BASE_URL}/products?${params}`);
      console.log('Products response:', response.data);
      
      const responseData = response.data;
      if (responseData && responseData.products && Array.isArray(responseData.products)) {
        safeSetProducts(responseData.products);
        if (responseData.products.length > 0) {
          showNotification(`Loaded ${responseData.products.length} products`, 'success');
        }
      } else {
        safeSetProducts([]);
        showNotification('No products found', 'info');
      }
    } catch (error: any) {
      console.error('Products fetch error:', error);
      
      // Ensure we don't break the component on errors
      safeSetProducts([]);
      
      if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
        window.location.reload();
        return;
      }
      showNotification('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products/categories/list`);
      const data = response.data;
      if (Array.isArray(data)) setCategories(data);
      else setCategories([]);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/suppliers`);
      const respData = response.data;
      // Backend returns a wrapper object: { suppliers: [...], pagination: {...} }
      // Support both the legacy array response and the wrapped object.
      const list = Array.isArray(respData) ? respData : (respData && Array.isArray(respData.suppliers) ? respData.suppliers : []);
      setSuppliers(list);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      setSuppliers([]);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSuppliers();
  }, []); // Run once on mount

  // Add global error handler
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Component Error:', error);
      setComponentError(new Error(error.message || 'Unknown component error'));
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      if (event.reason?.message) {
        setComponentError(new Error(event.reason.message));
      }
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Re-fetch products when filters change (skip initial mount)
  useEffect(() => {
    // Skip initial mount - data already loaded
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    
    // Skip if still debouncing
    if (debouncedSearchTerm !== searchTerm || debouncedFilterBrand !== filterBrand) {
      return; // Wait for debouncing to complete
    }
    
    // Skip if currently loading to prevent multiple simultaneous requests
    if (loading) {
      return;
    }
    
    // Reset page when filters change
    setPage(0);
    
    // Fetch products whenever filters change
    try {
      fetchProducts();
    } catch (error) {
      console.error('Error in products useEffect:', error);
      setComponentError(error as Error);
    }
  }, [debouncedSearchTerm, filterCategory, debouncedFilterBrand]);

  // Sorting helper (client-side)
  const handleRequestSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    setSortBy(field);
    setSortOrder(isAsc ? 'desc' : 'asc');
    setProducts(prev => {
      const copy = [...prev];
      copy.sort((a: any, b: any) => {
        const av = a[field];
        const bv = b[field];
        if (av == null && bv == null) return 0;
        if (av == null) return -1;
        if (bv == null) return 1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return (isAsc ? 1 : -1) * (av - bv);
        }
        const astr = String(av).toLowerCase();
        const bstr = String(bv).toLowerCase();
        if (astr < bstr) return isAsc ? 1 : -1;
        if (astr > bstr) return isAsc ? -1 : 1;
        return 0;
      });
      return copy;
    });
  };

  // styles for single-line truncation and header cells (copied from Inventory for parity)
  const headerCellSx = {
    top: 0,
    position: 'sticky',
    backgroundColor: '#f7f7f7',
    zIndex: 1200,
    whiteSpace: 'nowrap'
  } as any;

  const cellSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 240
  } as any;

  const truncateSx = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any;

  const openColMenu = (e: React.MouseEvent<HTMLElement>) => setColMenuAnchor(e.currentTarget);
  const closeColMenu = () => setColMenuAnchor(null);

  // Column menu UI mode will match Inventory: 'default' | 'all' | 'custom'
  const [columnMode, setColumnMode] = useState<'default' | 'all' | 'custom'>('custom');

  const closeCategoryPopover = () => setCategoryAnchor(null);
  const closeBrandPopover = () => setBrandAnchor(null);
  
  // No per-row three-dot menu; header three-dot handles actions for selected rows

  // Utility functions
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const resetForm = () => {
    // Clear main editing product fields and temporary UI state.
    setEditingProduct({});
    setScannedBarcode('');
    setLocalMargin('');
    // Also clear any temporary variant wizard state when the form is fully reset
    setVariants([]);
    try {
      localStorage.removeItem('products_editingProduct');
      localStorage.removeItem('products_variants');
    } catch (err) {
      console.debug('Failed to clear product draft from localStorage', err);
    }
    setBaseProduct({});
  };

  // Persist editingProduct and variants to localStorage so the modal state survives navigation
  useEffect(() => {
    try {
      localStorage.setItem('products_editingProduct', JSON.stringify(editingProduct));
    } catch (err) {
      console.debug('Failed to persist editingProduct', err);
    }
  }, [editingProduct]);

  useEffect(() => {
    try {
      localStorage.setItem('products_variants', JSON.stringify(variants));
    } catch (err) {
      console.debug('Failed to persist variants', err);
    }
  }, [variants]);

  // Restore persisted draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('products_editingProduct');
      if (saved) {
        setEditingProduct(JSON.parse(saved));
      }
      const savedVariants = localStorage.getItem('products_variants');
      if (savedVariants) {
        setVariants(JSON.parse(savedVariants));
      }
    } catch (err) {
      console.debug('Failed to restore product draft from localStorage', err);
    }
  }, []);

  // Keep localMargin in sync when editing an existing product
  useEffect(() => {
    if (!productDialog) return;
    const cost = Number(editingProduct.cost_price || 0);
    const selling = Number(editingProduct.selling_price || 0);
    if (cost > 0 && selling > 0) {
      let margin = ((selling / cost) - 1) * 100;
      if (!isFinite(margin) || Number.isNaN(margin)) {
        setLocalMargin('');
      } else {
        if (margin > 30) margin = 30;
        setLocalMargin(Number(margin.toFixed(2)));
      }
    } else {
      setLocalMargin('');
    }
  }, [productDialog, editingProduct.cost_price, editingProduct.selling_price]);

  // Handlers for two-way margin/price sync
  const handleCostChange = (value: string) => {
    const cost = parseFloat(value);
    const costVal = Number.isFinite(cost) ? cost : 0;
    setEditingProduct(prev => ({ ...prev, cost_price: costVal }));

    if (localMargin !== '' && costVal > 0) {
      const selling = +(costVal * (1 + Number(localMargin) / 100)).toFixed(2);
      setEditingProduct(prev => ({ ...prev, selling_price: selling }));
      setMarginError(null);
    } else if ((editingProduct.selling_price || 0) > 0 && costVal > 0) {
      // Recompute margin from existing selling price
      const selling = Number(editingProduct.selling_price || 0);
      let margin = ((selling / costVal) - 1) * 100;
      if (!isFinite(margin) || Number.isNaN(margin)) {
        setLocalMargin('');
      } else {
        if (margin > 30) margin = 30;
        setLocalMargin(Number(margin.toFixed(2)));
      }
    }
  };

  const handleMarginChange = (value: string) => {
    const m = parseFloat(value);
    const marginVal = Number.isFinite(m) ? m : '';
    // Do not set helper/error text here; keep UI clean. We still cap the margin to 30%.
    setMarginError(null);
    const capped = marginVal === '' ? '' : Math.min(Number(marginVal), 30);
    setLocalMargin(capped === '' ? '' : Number(Number(capped).toFixed(2)));

    const cost = Number(editingProduct.cost_price || 0);
    if (cost > 0 && capped !== '') {
      const selling = +(cost * (1 + Number(capped) / 100)).toFixed(2);
      setEditingProduct(prev => ({ ...prev, selling_price: selling }));
    }
  };

  const handleSellingChange = (value: string) => {
    const selling = parseFloat(value);
    const sellingVal = Number.isFinite(selling) ? selling : 0;
    setEditingProduct(prev => ({ ...prev, selling_price: sellingVal }));
    const cost = Number(editingProduct.cost_price || 0);
    if (cost > 0) {
      let margin = ((sellingVal / cost) - 1) * 100;
      if (!isFinite(margin) || Number.isNaN(margin)) {
        setLocalMargin('');
        setMarginError(null);
      } else {
        if (margin > 30) {
          // cap selling price to 30% margin
          const cappedSelling = +(cost * 1.3).toFixed(2);
          setEditingProduct(prev => ({ ...prev, selling_price: cappedSelling }));
          setLocalMargin(30);
          // do not display inline note; keep marginError cleared
          setMarginError(null);
          showNotification('Selling price capped to maintain 30% profit margin', 'warning');
        } else {
          setLocalMargin(Number(margin.toFixed(2)));
          setMarginError(null);
        }
      }
    }
  };

  const handleError = (error: any, context: string) => {
    console.error(`${context} error:`, error);
    setHasError(true);
    setErrorMessage(`${context}: ${error.message || 'Unknown error'}`);
  };

  const clearError = () => {
    setHasError(false);
    setErrorMessage('');
  };

  // Product CRUD operations
  const handleSaveProduct = async (createAnother: boolean = false) => {
    try {
      setLoading(true);
      
      // Validation
      // SKU is optional for now; require name, unit, cost and selling price
      if (!editingProduct.name || !editingProduct.unit) {
        showNotification('Please fill in all required fields (Name, Unit, Cost, Selling Price)', 'error');
        return;
      }

      // Check if cost_price and selling_price are valid numbers > 0
      const costPrice = Number(editingProduct.cost_price);
      const sellingPrice = Number(editingProduct.selling_price);
      
      if (isNaN(costPrice) || costPrice <= 0 || isNaN(sellingPrice) || sellingPrice <= 0) {
        showNotification('Cost Price and Selling Price must be valid numbers greater than 0', 'error');
        return;
      }

      // Build payload with the exact camelCase fields the backend expects.
      const productData = {
        sku: editingProduct.sku || '',
        barcode: scannedBarcode || editingProduct.barcode || null,
        name: editingProduct.name || '',
        brand: editingProduct.brand || null,
  description: editingProduct.description || null,
        categoryId: editingProduct.category_id ?? null,
        size: editingProduct.size || null,
        variety: editingProduct.variety || null,
        color: editingProduct.color || null,
        unit: editingProduct.unit || '',
        costPrice: Number(editingProduct.cost_price) || 0,
        sellingPrice: Number(editingProduct.selling_price) || 0,
        minStockLevel: Number(editingProduct.min_stock_level) || 0,
        maxStockLevel: Number(editingProduct.max_stock_level) || 0,
        supplierId: editingProduct.supplier_id ?? null,
        initialStock: Number(editingProduct.current_stock) || 0
      };

      if (editingProduct.id) {
        // Update existing product
        await axios.put(`${API_BASE_URL}/products/${editingProduct.id}`, productData);
        showNotification('Product updated successfully');
        setProductDialog(false);
        resetForm();
      } else {
        // Create new product
        await axios.post(`${API_BASE_URL}/products`, productData);
        showNotification('Product created successfully');
        
        if (createAnother) {
          // Keep dialog open and reset form for next product
          // But preserve category and supplier for convenience
          const keepCategory = editingProduct.category_id;
          const keepSupplier = editingProduct.supplier_id;
          resetForm();
          setEditingProduct({ 
            category_id: keepCategory,
            supplier_id: keepSupplier,
            min_stock_level: 0,
            max_stock_level: 0,
            current_stock: 0
          });
          showNotification('Ready to add another product', 'info');
        } else {
          setProductDialog(false);
          resetForm();
        }
      }

      fetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to save product';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      const confirmed = window.confirm('Are you sure you want to delete this product? This action cannot be undone.');
      if (!confirmed) return;

      await axios.delete(`${API_BASE_URL}/products/${id}`);
      showNotification('Product deleted successfully');
      fetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete product';
      showNotification(message, 'error');
    }
  };

  const openVariantWizard = () => {
    // Save current product as base
    setBaseProduct({ ...editingProduct });
    setVariants([{ size: '', color: '', sku: '', costPrice: editingProduct.cost_price, sellingPrice: editingProduct.selling_price, stock: 0 }]);
    setProductDialog(false);
    setVariantWizardOpen(true);
  };

  const addVariantRow = () => {
    setVariants([...variants, { size: '', color: '', sku: '', costPrice: baseProduct.cost_price, sellingPrice: baseProduct.selling_price, stock: 0 }]);
  };

  const removeVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const saveAllVariants = async () => {
    try {
      setLoading(true);
      
      // Validate all variants
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.size && !v.color) {
          showNotification(`Variant ${i + 1}: Please specify at least size or color`, 'error');
          return;
        }
      }

      // Create all variants
      const promises = variants.map(v => {
        const variantData = {
          sku: v.sku || `${baseProduct.sku || ''}-${v.size || ''}-${v.color || ''}`.replace(/^-+|-+$/g, ''),
          barcode: null,
          name: baseProduct.name || '',
          brand: baseProduct.brand || null,
          description: baseProduct.description || null,
          categoryId: baseProduct.category_id ?? null,
          size: v.size || null,
          variety: baseProduct.variety || null,
          color: v.color || null,
          unit: baseProduct.unit || '',
          costPrice: Number(v.costPrice) || 0,
          sellingPrice: Number(v.sellingPrice) || 0,
          minStockLevel: Number(baseProduct.min_stock_level) || 0,
          maxStockLevel: Number(baseProduct.max_stock_level) || 0,
          supplierId: baseProduct.supplier_id ?? null,
          initialStock: Number(v.stock) || 0
        };
        return axios.post(`${API_BASE_URL}/products`, variantData);
      });

      await Promise.all(promises);
      showNotification(`Successfully created ${variants.length} product variants!`, 'success');
      
      setVariantWizardOpen(false);
      setVariants([]);
      setBaseProduct({});
      fetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create variants';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    setDeletingCategory(true);
    try {
      await axios.delete(`${API_BASE_URL}/products/categories/${deleteCategoryId}`);
      setDeleteCategoryId(null);
      showNotification('Category deleted', 'success');
      await fetchCategories();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete category';
      setCategoryFormError(msg);
    } finally {
      setDeletingCategory(false);
    }
  };

  // Barcode functions
  const startBarcodeScanner = () => {
    setScannerActive(true);
    setBarcodeDialog(true);
    
    setTimeout(() => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
      
      try {
        scannerRef.current = new Html5QrcodeScanner(
          "barcode-scanner",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        
        scannerRef.current.render(
          (decodedText: string) => {
            setScannedBarcode(decodedText);
            stopBarcodeScanner();
            showNotification(`Barcode scanned: ${decodedText}`, 'success');
          },
          (error: any) => {
            // Ignore scanning errors - they're very frequent
          }
        );
      } catch (error) {
        console.error('Scanner error:', error);
        showNotification('Failed to start barcode scanner', 'error');
        stopBarcodeScanner();
      }
    }, 100);
  };

  const stopBarcodeScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (error) {
        console.error('Error clearing scanner:', error);
      }
      scannerRef.current = null;
    }
    setScannerActive(false);
    setBarcodeDialog(false);
  };

  const generateBarcode = async (productId: number) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/products/${productId}/generate-barcode`);
      showNotification(`Barcode generated: ${response.data.barcode}`);
      fetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to generate barcode';
      showNotification(message, 'error');
    }
  };

  // Export function
  const handleExport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);
      
      const response = await axios.get(`${API_BASE_URL}/products/export/csv?${params}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      saveAs(blob, `products-export-${timestamp}.csv`);
      
      showNotification('Products exported successfully');
    } catch (error) {
      showNotification('Failed to export products', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Excel Import handlers
  const handleExcelImportClick = () => {
    setExcelImportDialog(true);
    setImportFile(null);
    setImportResults(null);
  };

  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('File selected:', file);
    if (file) {
      setImportFile(file);
      setImportResults(null);
      console.log('Import file set:', file.name, file.size, 'bytes');
    } else {
      console.log('No file selected');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/products/import/template`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      saveAs(blob, 'product_import_template.xlsx');
      showNotification('Template downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download template:', error);
      showNotification('Failed to download template', 'error');
    }
  };

  const handleExcelImport = async () => {
    if (!importFile) {
      showNotification('Please select a file to import', 'error');
      return;
    }

    console.log('=== IMPORT START ===');
    console.log('File name:', importFile.name);
    console.log('File size:', importFile.size);
    console.log('File type:', importFile.type);

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const token = localStorage.getItem('token');
      console.log('Sending import request to:', `${API_BASE_URL}/products/import`);
      
      const response = await axios.post(`${API_BASE_URL}/products/import`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Import response:', response.data);
      setImportResults(response.data);
      
      if (response.data.success) {
        showNotification(
          `Successfully imported ${response.data.successCount} products!`, 
          'success'
        );
        fetchProducts(); // Refresh product list
      } else {
        showNotification(
          `Imported ${response.data.successCount} products with ${response.data.errorCount} errors`, 
          'warning'
        );
      }
    } catch (error: any) {
      console.error('Excel import failed:', error);
      console.error('Error response:', error.response?.data);
      
      // Set error results to display in dialog
      if (error.response?.data) {
        setImportResults(error.response.data);
      }
      
      showNotification(
        error.response?.data?.error || 'Failed to import products', 
        'error'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImportDialog = () => {
    setExcelImportDialog(false);
    setImportFile(null);
    setImportResults(null);
  };

  // Data Grid columns
  const columns: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 120, disableColumnMenu: true },
    { 
      field: 'name', 
      headerName: 'Product Name', 
      width: 200, 
      disableColumnMenu: true,
      renderCell: (params) => {
        const fullName = `${params.row.name}${params.row.size ? ' ' + params.row.size : ''}${params.row.color ? ' ' + params.row.color : ''}`;
        return (
          <Tooltip title={fullName}>
            <span>{fullName}</span>
          </Tooltip>
        );
      }
    },
    { field: 'brand', headerName: 'Brand', width: 120, disableColumnMenu: true },
    { field: 'category_name', headerName: 'Category', width: 130, disableColumnMenu: true },
    { field: 'unit', headerName: 'Unit', width: 80, disableColumnMenu: true },
    { 
      field: 'cost_price', 
      headerName: 'Cost Price', 
      width: 110,
      type: 'number',
      valueFormatter: (params) => `$${params.value?.toFixed(2)}`,
      disableColumnMenu: true
    },
    { 
      field: 'selling_price', 
      headerName: 'Selling Price', 
      width: 120,
      type: 'number',
      valueFormatter: (params) => `$${params.value?.toFixed(2)}`,
      disableColumnMenu: true
    },
    { 
      field: 'current_stock', 
      headerName: 'Stock', 
      width: 90,
      type: 'number',
      renderCell: (params) => {
        const isLowStock = params.row.current_stock <= params.row.min_stock_level;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isLowStock && <WarningIcon color="warning" sx={{ mr: 0.5, fontSize: 16 }} />}
            {params.value}
          </Box>
        );
      },
      disableColumnMenu: true
    },
    { field: 'min_stock_level', headerName: 'Min Stock', width: 100, type: 'number', disableColumnMenu: true },
    { field: 'supplier_name', headerName: 'Supplier', width: 140, disableColumnMenu: true },
    { 
      field: 'barcode', 
      headerName: 'Barcode', 
      width: 120,
      renderCell: (params) => (
        params.value ? (
          <Tooltip title={params.value}>
            <Chip label="Has Barcode" size="small" color="primary" />
          </Tooltip>
        ) : (
          <Button
            size="small"
            onClick={() => generateBarcode(params.row.id)}
            disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
          >
            Generate
          </Button>
        )
      ),
      disableColumnMenu: true
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={params.value ? 'Active' : 'Inactive'} 
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
      disableColumnMenu: true
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      headerClassName: 'dg-actions-header',
      cellClassName: 'dg-actions-cell',
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit Product">
            <IconButton
              size="small"
              onClick={() => {
                setEditingProduct(params.row);
                setProductDialog(true);
              }}
              disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Product">
            <IconButton
              size="small"
              onClick={() => handleDeleteProduct(params.row.id)}
              disabled={!user || user.role !== 'admin'}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
      // Only this column has column menu enabled
      disableColumnMenu: false
    }
  ];

  // Column customization state: order and visibility
  const defaultColumnsState = [
    { key: 'select', label: 'Select', visible: true },
    { key: 'sku', label: 'SKU', visible: true },
    { key: 'name', label: 'Product Name', visible: true },
    { key: 'brand', label: 'Brand', visible: true },
    { key: 'category_name', label: 'Category', visible: true },
    { key: 'variety', label: 'Variant / Type', visible: true },
    { key: 'material', label: 'Material', visible: true },
    { key: 'size', label: 'Size / Measurement', visible: true },
    { key: 'color', label: 'Color / Finish', visible: true },
    { key: 'unit', label: 'Unit', visible: true },
    { key: 'cost_price', label: 'Cost', visible: true },
    { key: 'selling_price', label: 'Price', visible: true },
    { key: 'current_stock', label: 'Stock', visible: true },
    { key: 'min_stock_level', label: 'Min Stock', visible: false },
    { key: 'supplier_name', label: 'Supplier', visible: false },
    { key: 'barcode', label: 'Barcode', visible: false },
    { key: 'is_active', label: 'Status', visible: false },
    { key: 'actions', label: 'Actions', visible: true, fixed: true }
  ];

  const [columnsState, setColumnsState] = useState(() => {
    try {
      const saved = localStorage.getItem('products_columns_state');
      if (saved) return JSON.parse(saved) as typeof defaultColumnsState;
    } catch (e) {}
    return defaultColumnsState;
  });

  // Persist columns state
  useEffect(() => {
    try { localStorage.setItem('products_columns_state', JSON.stringify(columnsState)); } catch (e) {}
  }, [columnsState]);

  const toggleColumnVisible = (key: string) => {
    setColumnsState(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    setColumnsState(prev => {
      const idx = prev.findIndex(c => c.key === key);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  // Mirror Inventory: separate visibleColumns map and columnOrder (string list) with native DnD handlers
  const defaultVisibleColumns = defaultColumnsState.reduce((acc, c) => { acc[c.key] = !!c.visible; return acc; }, {} as Record<string, boolean>);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('products_visible_columns');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        // Ensure actions is always visible
        parsed.actions = true;
        return parsed;
      }
    } catch (e) {}
    return defaultVisibleColumns;
  });

  const defaultColumnOrder = defaultColumnsState.map(c => c.key).filter(k => k !== 'actions');
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try { const raw = localStorage.getItem('products_column_order'); if (raw) return JSON.parse(raw) as string[]; } catch (e) {}
    return defaultColumnOrder;
  });

  const persistColumnOrder = (order: string[]) => {
    try { localStorage.setItem('products_column_order', JSON.stringify(order)); } catch (e) {}
  };

  const resetColumnOrderToDefault = () => { setColumnOrder(defaultColumnOrder); persistColumnOrder(defaultColumnOrder); };

  const toggleColumn = (col: string) => {
    if (col === 'actions') return;
    setVisibleColumns(prev => {
      const updated = { ...prev, [col]: !prev[col] };
      // Persist immediately
      try {
        localStorage.setItem('products_visible_columns', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setColumnMode('custom');
  };

  const setAllColumns = () => {
    setVisibleColumns(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => { if (k !== 'actions') copy[k] = true; });
      // Persist immediately
      try {
        localStorage.setItem('products_visible_columns', JSON.stringify(copy));
      } catch (e) {}
      return copy;
    });
  };

  const setDefaultColumns = () => {
    const defaults = { ...defaultVisibleColumns };
    setVisibleColumns(defaults);
    // Persist immediately
    try {
      localStorage.setItem('products_visible_columns', JSON.stringify(defaults));
    } catch (e) {}
  };

  // Helper to get conditional display style for columns
  const getColumnStyle = (columnKey: string) => {
    const isHidden = visibleColumns[columnKey] === false;
    const isSelectHidden = visibleColumns['select'] === false;
    // Add left padding to first visible column when select is hidden
    const isFirstColumn = columnKey === 'sku' || (columnKey === 'name' && visibleColumns['sku'] === false);
    const needsPadding = isSelectHidden && isFirstColumn && !isHidden;
    
    return {
      display: isHidden ? 'none' : undefined,
      pl: needsPadding ? 4 : undefined
    };
  };

  const formatLabel = (key: string) => {
    if (key.toLowerCase() === 'sku') return 'SKU';
    return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  // native drag-and-drop handlers (string ids based on column keys)
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch (err) {}
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const draggedId = draggingId || e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === overId) return;
    setColumnOrder((prev) => {
      const copy = [...prev];
      const from = copy.indexOf(draggedId);
      const to = copy.indexOf(overId);
      if (from === -1 || to === -1) return prev;
      copy.splice(from, 1);
      copy.splice(to, 0, draggedId);
      persistColumnOrder(copy);
      setColumnMode('custom');
      return copy;
    });
    setDraggingId(null);
  };

  const onDragEndNative = () => setDraggingId(null);

  const resetColumns = () => setColumnsState(defaultColumnsState);

  // Handle component-level errors
  if (componentError) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="error" gutterBottom>
          Component Error
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {componentError.message}
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => {
            setComponentError(null);
            window.location.reload();
          }}
        >
          Refresh Page
        </Button>
      </Box>
    );
  }

  return (
  <Box
      sx={{
        p: 3,
        backgroundColor: '#f7f8fA',
        height: '100vh',
        overflow: 'hidden',
        '&, & *': {
          fontSize: '14px !important'
        },
        '& .MuiTypography-root': { fontSize: '14px !important' },
        '& .MuiTableCell-root': { fontSize: '14px !important' },
        '& .MuiButton-root': { fontSize: '14px !important' },
        '& .MuiInputBase-root': { fontSize: '14px !important' },
        '& .MuiDataGrid-root .MuiDataGrid-cell, & .MuiDataGrid-root .MuiDataGrid-columnHeader': { fontSize: '14px !important' }
      }}
    >
      {/* Error Display */}
      {hasError && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={clearError}>
              Dismiss
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      )}
      
      {/* Product / Category tabs */}
      <Tabs
        value={productSubPage}
        onChange={(_, value) => setProductSubPage(value)}
        sx={{ mb: 2 }}
        aria-label="Product and Category tabs"
      >
        <Tab label="Product" value="product" />
        <Tab label="Category" value="category" />
      </Tabs>

      {/* Toolbar (show only on Product subpage) */}
      {productSubPage === 'product' && (
        <Card sx={{ mb: 2, backgroundColor: '#fff', borderRadius: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 1.5, pb: '12px !important', display: 'flex', alignItems: 'center' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                variant="outlined"
                size="small"
                InputProps={{
                  sx: {
                    borderRadius: '20px',
                    backgroundColor: '#ffffff',
                    px: 1.5,
                    py: 0,
                    boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)',
                    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(0,0,0,0.08)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.12)' },
                    '& .MuiInputBase-input': { padding: '10px 12px', fontSize: '14px' }
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon sx={{ color: 'rgba(0,0,0,0.45)', fontSize: 18, mr: 1 }} />
                      <IconButton size="small" onClick={startBarcodeScanner} aria-label="Scan barcode" sx={{ mr: 0 }}>
                        <ScanIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            {/* Category quick filter removed from header as requested; keep header table filter button intact */}
            {/* Brand quick filter removed from header as requested; keep header table filter button intact */}
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    resetForm();
                    setProductDialog(true);
                  }}
                  disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                  sx={{ borderRadius: 2, textTransform: 'none', minHeight: 36, px: 2, whiteSpace: 'nowrap' }}
                >
                  Add Product
                </Button>
                {/* Scan button moved into the search input adornment for parity with POS */}
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExport}
                  disabled={loading}
                  sx={{ borderRadius: 2, textTransform: 'none', minHeight: 36, px: 2, whiteSpace: 'nowrap' }}
                >
                  Export
                </Button>
                <Button
                  variant="contained"
                  startIcon={<UploadIcon />}
                  onClick={handleExcelImportClick}
                  disabled={!user || (user.role !== 'admin' && user.role !== 'manager') || loading}
                  sx={{ borderRadius: 2, textTransform: 'none', minHeight: 36, px: 2, whiteSpace: 'nowrap' }}
                >
                  Import Excel
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchProducts}
                  disabled={loading}
                  sx={{ borderRadius: 2, textTransform: 'none', minHeight: 36, px: 2, whiteSpace: 'nowrap' }}
                >
                  Refresh
                </Button>
              </Box>
            </Grid>
          </Grid>
          </CardContent>
        </Card>
      )}

      {/* Data Grid or Category Management depending on subpage */}
      {productSubPage === 'product' && (
        <Card sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
        {/* White background wrapper for the table so it appears as a card */}
        <Paper sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, mb: 2, boxShadow: 'none' }} elevation={0}>
          <TableContainer
            sx={{
              position: 'relative',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              // ensure children don't overflow the rounded corners
              overflowClipMargin: 'content-box',
              // allow TableContainer to clip children to rounded corners
              overflow: 'hidden',
              '& .MuiTable-root': { borderRadius: 2 }
            }}
          >
            {/* Inner scrolling area to keep rounded corners on the container */}
            <Box sx={{
              maxHeight: 538,
              overflow: 'auto',
              // custom scrollbar styling: ultra-thin and remove native buttons/triangle
              '&::-webkit-scrollbar': {
                width: 1,
                height: 1,
              },
              '&::-webkit-scrollbar-button': {
                display: 'none',
                width: 0,
                height: 0,
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.28)',
                borderRadius: 999,
                minHeight: 20,
              },
              '&::-webkit-scrollbar-corner': {
                background: 'transparent'
              },
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0,0,0,0.28) transparent',
              '&': {
                MsOverflowStyle: 'auto'
              }
            }}>
              <Table stickyHeader sx={{ minWidth: 1100, '& .MuiTableCell-root': { py: 0.5 }, '& .MuiTableRow-root.MuiTableRow-head': { height: 40 }, '& .MuiTableRow-root': { height: 40 } }}>
                  <TableHead>
                    <TableRow sx={{ height: 40 }}>
                      <TableCell sx={{ ...headerCellSx, width: 48, py: 0.5, zIndex: 1300, ...getColumnStyle('select') }}>
                        <Checkbox
                          checked={isAllSelected}
                          indeterminate={(selectedProducts as number[]).length > 0 && (selectedProducts as number[]).length < products.length}
                          onChange={toggleSelectAll}
                          inputProps={{ 'aria-label': 'select all' }}
                        />
                      </TableCell>
                      <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: '#f7f7f7', zIndex: 1200, py: 0.5, ...truncateSx, ...getColumnStyle('sku') }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: .5 }}>
                          <TableSortLabel active={sortBy === 'sku'} direction={sortBy === 'sku' ? sortOrder : 'asc'} onClick={() => handleRequestSort('sku')}>SKU</TableSortLabel>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...truncateSx, ...getColumnStyle('name') }}> 
                        <TableSortLabel active={sortBy === 'name'} direction={sortBy === 'name' ? sortOrder : 'asc'} onClick={() => handleRequestSort('name')}>Product Name</TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...truncateSx, ...getColumnStyle('brand') }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <span>Brand</span>
                          <IconButton
                            size="small"
                            onClick={(e) => { setTempBrandSelection(filterBrand ? [String(filterBrand)] : []); setBrandAnchor(e.currentTarget); }}
                            sx={{ ml: .5 }}
                            aria-label="Filter brand"
                          >
                            <FilterListIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...truncateSx, ...getColumnStyle('category_name') }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <span>Category</span>
                          <IconButton
                            size="small"
                            onClick={(e) => { setTempCategorySelection(filterCategory ? [String(filterCategory)] : []); setCategoryAnchor(e.currentTarget); }}
                            sx={{ ml: .5 }}
                            aria-label="Filter category"
                          >
                            <FilterListIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...getColumnStyle('variety') }}>Variant / Type</TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...getColumnStyle('material') }}>Material</TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...getColumnStyle('size') }}>Size / Measurement</TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...getColumnStyle('color') }}>Color / Finish</TableCell>
                      <TableCell sx={{ ...headerCellSx, py: 0.5, ...truncateSx, ...getColumnStyle('unit') }}>
                        Unit
                      </TableCell>
                      <TableCell sx={{ ...{ top: 0, position: 'sticky', backgroundColor: '#f7f7f7', zIndex: 1200, py: 0.5 }, ...truncateSx, ...getColumnStyle('cost_price') }}>Cost</TableCell>
                      <TableCell sx={{ ...{ top: 0, position: 'sticky', backgroundColor: '#f7f7f7', zIndex: 1200, py: 0.5 }, ...truncateSx, ...getColumnStyle('selling_price') }}>Price</TableCell>
                      <TableCell sx={{ ...{ top: 0, position: 'sticky', backgroundColor: '#f7f7f7', zIndex: 1200, py: 0.5 }, ...truncateSx, ...getColumnStyle('current_stock') }}>Stock</TableCell>
                      <TableCell sx={{
                        top: 0,
                        position: 'sticky',
                        right: 0,
                        backgroundColor: '#f7f7f7',
                        // Z-index high enough for dual sticky (top+right) but below modals (1300)
                        zIndex: 1250,
                        borderLeft: '1px solid',
                        borderColor: 'divider',
                        whiteSpace: 'nowrap',
                        pr: 0,
                        py: 0.5,
                        // keep the actions vertically centered and make icon buttons compact
                        '& .MuiIconButton-root': { height: 32, width: 32, p: 0 }
                      }}>
                        <Box sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 1,
                          height: 40,
                          minHeight: 40
                        }}>
                          <Box sx={{ mr: 1 }}>Actions</Box>
                          <IconButton size="small" onClick={openColMenu} sx={{ p: 0.5 }} aria-label="Columns">
                            {/* more icon */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} sx={{ textAlign: 'center', py: 8 }}>
                          {loading ? (
                            <>
                              <CircularProgress size={40} />
                              <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                                Loading products...
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No products found
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      products
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((item) => (
                      <TableRow key={item.id} hover sx={{ height: 40 }}>
                        <TableCell sx={{ ...cellSx, py: .5, ...getColumnStyle('select') }}>
                          <Checkbox
                            checked={(selectedProducts as number[]).includes(item.id)}
                            onChange={() => toggleRowSelected(item.id)}
                            inputProps={{ 'aria-label': `select ${item.sku}` }}
                          />
                        </TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('sku') }}>{item.sku}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('name') }}><Typography noWrap>{item.name}</Typography></TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('brand') }}>{item.brand}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('category_name') }}>{item.category_name}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('variety') }}>{item.variety || '-'}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('material') }}>{(item as any).material || '-'}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('size') }}>{item.size || '-'}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('color') }}>{item.color || '-'}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, maxWidth: 140, ...getColumnStyle('unit') }}>{item.unit || '-'}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('cost_price') }}>{`$${(Number(item.cost_price) || 0).toFixed(2)}`}</TableCell>
                        <TableCell sx={{ ...cellSx, ...truncateSx, ...getColumnStyle('selling_price') }}>{`$${(Number(item.selling_price) || 0).toFixed(2)}`}</TableCell>
                        <TableCell sx={{ ...cellSx, ...getColumnStyle('current_stock') }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {item.current_stock <= item.min_stock_level && <WarningIcon color="warning" sx={{ mr: 0.5, fontSize: 16 }} />}
                            <Typography noWrap>{item.current_stock}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1200, WebkitBackgroundClip: 'padding-box', backgroundClip: 'padding-box', boxShadow: '-6px 0 12px rgba(0,0,0,0.04)', borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap', pointerEvents: 'auto', pr: 0, py: 0.5, '& .MuiIconButton-root': { height: 32, width: 32, p: 0 } }}>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'center', height: 40, minHeight: 40 }}>
                            <Tooltip title="Edit Product">
                              <IconButton size="small" onClick={() => { setEditingProduct(item); setProductDialog(true); }} disabled={!user || (user.role !== 'admin' && user.role !== 'manager') || productDialog}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Product">
                              <IconButton size="small" onClick={() => handleDeleteProduct(item.id)} disabled={!user || user.role !== 'admin' || productDialog} color="error">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {/* per-row three-dot removed - header menu handles actions */}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )))}
                  </TableBody>
                </Table>
              </Box>
            </TableContainer>
            
            {/* Pagination Controls */}
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={products.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                '& .MuiTablePagination-toolbar': {
                  minHeight: 48,
                  px: 2
                },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  fontSize: '14px'
                }
              }}
            />
            
            {/* Column visibility menu (keeps shape consistent with Inventory) */}
            <Menu
              anchorEl={colMenuAnchor}
              open={Boolean(colMenuAnchor)}
              onClose={closeColMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{ sx: { minWidth: 130, maxWidth: 220, p: 0.2, fontFamily: 'inherit', fontSize: '14px', '&, & *': { fontFamily: 'inherit', fontSize: '14px' } } }}
              MenuListProps={{ sx: { width: 'auto', pr: 0, pl: .2, fontSize: '14px', '&, & *': { fontFamily: 'inherit', fontSize: '14px' }, '& .MuiListItem-root': { py: 0 }, '& .MuiFormControlLabel-label': { fontSize: '14px', fontFamily: 'inherit' } } }}
            >
              <Box sx={{ p: .75, pt: 0 }}>
                <RadioGroup
                  value={columnMode}
                  onChange={(e) => setColumnMode(e.target.value as any)}
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'flex-start', pl: .25 }}
                >
                  <FormControlLabel
                    value="default"
                    control={<Radio size="small" />}
                    label="Default"
                    onClick={() => { setDefaultColumns(); resetColumnOrderToDefault(); setColumnMode('default'); }}
                    sx={{ width: '100%', mb: 0, '& .MuiFormControlLabel-label': { fontSize: '14px', fontFamily: 'inherit', ml: 0 } }}
                  />
                  <FormControlLabel
                    value="all"
                    control={<Radio size="small" />}
                    label="All"
                    onClick={() => { setAllColumns(); setColumnMode('all'); }}
                    sx={{ width: '100%', mb: 0, '& .MuiFormControlLabel-label': { fontSize: '14px', fontFamily: 'inherit', ml: 0 } }}
                  />
                  <FormControlLabel
                    value="custom"
                    control={<Radio size="small" />}
                    label="Customize"
                    onClick={() => setColumnMode('custom')}
                    sx={{ width: '100%', mb: 0, '& .MuiFormControlLabel-label': { fontSize: '14px', fontFamily: 'inherit', ml: 0 } }}
                  />
                </RadioGroup>
              </Box>
              <Divider />
              <Box sx={{ maxHeight: 320, overflow: 'auto',
                '&::-webkit-scrollbar': { width: 1, height: 1 },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 999, minHeight: 12 },
                '&::-webkit-scrollbar-corner': { background: 'transparent' },
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.18) transparent'
              }}>
                <List dense sx={{ py: 0, '&::-webkit-scrollbar': { width: .1, height: .1 }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 999, minHeight: 16 }, '&::-webkit-scrollbar-track': { background: 'transparent' }, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.22) transparent' }}>
                  {columnOrder.map((col) => (
                    <ListItem
                      key={col}
                      draggable
                      onDragStart={(e) => onDragStart(e, col)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, col)}
                      onDragEnd={onDragEndNative}
                      sx={{ display: 'flex', alignItems: 'center', cursor: 'default', gap: 0, px: .75, py: 0 }}
                    >
                      <Box sx={{ color: 'action.disabled', cursor: 'grab', display: 'flex', alignItems: 'center', mr: 0, transform: 'translateY(1px)' }}>
                        <DragIndicatorIcon fontSize="small" sx={{ opacity: 0.9 }} />
                      </Box>
                      <Checkbox
                        checked={!!visibleColumns[col]}
                        onChange={() => toggleColumn(col)}
                        size="medium"
                        disableRipple
                        sx={{ ml: 0, mr: 0, transform: 'scale(0.98)', '& .MuiSvgIcon-root': { fontSize: 20 }, '&.Mui-focusVisible, &:focus-visible': { boxShadow: 'none', outline: 'none' } }}
                        inputProps={{ 'aria-label': `${formatLabel(col)} visible` }}
                      />
                      <Typography sx={{ flex: 1, ml: 0, textTransform: 'none', fontWeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'inherit', fontSize: '14px' }}>{formatLabel(col)}</Typography>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Menu>
            {/* header menu expanded below */}
            {/* Brand popover */}
            <Popover open={Boolean(brandAnchor)} anchorEl={brandAnchor} onClose={closeBrandPopover} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} PaperProps={{ sx: { borderRadius: 1, boxShadow: 6, overflow: 'hidden', fontSize: '14px', fontFamily: 'inherit' } }}>
              <Box sx={{ minWidth: 130, maxWidth: 190, p: 0.2 }}>
                <List sx={{ maxHeight: 320, overflow: 'auto', p: 0 }}>
                  <ListItem sx={{ py: 0, px: 0, alignItems: 'center' }}>
                    <Checkbox checked={tempBrandSelection.length === 0} onChange={(e) => setTempBrandSelection(e.target.checked ? [] : Array.from(new Set(products.map(i => i.brand).filter((v): v is string => !!v))))} color="success" sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }} />
                    <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px', textTransform: 'none' }}>All</Typography>
                  </ListItem>
                  <Divider sx={{ my: 0.5 }} />
                  {Array.from(new Set(products.map(i => i.brand).filter((v): v is string => !!v))).map((b) => (
                    <ListItem key={b} sx={{ py: 0, px: 0, alignItems: 'center' }}>
                      <Checkbox checked={tempBrandSelection.includes(b as string)} onChange={(e) => { setTempBrandSelection(prev => { const copy = new Set(prev); if (e.target.checked) copy.add(b as string); else copy.delete(b as string); return Array.from(copy); }); }} color="success" sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }} />
                      <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px' }}>{b}</Typography>
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ display: 'flex', justifyContent: 'left', mt: 0.25, px: 5, gap: 1.25, mb: .75}}>
                  <Button onClick={() => setTempBrandSelection([])} variant="outlined" sx={{ bgcolor: '#f5f5f5', color: 'text.secondary', borderColor: 'transparent', textTransform: 'none', px: 1, py: .3, fontSize: '14px' }}>Reset</Button>
                  <Button onClick={() => { setFilterBrand(tempBrandSelection.join(',')); setBrandAnchor(null); }} variant="contained" color="success" sx={{ textTransform: 'none', px: 1, py: .3, fontSize: '14px' }}>Confirm</Button>
                </Box>
              </Box>
            </Popover>

            {/* Category popover (mirror of Brand popover) */}
            <Popover open={Boolean(categoryAnchor)} anchorEl={categoryAnchor} onClose={() => setCategoryAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} PaperProps={{ sx: { borderRadius: 1, boxShadow: 6, overflow: 'hidden', fontSize: '14px', fontFamily: 'inherit' } }}>
              <Box sx={{ minWidth: 130, maxWidth: 190, p: 0.2 }}>
                <List sx={{ maxHeight: 320, overflow: 'auto', p: 0 }}>
                  <ListItem sx={{ py: 0, px: 0, alignItems: 'center' }}>
                    <Checkbox checked={tempCategorySelection.length === 0} onChange={(e) => setTempCategorySelection(e.target.checked ? [] : Array.from(new Set(products.map(i => i.category_name).filter((v): v is string => !!v))))} color="success" sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }} />
                    <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px', textTransform: 'none' }}>All</Typography>
                  </ListItem>
                  <Divider sx={{ my: 0.5 }} />
                  {Array.from(new Set(products.map(i => i.category_name).filter((v): v is string => !!v))).map((c) => (
                    <ListItem key={c} sx={{ py: 0, px: 0, alignItems: 'center' }}>
                      <Checkbox checked={tempCategorySelection.includes(c as string)} onChange={(e) => { setTempCategorySelection(prev => { const copy = new Set(prev); if (e.target.checked) copy.add(c as string); else copy.delete(c as string); return Array.from(copy); }); }} color="success" sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }} />
                      <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px' }}>{c}</Typography>
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ display: 'flex', justifyContent: 'left', mt: 0.25, px: 5, gap: 1.25, mb: .75}}>
                  <Button onClick={() => setTempCategorySelection([])} variant="outlined" sx={{ bgcolor: '#f5f5f5', color: 'text.secondary', borderColor: 'transparent', textTransform: 'none', px: 1, py: .3, fontSize: '14px' }}>Reset</Button>
                  <Button onClick={() => { setFilterCategory(tempCategorySelection.join(',')); setCategoryAnchor(null); }} variant="contained" color="success" sx={{ textTransform: 'none', px: 1, py: .3, fontSize: '14px' }}>Confirm</Button>
                </Box>
              </Box>
            </Popover>
          </Paper>
        </Card>
      )}

      {productSubPage === 'category' && (
        <Card sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          <Paper sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, mb: 2, boxShadow: 'none' }} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Categories</Typography>
              <Box>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setNewCategoryName(''); setNewCategoryDescription(''); setNewCategoryParentId(''); setCategoryDialogOpen(true); }}>
                  Add Category
                </Button>
              </Box>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Parent</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(categories || []).map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell>{cat.name}</TableCell>
                      <TableCell>{cat.description || '-'}</TableCell>
                      <TableCell>{(cat as any).parent_name || '-'}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => {
                          setEditingCategoryId(cat.id);
                          setNewCategoryName(cat.name || '');
                          setNewCategoryDescription(cat.description || '');
                          setNewCategoryParentId(cat.parent_id ?? '');
                          setCategoryFormError(null);
                          setCategoryDialogOpen(true);
                        }}>Edit</Button>
                        <Button size="small" color="error" onClick={() => setDeleteCategoryId(cat.id)} sx={{ ml: 1 }}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Card>
      )}

      {/* Product Dialog */}
      <Dialog 
        open={productDialog} 
        onClose={() => { setProductDialog(false); resetForm(); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingProduct.id ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              {/* Category & Supplier at the very top */}
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Category"
                  value={editingProduct.category_id ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingProduct(prev => ({ ...prev, category_id: val === '' ? undefined : Number(val) }));
                  }}
                  SelectProps={{
                    MenuProps: {
                      PaperProps: { style: { maxHeight: 250 } }
                    }
                  }}
                >
                  <MenuItem value="">No Category</MenuItem>
                  {(categories || []).map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Supplier"
                  value={editingProduct.supplier_id ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingProduct(prev => ({ ...prev, supplier_id: val === '' ? undefined : Number(val) }));
                  }}
                  SelectProps={{
                    MenuProps: {
                      PaperProps: { style: { maxHeight: 250 } }
                    }
                  }}
                >
                  <MenuItem value="">No Supplier</MenuItem>
                  {(suppliers || []).filter(s => s.is_active).map((supplier) => (
                    <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SKU (optional)"
                  value={editingProduct.sku || ''}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, sku: e.target.value }))}
                  disabled={!!editingProduct.id}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    label="Barcode"
                    value={scannedBarcode || editingProduct.barcode || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setScannedBarcode(value);
                      setEditingProduct(prev => ({ ...prev, barcode: value }));
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={startBarcodeScanner}
                    sx={{ minWidth: 'auto', px: 2 }}
                  >
                    <ScanIcon />
                  </Button>
                </Box>
              </Grid>
              {/* Brand before Product Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Brand"
                  value={editingProduct.brand || ''}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, brand: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Product Name *"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              {/* Material, Size, Variant, Color, Unit — equal width on one line */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  {['Material', 'Size / Measurement', 'Variant / Type', 'Color / Finish', 'Unit'].map((label, idx) => {
                    const key = ['material', 'size', 'variety', 'color', 'unit'][idx];
                    return (
                      <Box key={key} sx={{ flex: '1 1 0', minWidth: '10ch' }}>
                        <TextField
                          fullWidth
                          label={label}
                          value={(editingProduct as any)[key] || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, [key]: e.target.value }))}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Grid>
              
              {/* Cost, Selling, Profit Margin in one row */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Cost Price *"
                  type="number"
                  inputProps={{ min: 0, step: 0.01 }}
                  value={editingProduct.cost_price ?? ''}
                  onFocus={() => { if ((editingProduct.cost_price ?? 0) === 0) setEditingProduct(prev => ({ ...prev, cost_price: undefined })); }}
                  onChange={(e) => handleCostChange(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Selling Price *"
                  type="number"
                  inputProps={{ min: 0, step: 0.01 }}
                  value={editingProduct.selling_price ?? ''}
                  onFocus={() => { if ((editingProduct.selling_price ?? 0) === 0) setEditingProduct(prev => ({ ...prev, selling_price: undefined })); }}
                  onChange={(e) => handleSellingChange(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label={localMargin !== '' && Number(localMargin) > 30 ? 'Profit Margin (%) (30% max only)' : 'Profit Margin (%) (30% max only)'}
                  type="number"
                  inputProps={{ min: 0, step: 0.01 }}
                  value={localMargin === '' ? '' : localMargin}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  placeholder="(max 30)"
                  error={localMargin !== '' && Number(localMargin) > 30}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Min Stock Level"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={editingProduct.min_stock_level ?? ''}
                  onFocus={() => { if ((editingProduct.min_stock_level ?? 0) === 0) setEditingProduct(prev => ({ ...prev, min_stock_level: undefined })); }}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, min_stock_level: parseInt(e.target.value) || 0 }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Stock Level"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={editingProduct.max_stock_level ?? ''}
                  onFocus={() => { if ((editingProduct.max_stock_level ?? 0) === 0) setEditingProduct(prev => ({ ...prev, max_stock_level: undefined })); }}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, max_stock_level: parseInt(e.target.value) || 0 }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Initial Stock"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={editingProduct.current_stock ?? ''}
                  onFocus={() => { if ((editingProduct.current_stock ?? 0) === 0) setEditingProduct(prev => ({ ...prev, current_stock: undefined })); }}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, current_stock: parseInt(e.target.value) || 0 }))}
                  disabled={!!editingProduct.id}
                  helperText={editingProduct.id ? "Use inventory management to adjust stock" : ''}
                />
              </Grid>

              {/* Description moved to bottom as requested */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, description: e.target.value }))}
                />
              </Grid>
            </Grid>
            
            {/* Validation warnings */}
            {editingProduct.cost_price && editingProduct.selling_price && 
             editingProduct.cost_price >= editingProduct.selling_price && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Cost price is greater than or equal to selling price. This may result in low or negative margins.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Box>
            {!editingProduct.id && (
              <Button 
                onClick={openVariantWizard}
                variant="outlined"
                color="secondary"
                disabled={loading || !editingProduct.name}
                sx={{ mr: 1 }}
              >
                Create Variants
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => { setProductDialog(false); resetForm(); }}>Cancel</Button>
            {!editingProduct.id && (
              <Button 
                onClick={() => handleSaveProduct(true)}
                variant="outlined"
                disabled={loading}
              >
                Save & Create New
              </Button>
            )}
            <Button 
              onClick={() => handleSaveProduct(false)}
              variant="contained"
              disabled={loading}
            >
              {editingProduct.id ? 'Update Product' : 'Save Product'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Category Confirmation Dialog */}
      <Dialog open={Boolean(deleteCategoryId)} onClose={() => setDeleteCategoryId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this category? This action cannot be undone.</Typography>
          {categoryFormError && (
            <Alert severity="error" sx={{ mt: 2 }}>{categoryFormError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCategoryId(null)} disabled={deletingCategory}>Cancel</Button>
          <Button onClick={confirmDeleteCategory} color="error" variant="contained" disabled={deletingCategory}>
            {deletingCategory ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Category Dialog */}
      <Dialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
                  <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Category Name *"
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setCategoryFormError(null);
                  }}
                />
                {categoryFormError && (
                  <Alert severity="error" sx={{ mt: 1 }}>{categoryFormError}</Alert>
                )}
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Parent Category</InputLabel>
                  <Select
                    value={newCategoryParentId}
                    label="Parent Category"
                    onChange={(e) => setNewCategoryParentId(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <MenuItem value="">None</MenuItem>
                    {(categories || []).map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                  <Button
            variant="contained"
            disabled={creatingCategory || !newCategoryName.trim()}
            onClick={async () => {
              try {
                setCreatingCategory(true);
                const payload = {
                  name: newCategoryName.trim(),
                  description: newCategoryDescription || null,
                  parentId: newCategoryParentId === '' ? null : newCategoryParentId
                };

                // Client-side duplicate name check (case-insensitive)
                const duplicate = (categories || []).find(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase() && c.id !== editingCategoryId);
                if (duplicate) {
                  setCategoryFormError('A category with this name already exists');
                  return;
                }

                if (editingCategoryId) {
                  // Update
                  await axios.put(`${API_BASE_URL}/products/categories/${editingCategoryId}`, payload);
                  showNotification('Category updated', 'success');
                } else {
                  const resp = await axios.post(`${API_BASE_URL}/products/categories`, payload);
                  const newId = resp.data?.categoryId;
                  showNotification('Category created', 'success');
                  if (newId) setEditingProduct(prev => ({ ...prev, category_id: newId }));
                }

                setCategoryDialogOpen(false);
                await fetchCategories();
              } catch (err: any) {
                const msg = err.response?.data?.message || 'Failed to save category';
                setCategoryFormError(msg);
              } finally {
                setCreatingCategory(false);
                setEditingCategoryId(null);
              }
            }}
          >
            {editingCategoryId ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Variant Wizard Dialog */}
      <Dialog 
        open={variantWizardOpen} 
        onClose={() => {
          setVariantWizardOpen(false);
          setProductDialog(true);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Create Product Variants</Typography>
            <Typography variant="body2" color="text.secondary">
              Base Product: {baseProduct.name} {baseProduct.brand ? `- ${baseProduct.brand}` : ''}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Create multiple variants of the same product with different sizes, colors, or combinations. 
            Perfect for items like steel bars (different sizes) or paint (different colors).
          </Alert>
          
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Base Product Info:</Typography>
            <Grid container spacing={2}>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Category: {categories.find(c => c.id === baseProduct.category_id)?.name || 'None'}</Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Unit: {baseProduct.unit}</Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Base Cost: ${Number(baseProduct.cost_price || 0).toFixed(2)}</Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Base Price: ${Number(baseProduct.selling_price || 0).toFixed(2)}</Typography>
              </Grid>
            </Grid>
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Size / Measurement</TableCell>
                  <TableCell>Color / Finish</TableCell>
                  <TableCell>SKU (Optional)</TableCell>
                  <TableCell>Cost Price</TableCell>
                  <TableCell>Selling Price</TableCell>
                  <TableCell>Initial Stock</TableCell>
                  <TableCell width={60}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {variants.map((variant, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="e.g., 1/2 inch, 6ft"
                        value={variant.size || ''}
                        onChange={(e) => updateVariant(index, 'size', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="e.g., Red, Glossy"
                        value={variant.color || ''}
                        onChange={(e) => updateVariant(index, 'color', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Auto-generated"
                        value={variant.sku || ''}
                        onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        fullWidth
                        value={variant.costPrice || ''}
                        onChange={(e) => updateVariant(index, 'costPrice', parseFloat(e.target.value))}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        fullWidth
                        value={variant.sellingPrice || ''}
                        onChange={(e) => updateVariant(index, 'sellingPrice', parseFloat(e.target.value))}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        fullWidth
                        value={variant.stock || 0}
                        onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={() => removeVariantRow(index)}
                        disabled={variants.length === 1}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button 
              startIcon={<AddIcon />}
              onClick={addVariantRow}
              variant="outlined"
              size="small"
            >
              Add Another Variant
            </Button>
            <Typography variant="body2" color="text.secondary">
              Total variants: {variants.length}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setVariantWizardOpen(false);
              setProductDialog(true);
            }}
          >
            Back to Product
          </Button>
          <Button 
            onClick={saveAllVariants}
            variant="contained"
            disabled={loading || variants.length === 0}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            Create All Variants ({variants.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Excel Import Dialog */}
      <Dialog open={excelImportDialog} onClose={handleCloseImportDialog} maxWidth="md" fullWidth>
        <DialogTitle>Import Products from Excel</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            {!importResults ? (
              <>
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2" fontWeight="medium">Import Instructions:</Typography>
                  <Typography variant="body2" component="div">
                    1. Download the Excel template below<br />
                    2. Fill in your product data following the example rows<br />
                    3. Save the file and upload it here<br />
                    4. Products with the same Brand + Name will be grouped as variants
                  </Typography>
                </Alert>
                
                <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadTemplate}
                    sx={{ textTransform: 'none' }}
                  >
                    Download Excel Template
                  </Button>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box>
                  <input
                    type="file"
                    id="excel-file-input"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleExcelFileSelect}
                  />
                  <label htmlFor="excel-file-input">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<UploadIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      Select Excel File
                    </Button>
                  </label>
                  
                  {importFile && (
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      Selected file: <strong>{importFile.name}</strong>
                    </Typography>
                  )}
                </Box>
              </>
            ) : (
              <Box>
                <Alert 
                  severity={importResults.success ? 'success' : 'warning'} 
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body2" fontWeight="medium">
                    Import Summary
                  </Typography>
                  <Typography variant="body2">
                    Total Rows: {importResults.totalRows}<br />
                    Successfully Imported: {importResults.successCount}<br />
                    Errors: {importResults.errorCount}
                  </Typography>
                </Alert>

                {importResults.errors && importResults.errors.length > 0 && (
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                      Error Details:
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Row</TableCell>
                            <TableCell>Error</TableCell>
                            <TableCell>Data</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {importResults.errors.map((error: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{error.row}</TableCell>
                              <TableCell>{error.error}</TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                  {error.data?.sku || 'N/A'} - {error.data?.name || 'N/A'}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {!importResults ? (
            <>
              <Button onClick={handleCloseImportDialog}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleExcelImport}
                disabled={!importFile || importing}
                startIcon={importing ? <CircularProgress size={20} /> : <UploadIcon />}
              >
                {importing ? 'Importing...' : 'Import'}
              </Button>
            </>
          ) : (
            <Button onClick={handleCloseImportDialog} variant="contained">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <Dialog open={barcodeDialog} onClose={stopBarcodeScanner} maxWidth="sm" fullWidth>
        <DialogTitle>Scan Barcode</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {scannerActive ? (
              <Box>
                <div id="barcode-scanner" style={{ width: '100%' }} />
                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  Position the barcode within the scanner area
                </Typography>
              </Box>
            ) : (
              <Typography>Scanner not active</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={stopBarcodeScanner}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Products;