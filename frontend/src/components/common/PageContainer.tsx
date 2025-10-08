import React from 'react';
import { Box, Typography, BoxProps } from '@mui/material';

interface PageContainerProps extends BoxProps {
  title?: string;
  children: React.ReactNode;
}

/**
 * PageContainer - Consistent wrapper for all pages in the POS system
 * Provides standard background color, padding, and typography
 * Eliminates the need to repeat styling on every page
 */
const PageContainer: React.FC<PageContainerProps> = ({ 
  title, 
  children, 
  ...otherProps 
}) => {
  return (
    <Box
      sx={{
        backgroundColor: '#f7f8fA',
        minHeight: '100vh',
        p: 3,
        ...otherProps.sx,
      }}
      {...otherProps}
    >
      {title && (
        <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
};

export default PageContainer;
