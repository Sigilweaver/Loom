import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useUIStore } from "@state/uiStore";

export interface ColumnSchema {
  name: string;
  dtype: string;
  nullable: boolean;
}

// Selection range for cells
interface CellSelection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// Max characters to show before truncating
const MAX_STRING_LENGTH = 50;

// Format numeric values for display (handles Decimal artifacts)
const formatNumericDisplay = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  
  // Handle scientific notation zeros like "0E-10"
  if (/^-?0E[+-]?\d+$/i.test(str)) {
    return '0';
  }
  
  // Handle trailing zeros like "3327.540000000000" or "9.0000000000000"
  // Only if it looks like a decimal number with excessive trailing zeros
  if (/^-?\d+\.\d*0{4,}$/.test(str)) {
    // Parse and format to remove trailing zeros
    const num = parseFloat(str);
    if (!isNaN(num)) {
      return num.toString();
    }
  }
  
  return str;
};

// Check if a dtype is numeric
const isNumericType = (dtype: string): boolean => {
  const numericTypes = ['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Float32', 'Float64', 'Decimal'];
  return numericTypes.some(t => dtype.includes(t));
};

const DataTable = () => {
  const previewState = useUIStore((s) => s.previewState);
  const showNotification = useUIStore((s) => s.showNotification);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // Cell selection state
  // anchorCell: the fixed point of the selection (where selection started)
  // activeCell: the moving point of the selection (where arrow keys move to)
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSelectingColumns, setIsSelectingColumns] = useState(false);
  const [isSelectingRows, setIsSelectingRows] = useState(false);
  const [anchorCell, setAnchorCell] = useState<{row: number; col: number} | null>(null);
  const [activeCell, setActiveCell] = useState<{row: number; col: number} | null>(null);
  const [anchorCol, setAnchorCol] = useState<number | null>(null);
  const [anchorRow, setAnchorRow] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number; y: number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSocketKeyRef = useRef<string | null>(null);
  
  // Generate a unique key for the current socket to detect changes
  const currentSocketKey = previewState 
    ? `${previewState.toolId}-${previewState.socketId}-${previewState.socketDirection}`
    : null;
  
  // Clear selection when socket changes
  useEffect(() => {
    if (currentSocketKey !== prevSocketKeyRef.current) {
      setSelection(null);
      setAnchorCell(null);
      setActiveCell(null);
      setAnchorCol(null);
      setAnchorRow(null);
      setIsSelecting(false);
      setIsSelectingColumns(false);
      setIsSelectingRows(false);
      setContextMenu(null);
      prevSocketKeyRef.current = currentSocketKey;
    }
  }, [currentSocketKey]);
  
  // Get column names (excluding row number column)
  const columnNames = useMemo(() => {
    return previewState?.schema?.map(col => col.name) || [];
  }, [previewState?.schema]);
  
  // Normalize selection to always have start <= end
  const normalizeSelection = useCallback((sel: CellSelection): CellSelection => {
    return {
      startRow: Math.min(sel.startRow, sel.endRow),
      startCol: Math.min(sel.startCol, sel.endCol),
      endRow: Math.max(sel.startRow, sel.endRow),
      endCol: Math.max(sel.startCol, sel.endCol),
    };
  }, []);
  
  // Check if a cell is within the current selection
  const isCellSelected = useCallback((rowIdx: number, colIdx: number): boolean => {
    if (!selection) return false;
    const norm = normalizeSelection(selection);
    return rowIdx >= norm.startRow && rowIdx <= norm.endRow &&
           colIdx >= norm.startCol && colIdx <= norm.endCol;
  }, [selection, normalizeSelection]);
  
  // Get selection edge info for a cell (for drawing borders)
  const getSelectionEdges = useCallback((rowIdx: number, colIdx: number): {
    top: boolean; bottom: boolean; left: boolean; right: boolean;
  } | null => {
    if (!selection) return null;
    const norm = normalizeSelection(selection);
    if (rowIdx < norm.startRow || rowIdx > norm.endRow ||
        colIdx < norm.startCol || colIdx > norm.endCol) {
      return null;
    }
    return {
      top: rowIdx === norm.startRow,
      bottom: rowIdx === norm.endRow,
      left: colIdx === norm.startCol,
      right: colIdx === norm.endCol,
    };
  }, [selection, normalizeSelection]);
  
  // Format cell value for TSV export
  const formatCellValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape tabs and newlines for TSV
    if (str.includes('\t') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }, []);
  
  // Copy selection (or all data if no selection) to clipboard as TSV.
  // IMPORTANT: cell selection coordinates are *visual* row indices (the index
  // in the rendered, possibly sorted row list). We therefore have to read
  // through the table's sorted row model rather than `previewState.data`,
  // which is always in original (unsorted) order. The table instance is
  // created later in this component, so we access it via a ref.
  const sortedRowsRef = useRef<{ original: Record<string, unknown> }[]>([]);
  const copyData = useCallback((includeHeaders: boolean) => {
    if (!previewState?.data || columnNames.length === 0) return;

    const sortedRows = sortedRowsRef.current;
    const totalRows = sortedRows.length;

    // If no selection, copy everything (visible row order)
    const norm = selection
      ? normalizeSelection(selection)
      : { startRow: 0, startCol: 0, endRow: totalRows - 1, endCol: columnNames.length - 1 };

    const lines: string[] = [];

    // Add header row if requested
    if (includeHeaders) {
      const headerCells = columnNames.slice(norm.startCol, norm.endCol + 1);
      lines.push(headerCells.join('\t'));
    }

    // Add data rows
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const row = sortedRows[r]?.original;
      if (!row) continue;
      const cells: string[] = [];
      for (let c = norm.startCol; c <= norm.endCol; c++) {
        const colName = columnNames[c];
        if (colName !== undefined) {
          cells.push(formatCellValue(row[colName]));
        }
      }
      lines.push(cells.join('\t'));
    }

    const tsv = lines.join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      const rowCount = norm.endRow - norm.startRow + 1;
      const colCount = norm.endCol - norm.startCol + 1;
      const label = selection ? `${rowCount} x ${colCount} cells` : 'all data';
      showNotification(`Copied ${label}`, 'success', 1500);
      setContextMenu(null);
    }).catch(() => {
      showNotification('Failed to copy', 'error', 1500);
    });
  }, [selection, previewState?.data, columnNames, normalizeSelection, formatCellValue, showNotification]);
  
  // Handle cell mouse down - start selection
  const handleCellMouseDown = useCallback((
    e: React.MouseEvent,
    rowIdx: number,
    colIdx: number
  ) => {
    // Ignore right clicks for selection start (let context menu handle)
    if (e.button === 2) return;
    
    e.preventDefault();
    setContextMenu(null);
    
    // Focus the container so keyboard shortcuts work
    containerRef.current?.focus();
    
    if (e.shiftKey && anchorCell) {
      // Extend selection from anchor to clicked cell
      setActiveCell({ row: rowIdx, col: colIdx });
      setSelection({
        startRow: anchorCell.row,
        startCol: anchorCell.col,
        endRow: rowIdx,
        endCol: colIdx,
      });
    } else {
      // Start new selection
      setAnchorCell({ row: rowIdx, col: colIdx });
      setActiveCell({ row: rowIdx, col: colIdx });
      setSelection({
        startRow: rowIdx,
        startCol: colIdx,
        endRow: rowIdx,
        endCol: colIdx,
      });
      setIsSelecting(true);
    }
  }, [anchorCell]);
  
  // Handle mouse move during selection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !anchorCell) return;
    
    // Find the cell under the mouse
    const target = e.target as HTMLElement;
    const cell = target.closest('td[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    
    const rowIdx = parseInt(cell.dataset.row || '0', 10);
    const colIdx = parseInt(cell.dataset.col || '0', 10);
    
    setActiveCell({ row: rowIdx, col: colIdx });
    setSelection({
      startRow: anchorCell.row,
      startCol: anchorCell.col,
      endRow: rowIdx,
      endCol: colIdx,
    });
  }, [isSelecting, anchorCell]);
  
  // Handle mouse up - end selection
  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    setIsSelectingColumns(false);
    setIsSelectingRows(false);
  }, []);
  
  // Handle column header mouse down - start column selection
  const handleColumnHeaderMouseDown = useCallback((
    e: React.MouseEvent,
    colIdx: number
  ) => {
    if (e.button === 2) return; // Ignore right clicks
    if (!previewState?.data) return;
    e.preventDefault();
    setContextMenu(null);
    
    // Focus the container so keyboard shortcuts work
    containerRef.current?.focus();
    
    const rowCount = previewState.data.length;
    if (e.shiftKey && anchorCol !== null) {
      // Extend to column range
      setSelection({
        startRow: 0,
        startCol: anchorCol,
        endRow: rowCount - 1,
        endCol: colIdx,
      });
    } else {
      setAnchorCol(colIdx);
      setAnchorCell({ row: 0, col: colIdx });
      setSelection({
        startRow: 0,
        startCol: colIdx,
        endRow: rowCount - 1,
        endCol: colIdx,
      });
      setIsSelectingColumns(true);
    }
  }, [previewState?.data, anchorCol]);
  
  // Handle column header mouse move during drag
  const handleColumnHeaderMouseMove = useCallback((
    colIdx: number
  ) => {
    if (!isSelectingColumns || anchorCol === null || !previewState?.data) return;
    
    const rowCount = previewState.data.length;
    setSelection({
      startRow: 0,
      startCol: anchorCol,
      endRow: rowCount - 1,
      endCol: colIdx,
    });
  }, [isSelectingColumns, anchorCol, previewState?.data]);
  
  // Handle row number mouse down - start row selection
  const handleRowHeaderMouseDown = useCallback((
    e: React.MouseEvent,
    rowIdx: number
  ) => {
    if (e.button === 2) return; // Ignore right clicks
    e.preventDefault();
    setContextMenu(null);
    
    // Focus the container so keyboard shortcuts work
    containerRef.current?.focus();
    
    const colCount = columnNames.length;
    if (e.shiftKey && anchorRow !== null) {
      // Extend to row range
      setSelection({
        startRow: anchorRow,
        startCol: 0,
        endRow: rowIdx,
        endCol: colCount - 1,
      });
    } else {
      setAnchorRow(rowIdx);
      setAnchorCell({ row: rowIdx, col: 0 });
      setSelection({
        startRow: rowIdx,
        startCol: 0,
        endRow: rowIdx,
        endCol: colCount - 1,
      });
      setIsSelectingRows(true);
    }
  }, [columnNames.length, anchorRow]);
  
  // Handle row header mouse move during drag
  const handleRowHeaderMouseMove = useCallback((
    rowIdx: number
  ) => {
    if (!isSelectingRows || anchorRow === null) return;
    
    const colCount = columnNames.length;
    setSelection({
      startRow: anchorRow,
      startCol: 0,
      endRow: rowIdx,
      endCol: colCount - 1,
    });
  }, [isSelectingRows, anchorRow, columnNames.length]);
  
  // Handle context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // If right-clicking on an unselected cell, select it first
    const target = e.target as HTMLElement;
    const cell = target.closest('td[data-row][data-col]') as HTMLElement | null;
    if (cell) {
      const rowIdx = parseInt(cell.dataset.row || '0', 10);
      const colIdx = parseInt(cell.dataset.col || '0', 10);
      
      if (!isCellSelected(rowIdx, colIdx)) {
        setAnchorCell({ row: rowIdx, col: colIdx });
        setSelection({
          startRow: rowIdx,
          startCol: colIdx,
          endRow: rowIdx,
          endCol: colIdx,
        });
      }
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [isCellSelected]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Close context menu on any key
    if (contextMenu) {
      setContextMenu(null);
    }
    
    // Escape - clear selection
    if (e.key === 'Escape') {
      setSelection(null);
      setAnchorCell(null);
      setActiveCell(null);
      return;
    }
    
    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      
      const rowCount = previewState?.data?.length || 0;
      const colCount = columnNames.length;
      if (rowCount === 0 || colCount === 0) return;
      
      // For shift+arrow, move from active cell; otherwise from anchor (or 0,0 if none)
      const currentRow = e.shiftKey 
        ? (activeCell?.row ?? anchorCell?.row ?? 0)
        : (anchorCell?.row ?? 0);
      const currentCol = e.shiftKey
        ? (activeCell?.col ?? anchorCell?.col ?? 0)
        : (anchorCell?.col ?? 0);
      
      let newRow = currentRow;
      let newCol = currentCol;
      
      switch (e.key) {
        case 'ArrowUp':
          newRow = Math.max(0, currentRow - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(rowCount - 1, currentRow + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, currentCol - 1);
          break;
        case 'ArrowRight':
          newCol = Math.min(colCount - 1, currentCol + 1);
          break;
      }
      
      if (e.shiftKey) {
        // Extend/contract selection from anchor to new active position
        const anchor = anchorCell ?? { row: 0, col: 0 };
        setActiveCell({ row: newRow, col: newCol });
        setSelection({
          startRow: anchor.row,
          startCol: anchor.col,
          endRow: newRow,
          endCol: newCol,
        });
        // Set anchor if not already set
        if (!anchorCell) {
          setAnchorCell({ row: 0, col: 0 });
        }
      } else {
        // Move selection to single cell
        setAnchorCell({ row: newRow, col: newCol });
        setActiveCell({ row: newRow, col: newCol });
        setSelection({
          startRow: newRow,
          startCol: newCol,
          endRow: newRow,
          endCol: newCol,
        });
      }
      return;
    }
    
    // Ctrl+A - select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      if (previewState?.data && columnNames.length > 0) {
        setAnchorCell({ row: 0, col: 0 });
        setSelection({
          startRow: 0,
          startCol: 0,
          endRow: previewState.data.length - 1,
          endCol: columnNames.length - 1,
        });
      }
      return;
    }
    
    // Ctrl+C - copy with headers (default)
    // Ctrl+Shift+C - copy without headers
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      const includeHeaders = !e.shiftKey;
      copyData(includeHeaders);
      return;
    }
  }, [contextMenu, previewState?.data, columnNames.length, copyData]);
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  // Copy value to clipboard (for double-click on single cell)
  const copyToClipboard = useCallback((value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Copied to clipboard', 'success', 1500);
    }).catch(() => {
      showNotification('Failed to copy', 'error', 1500);
    });
  }, [showNotification]);

  // Create columns definition from schema
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!previewState?.schema) return [];

    // Row number column
    const rowNumberColumn: ColumnDef<Record<string, unknown>> = {
      id: '_rowNum',
      header: () => <span className="text-theme-text-tertiary">#</span>,
      size: 45,
      minSize: 45,
      maxSize: 45,
      enableSorting: false,
      enableResizing: false,
    };

    // Data columns
    const dataColumns = previewState.schema.map((col) => {
      const isNumeric = isNumericType(col.dtype);
      
      return {
        accessorKey: col.name,
        id: col.name,
        header: () => (
          <div className="flex flex-col">
            <div className="font-semibold text-theme-text-primary">{col.name}</div>
            <div className="text-xs font-normal text-theme-text-secondary mt-0.5">
              {col.dtype}
            </div>
          </div>
        ),
        cell: (info: { getValue: () => unknown }) => {
          const value = info.getValue();
          
          // Handle null/undefined
          if (value === null || value === undefined) {
            return <span className="italic text-theme-text-tertiary">null</span>;
          }
          
          // Format numeric values to clean up Decimal artifacts
          const stringValue = isNumeric ? formatNumericDisplay(value) : String(value);
          const isTruncated = stringValue.length > MAX_STRING_LENGTH;
          const displayValue = isTruncated 
            ? stringValue.slice(0, MAX_STRING_LENGTH) + '...' 
            : stringValue;
          
          return (
            <span 
              className={`${isNumeric ? 'font-mono' : ''} ${isTruncated ? 'cursor-help' : 'cursor-copy'}`}
              title={isTruncated ? stringValue : 'Double-click to copy'}
              onDoubleClick={() => copyToClipboard(value)}
            >
              {displayValue}
            </span>
          );
        },
        size: 150,
        minSize: 80,
        maxSize: 500,
        meta: { isNumeric },
      };
    });

    return [rowNumberColumn, ...dataColumns];
  }, [previewState?.schema, copyToClipboard]);

  const table = useReactTable({
    data: previewState?.data || [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  // Keep the sorted-rows ref in sync so copyData (defined earlier) can read
  // through the current sort order rather than the unsorted previewState.data.
  sortedRowsRef.current = table.getRowModel().rows as unknown as {
    original: Record<string, unknown>;
  }[];

  if (!previewState) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-text-secondary">
        No preview data available. Click a socket on the canvas to preview its data.
      </div>
    );
  }

  if (previewState.loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-text-secondary">
        Loading preview...
      </div>
    );
  }

  if (previewState.error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-notification-error-text">
        Error: {previewState.error}
      </div>
    );
  }

  const { schema, data } = previewState;

  if (!schema || schema.length === 0 || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-text-secondary">
        No data available for this socket.
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full outline-none select-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onBlur={(e) => {
        // Only clear selection if focus moved outside the container
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setSelection(null);
          setAnchorCell(null);
          setActiveCell(null);
          setContextMenu(null);
        }
      }}
    >
      {/* Header Info */}
      <div className="flex-shrink-0 flex items-center justify-between p-2 mb-2 rounded bg-theme-surface-elevated border border-theme-border-primary">
        <div className="flex items-center gap-3 text-xs text-theme-text-secondary">
          <span>
            <strong>{data.length}</strong> rows × <strong>{schema.length}</strong> columns
          </span>
          {selection && (() => {
            const norm = normalizeSelection(selection);
            const selRows = norm.endRow - norm.startRow + 1;
            const selCols = norm.endCol - norm.startCol + 1;
            return (
              <span className="text-theme-text-accent">
                ({selRows} x {selCols} selected)
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {/* Keyboard shortcuts tooltip */}
          <div className="relative group">
            <button
              className="p-1.5 rounded transition-colors text-theme-text-tertiary hover:text-theme-text-secondary hover:bg-theme-surface-panel"
              title="Keyboard shortcuts"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="absolute top-full right-0 mt-1 hidden group-hover:block z-50">
              <div className="bg-theme-surface-elevated border border-theme-border-primary rounded-lg shadow-lg p-3 whitespace-nowrap">
                <div className="text-xs font-medium text-theme-text-primary mb-2">Keyboard Shortcuts</div>
                <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1.5 text-xs">
                  <span className="text-theme-text-secondary">Drag</span>
                  <span className="text-theme-text-tertiary">Select cells</span>
                  <span className="text-theme-text-secondary"><kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Arrow</kbd> keys</span>
                  <span className="text-theme-text-tertiary">Navigate selection</span>
                  <span className="text-theme-text-secondary"><kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Shift</kbd> + Click/<kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Arrow</kbd></span>
                  <span className="text-theme-text-tertiary">Extend selection</span>
                  <span className="text-theme-text-secondary"><kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">A</kbd></span>
                  <span className="text-theme-text-tertiary">Select all</span>
                  <span className="text-theme-text-secondary"><kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">C</kbd></span>
                  <span className="text-theme-text-tertiary">Copy with headers</span>
                  <span className="text-theme-text-secondary"><kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Shift</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">C</kbd></span>
                  <span className="text-theme-text-tertiary">Copy without headers</span>
                  <span className="text-theme-text-secondary"><kbd className="px-1.5 py-0.5 rounded bg-theme-surface-panel border border-theme-border-secondary font-mono text-[10px]">Esc</kbd></span>
                  <span className="text-theme-text-tertiary">Clear selection</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => copyData(true)}
            className="px-2 py-1 text-xs font-medium rounded transition-colors
                       bg-theme-surface-panel border border-theme-border-primary
                       text-theme-text-secondary hover:text-theme-text-primary
                       hover:bg-theme-border-secondary hover:border-theme-border-focus"
            title={selection ? "Copy with headers (Ctrl+C)" : "Copy all with headers (Ctrl+C)"}
          >
            {selection ? 'Copy' : 'Copy All'}
          </button>
          <button
            onClick={() => copyData(false)}
            className="px-2 py-1 text-xs font-medium rounded transition-colors
                       bg-theme-surface-panel border border-theme-border-primary
                       text-theme-text-secondary hover:text-theme-text-primary
                       hover:bg-theme-border-secondary hover:border-theme-border-focus"
            title={selection ? "Copy without headers (Ctrl+Shift+C)" : "Copy all without headers (Ctrl+Shift+C)"}
          >
            {selection ? 'Copy without Headers' : 'Copy All without Headers'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div 
        className="flex-1 overflow-auto"
        onMouseMove={handleMouseMove}
        onContextMenu={handleContextMenu}
      >
        <table
          className="w-full text-xs border-collapse"
          style={{ width: table.getCenterTotalSize() }}
        >
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b-2 bg-theme-surface-elevated border-theme-border-primary"
              >
                {headerGroup.headers.map((header, headerIdx) => {
                  const isRowNumCol = header.column.id === '_rowNum';
                  // colIdx for data columns (0-indexed, excluding row num column)
                  const colIdx = headerIdx - 1;
                  const isSorted = header.column.getIsSorted();
                  
                  return (
                    <th
                      key={header.id}
                      className={`relative px-3 py-2 text-left border-r group border-theme-border-primary last:border-r-0 ${
                        !isRowNumCol ? 'cursor-cell hover:bg-theme-surface-panel' : ''
                      }`}
                      style={{ width: header.getSize() }}
                      onMouseDown={(e) => {
                        if (!isRowNumCol) {
                          handleColumnHeaderMouseDown(e, colIdx);
                        }
                      }}
                      onMouseEnter={() => {
                        if (!isRowNumCol) {
                          handleColumnHeaderMouseMove(colIdx);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0 select-none">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        {/* Sort button */}
                        {header.column.getCanSort() && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              header.column.getToggleSortingHandler()?.(e);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`flex-shrink-0 p-1 rounded transition-colors ${
                              isSorted 
                                ? 'text-theme-interactive-accent' 
                                : 'text-theme-text-tertiary opacity-0 group-hover:opacity-100 hover:text-theme-text-secondary'
                            } hover:bg-theme-surface-panel`}
                            title={isSorted === 'asc' ? 'Sort descending' : isSorted === 'desc' ? 'Clear sort' : 'Sort ascending'}
                          >
                            {isSorted === 'asc' 
                              ? <ArrowUp className="w-3.5 h-3.5" />
                              : isSorted === 'desc'
                                ? <ArrowDown className="w-3.5 h-3.5" />
                                : <ArrowUpDown className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}
                      </div>
                      {/* Column Resizer */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            header.getResizeHandler()(e);
                          }}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 hover:bg-theme-border-accent ${
                            header.column.getIsResizing() ? "bg-theme-border-accent opacity-100" : ""
                          }`}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={`border-b border-theme-border-secondary transition-colors ${
                  rowIdx % 2 === 0 ? "" : "bg-theme-surface-elevated"
                }`}
              >
                {row.getVisibleCells().map((cell, cellIdx) => {
                  const isNumeric = (cell.column.columnDef.meta as { isNumeric?: boolean })?.isNumeric;
                  const isRowNum = cell.column.id === '_rowNum';
                  // colIdx for data columns (0-indexed, excluding row num column)
                  const colIdx = cellIdx - 1;
                  const isSelected = !isRowNum && isCellSelected(rowIdx, colIdx);
                  const edges = !isRowNum ? getSelectionEdges(rowIdx, colIdx) : null;
                  
                  // Build border classes for selection outline
                  const borderClasses = edges ? [
                    edges.top ? 'border-t-2 border-t-theme-interactive-accent' : '',
                    edges.bottom ? 'border-b-2 border-b-theme-interactive-accent' : '',
                    edges.left ? 'border-l-2 border-l-theme-interactive-accent' : '',
                    edges.right ? 'border-r-2 border-r-theme-interactive-accent' : '',
                  ].filter(Boolean).join(' ') : '';
                  
                  return (
                    <td
                      key={cell.id}
                      data-row={isRowNum ? undefined : rowIdx}
                      data-col={isRowNum ? undefined : colIdx}
                      className={`px-3 py-2 text-theme-text-primary ${!edges ? 'border-r border-theme-border-primary last:border-r-0' : ''} ${
                        isNumeric ? 'text-right' : ''
                      } ${isRowNum ? 'bg-theme-surface-elevated cursor-cell hover:bg-theme-surface-panel border-r border-theme-border-primary' : ''} ${
                        isSelected ? 'bg-theme-interactive-accent/20' : ''
                      } ${!isRowNum ? 'cursor-cell' : ''} ${borderClasses}`}
                      style={{ width: cell.column.getSize() }}
                      onMouseDown={(e) => {
                        if (isRowNum) {
                          handleRowHeaderMouseDown(e, rowIdx);
                        } else {
                          handleCellMouseDown(e, rowIdx, colIdx);
                        }
                      }}
                      onMouseEnter={() => {
                        if (isRowNum) {
                          handleRowHeaderMouseMove(rowIdx);
                        }
                      }}
                    >
                      {isRowNum 
                        ? <span className="text-theme-text-tertiary select-none">{rowIdx + 1}</span>
                        : flexRender(cell.column.columnDef.cell, cell.getContext())
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded shadow-lg bg-theme-surface-elevated border border-theme-border-primary"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            top: Math.min(contextMenu.y, window.innerHeight - 80),
          }}
        >
          <button
            onClick={() => copyData(false)}
            className="w-full px-4 py-2 text-left text-xs hover:bg-theme-surface-panel text-theme-text-primary"
          >
            {selection ? 'Copy' : 'Copy All'}
          </button>
          <button
            onClick={() => copyData(true)}
            className="w-full px-4 py-2 text-left text-xs hover:bg-theme-surface-panel text-theme-text-primary"
          >
            {selection ? 'Copy with Headers' : 'Copy All with Headers'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DataTable;
