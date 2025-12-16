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

// Check if a dtype is numeric
const isNumericType = (dtype: string): boolean => {
  const numericTypes = ['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Float32', 'Float64'];
  return numericTypes.some(t => dtype.includes(t));
};

const DataTable = () => {
  const previewState = useUIStore((s) => s.previewState);
  const showNotification = useUIStore((s) => s.showNotification);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // Cell selection state
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [anchorCell, setAnchorCell] = useState<{row: number; col: number} | null>(null);
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
      setIsSelecting(false);
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
  
  // Copy selection (or all data if no selection) to clipboard as TSV
  const copyData = useCallback((includeHeaders: boolean) => {
    if (!previewState?.data || columnNames.length === 0) return;
    
    // If no selection, copy everything
    const norm = selection 
      ? normalizeSelection(selection)
      : { startRow: 0, startCol: 0, endRow: previewState.data.length - 1, endCol: columnNames.length - 1 };
    
    const lines: string[] = [];
    
    // Add header row if requested
    if (includeHeaders) {
      const headerCells = columnNames.slice(norm.startCol, norm.endCol + 1);
      lines.push(headerCells.join('\t'));
    }
    
    // Add data rows
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const row = previewState.data[r];
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
    
    if (e.shiftKey && anchorCell) {
      // Extend selection from anchor
      setSelection({
        startRow: anchorCell.row,
        startCol: anchorCell.col,
        endRow: rowIdx,
        endCol: colIdx,
      });
    } else {
      // Start new selection
      setAnchorCell({ row: rowIdx, col: colIdx });
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
  }, []);
  
  // Handle column header click - select entire column
  const handleColumnHeaderClick = useCallback((
    e: React.MouseEvent,
    colIdx: number
  ) => {
    if (!previewState?.data) return;
    e.preventDefault();
    setContextMenu(null);
    
    const rowCount = previewState.data.length;
    if (e.shiftKey && anchorCell) {
      // Extend to column range
      setSelection({
        startRow: 0,
        startCol: anchorCell.col,
        endRow: rowCount - 1,
        endCol: colIdx,
      });
    } else {
      setAnchorCell({ row: 0, col: colIdx });
      setSelection({
        startRow: 0,
        startCol: colIdx,
        endRow: rowCount - 1,
        endCol: colIdx,
      });
    }
  }, [previewState?.data, anchorCell]);
  
  // Handle row number click - select entire row
  const handleRowHeaderClick = useCallback((
    e: React.MouseEvent,
    rowIdx: number
  ) => {
    e.preventDefault();
    setContextMenu(null);
    
    const colCount = columnNames.length;
    if (e.shiftKey && anchorCell) {
      // Extend to row range
      setSelection({
        startRow: anchorCell.row,
        startCol: 0,
        endRow: rowIdx,
        endCol: colCount - 1,
      });
    } else {
      setAnchorCell({ row: rowIdx, col: 0 });
      setSelection({
        startRow: rowIdx,
        startCol: 0,
        endRow: rowIdx,
        endCol: colCount - 1,
      });
    }
  }, [columnNames.length, anchorCell]);
  
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
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
      cell: ({ row }) => (
        <span className="text-theme-text-tertiary select-none">{row.index + 1}</span>
      ),
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
              {col.nullable && " (nullable)"}
            </div>
          </div>
        ),
        cell: (info: { getValue: () => unknown }) => {
          const value = info.getValue();
          
          // Handle null/undefined
          if (value === null || value === undefined) {
            return <span className="italic text-theme-text-tertiary">null</span>;
          }
          
          const stringValue = String(value);
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
            {selection ? 'Copy with Headers' : 'Copy All with Headers'}
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
                  
                  return (
                    <th
                      key={header.id}
                      className={`relative px-3 py-2 text-left border-r group border-theme-border-primary last:border-r-0 ${
                        !isRowNumCol ? 'cursor-pointer hover:bg-theme-surface-panel' : ''
                      }`}
                      style={{ width: header.getSize() }}
                      onClick={(e) => {
                        if (!isRowNumCol) {
                          // If clicking the header area (not the sort indicator), select column
                          handleColumnHeaderClick(e, colIdx);
                        }
                      }}
                    >
                      <div
                        className={`flex items-center gap-2 ${
                          header.column.getCanSort() ? "cursor-pointer select-none" : ""
                        }`}
                        onClick={(e) => {
                          if (!isRowNumCol) {
                            e.stopPropagation();
                            header.column.getToggleSortingHandler()?.(e);
                          }
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-theme-text-accent">
                            {header.column.getIsSorted() === "asc" ? " ↑" : " ↓"}
                          </span>
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
                      } ${isRowNum ? 'bg-theme-surface-elevated cursor-pointer hover:bg-theme-surface-panel border-r border-theme-border-primary' : ''} ${
                        isSelected ? 'bg-theme-interactive-accent/20' : ''
                      } ${!isRowNum ? 'cursor-cell' : ''} ${borderClasses}`}
                      style={{ width: cell.column.getSize() }}
                      onMouseDown={(e) => {
                        if (isRowNum) {
                          handleRowHeaderClick(e, rowIdx);
                        } else {
                          handleCellMouseDown(e, rowIdx, colIdx);
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer hint */}
      <div className="flex-shrink-0 mt-2 text-xs text-theme-text-tertiary">
        <span className="opacity-70">
          Drag to select | Shift+Click to extend | Ctrl+A select all | Ctrl+C copy | Ctrl+Shift+C copy without headers | Esc clear
        </span>
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded shadow-lg bg-theme-surface-elevated border border-theme-border-primary"
          style={{ left: contextMenu.x, top: contextMenu.y }}
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
