import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Alert, CircularProgress
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import axios from 'axios';

const SalesSimple: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [sales, setSales] = useState<any[]>([]);

  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

  const fetchSales = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Fetching sales from:', `${API_BASE_URL}/sales`);
      const response = await axios.get(`${API_BASE_URL}/sales?page=1&limit=10`);
      console.log('Sales response:', response.data);
      setSales(response.data.sales || []);
    } catch (err: any) {
      console.error('Sales fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Sales Page - Debug Mode
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Button
            variant="contained"
            onClick={fetchSales}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            {loading ? 'Loading...' : 'Refresh Sales'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sales Count: {sales.length}
            </Typography>
            <pre style={{ fontSize: '12px', overflow: 'auto' }}>
              {JSON.stringify(sales, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default SalesSimple;
