import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  MenuOpen,
  ChevronLeft,
  GridViewOutlined,
  Inventory2Outlined,
  DevicesOtherOutlined,
  PointOfSaleOutlined,
  PeopleOutlined,
  LocalShippingOutlined,
  ListAltOutlined,
  ExitToApp,
  SettingsOutlined,
  ReceiptLongOutlined,
  AccountBalanceWalletOutlined,
  PaymentsOutlined,
  ReceiptOutlined,
  AssessmentOutlined,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// Cleared as requested
const drawerWidth = 200;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true); // Desktop drawer state
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Check if user is cashier for special behavior
  const isCashier = user?.role === 'cashier';
  
  // Initialize desktop drawer closed for cashiers
  React.useEffect(() => {
    if (isCashier) {
      setDesktopOpen(false);
    }
  }, [isCashier]);

  const menuItems = [
    { text: 'Dashboard', icon: <GridViewOutlined />, path: '/dashboard', roles: ['admin', 'manager'] },
    { text: 'Point of Sale', icon: <PointOfSaleOutlined />, path: '/pos', roles: ['admin', 'manager', 'cashier'] },
    { text: 'Products', icon: <DevicesOtherOutlined />, path: '/products', roles: ['admin', 'manager'] },
    { text: 'Inventory', icon: <Inventory2Outlined />, path: '/inventory', roles: ['admin', 'manager'] },
    { text: 'Sales', icon: <ListAltOutlined />, path: '/sales', roles: ['admin', 'manager', 'cashier'] },
    { text: 'Suppliers', icon: <LocalShippingOutlined />, path: '/suppliers', roles: ['admin', 'manager'] },
    { text: 'Reports', icon: <ListAltOutlined />, path: '/reports', roles: ['admin', 'manager'] },
    { text: 'Customers', icon: <PeopleOutlined />, path: '/customers', roles: ['admin', 'manager', 'cashier'] },
    { text: 'Expenses', icon: <ReceiptOutlined />, path: '/expenses', roles: ['admin', 'manager', 'cashier'] },
    { text: 'Petty Cash', icon: <AccountBalanceWalletOutlined />, path: '/petty-cash', roles: ['admin', 'manager', 'cashier'] },
    { text: 'Daily Reports', icon: <AssessmentOutlined />, path: '/daily-reports', roles: ['admin', 'manager'] },
  ];

  // Add Users menu item for admin and manager roles
  if (user?.role === 'admin' || user?.role === 'manager') {
    menuItems.push({ text: 'Users', icon: <PeopleOutlined />, path: '/users', roles: ['admin', 'manager'] });
    menuItems.push({ text: 'Settings', icon: <SettingsOutlined />, path: '/settings', roles: ['admin', 'manager'] });
  }

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDesktopOpen(!desktopOpen);
    }
  };

  const handleMenuClick = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
    // Auto-hide sidebar for cashiers after navigation (optional)
    if (isCashier && !isMobile) {
      setDesktopOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const drawer = (
    <div
      style={{
        height: '100%',
        borderTopRightRadius: 0,
        borderBottomRightRadius: 24,
        boxShadow: '0 4px 24px 0 rgba(60, 60, 120, 0.10)',
        background: '#ffffff', // changed to white
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <List
        sx={{
          pt: 1,
          pb: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: desktopOpen ? 'flex-start' : 'center',
          // match Inventory page typography: 14px and inherit font family
          // Use !important so it matches the Inventory page's enforced styles
          fontSize: '14px',
          '&, & *': { fontSize: '14px !important', fontFamily: 'inherit' }
        }}
      >
        {/* Expand/collapse button at top, always centered. Show regardless of viewport and use dark icons on white background */}
        {!desktopOpen && (
          <ListItem disablePadding sx={{ justifyContent: 'center', alignItems: 'center' }}>
            <Tooltip title="Expand Menu" placement="right">
              <ListItemButton
                onClick={() => setDesktopOpen(true)}
                sx={{
                  minHeight: 48,
                  borderRadius: 2,
                  mx: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  color: 'black',
                  boxShadow: 0,
                  '&:hover': { background: '#f2f2f2' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, color: 'black', justifyContent: 'center', fontSize: 28 }}>
                  <MenuIcon />
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}
        {desktopOpen && (
          <ListItem disablePadding sx={{ justifyContent: 'center', alignItems: 'center' }}>
            <Tooltip title="Collapse Menu" placement="right">
              <ListItemButton
                onClick={() => setDesktopOpen(false)}
                sx={{
                  minHeight: 48,
                  borderRadius: 2,
                  mx: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  color: 'black',
                  boxShadow: 0,
                  '&:hover': { background: '#f2f2f2' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, color: 'black', justifyContent: 'center', fontSize: 28 }}>
                  <ChevronLeft />
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}
        {/* header removed by request - logo/title hidden when sidebar should be minimal */}
        {filteredMenuItems.map((item) => (
          <ListItem
            key={item.text}
            disablePadding
            sx={{
              justifyContent: 'flex-start',
              alignItems: 'center',
              width: '100%',
              mb: 1,
              height: 30,
              display: 'flex',
              flexDirection: 'row',
            }}
          >
            <Tooltip title={item.text} placement="right">
                  <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleMenuClick(item.path)}
                sx={{
                        height: '100%',
                        borderRadius: 2,
                        mx: 1,
                        px: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: desktopOpen ? 'flex-start' : 'center',
                        background: 'transparent',
                        color: location.pathname === item.path ? '#00A870' : 'rgba(0,0,0,0.8)',
                        fontWeight: 500,
                        transition: 'color 0.18s ease-in-out, background-color 0.18s ease-in-out',
                        minWidth: 0,
                        // Hover: subtle green tint and make icon/text green like the screenshot
                        '&:hover': {
                          backgroundColor: 'rgba(0,168,112,0.06)',
                          color: '#00A870',
                          '& .MuiListItemIcon-root': { color: '#00A870' }
                        },
                        '&.Mui-selected': {
                          // Remove boxed highlight for selected; only change text color to green
                          backgroundColor: 'transparent',
                          color: '#00A870',
                          fontWeight: 600,
                          '& .MuiListItemIcon-root': { color: '#00A870' },
                          '&:hover': {
                            backgroundColor: 'rgba(0,168,112,0.06)'
                          },
                        },
                }}
              >
                <ListItemIcon
             sx={{
                 minWidth: 0,
                 color: 'rgba(0,0,0,0.54)',
                 justifyContent: desktopOpen ? 'flex-start' : 'center',
                 alignItems: 'center',
                 fontSize: 24,
                 transition: 'color 0.18s ease-in-out',
                 width: 34,
                 display: 'flex',
                 mr: desktopOpen ? 0 : 0,
               }}
                >
                  {item.icon}
                </ListItemIcon>
                {/* Only show text if expanded */}
                {desktopOpen && (
                  <Box
                    sx={{
                      ml: 1,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ListItemText
                      primary={item.text}
                      sx={{
                        fontWeight: location.pathname === item.path ? 600 : 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: location.pathname === item.path ? '#00A870' : 'rgba(0,0,0,0.87)',
                        opacity: 1,
                        transition: 'color 0.18s ease-in-out',
                        // enforce Inventory table font styling
                        fontSize: '14px !important',
                        fontFamily: 'inherit'
                      }}
                    />
                  </Box>
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
      
      {/* Logout button at bottom */}
      <Box
        sx={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          pt: 1,
          pb: 2,
          px: 1,
        }}
      >
        <Tooltip title="Logout" placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: desktopOpen ? 'flex-start' : 'center',
              background: 'transparent',
              color: 'rgba(0,0,0,0.8)',
              px: 1.5,
              transition: 'color 0.18s ease-in-out, background-color 0.18s ease-in-out',
              '&:hover': {
                backgroundColor: 'rgba(211, 47, 47, 0.08)',
                color: '#d32f2f',
                '& .MuiListItemIcon-root': { color: '#d32f2f' }
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                color: 'rgba(0,0,0,0.54)',
                justifyContent: desktopOpen ? 'flex-start' : 'center',
                alignItems: 'center',
                fontSize: 24,
                transition: 'color 0.18s ease-in-out',
                width: 34,
                display: 'flex',
                mr: desktopOpen ? 0 : 0,
              }}
            >
              <ExitToApp />
            </ListItemIcon>
            {desktopOpen && (
              <Box
                sx={{
                  ml: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ListItemText
                  primary="Logout"
                  sx={{
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'rgba(0,0,0,0.87)',
                    opacity: 1,
                    transition: 'color 0.18s ease-in-out',
                    fontSize: '14px !important',
                    fontFamily: 'inherit'
                  }}
                />
              </Box>
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <CssBaseline />
      {/* Removed AppBar - content now occupies top of page */}
      <Box
        component="nav"
        sx={{
          width: { md: desktopOpen ? drawerWidth : 64 }, // 64px for icon-only collapsed sidebar
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
          {/* Permanent drawer for all viewport sizes. Use desktopOpen state to toggle expanded vs collapsed (icon-only). */}
          <Drawer
            variant="permanent"
            open={desktopOpen}
            sx={{
              display: 'block',
              width: desktopOpen ? drawerWidth : 64,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: desktopOpen ? drawerWidth : 64,
                background: '#ffffff',
                color: 'black',
                borderRight: 'none',
                boxShadow: 'none',
                overflowX: 'hidden',
                transition: theme.transitions.create(['width', 'background'], {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
              },
            }}
          >
            {drawer}
          </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: 'auto',
          overflowY: 'auto',
          p: 0
        }}
      >
        {children}
      </Box>
      {/* Floating toggle removed — permanent drawer is visible in both expanded and collapsed states */}
    </Box>
  );
};

export default Layout;