import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel, InputAdornment,
  Chip, Alert, Snackbar, Tooltip, IconButton, Tab, Tabs, LinearProgress, Popover,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Accordion, AccordionSummary, AccordionDetails, TableSortLabel, Menu, MenuItem as MUIMenuItem, Checkbox,
  RadioGroup, FormControlLabel, Radio, List, ListItem, Divider
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Search as SearchIcon, Download as DownloadIcon,
  Upload as UploadIcon, Refresh as RefreshIcon, Warning as WarningIcon,
  TrendingDown as LowStockIcon, Inventory as CountIcon, History as HistoryIcon,
  ExpandMore as ExpandMoreIcon, Assessment as ReportIcon, MoreVert as MoreVertIcon, Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import dataGridStickySx from '../utils/dataGridSticky';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';
// lightweight drag-and-drop implemented with native HTML5 events (no extra deps)

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  brand?: string;
  category_name?: string;
  unit: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  min_stock_level: number;
  max_stock_level: number;
  supplier_name?: string;
  location: string;
  last_counted_at?: string;
  cost_price: number;
  selling_price: number;
  inventory_value: number;
}

interface Movement {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  unit: string;
  transaction_type: string;
  quantity_change: number;
  notes: string;
  reference_type?: string;
  reference_number?: string;
  created_by_username: string;
  created_at: string;
}

interface LowStockItem {
  id: number;
  sku: string;
  name: string;
  brand?: string;
  category_name?: string;
  current_stock: number;
  min_stock_level: number;
  alert_level: string;
  shortage_quantity: number;
  supplier_name?: string;
  location: string;
  last_counted_at?: string;
}

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<GridRowSelectionModel>([]);
  
  // Dialog states
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [countDialog, setCountDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  
  // Form states
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // new filters: category, brand, availability
  // multi-select filters: empty array means "All"
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'not_available'>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Adjustment form
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantityChange: 0,
    reason: 'correction',
    notes: ''
  });
  
  // Count form
  const [countForm, setCountForm] = useState({
    countedQuantity: 0,
    countedBy: '',
    notes: ''
  });
  
  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'validating' | 'importing' | 'complete' | 'error'>('idle');
  const [importResults, setImportResults] = useState<any>(null);
  // sorting state
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sku: true,
    name: true,
    brand: true,
    category_name: true,
    unit: true,
    current_stock: true,
    reserved_stock: true,
    available_stock: true,
    min_stock_level: true,
    inventory_value: true,
    location: true,
    last_counted_at: true,
    // actions is special: always visible
    actions: true
  });
  // column menu
  const [colMenuAnchor, setColMenuAnchor] = useState<null | HTMLElement>(null);
  // Category / Brand filter popovers
  const [categoryAnchor, setCategoryAnchor] = useState<null | HTMLElement>(null);
  const [brandAnchor, setBrandAnchor] = useState<null | HTMLElement>(null);
  const [tempCategorySelection, setTempCategorySelection] = useState<string[]>([]);
  const [tempBrandSelection, setTempBrandSelection] = useState<string[]>([]);
  // column menu UI mode: default | all | custom
  const [columnMode, setColumnMode] = useState<'default' | 'all' | 'custom'>('custom');
  // column ordering for customize mode (persisted in localStorage)
  const defaultColumnOrder = Object.keys(visibleColumns).filter(c => c !== 'actions');
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('inventory_column_order');
      if (raw) return JSON.parse(raw) as string[];
    } catch (e) {
      // ignore
    }
    return defaultColumnOrder;
  });
  
  // Notifications
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // Selection helpers for checkboxes
  const isAllSelected = inventory.length > 0 && selectedItems.length === inventory.length;
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedItems([]);
    else setSelectedItems(inventory.map(i => i.id));
  };
  const toggleRowSelected = (id: number) => {
    setSelectedItems(prev => {
      const set = new Set(prev as number[]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  };

  // Fetch functions
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // preserve existing low stock option
      if (showLowStockOnly) params.append('low_stock_only', 'true');
      // apply new filters
  if (categoryFilter.length) params.append('category', categoryFilter.join(','));
  if (brandFilter.length) params.append('brand', brandFilter.join(','));
      if (availabilityFilter !== 'all') params.append('availability', availabilityFilter);

      
      const response = await axios.get(`${API_BASE_URL}/inventory?${params}`);
      setInventory(response.data || []);
    } catch (error) {
      showNotification('Failed to fetch inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, [showLowStockOnly, categoryFilter, brandFilter, availabilityFilter, API_BASE_URL]);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/inventory/movements?limit=100`);
      setMovements(response.data.movements || []);
    } catch (error) {
      showNotification('Failed to fetch movements', 'error');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  const fetchLowStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
  if (categoryFilter.length) params.append('category', categoryFilter.join(','));
  if (brandFilter.length) params.append('brand', brandFilter.join(','));
      if (availabilityFilter !== 'all') params.append('availability', availabilityFilter);
      
      const response = await axios.get(`${API_BASE_URL}/inventory/low-stock?${params}`);
      setLowStockItems(response.data.lowStockItems || []);
    } catch (error) {
      showNotification('Failed to fetch low stock items', 'error');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, brandFilter, availabilityFilter, API_BASE_URL]);

  useEffect(() => {
    if (activeTab === 0) fetchInventory();
    else if (activeTab === 1) fetchLowStock();
    else if (activeTab === 2) fetchMovements();
  }, [activeTab, fetchInventory, fetchLowStock, fetchMovements]);

  // Utility functions
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const resetForms = () => {
    setAdjustmentForm({ quantityChange: 0, reason: 'correction', notes: '' });
    setCountForm({ countedQuantity: 0, countedBy: '', notes: '' });
    setSelectedProduct(null);
  };

  // CRUD operations
  const handleAdjustment = async () => {
    if (!selectedProduct) return;

    try {
      setLoading(true);
      
      if (!adjustmentForm.notes.trim()) {
        showNotification('Please provide notes for the adjustment', 'error');
        return;
      }

      if (adjustmentForm.quantityChange === 0) {
        showNotification('Quantity change cannot be zero', 'error');
        return;
      }

      await axios.post(`${API_BASE_URL}/inventory/adjust`, {
        productId: selectedProduct.id,
        quantityChange: adjustmentForm.quantityChange,
        notes: adjustmentForm.notes,
        reason: adjustmentForm.reason
      });

      showNotification('Inventory adjusted successfully');
      setAdjustmentDialog(false);
      resetForms();
      fetchInventory();
      if (activeTab === 1) fetchLowStock();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to adjust inventory';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePhysicalCount = async () => {
    if (!selectedProduct) return;

    try {
      setLoading(true);
      
      if (!countForm.countedBy.trim()) {
        showNotification('Please specify who performed the count', 'error');
        return;
      }

      if (countForm.countedQuantity < 0) {
        showNotification('Counted quantity cannot be negative', 'error');
        return;
      }

      await axios.post(`${API_BASE_URL}/inventory/count`, {
        productId: selectedProduct.id,
        countedQuantity: countForm.countedQuantity,
        notes: countForm.notes,
        countedBy: countForm.countedBy
      });

      showNotification('Physical count completed successfully');
      setCountDialog(false);
      resetForms();
      fetchInventory();
      if (activeTab === 1) fetchLowStock();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to complete physical count';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export function
  const handleExport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (showLowStockOnly) params.append('low_stock_only', 'true');
  if (categoryFilter.length) params.append('category', categoryFilter.join(','));
  if (brandFilter.length) params.append('brand', brandFilter.join(','));
      if (availabilityFilter !== 'all') params.append('availability', availabilityFilter);
      
      const response = await axios.get(`${API_BASE_URL}/inventory/export/csv?${params}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      saveAs(blob, `inventory-export-${timestamp}.csv`);
      
      showNotification('Inventory exported successfully');
    } catch (error) {
      showNotification('Failed to export inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Import function
  const handleImport = async (validateOnly = false) => {
    if (!importFile) {
      showNotification('Please select a file to import', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('validateOnly', validateOnly.toString());

    try {
      setImportStatus(validateOnly ? 'validating' : 'importing');
      setImportProgress(0);
      
      const response = await axios.post(`${API_BASE_URL}/inventory/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total!);
          setImportProgress(progress);
        }
      });

      setImportResults(response.data);
      setImportStatus('complete');
      
      if (!validateOnly) {
        showNotification(`Successfully imported ${response.data.importedCount} adjustments`);
        fetchInventory();
        setImportDialog(false);
        setImportFile(null);
        setImportResults(null);
        setImportStatus('idle');
      }
    } catch (error: any) {
      setImportStatus('error');
      const message = error.response?.data?.message || 'Import failed';
      showNotification(message, 'error');
    }
  };

  // Data Grid columns
  const inventoryColumns: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 120, disableColumnMenu: true },
    { field: 'name', headerName: 'Product Name', width: 200, disableColumnMenu: true },
    { field: 'brand', headerName: 'Brand', width: 120, disableColumnMenu: true },
    { field: 'category_name', headerName: 'Category', width: 130, disableColumnMenu: true },
    { field: 'unit', headerName: 'Unit', width: 80, disableColumnMenu: true },
    { field: 'current_stock', headerName: 'Current Stock', width: 120, type: 'number', disableColumnMenu: true,
      renderCell: (params) => {
        const isLowStock = params.row.current_stock <= params.row.min_stock_level;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isLowStock && <WarningIcon color="warning" sx={{ mr: 0.5, fontSize: 16 }} />}
            {params.value}
          </Box>
        );
      }
    },
    { field: 'reserved_stock', headerName: 'Reserved', width: 100, type: 'number', disableColumnMenu: true },
    { field: 'available_stock', headerName: 'Available', width: 100, type: 'number', valueGetter: (params) => (params.row.current_stock || 0) - (params.row.reserved_stock || 0), disableColumnMenu: true },
    { field: 'min_stock_level', headerName: 'Min Level', width: 100, type: 'number', disableColumnMenu: true },
    { field: 'inventory_value', headerName: 'Value', width: 100, type: 'number', valueFormatter: (params) => `$${params.value?.toFixed(2)}`, valueGetter: (params) => (Number(params.row.current_stock) || 0) * (Number(params.row.cost_price) || 0), disableColumnMenu: true },
    { field: 'location', headerName: 'Location', width: 100, disableColumnMenu: true },
    { field: 'last_counted_at', headerName: 'Last Counted', width: 140, valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : 'Never', disableColumnMenu: true },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Adjust Stock">
            <IconButton
              size="small"
              onClick={() => {
                setSelectedProduct(params.row);
                setAdjustmentDialog(true);
              }}
              disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Physical Count">
            <IconButton
              size="small"
              onClick={() => {
                setSelectedProduct(params.row);
                setCountForm(prev => ({ ...prev, countedQuantity: params.row.current_stock }));
                setCountDialog(true);
              }}
              disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
            >
              <CountIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
      disableColumnMenu: false
    }
  ];

  const lowStockColumns: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 120 },
    { field: 'name', headerName: 'Product Name', width: 200 },
    { field: 'brand', headerName: 'Brand', width: 120 },
    { field: 'category_name', headerName: 'Category', width: 130 },
    { 
      field: 'current_stock', 
      headerName: 'Current Stock', 
      width: 120,
      type: 'number'
    },
    { field: 'min_stock_level', headerName: 'Min Level', width: 100, type: 'number' },
    { 
      field: 'shortage_quantity', 
      headerName: 'Shortage', 
      width: 100, 
      type: 'number',
      renderCell: (params) => (
        <Chip 
          label={params.value}
          color="error"
          size="small"
        />
      )
    },
    {
      field: 'alert_level',
      headerName: 'Alert Level',
      width: 120,
      renderCell: (params) => {
        let color: 'default' | 'warning' | 'error' | 'info' = 'default';
        if (params.value === 'Critical') color = 'error';
        else if (params.value === 'Low') color = 'warning';
        else if (params.value === 'Out of Stock') color = 'error';
        else if (params.value === 'No Record') color = 'info';
        
        return (
          <Chip 
            label={params.value}
            color={color}
            size="small"
          />
        );
      }
    },
    { field: 'supplier_name', headerName: 'Supplier', width: 140 },
    { field: 'location', headerName: 'Location', width: 100 }
  ];

  const movementColumns: GridColDef[] = [
    { 
      field: 'created_at', 
      headerName: 'Date', 
      width: 140,
      valueFormatter: (params) => new Date(params.value).toLocaleString()
    },
    { field: 'sku', headerName: 'SKU', width: 120 },
    { field: 'product_name', headerName: 'Product', width: 180 },
    { 
      field: 'transaction_type', 
      headerName: 'Type', 
      width: 120,
      renderCell: (params) => {
        let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
        if (params.value === 'sale') color = 'error';
        else if (params.value === 'purchase') color = 'success';
        else if (params.value === 'adjustment') color = 'warning';
        else if (params.value === 'count') color = 'info';
        
        return (
          <Chip 
            label={params.value}
            color={color}
            size="small"
          />
        );
      }
    },
    { 
      field: 'quantity_change', 
      headerName: 'Change', 
      width: 100,
      type: 'number',
      renderCell: (params) => {
        const isPositive = params.value > 0;
        return (
          <Typography 
            color={isPositive ? 'success.main' : 'error.main'}
            fontWeight="bold"
          >
            {isPositive ? '+' : ''}{params.value}
          </Typography>
        );
      }
    },
    { field: 'notes', headerName: 'Notes', width: 200 },
    { field: 'reference_number', headerName: 'Reference', width: 120 },
    { field: 'created_by_username', headerName: 'User', width: 120 }
  ];

  // Sorting helper
  const handleRequestSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    setSortBy(field);
    setSortOrder(isAsc ? 'desc' : 'asc');
    // client-side sort for inventory array
    setInventory(prev => {
      const copy = [...prev];
      copy.sort((a: any, b: any) => {
        const av = a[field];
        const bv = b[field];
        if (av == null && bv == null) return 0;
        if (av == null) return sortOrder === 'asc' ? -1 : 1;
        if (bv == null) return sortOrder === 'asc' ? 1 : -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return (sortOrder === 'asc' ? 1 : -1) * (av - bv);
        }
        const astr = String(av).toLowerCase();
        const bstr = String(bv).toLowerCase();
        if (astr < bstr) return sortOrder === 'asc' ? 1 : -1;
        if (astr > bstr) return sortOrder === 'asc' ? -1 : 1;
        return 0;
      });
      return copy;
    });
  };

  const openColMenu = (e: React.MouseEvent<HTMLElement>) => setColMenuAnchor(e.currentTarget);
  const closeColMenu = () => setColMenuAnchor(null);
  const toggleColumn = (col: string) => {
    if (col === 'actions') return; // always visible
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    // when user manually toggles a column, switch the menu mode to 'custom'
    setColumnMode('custom');
  };

  const defaultVisibleColumns: Record<string, boolean> = {
    sku: true,
    name: true,
    brand: true,
    category_name: true,
    unit: true,
    current_stock: true,
    reserved_stock: true,
    available_stock: true,
    min_stock_level: true,
    inventory_value: true,
    location: true,
    last_counted_at: true,
    actions: true
  };

  const setAllColumns = () => {
    setVisibleColumns(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => { if (k !== 'actions') copy[k] = true; });
      return copy;
    });
  };

  const setDefaultColumns = () => setVisibleColumns({ ...defaultVisibleColumns });

  // reset column order to default and persist
  const resetColumnOrderToDefault = () => {
    const def = defaultColumnOrder;
    setColumnOrder(def);
    persistColumnOrder(def);
  };

  // persist order helper
  const persistColumnOrder = (order: string[]) => {
    try {
      localStorage.setItem('inventory_column_order', JSON.stringify(order));
    } catch (e) {
      // ignore
    }
  };

  // helper to format column keys into Title Case labels (caps first letter, SKU all caps)
  const formatLabel = (key: string) => {
    if (key.toLowerCase() === 'sku') return 'SKU';
    return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  // Native drag-and-drop handlers
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
      // user reordered columns -> switch to customize mode
      setColumnMode('custom');
      return copy;
    });
    setDraggingId(null);
  };

  const onDragEndNative = () => setDraggingId(null);

  // styles for single-line truncation and header cells
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

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: '#f7f8fA',
        minHeight: '100vh',
        // enforce 14px font size across the Inventory page
        // use specific selectors to avoid affecting icons/svg sizing where possible
        '&, & *': {
          fontSize: '14px !important',
        },
        '& .MuiTypography-root': {
          fontSize: '14px !important',
        },
        '& .MuiTableCell-root': {
          fontSize: '14px !important',
        },
        '& .MuiButton-root': {
          fontSize: '14px !important',
        },
        '& .MuiInputBase-root': {
          fontSize: '14px !important',
        },
        '& .MuiDataGrid-root .MuiDataGrid-cell, & .MuiDataGrid-root .MuiDataGrid-columnHeader': {
          fontSize: '14px !important',
        }
      }}
    >
      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Inventory Levels" icon={<AddIcon />} />
          <Tab label="Low Stock Alerts" icon={<LowStockIcon />} />
          <Tab label="Movement History" icon={<HistoryIcon />} />
          <Tab label="Reports" icon={<ReportIcon />} />
        </Tabs>
      </Box>

      {/* Toolbar: show only on Inventory Levels (activeTab === 0) and hide on Low Stock Alerts (activeTab === 1) */}
      {activeTab === 0 && (
        <Card sx={{ mb: 3, backgroundColor: '#fff', borderRadius: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search SKU, Product Name, Brand, Category"
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
                      '& .MuiInputBase-input': { padding: '10px 12px', fontSize: '14px' },
                    },
                    endAdornment: (
                      <InputAdornment position="end" sx={{ mr: 0 }}>
                        <SearchIcon sx={{ color: 'rgba(0,0,0,0.45)', fontSize: 18 }} />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  select
                  fullWidth
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    sx: {
                      borderRadius: '20px',
                      backgroundColor: '#ffffff',
                      '& .MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(0,0,0,0.08)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.12)' },
                      '& .MuiInputBase-input': { padding: '10px 12px', fontSize: '14px' },
                    }
                  }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="available">Available</MenuItem>
                  <MenuItem value="not_available">Not Available</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={() => setImportDialog(true)}
                    disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                    sx={{ borderRadius: 2, textTransform: 'none', minHeight: 36, px: 2 }}
                  >
                    Import
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleExport}
                    disabled={loading}
                    sx={{ borderRadius: 2, textTransform: 'none', minHeight: 36, px: 2 }}
                  >
                    Export
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      if (activeTab === 0) fetchInventory();
                      else if (activeTab === 1) fetchLowStock();
                      else if (activeTab === 2) fetchMovements();
                    }}
                    disabled={loading}
                    sx={{ borderRadius: 2, textTransform: 'none', minHeight: 36, px: 2 }}
                  >
                    Refresh
                  </Button>
                </Box>
              </Grid>
            </Grid>

            {/* Filter chips */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`Low Stock Only: ${showLowStockOnly ? 'On' : 'Off'}`}
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                color={showLowStockOnly ? 'primary' : 'default'}
                variant={showLowStockOnly ? 'filled' : 'outlined'}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Category filter popover */}
      <Popover
        open={Boolean(categoryAnchor)}
        anchorEl={categoryAnchor}
        onClose={() => setCategoryAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: 6, overflow: 'hidden', fontSize: '14px', fontFamily: 'inherit' } }}
      >
        <Box sx={{ minWidth: 130, maxWidth: 190, p: 0.2, fontFamily: 'inherit', fontSize: '14px', '&, & *': { fontFamily: 'inherit', fontSize: '14px' } }}>
          <List sx={{ maxHeight: 320, overflow: 'auto', p: 0 }}>
            <ListItem sx={{ py: 0, px: 0, alignItems: 'center' }}>
              <Checkbox
                checked={tempCategorySelection.length === 0}
                onChange={(e) => setTempCategorySelection(e.target.checked ? [] : Array.from(new Set(inventory.map(i => i.category_name).filter((v): v is string => !!v))))}
                color="success"
                sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }}
              />
              <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px', textTransform: 'none' }}>All</Typography>
            </ListItem>
            <Divider sx={{ my: 0 }} />
            {Array.from(new Set(inventory.map(i => i.category_name).filter((v): v is string => !!v))).map((c) => (
              <ListItem key={c} sx={{ py: 0, px: 0, alignItems: 'center' }}>
                <Checkbox
                  checked={tempCategorySelection.includes(c as string)}
                  onChange={(e) => {
                    setTempCategorySelection(prev => {
                      const copy = new Set(prev);
                      if (e.target.checked) copy.add(c as string);
                      else copy.delete(c as string);
                      return Array.from(copy);
                    });
                  }}
                  color="success"
                  sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }}
                />
                <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px' }}>{c}</Typography>
              </ListItem>
            ))}
          </List>
          <Box sx={{ display: 'flex', justifyContent: 'left', mt: 0.25, px: 5, gap: 1.25, mb: .75}}>
            <Button onClick={() => setTempCategorySelection([])} variant="outlined" sx={{ bgcolor: '#f5f5f5', color: 'text.secondary', borderColor: 'transparent', textTransform: 'none', px: 1, py: .3, fontSize: '14px' }}>Reset</Button>
            <Button onClick={() => { setCategoryFilter(tempCategorySelection); setCategoryAnchor(null); }} variant="contained" color="success" sx={{ textTransform: 'none', px: 1, py: .3, fontSize: '14px' }}>Confirm</Button>
          </Box>
        </Box>
      </Popover>

      {/* Brand filter popover */}
      <Popover
        open={Boolean(brandAnchor)}
        anchorEl={brandAnchor}
        onClose={() => setBrandAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { borderRadius: 1, boxShadow: 6, overflow: 'hidden', fontSize: '14px', fontFamily: 'inherit' } }}
      >
        <Box sx={{ minWidth: 130, maxWidth: 190, p: 0.2, fontFamily: 'inherit', fontSize: '14px', '&, & *': { fontFamily: 'inherit', fontSize: '14px' } }}>
          <List sx={{ maxHeight: 320, overflow: 'auto', p: 0 }}>
            <ListItem sx={{ py: 0, px: 0, alignItems: 'center' }}>
              <Checkbox
                checked={tempBrandSelection.length === 0}
                onChange={(e) => setTempBrandSelection(e.target.checked ? [] : Array.from(new Set(inventory.map(i => i.brand).filter((v): v is string => !!v))))}
                color="success"
                sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }}
              />
              <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px', textTransform: 'none' }}>All</Typography>
            </ListItem>
            <Divider sx={{ my: 0.5 }} />
            {Array.from(new Set(inventory.map(i => i.brand).filter((v): v is string => !!v))).map((b) => (
              <ListItem key={b} sx={{ py: 0, px: 0, alignItems: 'center' }}>
                <Checkbox
                  checked={tempBrandSelection.includes(b as string)}
                  onChange={(e) => {
                    setTempBrandSelection(prev => {
                      const copy = new Set(prev);
                      if (e.target.checked) copy.add(b as string);
                      else copy.delete(b as string);
                      return Array.from(copy);
                    });
                  }}
                  color="success"
                  sx={{ ml: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }}
                />
                <Typography sx={{ ml: 0, fontWeight: 100, fontSize: '14px' }}>{b}</Typography>
              </ListItem>
            ))}
          </List>
          <Box sx={{ display: 'flex', justifyContent: 'left', mt: 0.25, px: 5, gap: 1.25, mb: .75 }}>
            <Button onClick={() => setTempBrandSelection([])} variant="outlined" sx={{ bgcolor: '#f5f5f5', color: 'text.secondary', borderColor: 'transparent', textTransform: 'none', px: 1, py: 0.3, fontSize: '14px'}}>Reset</Button>
            <Button onClick={() => { setBrandFilter(tempBrandSelection); setBrandAnchor(null); }} variant="contained" color="success" sx={{ textTransform: 'none', px: 1, py: 0.3, fontSize: '14px' }}>Confirm</Button>
          </Box>
        </Box>
      </Popover>

      {/* Content based on active tab */}
      {activeTab === 0 && (
        <Card sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          {/* White background wrapper for the table so it appears as a card */}
          <Paper sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, mb: 2, boxShadow: 'none' }} elevation={0}>
            {/* Scrollable table with sticky header and frozen Actions column. The rounded border is applied to the TableContainer so the table itself has rounded corners. */}
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
                maxHeight: 600,
                overflow: 'auto',
                // custom scrollbar styling: ultra-thin and remove native buttons/triangle
                // width/height set to 2px for webkit browsers
                '&::-webkit-scrollbar': {
                  width: 1,
                  height: 1,
                },
                '&::-webkit-scrollbar-button': {
                  display: 'none',
                  width: 0,
                  height: 0,
                },
                // remove visible track line
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                // thumb more visible but narrow
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0,0,0,0.28)',
                  borderRadius: 999,
                  minHeight: 20,
                },
                // hide scrollbar corner in webkit
                '&::-webkit-scrollbar-corner': {
                  background: 'transparent'
                },
                // Firefox: best-effort (thin) and transparent track
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.28) transparent',
                // attempt to remove Windows-specific resize triangle by overriding corner/background
                '&': {
                  MsOverflowStyle: 'auto'
                }
              }}>
                {/* Make table rows more compact: tighten paddings and set explicit heights */}
                <Table stickyHeader sx={{ minWidth: 1100, '& .MuiTableCell-root': { py: 0.5 }, '& .MuiTableRow-root.MuiTableRow-head': { height: 48 }, '& .MuiTableRow-root': { height: 48 } }}>
        <TableHead>
          <TableRow sx={{ height: 48 }}>
                  {/* selection checkbox column */}
                  <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: '#f7f7f7', zIndex: 1300, width: 48, py: 0.5 }}>
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={selectedItems.length > 0 && selectedItems.length < inventory.length}
                      onChange={toggleSelectAll}
                      inputProps={{ 'aria-label': 'select all' }}
                    />
                  </TableCell>

                  {/* Render columns in the user-customizable order. columnOrder excludes 'actions' */}
                    {columnOrder.map((col) => {
                    if (!visibleColumns[col]) return null;
                    const rawLabel = col.replace(/_/g, ' ');
                    const label = rawLabel.replace(/\b\w/g, (m) => m.toUpperCase());
                    const sortable = ['sku', 'name', 'brand', 'category_name', 'current_stock'].includes(col);
                    const displayLabel = label === 'Sku' ? 'SKU' : (label === 'Last Counted' ? 'Last Counted' : (label === 'Inventory Value' ? 'Value' : (label === 'Available Stock' ? 'Available' : label)));
                    return (
                      <TableCell key={col} sx={{ ...headerCellSx, py: 0.5 }}>
                        {sortable ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: .5 }}>
                            <TableSortLabel
                              active={sortBy === col}
                              direction={sortBy === col ? sortOrder : 'asc'}
                              onClick={() => handleRequestSort(col)}
                            >
                              {displayLabel}
                            </TableSortLabel>
                            {(col === 'category_name' || col === 'brand') && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  if (col === 'category_name') { setTempCategorySelection(categoryFilter); setCategoryAnchor(e.currentTarget); }
                                  else { setTempBrandSelection(brandFilter); setBrandAnchor(e.currentTarget); }
                                }}
                                sx={{ ml: .25 }}
                                aria-label={`Filter ${col}`}
                              >
                                <FilterListIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        ) : (
                          displayLabel
                        )}
                      </TableCell>
                    );
                  })}

                  <TableCell
                    sx={{
                      top: 0,
                      position: 'sticky',
                      right: 0,
                      backgroundColor: '#f7f7f7',
                      // keep z-index below MUI modal/popover (1300) so menus/modals appear above
                      zIndex: 1200,
                      borderLeft: '1px solid',
                      borderColor: 'divider',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 1,
                      pr: 0,
                      // header row height set to 48 to match body rows
                      height: 48,
                      minHeight: 48,
                      py: 0.5,
                      // keep the actions vertically centered and make icon buttons compact
                      '& .MuiIconButton-root': { height: 32, width: 32, p: 0 }
                    }}
                  >
                    <Box sx={{ mr: 1 }}>Actions</Box>
                    <IconButton size="small" onClick={openColMenu} sx={{ p: 0.5 }} aria-label="Columns">
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id} hover sx={{ height: 48 }}>
                      <TableCell sx={{ ...cellSx, py: .5 }}>
                        <Checkbox
                          checked={(selectedItems as number[]).includes(item.id)}
                          onChange={() => toggleRowSelected(item.id)}
                          inputProps={{ 'aria-label': `select ${item.sku}` }}
                        />
                      </TableCell>

                    {/* Render cells in the same user-customizable order */}
                    {columnOrder.map((col) => {
                      if (!visibleColumns[col]) return null;
                      switch (col) {
                        case 'sku':
                          return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{item.sku}</TableCell>;
                        case 'name':
                          return (
                            <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>
                              <Typography noWrap>{item.name}</Typography>
                            </TableCell>
                          );
                        case 'brand':
                          return <TableCell key={col} sx={cellSx}>{item.brand}</TableCell>;
                        case 'category_name':
                          return <TableCell key={col} sx={cellSx}>{item.category_name}</TableCell>;
                        case 'unit':
                          return <TableCell key={col} sx={cellSx}>{item.unit}</TableCell>;
                        case 'current_stock':
                          return (
                            <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {item.current_stock <= item.min_stock_level && <WarningIcon color="warning" sx={{ mr: 0.5, fontSize: 16 }} />}
                                <Typography noWrap>{item.current_stock}</Typography>
                              </Box>
                            </TableCell>
                          );
                        case 'reserved_stock':
                          return <TableCell key={col} sx={cellSx}>{item.reserved_stock}</TableCell>;
                        case 'available_stock':
                          return <TableCell key={col} sx={cellSx}>{item.available_stock}</TableCell>;
                        case 'min_stock_level':
                          return <TableCell key={col} sx={cellSx}>{item.min_stock_level}</TableCell>;
                        case 'inventory_value':
                          return <TableCell key={col} sx={cellSx}>{`$${((Number(item.current_stock) || 0) * (Number(item.cost_price) || 0)).toFixed(2)}`}</TableCell>;
                        case 'last_counted_at':
                          return <TableCell key={col} sx={{ ...cellSx, py: 0.5 }}>{item.last_counted_at ? new Date(item.last_counted_at).toLocaleDateString() : 'Never'}</TableCell>;
                        default:
                          return null;
                      }
                    })}

                    <TableCell
            sx={{
              position: 'sticky',
              right: 0,
              backgroundColor: 'background.paper',
              // keep z-index below MUI modal/popover (1300) so menus/modals appear above
              zIndex: 1200,
                        borderLeft: '1px solid',
                        borderColor: 'divider',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'auto',
                        // ensure the sticky actions cell matches the row height
                        height: 48,
                        minHeight: 48,
                        py: 0.5,
                        // ensure buttons stay centered when rows are shorter
                        display: 'flex',
                        alignItems: 'center',
                        // tighten icon button sizing so the container height equals the row
                        '& .MuiIconButton-root': { height: 32, width: 32, p: 0 }
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
                        <Tooltip title="Adjust Stock">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedProduct(item);
                              setAdjustmentDialog(true);
                            }}
                            disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                            sx={{ '& .MuiSvgIcon-root': { fontSize: 20 } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Physical Count">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedProduct(item);
                              setCountForm(prev => ({ ...prev, countedQuantity: item.current_stock }));
                              setCountDialog(true);
                            }}
                            disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                          >
                            <CountIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              if (!user || (user.role !== 'admin' && user.role !== 'manager')) return;
                              const ok = window.confirm(`Delete ${item.name} (${item.sku})? This cannot be undone.`);
                              if (!ok) return;
                              try {
                                setLoading(true);
                                await axios.delete(`${API_BASE_URL}/products/${item.id}`);
                                showNotification('Product deleted', 'success');
                                fetchInventory();
                              } catch (err: any) {
                                showNotification(err.response?.data?.message || 'Delete failed', 'error');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                            sx={{ '& .MuiSvgIcon-root': { fontSize: 20 } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </Box>
            </TableContainer>
          </Paper>
          {/* Column visibility menu */}
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
              // ultra-thin scrollbar for the popup container (WebKit + Firefox)
              '&::-webkit-scrollbar': {
                width: 1,
                height: 1,
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.18)',
                borderRadius: 999,
                minHeight: 12,
              },
              // hide corner
              '&::-webkit-scrollbar-corner': { background: 'transparent' },
              // Firefox
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0,0,0,0.18) transparent'
            }}>
              <List dense sx={{ py: 0,
                // very thin scrollbar for popup
                '&::-webkit-scrollbar': {
                  width: .1,
                  height: .1,
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0,0,0,0.22)',
                  borderRadius: 999,
                  minHeight: 16,
                },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.22) transparent',
              }}>
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
                    {/* Checkbox adjacent to drag icon and scaled to match drag handle size */}
                    <Checkbox
                      checked={!!visibleColumns[col]}
                      onChange={() => toggleColumn(col)}
                      size="medium"
                      disableRipple
                      sx={{
                        ml: 0,
                        mr: 0,
                        transform: 'scale(0.98)',
                        '& .MuiSvgIcon-root': { fontSize: 20 },
                        // remove outline/shadow on focus
                        '&.Mui-focusVisible, &:focus-visible': { boxShadow: 'none', outline: 'none' }
                      }}
                      inputProps={{ 'aria-label': `${formatLabel(col)} visible` }}
                    />
                    <Typography sx={{ flex: 1, ml: 0, textTransform: 'none', fontWeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'inherit', fontSize: '14px' }}>{formatLabel(col)}</Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Menu>
        </Card>
      )}

      {activeTab === 1 && (
        <Card sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          <Paper sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, mb: 2, boxShadow: 'none' }} elevation={0}>
            <TableContainer
              sx={{
                position: 'relative',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflowClipMargin: 'content-box',
                overflow: 'hidden',
                '& .MuiTable-root': { borderRadius: 2 }
              }}
            >
              <Box sx={{
                maxHeight: 600,
                overflow: 'auto',
                '&::-webkit-scrollbar': { width: 1, height: 1 },
                '&::-webkit-scrollbar-button': { display: 'none', width: 0, height: 0 },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 999, minHeight: 20 },
                '&::-webkit-scrollbar-corner': { background: 'transparent' },
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.28) transparent',
                '&': { MsOverflowStyle: 'auto' }
              }}>
                <Table stickyHeader sx={{ minWidth: 1100, '& .MuiTableCell-root': { py: 0.5 }, '& .MuiTableRow-root.MuiTableRow-head': { height: 48 }, '& .MuiTableRow-root': { height: 48 } }}>
                  <TableHead>
                    <TableRow sx={{ height: 48 }}>
                      {lowStockColumns.map((col) => (
                        <TableCell key={col.field} sx={{ ...headerCellSx, py: 0.5 }}>
                          {col.headerName}
                        </TableCell>
                      ))}
                      <TableCell sx={{ ...headerCellSx, right: 0, borderLeft: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 1, py: 0.5, height: 48, minHeight: 48, '& .MuiIconButton-root': { height: 32, width: 32, p: 0 } }}>
                        <Box sx={{ mr: 1 }}>Actions</Box>
                        <IconButton size="small" onClick={openColMenu} sx={{ p: 0 }} aria-label="Columns">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lowStockItems.map((item) => (
                      <TableRow key={item.id} hover sx={{ height: 48 }}>
                        {/* sku */}
                        <TableCell sx={{ ...cellSx }}>{item.sku}</TableCell>
                        {/* name */}
                        <TableCell sx={{ ...cellSx }}><Typography noWrap>{item.name}</Typography></TableCell>
                        {/* brand */}
                        <TableCell sx={cellSx}>{item.brand}</TableCell>
                        {/* category */}
                        <TableCell sx={cellSx}>{item.category_name}</TableCell>
                        {/* current stock */}
                        <TableCell sx={{ ...cellSx }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {item.current_stock <= (item.min_stock_level ?? 0) && <WarningIcon color="warning" sx={{ mr: 0.5, fontSize: 16 }} />}
                            <Typography noWrap>{item.current_stock}</Typography>
                          </Box>
                        </TableCell>
                        {/* min level */}
                        <TableCell sx={cellSx}>{item.min_stock_level}</TableCell>
                        {/* shortage quantity */}
                        <TableCell sx={cellSx}>
                          <Chip label={String(item.shortage_quantity)} color="error" size="small" />
                        </TableCell>
                        {/* alert level */}
                        <TableCell sx={cellSx}>
                          {(() => {
                            const v = item.alert_level;
                            let color: 'default' | 'warning' | 'error' | 'info' = 'default';
                            if (v === 'Critical' || v === 'Out of Stock') color = 'error';
                            else if (v === 'Low') color = 'warning';
                            else if (v === 'No Record') color = 'info';
                            return <Chip label={v} color={color} size="small" />;
                          })()}
                        </TableCell>
                        {/* supplier */}
                        <TableCell sx={cellSx}>{item.supplier_name || '-'}</TableCell>
                        {/* location */}
                        <TableCell sx={cellSx}>{item.location || '-'}</TableCell>

                        <TableCell sx={{ position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1240, borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap', pointerEvents: 'auto', height: 48, minHeight: 48, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', pr: 0, '& .MuiIconButton-root': { height: 32, width: 32, p: 0 } }}>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                            <Tooltip title="Adjust Stock">
                              <IconButton size="small" onClick={() => { setSelectedProduct(item); setAdjustmentDialog(true); }} disabled={!user || (user.role !== 'admin' && user.role !== 'manager')} sx={{ '& .MuiSvgIcon-root': { fontSize: 20 } }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Physical Count">
                              <IconButton size="small" onClick={() => { setSelectedProduct(item); setCountForm(prev => ({ ...prev, countedQuantity: item.current_stock })); setCountDialog(true); }} disabled={!user || (user.role !== 'admin' && user.role !== 'manager')} sx={{ '& .MuiSvgIcon-root': { fontSize: 20 } }}>
                                <CountIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </TableContainer>
          </Paper>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <Box sx={{ height: 600 }}>
            <DataGrid
              rows={movements}
              columns={movementColumns}
              loading={loading}
              pageSizeOptions={[25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } }
              }}
            />
          </Box>
        </Card>
      )}

      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Inventory Reports & Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Advanced reporting features will be implemented here.
          </Typography>
        </Box>
      )}

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialog} onClose={() => setAdjustmentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Adjust Inventory: {selectedProduct?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Current Stock: {selectedProduct?.current_stock} {selectedProduct?.unit}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Quantity Change"
                  type="number"
                  value={adjustmentForm.quantityChange}
                  onChange={(e) => setAdjustmentForm(prev => ({ ...prev, quantityChange: parseInt(e.target.value) || 0 }))}
                  helperText="Use negative numbers to decrease stock"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Reason</InputLabel>
                  <Select
                    value={adjustmentForm.reason}
                    label="Reason"
                    onChange={(e) => setAdjustmentForm(prev => ({ ...prev, reason: e.target.value }))}
                  >
                    <MenuItem value="correction">Correction</MenuItem>
                    <MenuItem value="damaged">Damaged</MenuItem>
                    <MenuItem value="lost">Lost</MenuItem>
                    <MenuItem value="found">Found</MenuItem>
                    <MenuItem value="expired">Expired</MenuItem>
                    <MenuItem value="returned">Returned</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes *"
                  multiline
                  rows={3}
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Explain the reason for this adjustment..."
                />
              </Grid>
            </Grid>
            
            {selectedProduct && adjustmentForm.quantityChange !== 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                New stock level will be: {(selectedProduct.current_stock || 0) + adjustmentForm.quantityChange} {selectedProduct.unit}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustmentDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAdjustment}
            variant="contained"
            disabled={loading || adjustmentForm.quantityChange === 0 || !adjustmentForm.notes.trim()}
          >
            Apply Adjustment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Physical Count Dialog */}
      <Dialog open={countDialog} onClose={() => setCountDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Physical Count: {selectedProduct?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              System Stock: {selectedProduct?.current_stock} {selectedProduct?.unit}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Counted Quantity"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={countForm.countedQuantity}
                  onChange={(e) => setCountForm(prev => ({ ...prev, countedQuantity: parseInt(e.target.value) || 0 }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Counted By *"
                  value={countForm.countedBy}
                  onChange={(e) => setCountForm(prev => ({ ...prev, countedBy: e.target.value }))}
                  placeholder="Name of person who performed the count"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={2}
                  value={countForm.notes}
                  onChange={(e) => setCountForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any observations or notes about the count..."
                />
              </Grid>
            </Grid>
            
            {selectedProduct && countForm.countedQuantity !== selectedProduct.current_stock && (
              <Alert 
                severity={countForm.countedQuantity < selectedProduct.current_stock ? "warning" : "info"} 
                sx={{ mt: 2 }}
              >
                Difference: {countForm.countedQuantity - (selectedProduct.current_stock || 0)} {selectedProduct.unit}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCountDialog(false)}>Cancel</Button>
          <Button 
            onClick={handlePhysicalCount}
            variant="contained"
            disabled={loading || !countForm.countedBy.trim()}
          >
            Complete Count
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Inventory Adjustments</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Upload a CSV or Excel file with inventory adjustments. Required columns: SKU, Quantity Change, Notes.
              Optional columns: Reason (damaged, lost, found, correction, expired, returned, other).
            </Alert>
            
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              style={{ marginBottom: 16 }}
            />
            
            {importProgress > 0 && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress variant="determinate" value={importProgress} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {importStatus === 'validating' ? 'Validating...' : 
                   importStatus === 'importing' ? 'Importing...' : 
                   'Processing...'} {importProgress}%
                </Typography>
              </Box>
            )}
            
            {importResults && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Import Results
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4">{importResults.totalRows}</Typography>
                      <Typography variant="body2">Total Rows</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {importResults.importedCount || 0}
                      </Typography>
                      <Typography variant="body2">Imported</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="error.main">{importResults.errors}</Typography>
                      <Typography variant="body2">Errors</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">{importResults.warnings}</Typography>
                      <Typography variant="body2">Warnings</Typography>
                    </Paper>
                  </Grid>
                </Grid>
                
                {importResults.errorDetails?.length > 0 && (
                  <Accordion sx={{ mt: 2 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography color="error">Errors ({importResults.errorDetails.length})</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {importResults.errorDetails.map((error: string, index: number) => (
                          <Typography key={index} variant="body2" color="error">
                            • {error}
                          </Typography>
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => handleImport(true)}
            disabled={!importFile || importStatus === 'validating'}
          >
            Validate Only
          </Button>
          <Button 
            onClick={() => handleImport(false)}
            variant="contained"
            disabled={!importFile || importStatus === 'importing' || (importResults && importResults.errors > 0)}
          >
            Import Adjustments
          </Button>
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

export default Inventory;