import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  Chip, Alert, Snackbar, Tooltip, IconButton, Tab, Tabs, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Accordion, AccordionSummary, AccordionDetails, Divider, LinearProgress,
  Menu, Checkbox, List, ListItem, RadioGroup, FormControlLabel, Radio,
  ListItemButton, ListItemText, Badge, Stack, InputAdornment
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
  Download as DownloadIcon, Upload as UploadIcon, Refresh as RefreshIcon,
  Business as BusinessIcon, History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ContactMail as ContactIcon, Phone as PhoneIcon,
  Email as EmailIcon, Language as WebsiteIcon, Close as CloseIcon,
  Receipt as ReceiptIcon, Payment as PaymentIcon, Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon, Warning as WarningIcon, Schedule as ScheduleIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import dataGridStickySx from '../utils/dataGridSticky';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';

interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  tax_id?: string;
  website?: string;
  notes?: string;
  payment_terms?: string;
  credit_limit?: number;
  is_active: boolean;
  total_orders: number;
  pending_orders: number;
  total_purchased: number;
  last_order_date?: string;
  product_count: number;
  created_at: string;
}

interface SupplierDetail extends Supplier {
  recentOrders: Array<{
    id: number;
    po_number: string;
    order_date: string;
    status: string;
    total_amount: number;
  }>;
  products: Array<{
    id: number;
    name: string;
    sku: string;
    brand?: string;
    selling_price: number;
    cost_price: number;
    is_active: boolean;
  }>;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  expected_delivery_date?: string;
  status: 'Open' | 'Partial' | 'Received' | 'Closed';
  payment_status: 'Unpaid' | 'Paid this month' | 'To be paid next month' | 'Partially Paid';
  receiving_status: 'Awaiting' | 'Partially Received' | 'Received';
  total_amount: number;
  paid_amount?: number;
  items_summary: string;
  notes?: string;
}

const Suppliers: React.FC = () => {
  const { user } = useAuth();
  // Styling constants copied from Inventory for parity
  const headerCellSx = { py: 1, fontWeight: 600, fontSize: 13 } as const;
  const cellSx = { py: 1, fontSize: 13 } as const;
  // Single-line truncate style for table cells
  const truncateSx = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
  const [activeTab, setActiveTab] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<GridRowSelectionModel>([]);
  
  // Dialog states
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [purchaseOrderDialog, setPurchaseOrderDialog] = useState(false);
  const [poDetailDialog, setPoDetailDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [lowStockDialog, setLowStockDialog] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  
  // Receiving dialog states
  const [receiveDialog, setReceiveDialog] = useState(false);
  const [closePODialog, setClosePODialog] = useState(false);
  const [closePOReason, setClosePOReason] = useState('');
  const [poToClose, setPoToClose] = useState<PurchaseOrder | null>(null);
  const [receivingItems, setReceivingItems] = useState<Array<{
    id: number;
    product_id: number;
    product_name: string;
    ordered_quantity: number;
    received_quantity: number;
    receiving_now: number;
    unit_price: number;
    actual_price: number;
  }>>([]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'bank_transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  
  // Receive Items tab states
  const [selectedReceivePO, setSelectedReceivePO] = useState<number | null | 'summary'>(null);
  const [receivePOItems, setReceivePOItems] = useState<Array<{
    id: number;
    product_id: number;
    product_name: string;
    ordered_quantity: number;
    received_quantity: number;
    unit_price: number;
    actual_price: number;
    to_receive: number;
    checked: boolean;
  }>>([]);
  
  // Make Payment tab states
  const [selectedPaymentPO, setSelectedPaymentPO] = useState<number | null | 'summary'>(null);
  const [paymentPODetails, setPaymentPODetails] = useState<any>(null);
  
  // PO Form states
  const [poOrderNumber, setPoOrderNumber] = useState('');
  const [poOrderDate, setPoOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<Array<{id: string; product_id?: number; product_name: string; quantity: number; unit_price: number}>>([]);
  
  // Form states
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  // PO filters for right pane
  const [poPaymentFilter, setPoPaymentFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial'>('all');
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | 'open' | 'partial' | 'received' | 'closed'>('all');
  const [rightTab, setRightTab] = useState<number>(0); // 0: POs, 1: Receive Items, 2: Make Payment, 3: Inventory History
  const isSupplierDetail = (s: Supplier | SupplierDetail | null): s is SupplierDetail => {
    return !!s && (s as SupplierDetail).recentOrders !== undefined && (s as SupplierDetail).products !== undefined;
  };
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  
  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'validating' | 'importing' | 'complete' | 'error'>('idle');
  const [importResults, setImportResults] = useState<any>(null);
  
  // Notifications
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // Column customization state (Inventory-style)
  const defaultColumnOrder = ['name','contact_person','email','phone','city','state','total_orders','total_purchased','last_order_date','is_active','actions'];

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('suppliers_visible_columns');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // default: show all except actions handled separately
    const map: Record<string, boolean> = {};
    defaultColumnOrder.forEach(k => map[k] = k !== 'actions');
    map['actions'] = true;
    return map;
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('suppliers_column_order');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return defaultColumnOrder;
  });

  const persistColumns = (vis: Record<string, boolean>, order: string[]) => {
    try {
      localStorage.setItem('suppliers_visible_columns', JSON.stringify(vis));
      localStorage.setItem('suppliers_column_order', JSON.stringify(order));
    } catch (e) {}
  };

  // Drag-and-drop for column reordering (native)
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); } catch (err) {}
  };

  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    const from = columnOrder.indexOf(draggingId);
    const to = columnOrder.indexOf(overId);
    if (from === -1 || to === -1) return;
    const newOrder = [...columnOrder];
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, draggingId);
    setColumnOrder(newOrder);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingId(null);
    persistColumns(visibleColumns, columnOrder);
  };

  const onDragEndNative = () => {
    setDraggingId(null);
    persistColumns(visibleColumns, columnOrder);
  };

  const toggleColumn = (key: string) => {
    const next = { ...visibleColumns, [key]: !visibleColumns[key] };
    setVisibleColumns(next);
    persistColumns(next, columnOrder);
  };

  const setAllColumns = (val: boolean) => {
    const next: Record<string, boolean> = {};
    columnOrder.forEach(k => next[k] = val || k === 'actions');
    setVisibleColumns(next);
    persistColumns(next, columnOrder);
  };

  const setDefaultColumns = () => {
    const next: Record<string, boolean> = {};
    defaultColumnOrder.forEach(k => next[k] = k !== 'actions');
    next['actions'] = true;
    setVisibleColumns(next);
    setColumnOrder(defaultColumnOrder);
    persistColumns(next, defaultColumnOrder);
  };

  const resetColumnOrderToDefault = () => {
    setColumnOrder(defaultColumnOrder);
    persistColumns(visibleColumns, defaultColumnOrder);
  };

  // Columns menu state
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState<null | HTMLElement>(null);
  const columnsMenuOpen = Boolean(columnsMenuAnchor);
  const openColumnsMenu = (e: React.MouseEvent<HTMLElement>) => setColumnsMenuAnchor(e.currentTarget);
  const closeColumnsMenu = () => setColumnsMenuAnchor(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '25');
      
      if (searchTerm) params.append('search', searchTerm);
      if (cityFilter !== 'all') params.append('city', cityFilter);
      if (stateFilter !== 'all') params.append('state', stateFilter);
      if (statusFilter !== 'all') {
        // Map statusFilter values to backend expected values
        const isActiveValue = statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : 'all';
        if (isActiveValue !== 'all') params.append('is_active', isActiveValue);
      }
      
      // Add timestamp to bust cache
      params.append('_t', Date.now().toString());
      
      const response = await axios.get(`/api/suppliers?${params}`, {
        // Force fresh data, bypass cache
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.data && typeof response.data === 'object') {
        const suppliersData = response.data.suppliers || [];
        setSuppliers(suppliersData);
        setTotalPages(response.data.pagination?.pages || 1);
        setTotalSuppliers(response.data.pagination?.total || 0);
      } else {
        console.error('Invalid response format:', response.data);
        setSuppliers([]);
      }
    } catch (error) {
  console.error('Error fetching suppliers:', error);
  console.error('Error details:', axios.isAxiosError(error) ? error.response?.data : undefined);
  showNotification(`Failed to fetch suppliers: ${axios.isAxiosError(error) ? error.message : String(error)}`, 'error');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, cityFilter, stateFilter, statusFilter]);

  // Fetch purchase orders for selected supplier
  const fetchPurchaseOrders = useCallback(async (supplierId: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('supplier_id', supplierId.toString());
      if (poPaymentFilter !== 'all') params.append('payment_status', poPaymentFilter);
      if (poStatusFilter !== 'all') params.append('status', poStatusFilter);
      
      const response = await axios.get(`/api/purchase-orders?${params}`);
      setPurchaseOrders(response.data.orders || response.data || []);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      showNotification('Failed to fetch purchase orders', 'error');
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  }, [poPaymentFilter, poStatusFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    if (selectedSupplier) {
      fetchPurchaseOrders(selectedSupplier.id);
    } else {
      setPurchaseOrders([]);
    }
  }, [selectedSupplier, poPaymentFilter, poStatusFilter, fetchPurchaseOrders]);

  // Create purchase order
  const handleCreatePurchaseOrder = async () => {
    if (!selectedSupplier) {
      showNotification('No supplier selected', 'error');
      return;
    }

    if (poItems.length === 0) {
      showNotification('Please add at least one item to the order', 'error');
      return;
    }

    // Validate all items have required fields
    const invalidItems = poItems.filter(item => 
      !item.product_name.trim() || item.quantity <= 0 || item.unit_price <= 0
    );

    if (invalidItems.length > 0) {
      showNotification('All items must have a name, quantity, and unit price', 'error');
      return;
    }

    try {
      setLoading(true);

      // Validate all items have product_id
      const itemsWithoutProductId = poItems.filter(item => !item.product_id);
      if (itemsWithoutProductId.length > 0) {
        showNotification('All items must be selected from the product list', 'error');
        return;
      }

      // Prepare items for API
      const orderItems = poItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_price
      }));

      const response = await axios.post('/api/purchase-orders', {
        supplier_id: selectedSupplier.id,
        order_date: poOrderDate,
        expected_date: poExpectedDate || null,
        items: orderItems,
        notes: poNotes || null
      });

      showNotification(`Purchase order ${response.data.po_number} created successfully`, 'success');
      
      // Reset form
      setPoOrderDate(new Date().toISOString().split('T')[0]);
      setPoExpectedDate('');
      setPoNotes('');
      setPoItems([]);
      setPurchaseOrderDialog(false);

      // Refresh purchase orders list
      if (selectedSupplier) {
        fetchPurchaseOrders(selectedSupplier.id);
      }

    } catch (error) {
      console.error('Failed to create purchase order:', error);
      showNotification(
        axios.isAxiosError(error) 
          ? error.response?.data?.message || 'Failed to create purchase order'
          : 'Failed to create purchase order',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Open receive dialog and fetch PO items
  // Handle receiving items
  const handleReceiveItems = async () => {
    if (!selectedPO) return;

    const itemsToReceive = receivingItems.filter(item => item.receiving_now > 0);
    
    if (itemsToReceive.length === 0 && paymentAmount <= 0) {
      showNotification('Please enter items to receive or payment amount', 'warning');
      return;
    }

    try {
      setLoading(true);

      const receiveData: any = {
        purchase_order_id: selectedPO.id,
        items: itemsToReceive.map(item => ({
          purchase_order_item_id: item.id,
          product_id: item.product_id,
          quantity_received: item.receiving_now
        }))
      };

      // Add payment if amount > 0
      if (paymentAmount > 0) {
        receiveData.payment = {
          amount: paymentAmount,
          payment_method: paymentMethod,
          notes: paymentNotes
        };
      }

      const response = await axios.post(`/api/purchase-orders/${selectedPO.id}/receive`, receiveData);

      showNotification(response.data.message || 'Items received successfully', 'success');
      
      // Update selectedPO with new statuses from response
      if (response.data) {
        setSelectedPO(prev => prev ? {
          ...prev,
          receiving_status: response.data.receiving_status || prev.receiving_status,
          payment_status: response.data.payment_status || prev.payment_status,
          paid_amount: response.data.paid_amount !== undefined ? response.data.paid_amount : prev.paid_amount
        } : null);
      }
      
      // Reset and refresh
      setReceiveDialog(false);
      setReceivingItems([]);
      setPaymentAmount(0);
      setPaymentNotes('');
      setPaymentMethod('cash');
      
      // Force refresh purchase orders and supplier details
      if (selectedSupplier) {
        await fetchPurchaseOrders(selectedSupplier.id);
        await fetchSupplierDetail(selectedSupplier.id);
      }
      
      // Also refresh the main suppliers list to update statistics
      await fetchSuppliers();

    } catch (error) {
      console.error('Failed to receive items:', error);
      showNotification(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to receive items'
          : 'Failed to receive items',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle closing PO manually
  const handleClosePO = async () => {
    if (!poToClose) return;

    try {
      setLoading(true);
      const response = await axios.post(`/api/purchase-orders/${poToClose.id}/close`, {
        reason: closePOReason
      });

      showNotification(response.data.message || 'Purchase order closed successfully', 'success');
      
      setClosePODialog(false);
      setPoToClose(null);
      setClosePOReason('');
      
      // Refresh data
      if (selectedSupplier) {
        await fetchPurchaseOrders(selectedSupplier.id);
        await fetchSupplierDetail(selectedSupplier.id);
      }
      await fetchSuppliers();

    } catch (error) {
      console.error('Failed to close purchase order:', error);
      showNotification(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to close purchase order'
          : 'Failed to close purchase order',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle payment only (no receiving)
  const handleRecordPayment = async () => {
    if (!selectedPO || paymentAmount <= 0) {
      showNotification('Please enter a payment amount', 'warning');
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(`/api/purchase-orders/${selectedPO.id}/payment`, {
        amount: paymentAmount,
        payment_method: paymentMethod,
        notes: paymentNotes
      });

      showNotification(response.data.message || 'Payment recorded successfully', 'success');
      
      // Reset and refresh
      setPoDetailDialog(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      setPaymentMethod('cash');
      
      // Force refresh purchase orders and supplier details
      if (selectedSupplier) {
        await fetchPurchaseOrders(selectedSupplier.id);
        await fetchSupplierDetail(selectedSupplier.id);
      }
      
      // Also refresh the main suppliers list to update statistics
      await fetchSuppliers();

    } catch (error) {
      console.error('Failed to record payment:', error);
      showNotification(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to record payment'
          : 'Failed to record payment',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatCurrency = (amount: number | string) => `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getPaymentStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'Paid this month': return 'success';
      case 'Unpaid': return 'error';
      case 'To be paid next month': return 'warning';
      case 'Partially Paid': return 'info';
      default: return 'default';
    }
  };

  const getReceivingStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case 'Received': return 'success';
      case 'Partially Received': return 'warning';
      case 'Awaiting': return 'error';
      default: return 'default';
    }
  };

  const getReceivingStatusIcon = (status: string): React.ReactElement | undefined => {
    switch (status) {
      case 'Received': return <CheckCircleIcon fontSize="small" />;
      case 'Partially Received': return <WarningIcon fontSize="small" />;
      case 'Awaiting': return <ScheduleIcon fontSize="small" />;
      default: return undefined;
    }
  };

  const resetForm = () => {
    setEditingSupplier(null);
    setSelectedSupplier(null);
  };

  // CRUD operations
  const fetchSupplierDetail = async (supplierId: number) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/suppliers/${supplierId}`);
      setSelectedSupplier(response.data);
      setDetailDialog(true);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch supplier details';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };



  const handleSaveSupplier = async () => {
    if (!editingSupplier) return;

    try {
      setLoading(true);
      
      if (!editingSupplier.name?.trim()) {
        showNotification('Supplier name is required', 'error');
        return;
      }

      const supplierData = {
        name: editingSupplier.name.trim(),
        contactPerson: editingSupplier.contact_person?.trim() || '',
        email: editingSupplier.email?.trim() || '',
        phone: editingSupplier.phone?.trim() || '',
        address: editingSupplier.address?.trim() || '',
        city: editingSupplier.city?.trim() || '',
        state: editingSupplier.state?.trim() || '',
        zipCode: editingSupplier.zip_code?.trim() || '',
        country: editingSupplier.country?.trim() || '',
        taxId: editingSupplier.tax_id?.trim() || '',
        website: editingSupplier.website?.trim() || '',
        notes: editingSupplier.notes?.trim() || '',
        paymentTerms: editingSupplier.payment_terms?.trim() || '',
        creditLimit: editingSupplier.credit_limit || 0,
        isActive: editingSupplier.is_active !== false
      };

      if (editingSupplier.id) {
        // Update existing supplier
        await axios.put(`/api/suppliers/${editingSupplier.id}`, supplierData);
        showNotification('Supplier updated successfully');
      } else {
        // Create new supplier
        await axios.post('/api/suppliers', supplierData);
        showNotification('Supplier created successfully');
      }

      setSupplierDialog(false);
      resetForm();
      // Force refresh with cache busting
      setTimeout(() => {
        fetchSuppliers();
      }, 100);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to save supplier';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return;
    setLoading(true);
    try {
      await axios.delete(`/api/suppliers/${selectedSupplier.id}`);
      showNotification('Supplier deleted successfully');
      setDeleteDialog(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (error) {
      let message = 'Failed to delete supplier';
      if (axios.isAxiosError(error)) {
        console.error('Delete supplier error:', error.response);
        message = error.response?.data?.message || error.message || message;
      } else if (error instanceof Error) {
        console.error('Delete supplier error:', error);
        message = error.message;
      } else {
        console.error('Unknown error deleting supplier:', error);
      }
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export function
  const handleExport = async (format: 'csv' | 'excel', includeStats = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (statusFilter !== 'all') params.append('is_active', statusFilter);
      params.append('include_stats', includeStats.toString());
      
      const response = await axios.get(`${API_BASE_URL}/suppliers/export/${format}?${params}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data]);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `suppliers-export-${timestamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      saveAs(blob, filename);
      
      showNotification(`Suppliers exported successfully`);
    } catch (error) {
      showNotification('Failed to export suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Data Grid columns
  const supplierColumns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Company Name',
      width: 200,
      renderCell: (params) => (
        <Button
          variant="text"
          color="primary"
          onClick={() => fetchSupplierDetail(params.row.id)}
          style={{ textTransform: 'none' }}
        >
          {params.value}
        </Button>
      ),
      disableColumnMenu: true
    },
      { field: 'contact_person', headerName: 'Contact', width: 150, disableColumnMenu: true },
      { field: 'email', headerName: 'Email', width: 180, disableColumnMenu: true },
      { field: 'phone', headerName: 'Phone', width: 130, disableColumnMenu: true },
      { field: 'city', headerName: 'City', width: 120, disableColumnMenu: true },
      { field: 'state', headerName: 'State', width: 100, disableColumnMenu: true },
      { 
        field: 'total_orders', 
        headerName: 'Orders', 
        width: 80,
        type: 'number',
        disableColumnMenu: true
      },
      { 
        field: 'total_purchased', 
        headerName: 'Total Spent', 
        width: 120,
        type: 'number',
        valueFormatter: (params) => formatCurrency(params.value || 0),
        disableColumnMenu: true
      },
      { 
        field: 'last_order_date', 
        headerName: 'Last Order', 
        width: 120,
        valueFormatter: (params) => params.value ? formatDate(params.value) : 'Never',
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
        width: 160,
        sortable: false,
        renderCell: (params) => (
          <Box>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => {
                  setEditingSupplier(params.row);
                  setSupplierDialog(true);
                }}
                disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => {
                  setSelectedSupplier(params.row);
                  setDeleteDialog(true);
                }}
                disabled={!user || user.role !== 'admin'}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
        disableColumnMenu: false
      }
  ];

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: '#f7f8fA',
        minHeight: '100vh',
        '&, & *': { fontSize: '14px !important' },
        '& .MuiTypography-root': { fontSize: '14px !important' },
        '& .MuiTableCell-root': { fontSize: '14px !important' },
        '& .MuiButton-root': { fontSize: '14px !important' },
        '& .MuiInputBase-root': { fontSize: '14px !important' },
        '& .MuiDataGrid-root .MuiDataGrid-cell, & .MuiDataGrid-root .MuiDataGrid-columnHeader': { fontSize: '14px !important' }
      }}
    >
        {/* Toolbar (only show on main view) */}
        <Card sx={{ mb: 3, display: 'none' }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="true">Active</MenuItem>
                    <MenuItem value="false">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={7}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setEditingSupplier({ is_active: true });
                      setSupplierDialog(true);
                    }}
                    disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                  >
                    Add Supplier
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={() => setImportDialog(true)}
                    disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                  >
                    Import
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('csv')}
                    disabled={loading}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('excel')}
                    disabled={loading}
                  >
                    Export Excel
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      if (activeTab === 0) fetchSuppliers();
                    }}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Content based on active tab */}
        <Grid container spacing={3}>
            {/* Left Pane - Suppliers List */}
            <Grid item xs={12} md={3}>
              <Card sx={{ height: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ p: 2, pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Suppliers
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Add Supplier">
                        <IconButton 
                          size="small"
                          onClick={() => {
                            setEditingSupplier({ is_active: true });
                            setSupplierDialog(true);
                          }}
                          disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Import">
                        <IconButton 
                          size="small"
                          onClick={() => setImportDialog(true)}
                          disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                        >
                          <UploadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Export CSV">
                        <IconButton 
                          size="small"
                          onClick={() => handleExport('csv')}
                          disabled={loading}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Refresh">
                        <IconButton 
                          size="small"
                          onClick={fetchSuppliers}
                          disabled={loading}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  
                  {/* Search */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search suppliers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                    sx={{ mb: 1.5 }}
                  />

                  {/* Status Filter */}
                  <FormControl fullWidth size="small" sx={{ mb:0 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      label="Status"
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </CardContent>

                {/* Supplier List */}
                <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
                  <List dense>
                    {suppliers.map((supplier) => (
                      <ListItem
                        key={supplier.id}
                        disablePadding
                        sx={{ mb: 0 }}
                      >
                        <ListItemButton
                          selected={selectedSupplier?.id === supplier.id}
                          onClick={() => setSelectedSupplier(supplier)}
                          sx={{
                            borderRadius: 1,
                            '&.Mui-selected': {
                              backgroundColor: 'primary.light',
                              '&:hover': {
                                backgroundColor: 'primary.light',
                              }
                            }
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {supplier.name}
                                </Typography>
                                <Badge badgeContent={supplier.pending_orders} color="error" />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {supplier.contact_person || 'No contact'}
                                </Typography>
                                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                                  <Chip
                                    label={supplier.is_active ? 'Active' : 'Inactive'}
                                    size="small"
                                    color={supplier.is_active ? 'success' : 'default'}
                                    sx={{ height: 20, fontSize: 10 }}
                                  />
                                  <Chip
                                    label={`${supplier.total_orders} orders`}
                                    size="small"
                                    sx={{ height: 20, fontSize: 10 }}
                                  />
                                </Box>
                              </Box>
                            }
                          />
                          <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSupplier(supplier);
                                setSupplierDialog(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Card>
            </Grid>

            {/* Right Pane - Purchase Orders / Inventory History */}
            <Grid item xs={12} md={9}>
              <Card sx={{ height: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column' }}>
                {selectedSupplier ? (
                  <>
                    <CardContent sx={{ p: 2, pb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {selectedSupplier.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedSupplier.contact_person} • {selectedSupplier.phone}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => setPurchaseOrderDialog(true)}
                          disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                        >
                          Create PO
                        </Button>
                      </Box>

                      {/* Tabs */}
                      <Tabs value={rightTab} onChange={(e, v) => {
                        setRightTab(v);
                        // Set summary as default when switching to Receive Items or Make Payment tabs
                        if (v === 1) {
                          setSelectedReceivePO('summary');
                          setReceivePOItems([]);
                        } else if (v === 2) {
                          setSelectedPaymentPO('summary');
                          setPaymentPODetails(null);
                        }
                      }}>
                        <Tab label="Purchase Orders" />
                        <Tab label="Receive Items" icon={<InventoryIcon fontSize="small" />} iconPosition="start" />
                        <Tab label="Make Payment" icon={<PaymentIcon fontSize="small" />} iconPosition="start" />
                        <Tab label="Inventory History" />
                      </Tabs>
                    </CardContent>

                    <Divider />

                    {/* Tab Content */}
                    {rightTab === 0 && (
                      <>
                        {/* PO Filters */}
                        <CardContent sx={{ p: 2, pb: 1 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Payment Status</InputLabel>
                                <Select
                                  value={poPaymentFilter}
                                  label="Payment Status"
                                  onChange={(e) => setPoPaymentFilter(e.target.value as any)}
                                >
                                  <MenuItem value="all">All</MenuItem>
                                  <MenuItem value="unpaid">Unpaid</MenuItem>
                                  <MenuItem value="paid">Paid</MenuItem>
                                  <MenuItem value="partial">Partially Paid</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={6}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Receiving Status</InputLabel>
                                <Select
                                  value={poStatusFilter}
                                  label="Receiving Status"
                                  onChange={(e) => setPoStatusFilter(e.target.value as any)}
                                >
                                  <MenuItem value="all">All</MenuItem>
                                  <MenuItem value="open">Open</MenuItem>
                                  <MenuItem value="partial">Partially Received</MenuItem>
                                  <MenuItem value="received">Received</MenuItem>
                                  <MenuItem value="closed">Closed</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>
                        </CardContent>

                        {/* Purchase Orders Table */}
                        <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
                          <TableContainer>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600 }}>Order #</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }}>Items</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }}>Payment</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }}>Receiving</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {purchaseOrders.length > 0 ? (
                                  purchaseOrders.map((po) => (
                                    <TableRow key={po.id} hover>
                                      <TableCell>
                                        <Typography
                                          variant="body2"
                                          sx={{ 
                                            color: 'primary.main', 
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' }
                                          }}
                                          onClick={() => {
                                            setSelectedPO(po);
                                            setPoDetailDialog(true);
                                          }}
                                        >
                                          {po.po_number}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>{formatDate(po.order_date)}</TableCell>
                                      <TableCell>
                                        <Typography variant="caption" noWrap>
                                          {po.items_summary || `${po.id} items`}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>{formatCurrency(po.total_amount)}</TableCell>
                                      <TableCell>
                                        <Chip
                                          label={po.payment_status}
                                          size="small"
                                          color={getPaymentStatusColor(po.payment_status)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          icon={getReceivingStatusIcon(po.receiving_status)}
                                          label={po.receiving_status}
                                          size="small"
                                          color={getReceivingStatusColor(po.receiving_status)}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={6} align="center">
                                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                        No purchase orders found
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      </>
                    )}

                    {/* Receive Items Tab */}
                    {rightTab === 1 && (
                      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Left Side - PO List */}
                        <Box sx={{ width: 250, borderRight: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
                          <List dense>
                            {/* Summary Item - Always at top */}
                            <ListItem disablePadding>
                              <ListItemButton
                                selected={selectedReceivePO === 'summary'}
                                onClick={() => {
                                  setSelectedReceivePO('summary');
                                  setReceivePOItems([]);
                                }}
                                sx={{
                                  borderRadius: 1,
                                  mx: 1,
                                  my: 0.5,
                                  bgcolor: 'primary.main',
                                  color: 'white',
                                  '&:hover': {
                                    bgcolor: 'primary.dark',
                                  },
                                  '&.Mui-selected': {
                                    bgcolor: 'primary.dark',
                                    '&:hover': {
                                      bgcolor: 'primary.dark',
                                    }
                                  }
                                }}
                              >
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                                      Purchase Orders
                                    </Typography>
                                  }
                                  secondary={
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                                      View Summary
                                    </Typography>
                                  }
                                />
                              </ListItemButton>
                            </ListItem>
                            
                            <Divider sx={{ my: 1 }} />
                            {purchaseOrders.map(po => (
                                <ListItem
                                  key={po.id}
                                  disablePadding
                                >
                                  <ListItemButton
                                    selected={selectedReceivePO === po.id}
                                    onClick={async () => {
                                      setSelectedReceivePO(po.id);
                                      
                                      // Fetch PO items
                                      try {
                                        setLoading(true);
                                        const response = await axios.get(`/api/purchase-orders/${po.id}`);
                                        const poData = response.data;
                                        
                                        const items = poData.items.map((item: any) => ({
                                          id: item.id,
                                          product_id: item.product_id,
                                          product_name: item.product_name,
                                          ordered_quantity: item.quantity,
                                          received_quantity: item.received_quantity || 0,
                                          unit_price: item.unit_cost,
                                          actual_price: item.unit_cost,
                                          to_receive: Math.max(0, item.quantity - (item.received_quantity || 0)),
                                          checked: false
                                        }));
                                        
                                        setReceivePOItems(items);
                                      } catch (error) {
                                        console.error('Failed to fetch PO items:', error);
                                        showNotification('Failed to load purchase order items', 'error');
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    sx={{
                                      borderRadius: 1,
                                      mx: 1,
                                      my: 0.5,
                                      '&.Mui-selected': {
                                        backgroundColor: 'primary.light',
                                        '&:hover': {
                                          backgroundColor: 'primary.light',
                                        }
                                      }
                                    }}
                                  >
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {po.po_number}
                                          </Typography>
                                          <Chip
                                            label={po.receiving_status}
                                            size="small"
                                            color={getReceivingStatusColor(po.receiving_status)}
                                            sx={{ height: 18, fontSize: 9 }}
                                          />
                                        </Box>
                                      }
                                      secondary={
                                        <Box>
                                          <Typography variant="caption" display="block" color="text.secondary">
                                            {formatDate(po.order_date)}
                                          </Typography>
                                          <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                            {formatCurrency(po.total_amount)}
                                          </Typography>
                                        </Box>
                                      }
                                    />
                                  </ListItemButton>
                                </ListItem>
                              ))}
                            {purchaseOrders.filter(po => po.receiving_status !== 'Received').length === 0 && (
                              <Box sx={{ p: 3, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                  No purchase orders to receive
                                </Typography>
                              </Box>
                            )}
                          </List>
                        </Box>

                        {/* Right Side - Items Details */}
                        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                          {selectedReceivePO === 'summary' ? (
                            <Box sx={{ p: 3 }}>
                              {/* Header */}
                              <Box sx={{ mb: 3, pb: 2, borderBottom: '2px solid', borderColor: 'divider' }}>
                                <Typography variant="h5" sx={{ fontWeight: 600 }}>Receiving Status Report</Typography>
                                <Typography variant="body2" color="text.secondary">Purchase Order Receiving Overview</Typography>
                              </Box>

                              {/* Stats Cards */}
                              <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ p: 1.5, bgcolor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                      Received
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                                        {purchaseOrders.filter(po => po.receiving_status === 'Received').length}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">orders</Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ mt: 0.5, color: '#2e7d32', fontWeight: 600 }}>
                                      {formatCurrency(
                                        purchaseOrders.filter(po => po.receiving_status === 'Received')
                                          .reduce((sum, po) => sum + po.total_amount, 0)
                                      )}
                                    </Typography>
                                  </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ p: 1.5, bgcolor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                      Unreceived
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#e65100' }}>
                                        {purchaseOrders.filter(po => po.receiving_status === 'Awaiting' || po.receiving_status === 'Partially Received').length}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">pending</Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ mt: 0.5, color: '#e65100', fontWeight: 600 }}>
                                      {formatCurrency(
                                        purchaseOrders.filter(po => po.receiving_status === 'Awaiting' || po.receiving_status === 'Partially Received')
                                          .reduce((sum, po) => sum + po.total_amount, 0)
                                      )}
                                    </Typography>
                                  </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ p: 1.5, bgcolor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                      Total Orders
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1565c0' }}>
                                        {purchaseOrders.length}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">orders</Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ mt: 0.5, color: '#1565c0', fontWeight: 600 }}>
                                      {formatCurrency(purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0))}
                                    </Typography>
                                  </Card>
                                </Grid>
                              </Grid>

                              {/* Breakdown Table */}
                              <Card sx={{ p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Detailed Breakdown</Typography>
                                <TableContainer>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Total Amount</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Percentage</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      <TableRow>
                                        <TableCell>
                                          <Chip label="Received" size="small" color="success" sx={{ minWidth: 100 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.filter(po => po.receiving_status === 'Received').length}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(
                                            purchaseOrders.filter(po => po.receiving_status === 'Received')
                                              .reduce((sum, po) => sum + po.total_amount, 0)
                                          )}
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.length > 0
                                            ? ((purchaseOrders.filter(po => po.receiving_status === 'Received').length / purchaseOrders.length) * 100).toFixed(1)
                                            : 0}%
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell>
                                          <Chip label="Partially Received" size="small" color="warning" sx={{ minWidth: 100 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.filter(po => po.receiving_status === 'Partially Received').length}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(
                                            purchaseOrders.filter(po => po.receiving_status === 'Partially Received')
                                              .reduce((sum, po) => sum + po.total_amount, 0)
                                          )}
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.length > 0
                                            ? ((purchaseOrders.filter(po => po.receiving_status === 'Partially Received').length / purchaseOrders.length) * 100).toFixed(1)
                                            : 0}%
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell>
                                          <Chip label="Awaiting" size="small" color="error" sx={{ minWidth: 100 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.filter(po => po.receiving_status === 'Awaiting').length}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(
                                            purchaseOrders.filter(po => po.receiving_status === 'Awaiting')
                                              .reduce((sum, po) => sum + po.total_amount, 0)
                                          )}
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.length > 0
                                            ? ((purchaseOrders.filter(po => po.receiving_status === 'Awaiting').length / purchaseOrders.length) * 100).toFixed(1)
                                            : 0}%
                                        </TableCell>
                                      </TableRow>
                                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>{purchaseOrders.length}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                          {formatCurrency(purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0))}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>100%</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Card>
                            </Box>
                          ) : selectedReceivePO && receivePOItems.length > 0 ? (
                            <Box>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                  <TableHead>
                                  <TableRow>
                                    <TableCell padding="checkbox">
                                      <Checkbox
                                        checked={receivePOItems.every(item => item.checked)}
                                        indeterminate={receivePOItems.some(item => item.checked) && !receivePOItems.every(item => item.checked)}
                                        onChange={(e) => {
                                          setReceivePOItems(receivePOItems.map(item => ({
                                            ...item,
                                            checked: e.target.checked
                                          })));
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>Product</TableCell>
                                    <TableCell align="center">Ordered</TableCell>
                                    <TableCell align="center">Received</TableCell>
                                    <TableCell align="center">Remaining</TableCell>
                                    <TableCell align="center">Receive Qty</TableCell>
                                    <TableCell align="right">PO Price</TableCell>
                                    <TableCell align="right">Actual Price</TableCell>
                                    <TableCell align="right">Subtotal</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {receivePOItems.map((item, index) => (
                                    <TableRow key={item.id}>
                                      <TableCell padding="checkbox">
                                        <Checkbox
                                          checked={item.checked}
                                          onChange={(e) => {
                                            const newItems = [...receivePOItems];
                                            newItems[index].checked = e.target.checked;
                                            setReceivePOItems(newItems);
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell>{item.product_name}</TableCell>
                                      <TableCell align="center">{item.ordered_quantity}</TableCell>
                                      <TableCell align="center">{item.received_quantity}</TableCell>
                                      <TableCell align="center">
                                        {item.ordered_quantity - item.received_quantity}
                                      </TableCell>
                                      <TableCell align="center">
                                        <TextField
                                          type="number"
                                          size="small"
                                          value={item.to_receive}
                                          disabled={!item.checked}
                                          onFocus={(e) => {
                                            // Clear the field if it's 0
                                            if (item.to_receive === 0) {
                                              e.target.select();
                                            }
                                          }}
                                          onChange={(e) => {
                                            const inputValue = e.target.value;
                                            // Allow empty string for clearing
                                            if (inputValue === '') {
                                              const newItems = [...receivePOItems];
                                              newItems[index].to_receive = 0;
                                              setReceivePOItems(newItems);
                                              return;
                                            }
                                            // Calculate remaining quantity (cannot exceed)
                                            const remaining = item.ordered_quantity - item.received_quantity;
                                            const value = Math.max(0, Math.min(Number(inputValue), remaining));
                                            const newItems = [...receivePOItems];
                                            newItems[index].to_receive = value;
                                            setReceivePOItems(newItems);
                                          }}
                                          inputProps={{
                                            min: 0,
                                            max: item.ordered_quantity - item.received_quantity,
                                            style: { textAlign: 'center', width: 60 }
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                                      <TableCell align="right">
                                        <TextField
                                          type="number"
                                          size="small"
                                          value={item.actual_price}
                                          disabled={!item.checked}
                                          onChange={(e) => {
                                            const newItems = [...receivePOItems];
                                            newItems[index].actual_price = Number(e.target.value);
                                            setReceivePOItems(newItems);
                                          }}
                                          inputProps={{
                                            min: 0,
                                            step: 0.01,
                                            style: { textAlign: 'right', width: 80 }
                                          }}
                                          InputProps={{
                                            startAdornment: <Typography sx={{ fontSize: 12, mr: 0.5 }}>₱</Typography>
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell align="right">
                                        {formatCurrency(item.to_receive * item.actual_price)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>

                            {/* Summary */}
                            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                              <Grid container spacing={2}>
                                <Grid item xs={6}>
                                  <Typography variant="body2" color="text.secondary">
                                    Items Selected: {receivePOItems.filter(item => item.checked).length}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Total Quantity: {receivePOItems.filter(item => item.checked).reduce((sum, item) => sum + item.to_receive, 0)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                                  <Typography variant="h6" color="primary">
                                    Amount to Pay: {formatCurrency(
                                      receivePOItems
                                        .filter(item => item.checked)
                                        .reduce((sum, item) => sum + (item.to_receive * item.actual_price), 0)
                                    )}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Box>

                            {/* Action Buttons */}
                            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'space-between' }}>
                              <Button
                                variant="outlined"
                                color="warning"
                                startIcon={<CloseIcon />}
                                disabled={loading}
                                onClick={() => {
                                  const po = purchaseOrders.find(p => p.id === selectedReceivePO);
                                  if (po) {
                                    setPoToClose(po);
                                    setClosePODialog(true);
                                  }
                                }}
                              >
                                Close PO
                              </Button>
                              <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                  variant="outlined"
                                  onClick={() => {
                                    setSelectedReceivePO(null);
                                    setReceivePOItems([]);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="outlined"
                                  startIcon={<CheckCircleIcon />}
                                  disabled={loading || !receivePOItems.some(item => item.checked && item.to_receive > 0)}
                                  onClick={async () => {
                                  const itemsToReceive = receivePOItems.filter(item => item.checked && item.to_receive > 0);
                                  
                                  try {
                                    setLoading(true);
                                    await axios.post(`/api/purchase-orders/${selectedReceivePO}/receive`, {
                                      items: itemsToReceive.map(item => ({
                                        purchase_order_item_id: item.id,
                                        product_id: item.product_id,
                                        quantity_received: item.to_receive,
                                        actual_price: item.actual_price
                                      }))
                                    });

                                    showNotification('Items received successfully', 'success');
                                    setSelectedReceivePO(null);
                                    setReceivePOItems([]);
                                    
                                    if (selectedSupplier) {
                                      fetchPurchaseOrders(selectedSupplier.id);
                                    }
                                  } catch (error) {
                                    console.error('Failed to receive items:', error);
                                    showNotification('Failed to receive items', 'error');
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                              >
                                Receive Only
                              </Button>
                              <Button
                                variant="contained"
                                startIcon={<PaymentIcon />}
                                disabled={loading || !receivePOItems.some(item => item.checked && item.to_receive > 0)}
                                onClick={() => {
                                  // Prepare receiving items for the dialog
                                  const itemsToReceive = receivePOItems.filter(item => item.checked && item.to_receive > 0);
                                  const totalAmount = itemsToReceive.reduce((sum, item) => sum + (item.to_receive * item.actual_price), 0);
                                  
                                  // Set up the dialog with selected items
                                  setReceivingItems(itemsToReceive.map(item => ({
                                    id: item.id,
                                    product_id: item.product_id,
                                    product_name: item.product_name,
                                    ordered_quantity: item.ordered_quantity,
                                    received_quantity: item.received_quantity,
                                    receiving_now: item.to_receive,
                                    unit_price: item.unit_price,
                                    actual_price: item.actual_price
                                  })));
                                  setPaymentAmount(totalAmount);
                                  
                                  // Find the selected PO for the dialog
                                  const po = purchaseOrders.find(p => p.id === selectedReceivePO);
                                  if (po) {
                                    setSelectedPO(po);
                                  }
                                  
                                  setReceiveDialog(true);
                                }}
                                color="success"
                              >
                                Receive & Make Payment
                              </Button>
                              </Box>
                            </Box>
                          </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <Typography variant="body1" color="text.secondary">
                                {purchaseOrders.length > 0
                                  ? 'Select a purchase order from the left to receive items'
                                  : 'No purchase orders available for receiving'}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}

                    {/* Make Payment Tab */}
                    {rightTab === 2 && (
                      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Left Side - PO List */}
                        <Box sx={{ width: 250, borderRight: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
                          <List dense>
                            {/* Summary Item - Always at top */}
                            <ListItem disablePadding>
                              <ListItemButton
                                selected={selectedPaymentPO === 'summary'}
                                onClick={() => {
                                  setSelectedPaymentPO('summary');
                                  setPaymentPODetails(null);
                                }}
                                sx={{
                                  borderRadius: 1,
                                  mx: 1,
                                  my: 0.5,
                                  bgcolor: 'primary.main',
                                  color: 'white',
                                  '&:hover': {
                                    bgcolor: 'primary.dark',
                                  },
                                  '&.Mui-selected': {
                                    bgcolor: 'primary.dark',
                                    '&:hover': {
                                      bgcolor: 'primary.dark',
                                    }
                                  }
                                }}
                              >
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                                      Purchase Orders
                                    </Typography>
                                  }
                                  secondary={
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                                      View Summary
                                    </Typography>
                                  }
                                />
                              </ListItemButton>
                            </ListItem>
                            
                            <Divider sx={{ my: 1 }} />
                            {purchaseOrders.map(po => (
                                <ListItem
                                  key={po.id}
                                  disablePadding
                                >
                                  <ListItemButton
                                    selected={selectedPaymentPO === po.id}
                                    onClick={async () => {
                                      setSelectedPaymentPO(po.id);
                                      
                                      // Fetch PO details
                                      try {
                                        setLoading(true);
                                        const response = await axios.get(`/api/purchase-orders/${po.id}`);
                                        setPaymentPODetails(response.data);
                                        setPaymentAmount(response.data.total_amount - (response.data.paid_amount || 0));
                                      } catch (error) {
                                        console.error('Failed to fetch PO details:', error);
                                        showNotification('Failed to load purchase order details', 'error');
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    sx={{
                                      borderRadius: 1,
                                      mx: 1,
                                      my: 0.5,
                                      '&.Mui-selected': {
                                        backgroundColor: 'primary.light',
                                        '&:hover': {
                                          backgroundColor: 'primary.light',
                                        }
                                      }
                                    }}
                                  >
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {po.po_number}
                                          </Typography>
                                          <Chip
                                            label={po.payment_status}
                                            size="small"
                                            color={getPaymentStatusColor(po.payment_status)}
                                            sx={{ height: 18, fontSize: 9 }}
                                          />
                                        </Box>
                                      }
                                      secondary={
                                        <Box>
                                          <Typography variant="caption" display="block" color="text.secondary">
                                            {formatDate(po.order_date)}
                                          </Typography>
                                          <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                            {formatCurrency(po.total_amount)}
                                          </Typography>
                                        </Box>
                                      }
                                    />
                                  </ListItemButton>
                                </ListItem>
                              ))}
                            {purchaseOrders.filter(po => po.payment_status !== 'Paid this month').length === 0 && (
                              <Box sx={{ p: 3, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                  No purchase orders requiring payment
                                </Typography>
                              </Box>
                            )}
                          </List>
                        </Box>

                        {/* Right Side - Payment Form */}
                        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                          {selectedPaymentPO === 'summary' ? (
                            <Box sx={{ p: 3 }}>
                              {/* Header */}
                              <Box sx={{ mb: 3, pb: 2, borderBottom: '2px solid', borderColor: 'divider' }}>
                                <Typography variant="h5" sx={{ fontWeight: 600 }}>Payment Status Report</Typography>
                                <Typography variant="body2" color="text.secondary">Purchase Order Payment Overview</Typography>
                              </Box>

                              {/* Stats Cards */}
                              <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ p: 1.5, bgcolor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                      Paid
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                                        {purchaseOrders.filter(po => po.payment_status === 'Paid this month').length}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">orders</Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ mt: 0.5, color: '#2e7d32', fontWeight: 600 }}>
                                      {formatCurrency(
                                        purchaseOrders.filter(po => po.payment_status === 'Paid this month')
                                          .reduce((sum, po) => sum + po.total_amount, 0)
                                      )}
                                    </Typography>
                                  </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ p: 1.5, bgcolor: '#ffebee', borderLeft: '4px solid #f44336' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                      Unpaid
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#c62828' }}>
                                        {purchaseOrders.filter(po => po.payment_status !== 'Paid this month').length}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">orders</Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ mt: 0.5, color: '#c62828', fontWeight: 600 }}>
                                      {formatCurrency(
                                        purchaseOrders.filter(po => po.payment_status !== 'Paid this month')
                                          .reduce((sum, po) => sum + po.total_amount, 0)
                                      )}
                                    </Typography>
                                  </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ p: 1.5, bgcolor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                      Total Orders
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1565c0' }}>
                                        {purchaseOrders.length}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">orders</Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ mt: 0.5, color: '#1565c0', fontWeight: 600 }}>
                                      {formatCurrency(purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0))}
                                    </Typography>
                                  </Card>
                                </Grid>
                              </Grid>

                              {/* Breakdown Table */}
                              <Card sx={{ p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Detailed Breakdown</Typography>
                                <TableContainer>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Total Amount</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Percentage</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      <TableRow>
                                        <TableCell>
                                          <Chip label="Paid this month" size="small" color="success" sx={{ minWidth: 100 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.filter(po => po.payment_status === 'Paid this month').length}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(
                                            purchaseOrders.filter(po => po.payment_status === 'Paid this month')
                                              .reduce((sum, po) => sum + po.total_amount, 0)
                                          )}
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.length > 0
                                            ? ((purchaseOrders.filter(po => po.payment_status === 'Paid this month').length / purchaseOrders.length) * 100).toFixed(1)
                                            : 0}%
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell>
                                          <Chip label="Partially Paid" size="small" color="warning" sx={{ minWidth: 100 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.filter(po => po.payment_status === 'Partially Paid').length}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(
                                            purchaseOrders.filter(po => po.payment_status === 'Partially Paid')
                                              .reduce((sum, po) => sum + po.total_amount, 0)
                                          )}
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.length > 0
                                            ? ((purchaseOrders.filter(po => po.payment_status === 'Partially Paid').length / purchaseOrders.length) * 100).toFixed(1)
                                            : 0}%
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell>
                                          <Chip label="Unpaid" size="small" color="error" sx={{ minWidth: 100 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.filter(po => po.payment_status === 'Unpaid').length}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(
                                            purchaseOrders.filter(po => po.payment_status === 'Unpaid')
                                              .reduce((sum, po) => sum + po.total_amount, 0)
                                          )}
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.length > 0
                                            ? ((purchaseOrders.filter(po => po.payment_status === 'Unpaid').length / purchaseOrders.length) * 100).toFixed(1)
                                            : 0}%
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell>
                                          <Chip label="To be paid next month" size="small" color="info" sx={{ minWidth: 100 }} />
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.filter(po => po.payment_status === 'To be paid next month').length}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(
                                            purchaseOrders.filter(po => po.payment_status === 'To be paid next month')
                                              .reduce((sum, po) => sum + po.total_amount, 0)
                                          )}
                                        </TableCell>
                                        <TableCell align="right">
                                          {purchaseOrders.length > 0
                                            ? ((purchaseOrders.filter(po => po.payment_status === 'To be paid next month').length / purchaseOrders.length) * 100).toFixed(1)
                                            : 0}%
                                        </TableCell>
                                      </TableRow>
                                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>{purchaseOrders.length}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                          {formatCurrency(purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0))}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>100%</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Card>
                            </Box>
          ) : selectedPaymentPO && paymentPODetails ? (
                          <Paper sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Purchase Order Details
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Grid container spacing={2}>
                                  <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">PO Number</Typography>
                                    <Typography variant="body1">{paymentPODetails.po_number}</Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Order Date</Typography>
                                    <Typography variant="body1">{formatDate(paymentPODetails.order_date)}</Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                                    <Typography variant="h6">{formatCurrency(paymentPODetails.total_amount)}</Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Amount Paid</Typography>
                                    <Typography variant="h6" color="success.main">
                                      {formatCurrency(paymentPODetails.paid_amount || 0)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Alert severity="info">
                                      <Typography variant="body2">
                                        <strong>Balance Due:</strong> {formatCurrency(paymentPODetails.total_amount - (paymentPODetails.paid_amount || 0))}
                                      </Typography>
                                    </Alert>
                                  </Grid>
                                </Grid>
                              </Grid>

                              <Grid item xs={12}>
                                <Divider />
                              </Grid>

                              <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Payment Information
                                </Typography>
                              </Grid>

                              <Grid item xs={12} sm={6}>
                                <TextField
                                  fullWidth
                                  label="Payment Amount"
                                  type="number"
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                                  InputProps={{
                                    startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>
                                  }}
                                  inputProps={{
                                    min: 0,
                                    max: paymentPODetails.total_amount - (paymentPODetails.paid_amount || 0),
                                    step: 0.01
                                  }}
                                />
                              </Grid>

                              <Grid item xs={12} sm={6}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Payment Method</InputLabel>
                                  <Select
                                    value={paymentMethod}
                                    label="Payment Method"
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                  >
                                    <MenuItem value="cash">Cash</MenuItem>
                                    <MenuItem value="check">Check</MenuItem>
                                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Payment Notes"
                                  multiline
                                  rows={2}
                                  size="small"
                                  value={paymentNotes}
                                  onChange={(e) => setPaymentNotes(e.target.value)}
                                  placeholder="Reference number, check number, etc."
                                />
                              </Grid>

                              <Grid item xs={12}>
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                  <Button
                                    variant="outlined"
                                    onClick={() => {
                                      setSelectedPaymentPO(null);
                                      setPaymentPODetails(null);
                                      setPaymentAmount(0);
                                      setPaymentNotes('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<PaymentIcon />}
                                    disabled={loading || paymentAmount <= 0}
                                    onClick={async () => {
                                      try {
                                        setLoading(true);
                                        await axios.post(`/api/purchase-orders/${selectedPaymentPO}/payment`, {
                                          amount: paymentAmount,
                                          payment_method: paymentMethod,
                                          notes: paymentNotes
                                        });

                                        showNotification('Payment recorded successfully', 'success');
                                        setSelectedPaymentPO(null);
                                        setPaymentPODetails(null);
                                        setPaymentAmount(0);
                                        setPaymentNotes('');
                                        
                                        if (selectedSupplier) {
                                          fetchPurchaseOrders(selectedSupplier.id);
                                        }
                                      } catch (error) {
                                        console.error('Failed to record payment:', error);
                                        showNotification('Failed to record payment', 'error');
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                  >
                                    Record Payment
                                  </Button>
                                </Box>
                              </Grid>
                            </Grid>
                          </Paper>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <Typography variant="body1" color="text.secondary">
                                {purchaseOrders.filter(po => po.payment_status !== 'Paid this month').length > 0
                                  ? 'Select a purchase order from the left to make payment'
                                  : 'No purchase orders requiring payment'}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}

                    {/* Inventory History Tab */}
                    {rightTab === 3 && (
                      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Inventory history for {selectedSupplier.name} will be displayed here
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body1" color="text.secondary">
                      Select a supplier to view purchase orders
                    </Typography>
                  </Box>
                )}
              </Card>
            </Grid>
          </Grid>

        {/* Add/Edit Supplier Dialog */}
        <Dialog open={supplierDialog} onClose={() => setSupplierDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingSupplier?.id ? 'Edit Supplier' : 'Add New Supplier'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Company Name *"
                    value={editingSupplier?.name || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, name: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Person"
                    value={editingSupplier?.contact_person || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, contact_person: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={editingSupplier?.email || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, email: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={editingSupplier?.phone || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={editingSupplier?.address || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, address: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="City"
                    value={editingSupplier?.city || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, city: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="State"
                    value={editingSupplier?.state || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, state: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Zip Code"
                    value={editingSupplier?.zip_code || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, zip_code: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={editingSupplier?.country || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, country: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tax ID"
                    value={editingSupplier?.tax_id || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, tax_id: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Website"
                    value={editingSupplier?.website || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, website: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Payment Terms"
                    value={editingSupplier?.payment_terms || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, payment_terms: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Credit Limit"
                    type="number"
                    value={editingSupplier?.credit_limit || 0}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, credit_limit: Number(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={3}
                    value={editingSupplier?.notes || ''}
                    onChange={(e) => setEditingSupplier(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSupplierDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveSupplier}
              variant="contained"
              disabled={loading || !editingSupplier?.name?.trim()}
            >
              {editingSupplier?.id ? 'Update' : 'Create'} Supplier
            </Button>
          </DialogActions>
        </Dialog>

        {/* Supplier Detail Dialog */}
        <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            Supplier Details - {selectedSupplier?.name}
          </DialogTitle>
          <DialogContent>
            {selectedSupplier && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2">Contact Information</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography><ContactIcon sx={{ mr: 1, fontSize: 16 }} />{selectedSupplier.contact_person || 'N/A'}</Typography>
                      <Typography><EmailIcon sx={{ mr: 1, fontSize: 16 }} />{selectedSupplier.email || 'N/A'}</Typography>
                      <Typography><PhoneIcon sx={{ mr: 1, fontSize: 16 }} />{selectedSupplier.phone || 'N/A'}</Typography>
                      {selectedSupplier.website && (
                        <Typography><WebsiteIcon sx={{ mr: 1, fontSize: 16 }} />{selectedSupplier.website}</Typography>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2">Business Metrics</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography>Total Orders: {selectedSupplier.total_orders}</Typography>
                      <Typography>Total Spent: {formatCurrency(selectedSupplier.total_purchased || 0)}</Typography>
                      <Typography>Products: {selectedSupplier.product_count}</Typography>
                      <Typography>Last Order: {selectedSupplier.last_order_date ? formatDate(selectedSupplier.last_order_date) : 'Never'}</Typography>
                    </Box>
                  </Grid>
                </Grid>

                {isSupplierDetail(selectedSupplier) && Array.isArray(selectedSupplier.recentOrders) && selectedSupplier.recentOrders.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>Recent Purchase Orders</Typography>
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Order #</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedSupplier.recentOrders.map((order: { id: number; po_number: string; order_date: string; status: string; total_amount: number }) => (
                            <TableRow key={order.id}>
                              <TableCell>{order.po_number}</TableCell>
                              <TableCell>{formatDate(order.order_date)}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={order.status} 
                                  size="small"
                                  color={order.status === 'completed' ? 'success' : 
                                         order.status === 'pending' ? 'warning' : 'default'}
                                />
                              </TableCell>
                              <TableCell align="right">{formatCurrency(order.total_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                {isSupplierDetail(selectedSupplier) && Array.isArray(selectedSupplier.products) && selectedSupplier.products.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>Products from This Supplier</Typography>
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Product</TableCell>
                            <TableCell>SKU</TableCell>
                            <TableCell align="right">Cost</TableCell>
                            <TableCell align="right">Selling Price</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedSupplier.products.slice(0, 20).map((product: { id: number; name: string; sku: string; brand?: string; selling_price: number; cost_price: number; is_active: boolean }) => (
                            <TableRow key={product.id}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="bold">
                                  {product.name}
                                </Typography>
                                {product.brand && (
                                  <Typography variant="caption" color="text.secondary">
                                    {product.brand}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>{product.sku}</TableCell>
                              <TableCell align="right">{formatCurrency(product.cost_price)}</TableCell>
                              <TableCell align="right">{formatCurrency(product.selling_price)}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={product.is_active ? 'Active' : 'Inactive'}
                                  color={product.is_active ? 'success' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {selectedSupplier.products.length > 20 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        Showing first 20 products. Total: {selectedSupplier.product_count}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialog(false)}>Close</Button>
            <Button 
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => {
                setEditingSupplier(selectedSupplier);
                setDetailDialog(false);
                setSupplierDialog(true);
              }}
              disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
            >
              Edit Supplier
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete supplier "{selectedSupplier?.name}"?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleDeleteSupplier}
              color="error"
              variant="contained"
              disabled={loading}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Purchase Order Dialog */}
        <Dialog 
          open={purchaseOrderDialog} 
          onClose={() => setPurchaseOrderDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Create Purchase Order - {selectedSupplier?.name}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Purchase Order Number"
                    required
                    value={poOrderNumber}
                    onChange={(e) => setPoOrderNumber(e.target.value)}
                    placeholder="e.g., PO001"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Order Date"
                    type="date"
                    required
                    InputLabelProps={{ shrink: true }}
                    value={poOrderDate}
                    onChange={(e) => setPoOrderDate(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={2}
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1">
                      Order Items ({poItems.length})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        startIcon={<WarningIcon />}
                        size="small"
                        onClick={async () => {
                          try {
                            const response = await axios.get('/api/products', {
                              params: {
                                supplier_id: selectedSupplier?.id,
                                low_stock: true
                              }
                            });
                            setLowStockProducts(response.data.products || response.data || []);
                            setLowStockDialog(true);
                          } catch (error) {
                            console.error('Failed to fetch low stock products:', error);
                            showNotification('Failed to fetch low stock products', 'error');
                          }
                        }}
                      >
                        Low Stock
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={async () => {
                          try {
                            // Fetch all products for this supplier
                            const response = await axios.get('/api/products', {
                              params: {
                                supplier_id: selectedSupplier?.id,
                                status: 'active'
                              }
                            });
                            const products = response.data.products || response.data || [];
                            if (products.length === 0) {
                              showNotification('No products found for this supplier', 'warning');
                              return;
                            }
                            setLowStockProducts(products);
                            setLowStockDialog(true);
                          } catch (error) {
                            console.error('Failed to fetch products:', error);
                            showNotification('Failed to fetch products', 'error');
                          }
                        }}
                      >
                        Add Product
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={() => {
                          // Add a new manual item
                          setPoItems([...poItems, {
                            id: Date.now().toString(),
                            product_name: '',
                            quantity: 1,
                            unit_price: 0
                          }]);
                        }}
                      >
                        Add Item Manually
                      </Button>
                    </Box>
                  </Box>
                  
                  {poItems.length === 0 ? (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="info">
                        Click "Add Item" to add products to this purchase order.
                      </Alert>
                    </Box>
                  ) : (
                    <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                      {poItems.map((item, index) => (
                        <Card key={item.id} sx={{ mb: 1, p: 1 }}>
                          <Grid container spacing={1} alignItems="center">
                            <Grid item xs>
                              <TextField
                                fullWidth
                                label="Product Name"
                                size="small"
                                required
                                value={item.product_name}
                                disabled={!!item.product_id}
                                onChange={(e) => {
                                  const newItems = [...poItems];
                                  newItems[index].product_name = e.target.value;
                                  setPoItems(newItems);
                                }}
                              />
                            </Grid>
                            <Grid item xs={1.3}>
                              <TextField
                                fullWidth
                                label="Qty"
                                type="number"
                                size="small"
                                required
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...poItems];
                                  newItems[index].quantity = Number(e.target.value);
                                  setPoItems(newItems);
                                }}
                              />
                            </Grid>
                            <Grid item xs={2}>
                              <TextField
                                fullWidth
                                label="Unit Price"
                                type="number"
                                size="small"
                                required
                                value={item.unit_price}
                                onFocus={(e) => {
                                  if (item.unit_price === 0) {
                                    e.target.select();
                                  }
                                }}
                                onChange={(e) => {
                                  const newItems = [...poItems];
                                  newItems[index].unit_price = Number(e.target.value);
                                  setPoItems(newItems);
                                }}
                              />
                            </Grid>
                            <Grid item xs={2}>
                              <TextField
                                fullWidth
                                label="Subtotal"
                                size="small"
                                value={`$${(item.quantity * item.unit_price).toFixed(2)}`}
                                disabled
                              />
                            </Grid>
                            <Grid item xs="auto">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setPoItems(poItems.filter(i => i.id !== item.id));
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', pl: 2 }}>
              <Typography variant="h6">
                Total: ${poItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
              </Typography>
            </Box>
            <Button onClick={() => setPurchaseOrderDialog(false)}>Cancel</Button>
            <Button 
              variant="contained"
              disabled={loading || poItems.length === 0 || !poOrderNumber.trim()}
              onClick={handleCreatePurchaseOrder}
            >
              Create Purchase Order
            </Button>
          </DialogActions>
        </Dialog>

        {/* Products Selection Dialog */}
        <Dialog 
          open={lowStockDialog} 
          onClose={() => setLowStockDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Select Products from {selectedSupplier?.name}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search products..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 2 }}
              />
              {lowStockProducts.length === 0 ? (
                <Alert severity="info">
                  No low stock products found for this supplier.
                </Alert>
              ) : (
                <>
                  {lowStockProducts
                    .filter((product) => {
                      if (!productSearchTerm.trim()) return true;
                      const searchLower = productSearchTerm.toLowerCase().trim();
                      return (
                        product.name?.toLowerCase().includes(searchLower) ||
                        product.brand?.toLowerCase().includes(searchLower) ||
                        product.sku?.toLowerCase().includes(searchLower)
                      );
                    }).length === 0 ? (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        No products match your search criteria.
                      </Alert>
                    ) : (
                      <List>
                        {lowStockProducts
                          .filter((product) => {
                            if (!productSearchTerm.trim()) return true;
                            const searchLower = productSearchTerm.toLowerCase().trim();
                            return (
                              product.name?.toLowerCase().includes(searchLower) ||
                              product.brand?.toLowerCase().includes(searchLower) ||
                              product.sku?.toLowerCase().includes(searchLower)
                            );
                          })
                          .map((product) => (
                    <ListItem 
                      key={product.id}
                      secondaryAction={
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => {
                            // Check if product already exists in items
                            const existingItem = poItems.find(item => item.product_id === product.id);
                            if (existingItem) {
                              showNotification('Product already added to order', 'warning');
                              return;
                            }
                            
                            setPoItems([...poItems, {
                              id: Date.now().toString(),
                              product_id: product.id,
                              product_name: `${product.brand || ''} ${product.name}`.trim(),
                              quantity: product.reorder_point || 10,
                              unit_price: product.cost_price || 0
                            }]);
                            showNotification(`Added ${product.name} to order`, 'success');
                          }}
                        >
                          Add
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body1">
                            {product.brand && `${product.brand} - `}{product.name}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              Current Stock: {product.quantity || 0} {product.unit || 'pcs'}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Cost: {formatCurrency(product.cost_price || 0)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                      </List>
                    )}
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLowStockDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Purchase Order Detail Dialog */}
        <Dialog 
          open={poDetailDialog} 
          onClose={() => setPoDetailDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Purchase Order Details - {selectedPO?.po_number}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Order Date</Typography>
                  <Typography variant="body1">{selectedPO && formatDate(selectedPO.order_date)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Payment Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={selectedPO?.payment_status}
                      size="small"
                      color={selectedPO ? getPaymentStatusColor(selectedPO.payment_status) : 'default'}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Receiving Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      icon={selectedPO ? getReceivingStatusIcon(selectedPO.receiving_status) : undefined}
                      label={selectedPO?.receiving_status}
                      size="small"
                      color={selectedPO ? getReceivingStatusColor(selectedPO.receiving_status) : 'default'}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                  <Typography variant="h5">{selectedPO && formatCurrency(selectedPO.total_amount)}</Typography>
                </Grid>
                {selectedPO?.notes && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Notes</Typography>
                    <Typography variant="body1">{selectedPO.notes}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>Order Items</Typography>
                  <Alert severity="info">
                    Item details will be loaded from the database. Currently showing: {selectedPO?.items_summary}
                  </Alert>
                  {/* TODO: Fetch and display actual items from backend */}
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPoDetailDialog(false)}>Close</Button>
            {selectedPO?.receiving_status !== 'Received' && (
              <Button 
                variant="contained"
                startIcon={<InventoryIcon />}
                onClick={async () => {
                  setPoDetailDialog(false);
                  if (selectedPO) {
                    setRightTab(1);
                    setSelectedReceivePO(selectedPO.id);
                    
                    // Fetch PO items for the Receive Items tab
                    try {
                      setLoading(true);
                      const response = await axios.get(`/api/purchase-orders/${selectedPO.id}`);
                      const poData = response.data;
                      
                      const items = poData.items.map((item: any) => ({
                        id: item.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        ordered_quantity: item.quantity,
                        received_quantity: item.received_quantity || 0,
                        unit_price: item.unit_cost,
                        actual_price: item.unit_cost,
                        to_receive: Math.max(0, item.quantity - (item.received_quantity || 0)),
                        checked: false
                      }));
                      
                      setReceivePOItems(items);
                    } catch (error) {
                      console.error('Failed to fetch PO items:', error);
                      showNotification('Failed to load purchase order items', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                color="primary"
              >
                Receive Items
              </Button>
            )}
            {selectedPO?.payment_status !== 'Paid this month' && (
              <Button 
                variant="contained"
                startIcon={<PaymentIcon />}
                onClick={async () => {
                  setPoDetailDialog(false);
                  if (selectedPO) {
                    setSelectedPaymentPO(selectedPO.id);
                    setRightTab(2);
                    // Fetch PO details for payment
                    try {
                      setLoading(true);
                      const response = await axios.get(`/api/purchase-orders/${selectedPO.id}`);
                      setPaymentPODetails(response.data);
                      setPaymentAmount(response.data.total_amount - (response.data.paid_amount || 0));
                    } catch (error) {
                      console.error('Failed to fetch PO details:', error);
                      showNotification('Failed to load purchase order details', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                disabled={!user || (user.role !== 'admin' && user.role !== 'manager')}
                color="success"
              >
                Record Payment
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Receive Items & Payment Dialog */}
        <Dialog 
          open={receiveDialog} 
          onClose={() => setReceiveDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Receive Items & Payment - {selectedPO?.po_number}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                {/* Receiving Section */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Items to Receive
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="center">Ordered</TableCell>
                          <TableCell align="center">Already Received</TableCell>
                          <TableCell align="center">Remaining</TableCell>
                          <TableCell align="center" sx={{ minWidth: 120 }}>Receive Now</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {receivingItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell align="center">{item.ordered_quantity}</TableCell>
                            <TableCell align="center">{item.received_quantity}</TableCell>
                            <TableCell align="center">
                              {item.ordered_quantity - item.received_quantity}
                            </TableCell>
                            <TableCell align="center">
                              <TextField
                                type="number"
                                size="small"
                                value={item.receiving_now}
                                onChange={(e) => {
                                  const value = Math.max(0, Math.min(
                                    Number(e.target.value),
                                    item.ordered_quantity - item.received_quantity
                                  ));
                                  const newItems = [...receivingItems];
                                  newItems[index].receiving_now = value;
                                  setReceivingItems(newItems);
                                }}
                                inputProps={{
                                  min: 0,
                                  max: item.ordered_quantity - item.received_quantity,
                                  style: { textAlign: 'center' }
                                }}
                                sx={{ width: 80 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Payment Section */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Payment Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Payment Amount"
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Payment Method</InputLabel>
                        <Select
                          value={paymentMethod}
                          label="Payment Method"
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                        >
                          <MenuItem value="cash">Cash</MenuItem>
                          <MenuItem value="check">Check</MenuItem>
                          <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Box
                        sx={{
                          position: 'relative',
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'grey.300',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          px: 1.75,
                          pt: 1.25,
                          pb: 0.5
                        }}
                      >
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            position: 'absolute',
                            top: '-9px',
                            left: '10px',
                            bgcolor: 'grey.50',
                            px: 0.5,
                            fontSize: '0.75rem',
                            color: 'text.secondary'
                          }}
                        >
                          Total PO Amount
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.875rem' }}>
                          {formatCurrency(selectedPO?.total_amount || 0)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Payment Notes (Optional)"
                        multiline
                        rows={2}
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Reference number, check number, etc."
                      />
                    </Grid>
                  </Grid>
                </Grid>

                {/* Summary */}
                <Grid item xs={12}>
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Summary:</strong><br/>
                      • Receiving {receivingItems.reduce((sum, item) => sum + item.receiving_now, 0)} items<br/>
                      • Recording payment: {formatCurrency(paymentAmount)}
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReceiveDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="contained"
              onClick={handleReceiveItems}
              disabled={loading || (receivingItems.every(item => item.receiving_now === 0) && paymentAmount <= 0)}
              startIcon={<CheckCircleIcon />}
              color="primary"
            >
              {receivingItems.some(item => item.receiving_now > 0) && paymentAmount > 0
                ? 'Receive & Pay'
                : receivingItems.some(item => item.receiving_now > 0)
                ? 'Receive Items'
                : 'Record Payment'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Close Purchase Order Dialog */}
        <Dialog open={closePODialog} onClose={() => setClosePODialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Close Purchase Order
          </DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                This will mark the purchase order as complete even if not all items have been received.
                Use this when the supplier cannot fulfill the remaining items.
              </Typography>
            </Alert>
            {poToClose && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  PO: {poToClose.po_number}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supplier: {poToClose.supplier_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {poToClose.receiving_status}
                </Typography>
              </Box>
            )}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason for closing (optional)"
              placeholder="e.g., Supplier out of stock, discontinued item, etc."
              value={closePOReason}
              onChange={(e) => setClosePOReason(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setClosePODialog(false);
              setPoToClose(null);
              setClosePOReason('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="contained"
              color="warning"
              onClick={handleClosePO}
              disabled={loading}
            >
              Close Purchase Order
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

export default Suppliers;