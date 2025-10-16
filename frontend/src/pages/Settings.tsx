import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField, Tab, Tabs,
  Alert, Snackbar, FormControl, InputLabel, Select, MenuItem, Switch,
  FormControlLabel, Divider, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Chip, List, ListItem, ListItemText, ListItemSecondaryAction,
  CircularProgress
} from '@mui/material';
import {
  Settings as SettingsIcon, Business as BusinessIcon, Receipt as ReceiptIcon,
  Security as SecurityIcon, Storage as BackupIcon, LocalAtm as TaxIcon,
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Save as SaveIcon,
  Backup as BackupNowIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface BusinessInfo {
  business_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  tax_id: string;
  logo_url: string;
  receipt_header: string;
  receipt_footer: string;
}

interface TaxRate {
  id: number;
  name: string;
  rate: number;
  category_name: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface SystemSettings {
  [category: string]: {
    [key: string]: {
      value: any;
      description: string;
      data_type: string;
      updated_at: string;
    };
  };
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);
  
  // States for different settings categories
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    business_name: '', address_line1: '', address_line2: '', city: '', state: '',
    zip_code: '', country: '', phone: '', email: '', website: '', tax_id: '',
    logo_url: '', receipt_header: '', receipt_footer: ''
  });
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [newTaxRate, setNewTaxRate] = useState({ name: '', rate: 0, category_id: null, is_default: false });
  const [taxRateDialogOpen, setTaxRateDialogOpen] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null);

  // Load all settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, businessRes, taxRatesRes] = await Promise.all([
        axios.get('/api/settings'),
        axios.get('/api/settings/business'),
        axios.get('/api/settings/tax-rates')
      ]);
      
      setSystemSettings(settingsRes.data.settings || {});
      setBusinessInfo(businessRes.data.business || {});
      setTaxRates(taxRatesRes.data.tax_rates || []);
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setAlert({ message: 'Failed to load settings', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateSystemSetting = async (category: string, key: string, value: any) => {
    try {
      await axios.put(`/api/settings/system/${category}/${key}`, { value });
      
      // Update local state
      setSystemSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: {
            ...prev[category][key],
            value
          }
        }
      }));
      
      setAlert({ message: 'Setting updated successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error updating setting:', error);
      setAlert({ message: 'Failed to update setting', severity: 'error' });
    }
  };

  const updateBusinessInfo = async () => {
    setLoading(true);
    try {
      await axios.put('/api/settings/business', businessInfo);
      setAlert({ message: 'Business information updated successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error updating business info:', error);
      setAlert({ message: 'Failed to update business information', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const createTaxRate = async () => {
    try {
      await axios.post('/api/settings/tax-rates', newTaxRate);
      setNewTaxRate({ name: '', rate: 0, category_id: null, is_default: false });
      setTaxRateDialogOpen(false);
      await loadSettings(); // Reload to get updated list
      setAlert({ message: 'Tax rate created successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error creating tax rate:', error);
      setAlert({ message: 'Failed to create tax rate', severity: 'error' });
    }
  };

  const updateTaxRate = async () => {
    if (!editingTaxRate) return;
    
    try {
      await axios.put(`/api/settings/tax-rates/${editingTaxRate.id}`, editingTaxRate);
      setEditingTaxRate(null);
      await loadSettings();
      setAlert({ message: 'Tax rate updated successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error updating tax rate:', error);
      setAlert({ message: 'Failed to update tax rate', severity: 'error' });
    }
  };

  const deleteTaxRate = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this tax rate?')) return;
    
    try {
      await axios.delete(`/api/settings/tax-rates/${id}`);
      await loadSettings();
      setAlert({ message: 'Tax rate deleted successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error deleting tax rate:', error);
      setAlert({ message: 'Failed to delete tax rate', severity: 'error' });
    }
  };

  const executeBackup = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/settings/backup/execute');
      setAlert({ 
        message: `Backup completed successfully. File: ${response.data.backup_path}`, 
        severity: 'success' 
      });
    } catch (error: any) {
      console.error('Error executing backup:', error);
      setAlert({ message: 'Backup failed', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderSystemSettings = () => (
    <Grid container spacing={3}>
      {Object.entries(systemSettings).map(([category, settings]) => (
        <Grid item xs={12} md={6} key={category}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                {category} Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {Object.entries(settings).map(([key, setting]) => (
                <Box key={key} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {setting.description || key}
                  </Typography>
                  
                  {setting.data_type === 'boolean' ? (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={setting.value}
                          onChange={(e) => updateSystemSetting(category, key, e.target.checked)}
                          disabled={user?.role !== 'admin'}
                        />
                      }
                      label={setting.value ? 'Enabled' : 'Disabled'}
                    />
                  ) : setting.data_type === 'number' ? (
                    <TextField
                      type="number"
                      value={setting.value}
                      onChange={(e) => updateSystemSetting(category, key, parseFloat(e.target.value))}
                      size="small"
                      fullWidth
                      disabled={user?.role !== 'admin'}
                    />
                  ) : (
                    <TextField
                      value={setting.value}
                      onChange={(e) => updateSystemSetting(category, key, e.target.value)}
                      size="small"
                      fullWidth
                      disabled={user?.role !== 'admin'}
                    />
                  )}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderBusinessSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Business Information</Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Business Name"
              value={businessInfo.business_name || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, business_name: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Tax ID"
              value={businessInfo.tax_id || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, tax_id: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address Line 1"
              value={businessInfo.address_line1 || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, address_line1: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address Line 2"
              value={businessInfo.address_line2 || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, address_line2: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="City"
              value={businessInfo.city || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, city: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="State"
              value={businessInfo.state || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, state: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="ZIP Code"
              value={businessInfo.zip_code || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, zip_code: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Phone"
              value={businessInfo.phone || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, phone: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Email"
              value={businessInfo.email || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, email: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Website"
              value={businessInfo.website || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, website: e.target.value }))}
              fullWidth
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Receipt Header"
              value={businessInfo.receipt_header || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, receipt_header: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              disabled={user?.role !== 'admin'}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Receipt Footer"
              value={businessInfo.receipt_footer || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, receipt_footer: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              disabled={user?.role !== 'admin'}
            />
          </Grid>
        </Grid>
        
        {user?.role === 'admin' && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={updateBusinessInfo}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            >
              Save Business Information
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderTaxSettings = () => (
    <Box>
      {/* VAT Configuration Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            VAT / Tax Configuration
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Default VAT Rate (%)
              </Typography>
              <TextField
                type="number"
                value={systemSettings.tax?.default_rate?.value ? (systemSettings.tax.default_rate.value * 100).toFixed(2) : '12.00'}
                onChange={(e) => updateSystemSetting('tax', 'default_rate', parseFloat(e.target.value) / 100)}
                size="small"
                fullWidth
                disabled={user?.role !== 'admin'}
                inputProps={{ step: 0.01, min: 0, max: 100 }}
                helperText="Default rate: 12% for Philippine VAT"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                VAT-Inclusive Pricing
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={systemSettings.tax?.vat_inclusive?.value === true || systemSettings.tax?.vat_inclusive?.value === 'true'}
                    onChange={(e) => updateSystemSetting('tax', 'vat_inclusive', e.target.checked)}
                    disabled={user?.role !== 'admin'}
                  />
                }
                label={systemSettings.tax?.vat_inclusive?.value === true || systemSettings.tax?.vat_inclusive?.value === 'true' ? 'Prices include VAT' : 'VAT added at checkout'}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                {systemSettings.tax?.vat_inclusive?.value === true || systemSettings.tax?.vat_inclusive?.value === 'true' 
                  ? 'Product prices already include VAT (Philippine standard)'
                  : 'VAT will be added on top of product prices'}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Show VAT Breakdown on Receipts
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={systemSettings.tax?.show_vat_breakdown?.value === true || systemSettings.tax?.show_vat_breakdown?.value === 'true'}
                    onChange={(e) => updateSystemSetting('tax', 'show_vat_breakdown', e.target.checked)}
                    disabled={user?.role !== 'admin'}
                  />
                }
                label={systemSettings.tax?.show_vat_breakdown?.value === true || systemSettings.tax?.show_vat_breakdown?.value === 'true' ? 'Show breakdown' : 'Hide breakdown'}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Display VATABLE SALE (Less VAT) and VAT (12%) separately
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                VAT-Registered Business
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={systemSettings.tax?.vat_registered?.value === true || systemSettings.tax?.vat_registered?.value === 'true'}
                    onChange={(e) => updateSystemSetting('tax', 'vat_registered', e.target.checked)}
                    disabled={user?.role !== 'admin'}
                  />
                }
                label={systemSettings.tax?.vat_registered?.value === true || systemSettings.tax?.vat_registered?.value === 'true' ? 'VAT-Registered' : 'Non-VAT'}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                BIR compliance: VAT-registered businesses must show VAT breakdown
              </Typography>
            </Grid>
          </Grid>
          
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              Philippine VAT Calculation (BIR Standard):
            </Typography>
            <Typography variant="caption" component="div">
              • Price includes 12% VAT: ₱19.99 ÷ 1.12 = ₱17.85 (VATABLE SALE)<br />
              • VAT amount: ₱17.85 × 0.12 = ₱2.14 (VAT 12%)<br />
              • Total: ₱17.85 + ₱2.14 = ₱19.99
            </Typography>
          </Alert>
        </CardContent>
      </Card>
      
      {/* Tax Rates Management Card */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Tax Rates</Typography>
            {user?.role === 'admin' && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setTaxRateDialogOpen(true)}
              >
                Add Tax Rate
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 2 }} />
        
        <TableContainer component={Paper} sx={{ maxHeight: 360, position: 'relative', overflow: 'auto' }}>
          <Table stickyHeader sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Name</TableCell>
                <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Rate (%)</TableCell>
                <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Category</TableCell>
                <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Status</TableCell>
                <TableCell sx={{ top: 0, position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1400, WebkitBackgroundClip: 'padding-box', backgroundClip: 'padding-box', boxShadow: '-6px 0 12px rgba(0,0,0,0.04)', borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' }} data-field="actions">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {taxRates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>
                    {rate.name}
                    {rate.is_default && <Chip label="Default" size="small" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{(rate.rate * 100).toFixed(2)}%</TableCell>
                  <TableCell>{rate.category_name || 'All'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={rate.is_active ? 'Active' : 'Inactive'} 
                      color={rate.is_active ? 'success' : 'default'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell data-field="actions" sx={{ position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 1400, WebkitBackgroundClip: 'padding-box', backgroundClip: 'padding-box', boxShadow: '-6px 0 12px rgba(0,0,0,0.04)', borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
                    {user?.role === 'admin' && (
                      <>
                        <IconButton onClick={() => setEditingTaxRate(rate)} size="small">
                          <EditIcon />
                        </IconButton>
                        {!rate.is_default && (
                          <IconButton onClick={() => deleteTaxRate(rate.id)} size="small">
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
      
      {/* Tax Rate Dialog */}
      <Dialog open={taxRateDialogOpen} onClose={() => setTaxRateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Tax Rate</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Name"
                value={newTaxRate.name}
                onChange={(e) => setNewTaxRate(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Rate (%)"
                type="number"
                value={newTaxRate.rate}
                onChange={(e) => setNewTaxRate(prev => ({ ...prev, rate: parseFloat(e.target.value) / 100 }))}
                fullWidth
                required
                inputProps={{ step: 0.01, min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newTaxRate.is_default}
                    onChange={(e) => setNewTaxRate(prev => ({ ...prev, is_default: e.target.checked }))}
                  />
                }
                label="Set as default tax rate"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaxRateDialogOpen(false)}>Cancel</Button>
          <Button onClick={createTaxRate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Tax Rate Dialog */}
      <Dialog open={!!editingTaxRate} onClose={() => setEditingTaxRate(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tax Rate</DialogTitle>
        <DialogContent>
          {editingTaxRate && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  value={editingTaxRate.name}
                  onChange={(e) => setEditingTaxRate(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Rate (%)"
                  type="number"
                  value={editingTaxRate.rate * 100}
                  onChange={(e) => setEditingTaxRate(prev => prev ? ({ ...prev, rate: parseFloat(e.target.value) / 100 }) : null)}
                  fullWidth
                  required
                  inputProps={{ step: 0.01, min: 0, max: 100 }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editingTaxRate.is_default}
                      onChange={(e) => setEditingTaxRate(prev => prev ? ({ ...prev, is_default: e.target.checked }) : null)}
                    />
                  }
                  label="Set as default tax rate"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editingTaxRate.is_active}
                      onChange={(e) => setEditingTaxRate(prev => prev ? ({ ...prev, is_active: e.target.checked }) : null)}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingTaxRate(null)}>Cancel</Button>
          <Button onClick={updateTaxRate} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
      </Card>
    </Box>
  );

  const renderProductFormSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Product Form Configuration</Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Configure which fields are required when adding new products. This helps customize the product form based on your business needs.
        </Alert>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Require SKU
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={systemSettings.product_form?.require_sku?.value === true || systemSettings.product_form?.require_sku?.value === 'true'}
                  onChange={(e) => updateSystemSetting('product_form', 'require_sku', e.target.checked)}
                  disabled={user?.role !== 'admin'}
                />
              }
              label={systemSettings.product_form?.require_sku?.value === true || systemSettings.product_form?.require_sku?.value === 'true' ? 'SKU Required' : 'SKU Optional'}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              {systemSettings.product_form?.require_sku?.value === true || systemSettings.product_form?.require_sku?.value === 'true'
                ? 'Users must provide SKU when adding products'
                : 'SKU will be auto-generated if not provided'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Require Barcode
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={systemSettings.product_form?.require_barcode?.value === true || systemSettings.product_form?.require_barcode?.value === 'true'}
                  onChange={(e) => updateSystemSetting('product_form', 'require_barcode', e.target.checked)}
                  disabled={user?.role !== 'admin'}
                />
              }
              label={systemSettings.product_form?.require_barcode?.value === true || systemSettings.product_form?.require_barcode?.value === 'true' ? 'Barcode Required' : 'Barcode Optional'}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              {systemSettings.product_form?.require_barcode?.value === true || systemSettings.product_form?.require_barcode?.value === 'true'
                ? 'Users must provide barcode when adding products'
                : 'Barcode is optional and can be added later'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Require Unit
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={systemSettings.product_form?.require_unit?.value === true || systemSettings.product_form?.require_unit?.value === 'true'}
                  onChange={(e) => updateSystemSetting('product_form', 'require_unit', e.target.checked)}
                  disabled={user?.role !== 'admin'}
                />
              }
              label={systemSettings.product_form?.require_unit?.value === true || systemSettings.product_form?.require_unit?.value === 'true' ? 'Unit Required' : 'Unit Optional'}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              {systemSettings.product_form?.require_unit?.value === true || systemSettings.product_form?.require_unit?.value === 'true'
                ? 'Users must specify unit of measurement (pcs, box, etc.)'
                : 'Unit field can be left empty'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Auto-generate SKU
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={systemSettings.product_form?.auto_generate_sku?.value === true || systemSettings.product_form?.auto_generate_sku?.value === 'true'}
                  onChange={(e) => updateSystemSetting('product_form', 'auto_generate_sku', e.target.checked)}
                  disabled={user?.role !== 'admin' || (systemSettings.product_form?.require_sku?.value === true || systemSettings.product_form?.require_sku?.value === 'true')}
                />
              }
              label={systemSettings.product_form?.auto_generate_sku?.value === true || systemSettings.product_form?.auto_generate_sku?.value === 'true' ? 'Auto-generate ON' : 'Auto-generate OFF'}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              Automatically generate SKU if not provided (format: SKU-XXXXXX-XXX)
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderBackupSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Database Backup</Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Regular backups are essential for data security. Configure automatic backups or perform manual backups regularly.
        </Alert>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            onClick={executeBackup}
            disabled={loading || user?.role !== 'admin'}
            startIcon={loading ? <CircularProgress size={20} /> : <BackupNowIcon />}
          >
            Execute Backup Now
          </Button>
        </Box>
        
        <Typography variant="subtitle1" gutterBottom>Backup Status</Typography>
        <List>
          <ListItem>
            <ListItemText 
              primary="Last Backup"
              secondary="Manual backups available on demand"
            />
            <ListItemSecondaryAction>
              <Chip label="Ready" color="success" />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );

  // Admin-only check
  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Only administrators and managers can access settings.
        </Alert>
      </Box>
    );
  }

  const tabs = [
    { label: 'System', icon: <SettingsIcon /> },
    { label: 'Business', icon: <BusinessIcon /> },
    { label: 'Tax Rates', icon: <TaxIcon /> },
    { label: 'Product Form', icon: <ReceiptIcon /> },
    { label: 'Backup', icon: <BackupIcon /> }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={(e, value) => setCurrentTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      <Box>
        {currentTab === 0 && renderSystemSettings()}
        {currentTab === 1 && renderBusinessSettings()}
        {currentTab === 2 && renderTaxSettings()}
        {currentTab === 3 && renderProductFormSettings()}
        {currentTab === 4 && renderBackupSettings()}
      </Box>

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

export default Settings;