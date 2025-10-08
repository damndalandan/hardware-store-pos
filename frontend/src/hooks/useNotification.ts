import { useState, useCallback } from 'react';

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  open: boolean;
  message: string;
  severity: NotificationSeverity;
}

/**
 * useNotification - Reusable hook for displaying snackbar notifications
 * Eliminates duplicate snackbar state management on every page
 */
export function useNotification() {
  const [notification, setNotification] = useState<Notification>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showNotification = useCallback(
    (message: string, severity: NotificationSeverity = 'success') => {
      setNotification({
        open: true,
        message,
        severity,
      });
    },
    []
  );

  const hideNotification = useCallback(() => {
    setNotification((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  return {
    notification,
    showNotification,
    hideNotification,
  };
}
