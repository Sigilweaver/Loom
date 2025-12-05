import { useMemo, useCallback } from "react";
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
import { useState } from "react";

export interface ColumnSchema {
  name: string;
  dtype: string;
  nullable: boolean;
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

  // Copy value to clipboard
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
      <div className="flex items-center justify-center h-full text-sm text-theme-text-error">
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
    <div className="flex flex-col h-full">
      {/* Header Info */}
      <div className="flex-shrink-0 p-2 mb-3 text-xs rounded bg-theme-surface-elevated text-theme-text-secondary">
        <strong>{data.length}</strong> rows × <strong>{schema.length}</strong> columns
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
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
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative px-3 py-2 text-left border-r group border-theme-border-primary last:border-r-0"
                    style={{ width: header.getSize() }}
                  >
                    <div
                      className={`flex items-center gap-2 ${
                        header.column.getCanSort() ? "cursor-pointer select-none" : ""
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
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
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 hover:bg-theme-border-accent ${
                          header.column.getIsResizing() ? "bg-theme-border-accent opacity-100" : ""
                        }`}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-theme-border-secondary hover:bg-theme-surface-panel transition-colors ${
                  idx % 2 === 0 ? "" : "bg-theme-surface-elevated"
                }`}
              >
                {row.getVisibleCells().map((cell) => {
                  const isNumeric = (cell.column.columnDef.meta as { isNumeric?: boolean })?.isNumeric;
                  const isRowNum = cell.column.id === '_rowNum';
                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-2 border-r text-theme-text-primary border-theme-border-primary last:border-r-0 ${
                        isNumeric ? 'text-right' : ''
                      } ${isRowNum ? 'bg-theme-surface-elevated' : ''}`}
                      style={{ width: cell.column.getSize() }}
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
    </div>
  );
};

export default DataTable;
