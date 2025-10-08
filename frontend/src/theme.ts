import { createTheme } from '@mui/material/styles';

// Global theme configuration for the POS System
// This eliminates the need to repeat font sizes and styles on every page
const theme = createTheme({
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontSize: 14,
    // Set default font size for all typography variants
    h1: { fontSize: '2rem' },
    h2: { fontSize: '1.75rem' },
    h3: { fontSize: '1.5rem' },
    h4: { fontSize: '1.25rem' },
    h5: { fontSize: '1.125rem' },
    h6: { fontSize: '1rem' },
    body1: { fontSize: '14px' },
    body2: { fontSize: '14px' },
    button: { fontSize: '14px', textTransform: 'none' },
    caption: { fontSize: '12px' },
    overline: { fontSize: '12px' },
  },
  palette: {
    primary: {
      main: '#00A870', // Green from sidebar
      light: '#33ba88',
      dark: '#00754e',
    },
    secondary: {
      main: '#1976d2',
    },
    error: {
      main: '#d32f2f',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
    background: {
      default: '#f7f8fA',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontSize: '14px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            fontSize: '14px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '14px',
          padding: '8px',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#f7f7f7',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '13px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: '14px',
          minHeight: 48,
        },
      },
    },
  },
  spacing: 8,
});

// Common table styles for sticky headers and scrolling
export const tableContainerStyles = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  overflow: 'hidden',
};

export const tableScrollBoxStyles = {
  maxHeight: 600,
  overflow: 'auto',
  // Ultra-thin scrollbar styling
  '&::-webkit-scrollbar': {
    width: 1,
    height: 1,
  },
  '&::-webkit-scrollbar-button': {
    display: 'none',
    width: 0,
    height: 0,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    minHeight: 20,
  },
  '&::-webkit-scrollbar-corner': {
    background: 'transparent',
  },
  scrollbarWidth: 'thin' as const,
  scrollbarColor: 'rgba(0,0,0,0.28) transparent',
};

export const stickyHeaderCellStyles = {
  top: 0,
  position: 'sticky' as const,
  backgroundColor: '#f7f7f7',
  zIndex: 1200,
  whiteSpace: 'nowrap' as const,
  py: 0.5,
};

export const stickyActionsCellStyles = {
  top: 0,
  position: 'sticky' as const,
  right: 0,
  backgroundColor: '#f7f7f7',
  zIndex: 1200,
  borderLeft: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  pr: 0,
  py: 0.5,
  '& .MuiIconButton-root': { height: 32, width: 32, p: 0 },
};

export const cellTruncateStyles = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
  maxWidth: 240,
};

export const roundedSearchInputStyles = {
  borderRadius: '20px',
  backgroundColor: '#ffffff',
  px: 1.5,
  py: 0,
  boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)',
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(0,0,0,0.08)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.12)' },
  '& .MuiInputBase-input': { padding: '10px 12px', fontSize: '14px' },
};

export default theme;
