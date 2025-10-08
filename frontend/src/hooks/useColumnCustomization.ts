import { useState, useEffect } from 'react';

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  fixed?: boolean; // e.g., for actions column
}

interface UseColumnCustomizationOptions {
  storageKey: string;
  defaultColumns: ColumnConfig[];
}

/**
 * useColumnCustomization - Reusable hook for column visibility and ordering
 * Eliminates 200+ lines of duplicate code across Products, Inventory, Suppliers
 */
export function useColumnCustomization({
  storageKey,
  defaultColumns,
}: UseColumnCustomizationOptions) {
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_visible`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load column visibility:', e);
    }
    return defaultColumns.reduce((acc, col) => {
      acc[col.key] = col.visible;
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Column order state
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_order`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load column order:', e);
    }
    return defaultColumns.map((col) => col.key);
  });

  // Persist to localStorage whenever visibility or order changes
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_visible`, JSON.stringify(visibleColumns));
    } catch (e) {
      console.error('Failed to save column visibility:', e);
    }
  }, [visibleColumns, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_order`, JSON.stringify(columnOrder));
    } catch (e) {
      console.error('Failed to save column order:', e);
    }
  }, [columnOrder, storageKey]);

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Show all columns
  const showAllColumns = () => {
    const newVisible: Record<string, boolean> = {};
    defaultColumns.forEach((col) => {
      newVisible[col.key] = true;
    });
    setVisibleColumns(newVisible);
  };

  // Reset to default columns
  const resetToDefault = () => {
    const newVisible: Record<string, boolean> = {};
    defaultColumns.forEach((col) => {
      newVisible[col.key] = col.visible;
    });
    setVisibleColumns(newVisible);
    setColumnOrder(defaultColumns.map((col) => col.key));
  };

  // Reorder columns
  const reorderColumns = (fromIndex: number, toIndex: number) => {
    setColumnOrder((prev) => {
      const newOrder = [...prev];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return newOrder;
    });
  };

  // Native drag and drop handlers
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', id);
    } catch (err) {
      console.error('Failed to set drag data:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const draggedId = draggingId || e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === overId) {
      setDraggingId(null);
      return;
    }

    setColumnOrder((prev) => {
      const fromIndex = prev.indexOf(draggedId);
      const toIndex = prev.indexOf(overId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const newOrder = [...prev];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggedId);
      return newOrder;
    });
    setDraggingId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  // Format column key to display label
  const formatLabel = (key: string): string => {
    if (key.toLowerCase() === 'sku') return 'SKU';
    return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  return {
    visibleColumns,
    columnOrder,
    toggleColumn,
    showAllColumns,
    resetToDefault,
    reorderColumns,
    draggingId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    formatLabel,
  };
}
