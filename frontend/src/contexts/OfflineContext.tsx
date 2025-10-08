import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Dexie from 'dexie';

// IndexedDB database for offline storage
class OfflineDB extends Dexie {
  sales: Dexie.Table<any, number>;
  inventory: Dexie.Table<any, number>;
  products: Dexie.Table<any, number>;

  constructor() {
    super('POSOfflineDB');
    
    this.version(1).stores({
      sales: '++id, saleNumber, timestamp, syncStatus',
      inventory: '++id, productId, quantity, lastUpdated',
      products: '++id, sku, barcode, name, lastSync'
    });

    this.sales = this.table('sales');
    this.inventory = this.table('inventory');
    this.products = this.table('products');
  }
}

const offlineDB = new OfflineDB();

interface OfflineContextType {
  isOffline: boolean;
  pendingSales: any[];
  syncPendingData: () => Promise<void>;
  saveSaleOffline: (saleData: any) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSales, setPendingSales] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncPendingData();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load pending sales on mount
    loadPendingSales();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadPendingSales = async () => {
    try {
      const sales = await offlineDB.sales.where('syncStatus').equals('pending').toArray();
      setPendingSales(sales);
    } catch (error) {
      console.error('Error loading pending sales:', error);
    }
  };

  const saveSaleOffline = async (saleData: any) => {
    try {
      const offlineSale = {
        ...saleData,
        timestamp: new Date().toISOString(),
        syncStatus: 'pending'
      };

      await offlineDB.sales.add(offlineSale);
      await loadPendingSales();
    } catch (error) {
      console.error('Error saving offline sale:', error);
      throw error;
    }
  };

  const syncPendingData = async () => {
    if (isOffline) return;

    try {
      const pendingSales = await offlineDB.sales.where('syncStatus').equals('pending').toArray();
      
      for (const sale of pendingSales) {
        try {
          // Attempt to sync sale to server
          const response = await fetch(`${(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/sales`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(sale)
          });

          if (response.ok) {
            // Mark as synced
            await offlineDB.sales.update(sale.id, { syncStatus: 'synced' });
          }
        } catch (error) {
          console.error('Error syncing sale:', error);
        }
      }

      await loadPendingSales();
    } catch (error) {
      console.error('Error during sync:', error);
    }
  };

  return (
    <OfflineContext.Provider value={{
      isOffline,
      pendingSales,
      syncPendingData,
      saveSaleOffline
    }}>
      {children}
    </OfflineContext.Provider>
  );
};