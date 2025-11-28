import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import { useOffline } from './contexts/OfflineContext';
import { CashierPOSProvider } from './contexts/CashierPOSContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import CashierPOS from './pages/CashierPOS';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Users from './pages/Users';
import LoadingSpinner from './components/LoadingSpinner';
import OfflineIndicator from './components/OfflineIndicator';
import Settings from './pages/Settings';
import CustomerManagement from './pages/CustomerManagement';
import Expenses from './pages/Expenses';
import PettyCash from './pages/PettyCash';
import DailyReports from './pages/DailyReports';

function App() {
  const { user, loading } = useAuth();
  const { isOffline } = useOffline();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Login />;
  }

  // Role-based default routing
  const isCashier = user.role === 'cashier';
  const defaultRoute = isCashier ? '/pos' : '/dashboard';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {isOffline && <OfflineIndicator />}
      <CashierPOSProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to={defaultRoute} replace />} />
            
            {/* Cashier-specific routes */}
            {isCashier ? (
              <>
                <Route path="/pos" element={<CashierPOS />} />
                <Route 
                  path="/sales" 
                  element={
                    <ErrorBoundary>
                      <Sales />
                    </ErrorBoundary>
                  } 
                />
                <Route 
                  path="/customers" 
                  element={
                    <ErrorBoundary>
                      <CustomerManagement />
                    </ErrorBoundary>
                  } 
                />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/petty-cash" element={<PettyCash />} />
                <Route path="*" element={<Navigate to="/pos" replace />} />
              </>
            ) : (
              /* Admin/Manager routes */
              <>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<CashierPOS />} />
                <Route 
                  path="/products" 
                  element={
                    <ErrorBoundary>
                      <Products />
                    </ErrorBoundary>
                  } 
                />
                <Route path="/inventory" element={<Inventory />} />
                <Route 
                  path="/sales" 
                  element={
                    <ErrorBoundary>
                      <Sales />
                    </ErrorBoundary>
                  } 
                />
                <Route path="/suppliers" element={<Suppliers />} />

                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route 
                  path="/customers" 
                  element={
                    <ErrorBoundary>
                      <CustomerManagement />
                    </ErrorBoundary>
                  } 
                />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/petty-cash" element={<PettyCash />} />
                <Route path="/daily-reports" element={<DailyReports />} />
                {(user.role === 'admin' || user.role === 'manager') && (
                  <Route path="/users" element={<Users />} />
                )}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
          </Routes>
        </Layout>
      </CashierPOSProvider>
    </Box>
  );
}

export default App;