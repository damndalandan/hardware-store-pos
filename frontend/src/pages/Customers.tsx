import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Snackbar, Alert, Paper, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [alert, setAlert] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/customers');
      setCustomers(res.data.customers || []);
    } catch (error: any) {
      setAlert({ message: 'Failed to fetch customers', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer?.name?.trim()) {
      setAlert({ message: 'Customer name is required', severity: 'error' });
      return;
    }
    setLoading(true);
    try {
      if (editingCustomer.id) {
        await axios.put(`/api/customers/${editingCustomer.id}`, editingCustomer);
        setAlert({ message: 'Customer updated successfully', severity: 'success' });
      } else {
        await axios.post('/api/customers', editingCustomer);
        setAlert({ message: 'Customer added successfully', severity: 'success' });
      }
      setDialogOpen(false);
      fetchCustomers();
    } catch (error: any) {
      setAlert({ message: 'Failed to save customer', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    setLoading(true);
    try {
      await axios.delete(`/api/customers/${selectedCustomer.id}`);
      setAlert({ message: 'Customer deleted successfully', severity: 'success' });
      setDeleteDialogOpen(false);
      fetchCustomers();
    } catch (error: any) {
      setAlert({ message: 'Failed to delete customer', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Customers</Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingCustomer({}); setDialogOpen(true); }}>
        Add Customer
      </Button>
      <Paper sx={{ mt: 3 }}>
        <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Name</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Email</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Phone</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Address</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1250, borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' }} data-field="actions">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>{customer.address}</TableCell>
                <TableCell data-field="actions" sx={{ position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1240, borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
                  <IconButton onClick={() => { setEditingCustomer(customer); setDialogOpen(true); }}><EditIcon /></IconButton>
                  <IconButton color="error" onClick={() => { setSelectedCustomer(customer); setDeleteDialogOpen(true); }}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{editingCustomer?.id ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={editingCustomer?.name || ''}
            onChange={e => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email"
            value={editingCustomer?.email || ''}
            onChange={e => setEditingCustomer(prev => ({ ...prev, email: e.target.value }))}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Phone"
            value={editingCustomer?.phone || ''}
            onChange={e => setEditingCustomer(prev => ({ ...prev, phone: e.target.value }))}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Address"
            value={editingCustomer?.address || ''}
            onChange={e => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveCustomer} variant="contained" disabled={loading}>Save</Button>
        </DialogActions>
      </Dialog>
      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete customer "{selectedCustomer?.name}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteCustomer} color="error" variant="contained" disabled={loading}>Delete</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!alert}
        autoHideDuration={6000}
        onClose={() => setAlert(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setAlert(null)} severity={alert?.severity || 'info'}>
          {alert?.message || ''}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Customers;
