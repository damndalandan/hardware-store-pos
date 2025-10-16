import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useOffline } from './OfflineContext';

export interface CartItem {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
  brand?: string;
  size?: string;
  color?: string;
  variety?: string;
  current_stock: number;
}

export interface Payment {
  method: 'cash' | 'card' | 'mobile' | 'check';
  amount: number;
  reference?: string | null;
  cardLast4?: string;
  checkNumber?: string;
}

export interface Sale {
  id?: number;
  saleNumber: string;
  items: CartItem[];
  payments: Payment[];
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string;
  customerEmail?: string;
  cashierId: number;
  cashierName: string;
  timestamp: string;
  isRefund?: boolean;
  originalSaleId?: number;
  isOffline?: boolean;
  synced?: boolean;
  shiftId?: number;
}

export interface CashierShift {
  id?: number;
  cashierId: number;
  cashierName: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  endingCash?: number;
  totalSales: number;
  totalTransactions: number;
  totalCash: number;
  totalCard: number;
  totalMobile: number;
  totalCheck: number;
  isActive: boolean;
  cashDifference?: number;
}

interface CashierPOSContextType {
  // Cart Management
  cart: CartItem[];
  addToCart: (product: any) => void;
  updateCartItem: (id: number, quantity: number) => void;
  removeFromCart: (id: number) => void;
  clearCart: () => void;
  
  // Sale Processing
  currentSale: Sale | null;
  processSale: (payments: Payment[], customerInfo?: any) => Promise<boolean>;
  processEnhancedSale: (paymentData: {
    paymentSplits: Array<{ payment_method_code: string; amount: number; reference_number?: string | null }>;
    customerAccountId?: number | null;
    customerName?: string | null;
  }) => Promise<boolean>;
  processRefund: (originalSaleId: number, items: CartItem[], reason: string) => Promise<boolean>;
  voidTransaction: (saleId: number, reason: string) => Promise<boolean>;
  
  // Payment & Calculations
  calculateTotals: () => { subtotal: number; tax: number; total: number };
  taxRate: number;
  
  // Product Search & Barcode
  searchProducts: (term: string) => Promise<any[]>;
  getProductByBarcode: (barcode: string) => Promise<any>;
  
  // Receipt Management
  printReceipt: (sale: Sale) => void;
  reprintReceipt: (saleId: number) => Promise<void>;
  emailReceipt: (sale: Sale, email: string) => Promise<void>;
  
  // Shift Management
  currentShift: CashierShift | null;
  startShift: (startingCash: number) => Promise<void>;
  endShift: (endingCash: number) => Promise<CashierShift>;
  getShiftSummary: () => any;
  
  // Sales History
  todaysSales: Sale[];
  loadTodaysSales: () => Promise<void>;
  
  // Offline Support
  offlineSales: Sale[];
  syncOfflineSales: () => Promise<void>;
  
  // State
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
}

const CashierPOSContext = createContext<CashierPOSContextType | undefined>(undefined);

export const useCashierPOS = (): CashierPOSContextType => {
  const context = useContext(CashierPOSContext);
  if (!context) {
    throw new Error('useCashierPOS must be used within a CashierPOSProvider');
  }
  return context;
};

interface CashierPOSProviderProps {
  children: ReactNode;
}

export const CashierPOSProvider: React.FC<CashierPOSProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { isOffline } = useOffline();
  
  // State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [todaysSales, setTodaysSales] = useState<Sale[]>([]);
  const [offlineSales, setOfflineSales] = useState<Sale[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRate] = useState(0.08); // 8% tax rate

  // Helper to include Authorization header when token is present
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Load data on mount (only offline sales and shifts/sales will be loaded here)
  useEffect(() => {
    loadOfflineData();
    loadCurrentShift();
    loadTodaysSales();
  }, []);

  // Persist cart per-user: use a user-scoped key so different users do not share the same cart
  useEffect(() => {
    const key = user ? `cashier_cart_${user.id}` : null;
    if (!key) return;

    if (cart.length > 0) {
      localStorage.setItem(key, JSON.stringify(cart));
    } else {
      localStorage.removeItem(key);
    }
  }, [cart, user]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOffline && offlineSales.length > 0) {
      syncOfflineSales();
    }
  }, [isOffline]);

  const loadOfflineData = () => {
    try {
      // Load offline sales (global) but do NOT load a global cart here. Cart is user-scoped and
      // will be loaded when `user` becomes available.
      const savedOfflineSales = localStorage.getItem('offline_sales');
      if (savedOfflineSales) {
        setOfflineSales(JSON.parse(savedOfflineSales));
      }
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  // Load the cart when the authenticated user changes. If no user (logged out), clear the cart.
  useEffect(() => {
    try {
      if (!user) {
        // If the user logged out, clear in-memory cart (do not delete other users' carts)
        setCart([]);
        setCurrentSale(null);
        return;
      }

      const key = `cashier_cart_${user.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setCart(JSON.parse(saved));
      } else {
        setCart([]);
      }
    } catch (err) {
      console.error('Failed to load user cart:', err);
      setCart([]);
    }
  }, [user]);

  const loadCurrentShift = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/shifts/current/${user.id}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const shift = await response.json();
        setCurrentShift(shift);
        localStorage.setItem('current_shift', JSON.stringify(shift));
      }
    } catch (error) {
      console.error('Failed to load current shift:', error);
    }
  };

  const loadTodaysSales = async () => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/sales?cashierId=${user.id}&date=${today}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const sales = await response.json();
        setTodaysSales(sales);
      }
    } catch (error) {
      console.error('Failed to load today\'s sales:', error);
    }
  };

  const clearError = () => setError(null);

  // Cart Management
  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem: CartItem = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.selling_price,
        quantity: 1,
        unit: product.unit,
        category: product.category,
        brand: product.brand,
        size: product.size,
        color: product.color,
        variety: product.variety,
        current_stock: product.current_stock
      };
      setCart([...cart, newItem]);
    }
  };

  const updateCartItem = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    
    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCurrentSale(null);
    try {
      if (user) {
        localStorage.removeItem(`cashier_cart_${user.id}`);
      }
    } catch (err) {
      // Silently handle localStorage errors
    }
  };

  // Calculations
  const calculateTotals = () => {
    // Price already includes 12% VAT
    // Formula: price = lessVat * 1.12
    // Therefore: lessVat = price / 1.12, vat = lessVat * 0.12
    const totalWithVat = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const vatDivisor = 1 + taxRate; // 1.12 for 12% VAT
    const vatableSale = totalWithVat / vatDivisor; // Less VAT (amount before VAT)
    const vat = vatableSale * taxRate; // VAT amount (12% of vatable sale)
    
    return {
      subtotal: vatableSale,  // VATABLE SALE (Less VAT) - for BIR
      tax: vat,               // VAT (12%)
      total: totalWithVat     // Total amount (already includes VAT)
    };
  };

  // Product Search
  const searchProducts = async (term: string): Promise<any[]> => {
    try {
      // Use the main products endpoint which accepts `search` query param
      const token = localStorage.getItem('token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`/api/products?search=${encodeURIComponent(term)}&active_only=true&limit=50`, { headers });
      if (response.ok) {
        const data = await response.json();
        // Backend returns { products, pagination }
        const products = Array.isArray(data.products) ? data.products : [];
        // Fallback: if no products found, attempt exact identifier lookup (sku/barcode/id)
        if (products.length === 0) {
          try {
            const exactResp = await fetch(`/api/products/${encodeURIComponent(term)}`, { headers });
            if (exactResp.ok) {
              const exactProduct = await exactResp.json();
              // return single-item array for compatibility
              return [exactProduct];
            }
          } catch (err) {
            // ignore fallback errors and return empty array below
            console.debug('Exact lookup fallback failed:', err);
          }
        }
        return products;
      }
      return [];
    } catch (error) {
      console.error('Product search failed:', error);
      return [];
    }
  };

  const getProductByBarcode = async (barcode: string): Promise<any> => {
    try {
      const response = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`, { headers: getAuthHeaders() });
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Barcode lookup failed:', error);
      return null;
    }
  };

  // Enhanced Sale Processing with Multi-Payment Support
  const processEnhancedSale = async (paymentData: {
    paymentSplits: Array<{ payment_method_code: string; amount: number; reference_number?: string | null }>;
    customerAccountId?: number | null;
    customerName?: string | null;
  }): Promise<boolean> => {
    if (cart.length === 0 || !currentShift || !user) {
      setError('Cannot process sale: empty cart, no active shift, or not logged in');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { subtotal, tax, total } = calculateTotals();

      const saleData = {
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          discount: 0,
        })),
        paymentSplits: paymentData.paymentSplits.map(split => ({
          payment_method_code: split.payment_method_code,
          amount: split.amount,
          reference_number: split.reference_number ?? null
        })),
        customerAccountId: paymentData.customerAccountId ?? null,
        customerName: paymentData.customerName ?? null,
        cashier_id: user.id,
        shift_id: currentShift?.id ?? null,
      };

      const response = await fetch('/api/sales/enhanced', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process sale');
      }

      const result = await response.json();

      // Create sale object for local state
      const sale: Sale = {
        id: result.saleId,
        saleNumber: result.saleNumber,
        items: [...cart],
        payments: paymentData.paymentSplits.map(split => ({
          method: split.payment_method_code.toLowerCase() as Payment['method'],
          amount: split.amount,
          reference: split.reference_number || undefined
        })),
        subtotal,
        tax,
        total,
        cashierId: user.id,
        cashierName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        timestamp: new Date().toISOString(),
  shiftId: currentShift?.id ?? undefined,
        isOffline: false,
        synced: true
      };

      setCurrentSale(sale);
      clearCart();

      // Update shift totals
      const paymentTotals = paymentData.paymentSplits.reduce((acc, split) => {
        const code = split.payment_method_code.toLowerCase();
        acc[code] = (acc[code] || 0) + split.amount;
        return acc;
      }, {} as Record<string, number>);

      setCurrentShift({
        ...(currentShift || {} as any),
        totalSales: Number(currentShift?.totalSales || 0) + Number(total || 0),
        totalTransactions: Number(currentShift?.totalTransactions || 0) + 1,
        totalCash: Number(currentShift?.totalCash || 0) + Number(paymentTotals['cash'] || 0),
        totalCard: Number(currentShift?.totalCard || 0) + Number(paymentTotals['credit_card'] || 0),
        totalMobile: Number(currentShift?.totalMobile || 0) + Number(paymentTotals['gcash'] || paymentTotals['qr_ph'] || 0),
        totalCheck: Number(currentShift?.totalCheck || 0) + Number(paymentTotals['check'] || 0)
      });

      // Refresh today's sales
      loadTodaysSales();

      setIsProcessing(false);
      return true;
    } catch (error: any) {
      console.error('Enhanced sale processing failed:', error);
      setError(error.message || 'Failed to process sale');
      setIsProcessing(false);
      return false;
    }
  };

  // Sale Processing
  const processSale = async (payments: Payment[], customerInfo?: any): Promise<boolean> => {
    if (cart.length === 0 || !currentShift || !user) {
      setError('Cannot process sale: empty cart, no active shift, or not logged in');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { subtotal, tax, total } = calculateTotals();
      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

      if (totalPaid < total) {
        setError('Insufficient payment amount');
        return false;
      }

      const saleNumber = `SALE-${Date.now()}-${user.id}`;
      const sale: Sale = {
        saleNumber,
        items: [...cart],
        payments,
        subtotal,
        tax,
        total,
        customerName: customerInfo?.name,
        customerEmail: customerInfo?.email,
        cashierId: user.id,
        cashierName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        timestamp: new Date().toISOString(),
  shiftId: currentShift?.id ?? undefined,
        isOffline: isOffline,
        synced: !isOffline
      };

      if (isOffline) {
        // Store offline
        const updatedOfflineSales = [...offlineSales, sale];
        setOfflineSales(updatedOfflineSales);
        localStorage.setItem('offline_sales', JSON.stringify(updatedOfflineSales));
      } else {
        // Process online
        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(sale),
        });

        if (!response.ok) {
          throw new Error('Failed to process sale');
        }

        const savedSale = await response.json();
        sale.id = savedSale.id;
        
        // Update inventory
        for (const item of cart) {
          await fetch(`/api/inventory/${item.id}/adjust`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              adjustment: -item.quantity,
              reason: `Sale #${saleNumber}`,
              type: 'sale'
            }),
          });
        }
      }

      setCurrentSale(sale);
      clearCart();
      
      // Update shift totals
      const cashAmount = payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0);
      const cardAmount = payments.filter(p => p.method === 'card').reduce((sum, p) => sum + p.amount, 0);
      const mobileAmount = payments.filter(p => p.method === 'mobile').reduce((sum, p) => sum + p.amount, 0);
      const checkAmount = payments.filter(p => p.method === 'check').reduce((sum, p) => sum + p.amount, 0);

      setCurrentShift({
        ...(currentShift || {} as any),
        totalSales: Number(currentShift?.totalSales || 0) + Number(total || 0),
        totalTransactions: Number(currentShift?.totalTransactions || 0) + 1,
        totalCash: Number(currentShift?.totalCash || 0) + Number(cashAmount || 0),
        totalCard: Number(currentShift?.totalCard || 0) + Number(cardAmount || 0),
        totalMobile: Number(currentShift?.totalMobile || 0) + Number(mobileAmount || 0),
        totalCheck: Number(currentShift?.totalCheck || 0) + Number(checkAmount || 0)
      });

      // Refresh today's sales
      loadTodaysSales();

      return true;
    } catch (error) {
      console.error('Sale processing failed:', error);
      setError('Failed to process sale: ' + (error as Error).message);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const processRefund = async (originalSaleId: number, items: CartItem[], reason: string): Promise<boolean> => {
    if (!currentShift || !user) {
      setError('Cannot process refund: no active shift or not logged in');
      return false;
    }

    setIsProcessing(true);
    try {
      const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      const refundSale: Sale = {
        saleNumber: `REFUND-${Date.now()}-${user.id}`,
        items,
        payments: [{ method: 'cash', amount: total }],
        subtotal: -subtotal,
        tax: -tax,
        total: -total,
        cashierId: user.id,
        cashierName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        timestamp: new Date().toISOString(),
        isRefund: true,
        originalSaleId,
        shiftId: currentShift.id,
        isOffline: isOffline,
        synced: !isOffline
      };

      if (isOffline) {
        const updatedOfflineSales = [...offlineSales, refundSale];
        setOfflineSales(updatedOfflineSales);
        localStorage.setItem('offline_sales', JSON.stringify(updatedOfflineSales));
      } else {
        const response = await fetch('/api/sales/refund', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...refundSale, reason }),
        });

        if (!response.ok) {
          throw new Error('Failed to process refund');
        }

        // Update inventory
        for (const item of items) {
          await fetch(`/api/inventory/${item.id}/adjust`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              adjustment: item.quantity,
              reason: `Refund #${refundSale.saleNumber}`,
              type: 'refund'
            }),
          });
        }
      }

      setCurrentSale(refundSale);
      loadTodaysSales();
      return true;
    } catch (error) {
      console.error('Refund processing failed:', error);
      setError('Failed to process refund');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const voidTransaction = async (saleId: number, reason: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/sales/${saleId}/void`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason, cashierId: user!.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to void transaction');
      }

      loadTodaysSales();
      return true;
    } catch (error) {
      console.error('Void transaction failed:', error);
      setError('Failed to void transaction');
      return false;
    }
  };

  // Receipt Management
  const printReceipt = (sale: Sale) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${sale.saleNumber}</title>
            <style>
              body { font-family: 'Courier New', monospace; margin: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .total { border-top: 1px solid #000; padding-top: 10px; margin-top: 10px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>HARDWARE STORE</h2>
              <p>Receipt #${sale.saleNumber}</p>
              <p>${new Date(sale.timestamp).toLocaleString()}</p>
              <p>Cashier: ${sale.cashierName}</p>
            </div>
            ${sale.items.map(item => 
              `<div class="item">
                <span>${item.name} x${item.quantity}</span>
                <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
              </div>`
            ).join('')}
            <div class="total">
              <div class="item"><span>Subtotal:</span><span>$${Number(sale.subtotal).toFixed(2)}</span></div>
              <div class="item"><span>Tax:</span><span>$${Number(sale.tax).toFixed(2)}</span></div>
              <div class="item"><strong><span>Total:</span><span>$${Number(sale.total).toFixed(2)}</span></strong></div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
              <p>Thank you for your business!</p>
            </div>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
    }
  };

  const reprintReceipt = async (saleId: number) => {
    try {
      const response = await fetch(`/api/sales/${saleId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const sale = await response.json();
        printReceipt(sale);
      }
    } catch (error) {
      console.error('Failed to reprint receipt:', error);
      setError('Failed to reprint receipt');
    }
  };

  const emailReceipt = async (sale: Sale, email: string) => {
    try {
      const response = await fetch('/api/sales/email-receipt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ saleId: sale.id, email }),
      });

      if (!response.ok) {
        throw new Error('Failed to email receipt');
      }
    } catch (error) {
      console.error('Email receipt failed:', error);
      setError('Failed to email receipt');
    }
  };

  // Shift Management
  const startShift = async (startingCash: number) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }
    
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          cashierId: user.id,
          cashierName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
          startingCash,
          startTime: new Date().toISOString()
        }),
      });

      if (response.ok) {
        const shift = await response.json();
        setCurrentShift(shift);
        localStorage.setItem('current_shift', JSON.stringify(shift));
      } else {
        // Try to read server error message for better feedback
        try {
          const body = await response.json();
          setError(body?.message || 'Failed to start shift');
        } catch (e) {
          setError('Failed to start shift');
        }
        return;
      }
    } catch (error) {
      console.error('Start shift failed:', error);
      setError('Failed to start shift');
    }
  };

  const endShift = async (endingCash: number): Promise<CashierShift> => {
    if (!currentShift) {
      throw new Error('No active shift');
    }

    try {
      const cashDifference = endingCash - (Number(currentShift?.startingCash || 0) + Number(currentShift?.totalCash || 0));
      
      const response = await fetch(`/api/shifts/${currentShift?.id}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          endingCash,
          endTime: new Date().toISOString(),
          cashDifference
        }),
      });

      if (response.ok) {
        const endedShift = await response.json();
        setCurrentShift(null);
        localStorage.removeItem('current_shift');
        return endedShift;
      } else {
        try {
          const body = await response.json();
          setError(body?.message || 'Failed to end shift');
        } catch (e) {
          setError('Failed to end shift');
        }
        throw new Error('Failed to end shift');
      }
    } catch (error) {
      console.error('End shift failed:', error);
      setError('Failed to end shift');
      throw error;
    }
  };

  const getShiftSummary = () => {
    if (!currentShift) return null;

    // Use defensive numeric conversions in case backend returns null/undefined
    const expectedCash = Number(currentShift.startingCash || 0) + Number(currentShift.totalCash || 0);

    return {
      shift: currentShift,
      totalSales: Number(currentShift.totalSales || 0),
      totalTransactions: Number(currentShift.totalTransactions || 0),
      expectedCash,
      paymentBreakdown: {
        cash: Number(currentShift.totalCash || 0),
        card: Number(currentShift.totalCard || 0),
        mobile: Number(currentShift.totalMobile || 0),
        check: Number(currentShift.totalCheck || 0)
      }
    };
  };

  // Offline Support
  const syncOfflineSales = async () => {
    if (offlineSales.length === 0) return;

    try {
      const syncedSales = [];
      const failedSales = [];

      for (const sale of offlineSales) {
        try {
          const response = await fetch('/api/sales', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ...sale, isOfflineSync: true }),
          });

          if (response.ok) {
            syncedSales.push(sale);
            
            // Update inventory for synced sales
            for (const item of sale.items) {
              await fetch(`/api/inventory/${item.id}/adjust`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  adjustment: sale.isRefund ? item.quantity : -item.quantity,
                  reason: `Offline ${sale.isRefund ? 'Refund' : 'Sale'} #${sale.saleNumber}`,
                  type: sale.isRefund ? 'refund' : 'sale'
                }),
              });
            }
          } else {
            failedSales.push(sale);
          }
        } catch (error) {
          failedSales.push(sale);
        }
      }

      setOfflineSales(failedSales);
      localStorage.setItem('offline_sales', JSON.stringify(failedSales));
      
      if (syncedSales.length > 0) {
        loadTodaysSales(); // Refresh sales data
      }
    } catch (error) {
      console.error('Failed to sync offline sales:', error);
    }
  };

  const value: CashierPOSContextType = {
    // Cart Management
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    
    // Sale Processing
    currentSale,
    processSale,
    processEnhancedSale,
    processRefund,
    voidTransaction,
    
    // Payment & Calculations
    calculateTotals,
    taxRate,
    
    // Product Search
    searchProducts,
    getProductByBarcode,
    
    // Receipt Management
    printReceipt,
    reprintReceipt,
    emailReceipt,
    
    // Shift Management
    currentShift,
    startShift,
    endShift,
    getShiftSummary,
    
    // Sales History
    todaysSales,
    loadTodaysSales,
    
    // Offline Support
    offlineSales,
    syncOfflineSales,
    
    // State
    isProcessing,
    error,
    clearError
  };

  return (
    <CashierPOSContext.Provider value={value}>
      {children}
    </CashierPOSContext.Provider>
  );
};