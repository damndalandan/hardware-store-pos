import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { CloudOff, Sync } from '@mui/icons-material';
import { useOffline } from '../contexts/OfflineContext';

const OfflineIndicator: React.FC = () => {
  const { isOffline, pendingSales, syncPendingData } = useOffline();

  if (!isOffline && pendingSales.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        backgroundColor: '#ff9800',
        color: 'white',
        padding: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1
      }}
    >
      <CloudOff fontSize="small" />
      <Typography variant="body2">
        {isOffline ? 'Offline Mode' : `${pendingSales.length} pending transactions`}
      </Typography>
      {!isOffline && pendingSales.length > 0 && (
        <IconButton
          size="small"
          onClick={syncPendingData}
          sx={{ color: 'white', ml: 1 }}
        >
          <Sync fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

export default OfflineIndicator;