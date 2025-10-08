import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Collapse,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  LockReset as ResetPasswordIcon,
  Search as SearchIcon,
  Download as ExportIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as ManagerIcon,
  PointOfSale as CashierIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'cashier';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  total_sales?: number;
  total_sales_amount?: number;
  last_sale_date?: string;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'cashier';
  isActive: boolean;
}

interface Activity {
  activity_type: string;
  reference: string;
  activity_date: string;
  amount?: number;
  description: string;
}

interface UserStats {
  roleDistribution: Array<{
    role: string;
    count: number;
    active_count: number;
  }>;
  activitySummary: Array<User>;
  recentRegistrations: Array<User>;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'cashier',
    isActive: true
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  
  // Dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDetailDialogOpen, setUserDetailDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000/api';

  useEffect(() => {
    loadUsers();
    loadUserStats();
  }, [page, searchTerm, filterRole, filterStatus, sortBy, sortOrder]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort_by: sortBy,
        sort_order: sortOrder
      });

      if (searchTerm) params.append('search', searchTerm);
      if (filterRole !== 'all') params.append('role', filterRole);
      if (filterStatus !== 'all') params.append('is_active', filterStatus);

      const response = await fetch(`${API_BASE_URL}/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load users');
      
      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.pagination.pages);
      setError(null);
    } catch (error) {
      setError('Failed to load users');
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/stats/summary`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load user stats');
      
      const data = await response.json();
      setUserStats(data);
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadUserActivity = async (userId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/activity`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load user activity');
      
      const data = await response.json();
      setActivities(data.activities);
    } catch (error) {
      console.error('Error loading user activity:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(userFormData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }

      setSuccess('User created successfully');
      setUserDialogOpen(false);
      resetForm();
      loadUsers();
      loadUserStats();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      const { password, ...updateData } = userFormData;
      
      const response = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }

      setSuccess('User updated successfully');
      setUserDialogOpen(false);
      resetForm();
      loadUsers();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to deactivate user');
      }

      setSuccess('User deactivated successfully');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
      loadUserStats();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to deactivate user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset password');
      }

      setSuccess('Password reset successfully');
      setResetPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUserFormData({
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'cashier',
      isActive: true
    });
    setSelectedUser(null);
    setIsEditing(false);
  };

  const openUserDialog = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setUserFormData({
        username: user.username,
        email: user.email,
        password: '',
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active
      });
      setIsEditing(true);
    } else {
      resetForm();
    }
    setUserDialogOpen(true);
  };

  const openUserDetail = (user: User) => {
    setSelectedUser(user);
    loadUserActivity(user.id);
    setUserDetailDialogOpen(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <AdminIcon />;
      case 'manager': return <ManagerIcon />;
      case 'cashier': return <CashierIcon />;
      default: return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      case 'cashier': return 'primary';
      default: return 'default';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Dashboard Tab Content
  const renderDashboard = () => (
    <Box>
      {/* User Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Users</Typography>
              <Typography variant="h3" color="primary">
                {users.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Active users in system
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Role Distribution</Typography>
              {userStats?.roleDistribution.map(role => (
                <Box key={role.role} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {role.role}:
                  </Typography>
                  <Typography variant="body2">
                    {role.active_count}/{role.count}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Recent Registrations</Typography>
              <Typography variant="h3" color="secondary">
                {userStats?.recentRegistrations.length || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                New users this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Performers */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Top Performers (Sales)</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell align="right">Sales Count</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                  <TableCell>Last Sale</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userStats?.activitySummary
                  .filter(user => user.total_sales && user.total_sales > 0)
                  .slice(0, 10)
                  .map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getRoleIcon(user.role)}
                          <Box sx={{ ml: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              {user.first_name} {user.last_name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              @{user.username}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          size="small"
                          color={getRoleColor(user.role) as any}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell align="right">{user.total_sales || 0}</TableCell>
                      <TableCell align="right">
                        {user.total_sales_amount ? formatCurrency(user.total_sales_amount) : '$0.00'}
                      </TableCell>
                      <TableCell>
                        {user.last_sale_date ? 
                          format(new Date(user.last_sale_date), 'MMM dd, yyyy') : 
                          'No sales'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );

  // Users Management Tab Content
  const renderUsersManagement = () => (
    <Box>
      {/* Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ minWidth: 250 }}
        />
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Role</InputLabel>
          <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="cashier">Cashier</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Inactive</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openUserDialog()}
        >
          Add User
        </Button>
      </Box>

      {/* Users Table */}
      <TableContainer
        component={Paper}
        sx={{
          // make table scrollable with sticky header
          maxHeight: 440,
          position: 'relative',
          // ensure horizontal overflow is possible on small screens
          overflow: 'auto'
        }}
      >
        <Table stickyHeader sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>User</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Email</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Role</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Status</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Sales</TableCell>
              <TableCell sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', zIndex: 1200 }}>Last Login</TableCell>
              {/* Actions header: sticky to the right */}
              <TableCell
                sx={{
                  top: 0,
                  position: 'sticky',
                  right: 0,
                  backgroundColor: 'background.paper',
                  zIndex: 1250,
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                  whiteSpace: 'nowrap'
                }}
                data-field="actions"
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getRoleIcon(user.role)}
                    <Box sx={{ ml: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {user.first_name} {user.last_name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        @{user.username}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    size="small"
                    color={getRoleColor(user.role) as any}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    color={user.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  {user.total_sales ? (
                    <Box>
                      <Typography variant="body2">
                        {user.total_sales} sales
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {user.total_sales_amount ? formatCurrency(user.total_sales_amount) : '$0.00'}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">No sales</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {user.last_login ? 
                    format(new Date(user.last_login), 'MMM dd, yyyy HH:mm') : 
                    'Never'
                  }
                </TableCell>
                <TableCell
                  data-field="actions"
                  sx={{
                    position: 'sticky',
                    right: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 1240,
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'auto'
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => openUserDetail(user)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit User">
                      <IconButton
                        size="small"
                        onClick={() => openUserDialog(user)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reset Password">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedUser(user);
                          setResetPasswordDialogOpen(true);
                        }}
                      >
                        <ResetPasswordIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deactivate User">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedUser(user);
                          setDeleteDialogOpen(true);
                        }}
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
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, newPage) => setPage(newPage)}
        />
      </Box>
    </Box>
  );

  return (
  <Box
    sx={{
      backgroundColor: '#f7f8fA',
      minHeight: '100vh',
      '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiPaper-root, & .MuiTableCell-root': {
        fontSize: '14px !important',
      },
      p: 1,
      pt: 0.5,
    }}
  >
      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Dashboard" />
        <Tab label="Users Management" />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && renderDashboard()}
      {activeTab === 1 && renderUsersManagement()}

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Username"
                value={userFormData.username}
                onChange={(e) => setUserFormData(prev => ({ ...prev, username: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={userFormData.firstName}
                onChange={(e) => setUserFormData(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={userFormData.lastName}
                onChange={(e) => setUserFormData(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value as any }))}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="cashier">Cashier</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userFormData.isActive}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Grid>
            {!isEditing && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={isEditing ? handleUpdateUser : handleCreateUser}
            disabled={loading}
          >
            {isEditing ? 'Update' : 'Create'} User
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={userDetailDialogOpen} onClose={() => setUserDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedUser && `${selectedUser.first_name} ${selectedUser.last_name} Details`}
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Username</Typography>
                  <Typography variant="body1">{selectedUser.username}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Email</Typography>
                  <Typography variant="body1">{selectedUser.email}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Role</Typography>
                  <Chip
                    label={selectedUser.role}
                    size="small"
                    color={getRoleColor(selectedUser.role) as any}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                  <Chip
                    label={selectedUser.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    color={selectedUser.is_active ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Created</Typography>
                  <Typography variant="body1">
                    {format(new Date(selectedUser.created_at), 'PPP')}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Last Login</Typography>
                  <Typography variant="body1">
                    {selectedUser.last_login ? 
                      format(new Date(selectedUser.last_login), 'PPP') : 
                      'Never'
                    }
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Button
                  onClick={() => setActivityExpanded(!activityExpanded)}
                  startIcon={activityExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  endIcon={<HistoryIcon />}
                >
                  Recent Activity
                </Button>
              </Box>

              <Collapse in={activityExpanded}>
                <List>
                  {activities.map((activity, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={activity.description}
                        secondary={`${activity.reference} - ${format(new Date(activity.activity_date), 'PPP')}`}
                      />
                      {activity.amount && (
                        <ListItemSecondaryAction>
                          <Typography variant="body2">
                            {formatCurrency(activity.amount)}
                          </Typography>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                  {activities.length === 0 && (
                    <ListItem>
                      <ListItemText primary="No recent activity" />
                    </ListItem>
                  )}
                </List>
              </Collapse>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)}>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {selectedUser && `Reset password for ${selectedUser.username}?`}
          </Typography>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleResetPassword}
            disabled={loading || !newPassword}
          >
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Deactivate User</DialogTitle>
        <DialogContent>
          <Typography>
            {selectedUser && `Are you sure you want to deactivate ${selectedUser.username}? This will prevent them from logging in.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteUser}
            disabled={loading}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users;