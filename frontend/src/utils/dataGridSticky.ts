// Shared DataGrid sticky column styles
import { SxProps, Theme } from '@mui/material';

export const dataGridStickySx: SxProps<Theme> = {
  position: 'relative', // ensure sticky children are positioned relative to this container
  // make header sticky (keeps existing behavior)
  '& .MuiDataGrid-columnHeaders': {
    position: 'sticky',
    top: 0,
    backgroundColor: 'background.paper',
    zIndex: 1200, // higher to sit above other elements
    // keep header visually flat like the Users table (no shadow)
    boxShadow: 'none'
  },
  // Make sure the main viewport doesn't obstruct sticky columns
  '& .MuiDataGrid-viewport, & .MuiDataGrid-renderingZone': {
    // Some DataGrid implementations apply transform to the rendering zone which breaks position:sticky.
    // Remove transform here so sticky elements can be positioned correctly.
    transform: 'none !important',
  },
  // Virtual scroller should allow internal horizontal scrolling while sticky remains
  '& .MuiDataGrid-virtualScroller': {
    overflowX: 'auto',
    overflowY: 'hidden'
  },
  // Sticky right-most actions column (header + body cells)
  '& .MuiDataGrid-columnHeader[data-field="actions"], & .MuiDataGrid-cell[data-field="actions"],\\\
  & .dg-actions-header, & .dg-actions-cell': {
    position: 'sticky',
    right: 0,
    backgroundColor: 'background.paper',
    // header should sit above cells
    zIndex: 1250,
    borderLeft: '1px solid',
    borderColor: 'divider',
    // match the Users table: no shadow, compact nowrap
    boxShadow: 'none',
    whiteSpace: 'nowrap',
    transform: 'none !important'
  },
  '& .MuiDataGrid-cell[data-field="actions"], & .dg-actions-cell': {
    zIndex: 1240,
    // Ensure pointer events work on sticky cells
    pointerEvents: 'auto'
  }
};

export default dataGridStickySx;
