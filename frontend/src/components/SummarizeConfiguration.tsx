import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "../domain/workflow/entities/workflow";
import { useMetadata } from "../api/hooks";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { ColumnSchema } from "../api/backend";
import clsx from "clsx";

/**
 * Aggregation action definitions
 */
interface ActionInfo {
  value: string;
  label: string;
  numericOnly: boolean;
  stringOnly: boolean;
}

const ALL_ACTIONS: ActionInfo[] = [
  { value: "GroupBy", label: "Group By", numericOnly: false, stringOnly: false },
  { value: "Sum", label: "Sum", numericOnly: true, stringOnly: false },
  { value: "Mean", label: "Mean", numericOnly: true, stringOnly: false },
  { value: "Median", label: "Median", numericOnly: true, stringOnly: false },
  { value: "Min", label: "Min", numericOnly: false, stringOnly: false },
  { value: "Max", label: "Max", numericOnly: false, stringOnly: false },
  { value: "Count", label: "Count", numericOnly: false, stringOnly: false },
  { value: "CountDistinct", label: "Count Distinct", numericOnly: false, stringOnly: false },
  { value: "First", label: "First", numericOnly: false, stringOnly: false },
  { value: "Last", label: "Last", numericOnly: false, stringOnly: false },
  { value: "Std", label: "Std Dev", numericOnly: true, stringOnly: false },
  { value: "Var", label: "Variance", numericOnly: true, stringOnly: false },
  { value: "Concat", label: "Concat", numericOnly: false, stringOnly: true },
];

/**
 * Column action configuration (for the bottom panel)
 */
interface ColumnAction {
  column: string;
  action: string;
  outputName: string;
}

/**
 * Check if a dtype is numeric
 */
function isNumericDtype(dtype: string): boolean {
  const numericTypes = new Set([
    "Int8", "Int16", "Int32", "Int64",
    "UInt8", "UInt16", "UInt32", "UInt64",
    "Float32", "Float64", "Decimal",
  ]);
  return numericTypes.has(dtype);
}

/**
 * Check if a dtype is string-like
 */
function isStringDtype(dtype: string): boolean {
  return dtype === "String" || dtype === "Utf8";
}

/**
 * Get valid actions for a set of column types
 */
function getValidActions(columns: ColumnSchema[]): ActionInfo[] {
  if (columns.length === 0) return [];

  const allNumeric = columns.every((c) => isNumericDtype(c.dtype || ""));
  const allString = columns.every((c) => isStringDtype(c.dtype || ""));
  const anyNumeric = columns.some((c) => isNumericDtype(c.dtype || ""));

  return ALL_ACTIONS.filter((action) => {
    // Numeric-only actions require all columns to be numeric
    if (action.numericOnly && !allNumeric) return false;
    // String-only actions require all columns to be strings
    if (action.stringOnly && !allString) return false;
    // Concat doesn't make sense for numeric columns
    if (action.value === "Concat" && anyNumeric) return false;
    return true;
  });
}

/**
 * Generate default output name for a column + action
 */
function getDefaultOutputName(column: string, action: string): string {
  if (action === "GroupBy") return column;
  return `${action}_${column}`;
}

/**
 * Parse column actions from config
 */
function parseColumnActions(config: ToolConfig): ColumnAction[] {
  const actions: ColumnAction[] = [];

  // Parse groupByColumns
  const groupByColumns = Array.isArray(config.groupByColumns) ? config.groupByColumns : [];
  for (const col of groupByColumns) {
    if (typeof col === "string") {
      actions.push({ column: col, action: "GroupBy", outputName: col });
    }
  }

  // Parse aggregations
  const aggregations = Array.isArray(config.aggregations) ? config.aggregations : [];
  for (const agg of aggregations) {
    if (typeof agg === "object" && agg !== null) {
      const column = typeof agg.column === "string" ? agg.column : "";
      const operation = typeof agg.operation === "string" ? agg.operation : "Sum";
      const outputName = typeof agg.outputName === "string" && agg.outputName
        ? agg.outputName
        : getDefaultOutputName(column, operation);
      if (column) {
        actions.push({ column, action: operation, outputName });
      }
    }
  }

  return actions;
}

/**
 * Convert column actions back to config format
 */
function columnActionsToConfig(actions: ColumnAction[]): { groupByColumns: string[]; aggregations: Array<{ column: string; operation: string; outputName: string }> } {
  const groupByColumns: string[] = [];
  const aggregations: Array<{ column: string; operation: string; outputName: string }> = [];

  for (const action of actions) {
    if (action.action === "GroupBy") {
      groupByColumns.push(action.column);
    } else {
      aggregations.push({
        column: action.column,
        operation: action.action,
        outputName: action.outputName,
      });
    }
  }

  return { groupByColumns, aggregations };
}

interface SummarizeConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function SummarizeConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: SummarizeConfigurationProps) {
  const { columns, fetchMetadata, loading } = useMetadata();
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  // Track wire connections to this tool
  const wireConnections = useMemo(() => {
    return wires
      .filter((w) => w.to.tool === toolId)
      .map((w) => `${w.from.tool}-${w.from.socket}`)
      .sort()
      .join(",");
  }, [wires, toolId]);

  // Fetch metadata when component mounts or connections change
  useEffect(() => {
    const { tools: upstreamTools, wires: upstreamWires } =
      WorkflowSerializer.extractUpstreamSubgraph(tools, wires, toolId);
    const workflow = WorkflowSerializer.toJSON(
      upstreamTools,
      upstreamWires,
      workflowMeta
    );
    fetchMetadata(toolId, JSON.parse(workflow), 'input');
  }, [toolId, wireConnections, fetchMetadata]);

  // Get input columns from metadata
  const inputColumns: ColumnSchema[] = columns;

  // Create column lookup by name
  const columnMap = useMemo(() => {
    const map = new Map<string, ColumnSchema>();
    for (const col of inputColumns) {
      map.set(col.name, col);
    }
    return map;
  }, [inputColumns]);

  // Get current column actions from config
  const columnActions = useMemo(() => parseColumnActions(config), [config]);

  // Count aggregations per column (for badge display)
  const columnAggCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of columnActions) {
      counts.set(a.column, (counts.get(a.column) || 0) + 1);
    }
    return counts;
  }, [columnActions]);

  // Get valid actions for currently selected columns
  const validActions = useMemo(() => {
    const selectedCols = Array.from(selectedColumns)
      .map((name) => columnMap.get(name))
      .filter((col): col is ColumnSchema => col !== undefined);
    return getValidActions(selectedCols);
  }, [selectedColumns, columnMap]);

  // Toggle column selection in top panel
  const toggleColumnSelection = useCallback((columnName: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        next.delete(columnName);
      } else {
        next.add(columnName);
      }
      return next;
    });
  }, []);

  // Calculate selection state for header checkbox
  const allSelected =
    inputColumns.length > 0 && inputColumns.every((c) => selectedColumns.has(c.name));
  const someSelected = inputColumns.some((c) => selectedColumns.has(c.name));
  const isIndeterminate = someSelected && !allSelected;

  // Toggle all columns
  const toggleAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedColumns(new Set(inputColumns.map((c) => c.name)));
    } else {
      setSelectedColumns(new Set());
    }
  }, [inputColumns]);

  // Add selected columns with an action
  const addColumnsWithAction = useCallback(
    (action: string) => {
      const newActions = [...columnActions];

      for (const columnName of selectedColumns) {
        newActions.push({
          column: columnName,
          action,
          outputName: getDefaultOutputName(columnName, action),
        });
      }

      const { groupByColumns, aggregations } = columnActionsToConfig(newActions);

      const newConfig: ToolConfig = {
        ...config,
        groupByColumns,
        aggregations,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          groupByColumns: true,
          aggregations: true,
        },
      };
      onChange(newConfig);
      setSelectedColumns(new Set());
    },
    [columnActions, selectedColumns, config, onChange]
  );

  // Update an action in the bottom panel
  const updateAction = useCallback(
    (index: number, updates: Partial<ColumnAction>) => {
      const newActions = [...columnActions];
      const current = newActions[index];
      if (!current) return;

      // If action changed, update output name if it was the default
      if (updates.action && updates.action !== current.action) {
        const wasDefault = current.outputName === getDefaultOutputName(current.column, current.action);
        if (wasDefault) {
          updates.outputName = getDefaultOutputName(current.column, updates.action);
        }
      }

      newActions[index] = { ...current, ...updates };

      const { groupByColumns, aggregations } = columnActionsToConfig(newActions);

      const newConfig: ToolConfig = {
        ...config,
        groupByColumns,
        aggregations,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          groupByColumns: true,
          aggregations: true,
        },
      };
      onChange(newConfig);
    },
    [columnActions, config, onChange]
  );

  // Remove an action from the bottom panel
  const removeAction = useCallback(
    (index: number) => {
      const newActions = columnActions.filter((_: ColumnAction, i: number) => i !== index);
      const { groupByColumns, aggregations } = columnActionsToConfig(newActions);

      const newConfig: ToolConfig = {
        ...config,
        groupByColumns,
        aggregations,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          groupByColumns: true,
          aggregations: true,
        },
      };
      onChange(newConfig);
    },
    [columnActions, config, onChange]
  );

  // Get valid actions for a specific column (for the dropdown in actions table)
  const getActionsForColumn = useCallback(
    (columnName: string): ActionInfo[] => {
      const col = columnMap.get(columnName);
      if (!col) return ALL_ACTIONS;
      return getValidActions([col]);
    },
    [columnMap]
  );

  // Check if we have any input
  const hasInput = wireConnections.length > 0;

  // State for dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!hasInput) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4">
          <div className="p-4 text-center border border-dashed rounded border-theme-border-primary">
            <div className="text-sm text-theme-text-tertiary">
              Connect an input to configure summarize
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && inputColumns.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4">
          <div className="p-4 text-center">
            <div className="text-sm text-theme-text-tertiary">
              Loading schema...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Panel: Columns */}
      <div className="flex flex-col border-b border-theme-border-primary" style={{ height: "45%" }}>
        {/* Columns Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <span className="text-sm font-semibold text-theme-text-primary">Columns:</span>
        </div>

        {/* Columns Table Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <div className="grid grid-cols-[32px_1fr_100px] gap-2 text-xs font-semibold text-theme-text-secondary uppercase tracking-wide items-center">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onChange={(e) => toggleAll(e.target.checked)}
                className="w-4 h-4 rounded border-theme-border-primary bg-theme-surface-primary text-theme-interactive-accent focus:ring-theme-interactive-accent"
              />
            </div>
            <div>Column</div>
            <div>Type</div>
          </div>
        </div>

        {/* Columns List */}
        <div className="flex-1 overflow-y-auto">
          {inputColumns.length === 0 ? (
            <div className="p-4 text-sm text-center text-theme-text-tertiary">
              No columns available
            </div>
          ) : (
            <div className="divide-y divide-theme-border-primary">
              {inputColumns.map((col) => {
                const isSelected = selectedColumns.has(col.name);
                const aggCount = columnAggCounts.get(col.name) || 0;

                return (
                  <div
                    key={col.name}
                    onClick={() => toggleColumnSelection(col.name)}
                    className={clsx(
                      "px-4 py-2 grid grid-cols-[32px_1fr_100px] gap-2 items-center cursor-pointer",
                      isSelected && "bg-theme-interactive-accent/20",
                      !isSelected && "hover:bg-theme-surface-hover"
                    )}
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleColumnSelection(col.name)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-theme-border-primary bg-theme-surface-primary text-theme-interactive-accent focus:ring-theme-interactive-accent"
                      />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={clsx(
                          "text-sm truncate",
                          isSelected ? "text-theme-text-primary font-medium" : "text-theme-text-secondary"
                        )}
                      >
                        {col.name}
                      </span>
                      {aggCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-theme-interactive-accent/30 text-theme-interactive-accent">
                          {aggCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-theme-text-tertiary">
                      {col.dtype}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Middle: Add Actions Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
        <span className="text-xs text-theme-text-tertiary">
          {selectedColumns.size > 0
            ? `${selectedColumns.size} column${selectedColumns.size > 1 ? "s" : ""} selected`
            : "Select columns above to add"}
        </span>
        
        {/* Add Dropdown */}
        {validActions.length > 0 && selectedColumns.size > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded border flex items-center gap-1",
                "bg-theme-surface-panel text-theme-text-primary border-theme-border-primary",
                "hover:bg-theme-surface-hover hover:border-theme-text-secondary",
                "focus:outline-none focus:ring-1 focus:ring-theme-text-secondary"
              )}
            >
              Add
              <svg 
                className={clsx("w-3 h-3 transition-transform", isDropdownOpen && "rotate-180")} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isDropdownOpen && (
              <div className="absolute left-0 z-50 w-40 py-1 mt-1 border rounded shadow-lg bg-theme-surface-panel border-theme-border-primary">
                {validActions.map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    onClick={() => {
                      addColumnsWithAction(action.value);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-theme-text-primary hover:bg-theme-surface-hover cursor-pointer"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Panel: Actions */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Actions Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <span className="text-sm font-semibold text-theme-text-primary">Actions:</span>
        </div>

        {/* Actions Table Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_24px] gap-2 text-xs font-semibold text-theme-text-secondary uppercase tracking-wide items-center">
            <div>Column</div>
            <div>Action</div>
            <div>Output Name</div>
            <div></div>
          </div>
        </div>

        {/* Actions List */}
        <div className="flex-1 overflow-y-auto">
          {columnActions.length === 0 ? (
            <div className="p-4 text-sm text-center text-theme-text-tertiary">
              No actions configured. Select columns above and add them.
            </div>
          ) : (
            <div className="divide-y divide-theme-border-primary">
              {columnActions.map((action: ColumnAction, index: number) => {
                const availableActions = getActionsForColumn(action.column);

                  return (
                  <div
                    key={`${action.column}-${index}`}
                    className="px-4 py-2 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_24px] gap-2 items-center hover:bg-theme-surface-hover"
                  >
                    {/* Column Name */}
                    <div className="text-sm truncate text-theme-text-primary" title={action.column}>
                      {action.column}
                    </div>

                    {/* Action Dropdown */}
                    <select
                      value={action.action}
                      onChange={(e) =>
                        updateAction(index, { action: e.target.value })
                      }
                      className={clsx(
                        "w-full px-2 py-1 text-xs rounded border appearance-none",
                        "bg-theme-surface-panel border-theme-border-primary",
                        "text-theme-text-primary",
                        "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent"
                      )}
                    >
                      {availableActions.map((a: ActionInfo) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>

                    {/* Output Name Input */}
                    <input
                      type="text"
                      value={action.outputName}
                      onChange={(e) =>
                        updateAction(index, { outputName: e.target.value })
                      }
                      className={clsx(
                        "w-full px-2 py-1 text-xs rounded border",
                        "bg-theme-surface-panel border-theme-border-primary",
                        "text-theme-text-primary",
                        "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent"
                      )}
                    />

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="p-1 text-xs text-theme-text-tertiary hover:text-red-400 flex justify-center"
                      title="Remove"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
