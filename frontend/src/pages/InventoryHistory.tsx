import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Grid, FormControl, InputLabel,
  Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, IconButton, InputAdornment, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, TablePagination
} from '@mui/material';
import {
  Search as SearchIcon, FilterList as FilterIcon, Refresh as RefreshIcon,
  Download as DownloadIcon, Visibility as ViewIcon
} from '@mui/icons-material';
import axios from 'axios';

interface InventoryEvent {
  id: number;
  event_type: 'received' | 'returned' | 'adjusted';
  date: string;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  supplier_id?: number;
  supplier_name?: string;
  purchase_order_id?: number;
  purchase_order_number?: string;
  reference_number?: string;
  reason?: string;
  performed_by: string;
  notes?: string;
}

const InventoryHistory: React.FC = () => {
  const [events, setEvents] = useState<InventoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<InventoryEvent | null>(null);
  const [detailDialog, setDetailDialog] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'received' | 'returned' | 'adjusted'>('all');
  const [supplierFilter, setSupplierFilter] = useState<'all' | number>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchInventoryHistory();
  }, [page, rowsPerPage, eventTypeFilter, supplierFilter, dateFrom, dateTo, searchTerm]);

  const fetchInventoryHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', (page + 1).toString());
      params.append('limit', rowsPerPage.toString());
      
      if (searchTerm) params.append('search', searchTerm);
      if (eventTypeFilter !== 'all') params.append('event_type', eventTypeFilter);
      if (supplierFilter !== 'all') params.append('supplier_id', supplierFilter.toString());
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const response = await axios.get(`${API_BASE_URL}/inventory/history?${params}`);
      setEvents(response.data.events || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch inventory history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'received': return 'success';
      case 'returned': return 'error';
      case 'adjusted': return 'warning';
      default: return 'default';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'received': return 'Received';
      case 'returned': return 'Returned';
      case 'adjusted': return 'Adjusted';
      default: return type;
    }
  };

  const handleExport = () => {
    // Export to CSV logic
    const csv = [
      ['Date', 'Event Type', 'Product', 'SKU', 'Quantity', 'Supplier', 'PO Number', 'Performed By', 'Notes'].join(','),
      ...events.map(event => [
        formatDate(event.date),
        getEventTypeLabel(event.event_type),
        event.product_name,
        event.sku,
        event.quantity,
        event.supplier_name || 'N/A',
        event.purchase_order_number || 'N/A',
        event.performed_by,
        event.notes || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-history-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#f7f8fA', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Inventory History
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchInventoryHistory}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            Export
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Event Type</InputLabel>
                <Select
                  value={eventTypeFilter}
                  label="Event Type"
                  onChange={(e) => setEventTypeFilter(e.target.value as any)}
                >
                  <MenuItem value="all">All Events</MenuItem>
                  <MenuItem value="received">Received</MenuItem>
                  <MenuItem value="returned">Returned</MenuItem>
                  <MenuItem value="adjusted">Adjusted</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Date From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Date To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date/Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Event Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Quantity</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Previous Stock</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">New Stock</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Supplier</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>PO #</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Performed By</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id} hover>
                  <TableCell>{formatDate(event.date)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getEventTypeLabel(event.event_type)}
                      size="small"
                      color={getEventTypeColor(event.event_type)}
                    />
                  </TableCell>
                  <TableCell>{event.product_name}</TableCell>
                  <TableCell>{event.sku}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: event.event_type === 'received' ? 'success.main' : 
                               event.event_type === 'returned' ? 'error.main' : 'warning.main'
                      }}
                    >
                      {event.event_type === 'received' ? '+' : event.event_type === 'returned' ? '-' : '±'}
                      {event.quantity}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{event.previous_quantity}</TableCell>
                  <TableCell align="right">{event.new_quantity}</TableCell>
                  <TableCell>{event.supplier_name || '-'}</TableCell>
                  <TableCell>
                    {event.purchase_order_number ? (
                      <Chip
                        label={event.purchase_order_number}
                        size="small"
                        variant="outlined"
                      />
                    ) : '-'}
                  </TableCell>
                  <TableCell>{event.performed_by}</TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedEvent(event);
                          setDetailDialog(true);
                        }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialog}
        onClose={() => setDetailDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Inventory Event Details
        </DialogTitle>
        <DialogContent dividers>
          {selectedEvent && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Date/Time</Typography>
                <Typography variant="body2">{formatDate(selectedEvent.date)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Event Type</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={getEventTypeLabel(selectedEvent.event_type)}
                    size="small"
                    color={getEventTypeColor(selectedEvent.event_type)}
                  />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Product</Typography>
                <Typography variant="body2">{selectedEvent.product_name}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">SKU</Typography>
                <Typography variant="body2">{selectedEvent.sku}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Quantity Change</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedEvent.event_type === 'received' ? '+' : selectedEvent.event_type === 'returned' ? '-' : '±'}
                  {selectedEvent.quantity}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Previous Stock</Typography>
                <Typography variant="body2">{selectedEvent.previous_quantity}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">New Stock</Typography>
                <Typography variant="body2">{selectedEvent.new_quantity}</Typography>
              </Grid>
              {selectedEvent.supplier_name && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Supplier</Typography>
                  <Typography variant="body2">{selectedEvent.supplier_name}</Typography>
                </Grid>
              )}
              {selectedEvent.purchase_order_number && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Purchase Order</Typography>
                  <Typography variant="body2">{selectedEvent.purchase_order_number}</Typography>
                </Grid>
              )}
              {selectedEvent.reference_number && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Reference Number</Typography>
                  <Typography variant="body2">{selectedEvent.reference_number}</Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Performed By</Typography>
                <Typography variant="body2">{selectedEvent.performed_by}</Typography>
              </Grid>
              {selectedEvent.reason && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Reason</Typography>
                  <Typography variant="body2">{selectedEvent.reason}</Typography>
                </Grid>
              )}
              {selectedEvent.notes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Notes</Typography>
                  <Typography variant="body2">{selectedEvent.notes}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryHistory;
