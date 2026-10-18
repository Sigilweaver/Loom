import { useCallback, useMemo, useState } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { useToolConfiguration } from "@hooks/useToolConfiguration";
import { ColumnSchema } from "@api/backend";
import clsx from "clsx";
import { isNumericPolarsType } from "@data/polarsTypes";
import { CommonSockets } from "@domain/workflow/constants/socketIds";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@components/ui/DropdownMenu";
import { ChevronDown } from "lucide-react";
import {
  ConfigColumnSelector,
  ColumnSelectorItemHandlers,
} from "@components/primitives";

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
  {
    value: "CountDistinct",
    label: "Count Distinct",
    numericOnly: false,
    stringOnly: false,
  },
  { value: "First", label: "First", numericOnly: false, stringOnly: false },
  { value: "Last", label: "Last", numericOnly: false, stringOnly: false },
  { value: "Std", label: "Std Dev", numericOnly: true, stringOnly: false },
  { value: "Var", label: "Variance", numericOnly: true, stringOnly: false },
  { value: "Concat", label: "Concat", numericOnly: false, stringOnly: true },
];

/**
 * Check if a dtype is string-like
 */
function isStringDtype(dtype: string): boolean {
  return dtype === "String" || dtype === "Utf8";
}

/**
 * Get valid actions for a column type
 */
function getValidActionsForDtype(dtype: string): ActionInfo[] {
  const isNumeric = isNumericPolarsType(dtype);
  const isString = isStringDtype(dtype);

  return ALL_ACTIONS.filter((action) => {
    if (action.numericOnly && !isNumeric) return false;
    if (action.stringOnly && !isString) return false;
    if (action.value === "Concat" && isNumeric) return false;
    return true;
  });
}

/**
 * Get valid actions for multiple column types (intersection)
 */
function getValidActionsForColumns(columns: ColumnSchema[]): ActionInfo[] {
  if (columns.length === 0) return [];

  const allNumeric = columns.every((c) => isNumericPolarsType(c.dtype || ""));
  const allString = columns.every((c) => isStringDtype(c.dtype || ""));
  const anyNumeric = columns.some((c) => isNumericPolarsType(c.dtype || ""));

  return ALL_ACTIONS.filter((action) => {
    if (action.numericOnly && !allNumeric) return false;
    if (action.stringOnly && !allString) return false;
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
 * Generate a unique ID for a new action
 */
let actionIdCounter = 0;
function generateActionId(): string {
  return `action-${Date.now()}-${actionIdCounter++}`;
}

/**
 * Column action stored in config
 */
interface ColumnAction {
  _id: string; // Stable unique ID for UI tracking
  column: string;
  action: string;
  outputName: string;
}

/**
 * Unified action stored in config.actions array
 */
interface ConfigAction {
  _id: string;
  column: string;
  action: string; // "GroupBy" or aggregation operation
  outputName: string;
}

/**
 * Parse column actions from config.
 * Reads from unified `actions` array if present, otherwise falls back to legacy format.
 */
function parseColumnActions(config: ToolConfig): ColumnAction[] {
  // New format: unified actions array that preserves order
  const configActions = config.actions;
  if (Array.isArray(configActions) && configActions.length > 0) {
    const actions: ColumnAction[] = [];
    for (const item of configActions) {
      if (typeof item === "object" && item !== null) {
        const configAction = item as Partial<ConfigAction>;
        const _id = typeof configAction._id === "string" ? configAction._id : generateActionId();
        const column = typeof configAction.column === "string" ? configAction.column : "";
        const action = typeof configAction.action === "string" ? configAction.action : "Sum";
        const outputName = typeof configAction.outputName === "string" ? configAction.outputName : getDefaultOutputName(column, action);
        if (column) {
          actions.push({ _id, column, action, outputName });
        }
      }
    }
    return actions;
  }

  // Legacy format: separate groupByColumns and aggregations arrays
  const actions: ColumnAction[] = [];

  const groupByColumns = Array.isArray(config.groupByColumns)
    ? config.groupByColumns
    : [];
  for (const col of groupByColumns) {
    if (typeof col === "string") {
      actions.push({ _id: generateActionId(), column: col, action: "GroupBy", outputName: col });
    } else if (typeof col === "object" && col !== null) {
      const colObj = col as { _id?: string; column?: string };
      const column = typeof colObj.column === "string" ? colObj.column : "";
      const _id = typeof colObj._id === "string" ? colObj._id : generateActionId();
      if (column) {
        actions.push({ _id, column, action: "GroupBy", outputName: column });
      }
    }
  }

  const aggregations = Array.isArray(config.aggregations)
    ? config.aggregations
    : [];
  for (const agg of aggregations) {
    if (typeof agg === "object" && agg !== null) {
      const column = typeof agg.column === "string" ? agg.column : "";
      const operation =
        typeof agg.operation === "string" ? agg.operation : "Sum";
      const outputName =
        typeof agg.outputName === "string" && agg.outputName
          ? agg.outputName
          : getDefaultOutputName(column, operation);
      const _id = typeof agg._id === "string" ? agg._id : generateActionId();
      if (column) {
        actions.push({ _id, column, action: operation, outputName });
      }
    }
  }

  return actions;
}

/**
 * Convert column actions back to config format.
 * Returns unified `actions` array (preserves order) plus derived `groupByColumns` and `aggregations` (for backend).
 */
function columnActionsToConfig(actions: ColumnAction[]): {
  actions: ConfigAction[];
  groupByColumns: Array<{ _id: string; column: string }>;
  aggregations: Array<{ _id: string; column: string; operation: string; outputName: string }>;
} {
  // Unified actions array preserving order
  const configActions: ConfigAction[] = actions.map((a) => ({
    _id: a._id,
    column: a.column,
    action: a.action,
    outputName: a.outputName,
  }));

  // Derived arrays for backend compatibility
  const groupByColumns: Array<{ _id: string; column: string }> = [];
  const aggregations: Array<{
    _id: string;
    column: string;
    operation: string;
    outputName: string;
  }> = [];

  for (const action of actions) {
    if (action.action === "GroupBy") {
      groupByColumns.push({ _id: action._id, column: action.column });
    } else {
      aggregations.push({
        _id: action._id,
        column: action.column,
        operation: action.action,
        outputName: action.outputName,
      });
    }
  }

  return { actions: configActions, groupByColumns, aggregations };
}

/**
 * Item type for top panel ConfigColumnSelector (source columns).
 */
interface ColumnItem {
  id: string;
  name: string;
  dtype: string;
  aggCount: number; // Number of aggregations on this column
  [key: string]: unknown;
}

/**
 * Item type for bottom panel ConfigColumnSelector (actions).
 */
interface ActionItem {
  id: string;
  _id: string; // The stable unique ID from the config
  column: string;
  action: string;
  outputName: string;
  dtype: string;
  availableActions: ActionInfo[];
  [key: string]: unknown;
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
  const { columns, loading, hasInput } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  // Track selected columns from the top panel
  const [selectedColumns, setSelectedColumns] = useState<ColumnItem[]>([]);

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

  // Build items for top panel (source columns)
  const columnItems = useMemo((): ColumnItem[] => {
    return inputColumns.map((col) => ({
      id: col.name,
      name: col.name,
      dtype: col.dtype || "Unknown",
      aggCount: columnAggCounts.get(col.name) || 0,
    }));
  }, [inputColumns, columnAggCounts]);

  // Build items for bottom panel (actions)
  // Use the stable _id from config for the selector's id, ensuring IDs persist across reorders
  const actionItems = useMemo((): ActionItem[] => {
    return columnActions.map((action) => {
      const col = columnMap.get(action.column);
      const dtype = col?.dtype || "Unknown";
      
      return {
        id: action._id, // Use the stable _id from config
        _id: action._id,
        column: action.column,
        action: action.action,
        outputName: action.outputName,
        dtype,
        availableActions: getValidActionsForDtype(dtype),
      };
    });
  }, [columnActions, columnMap]);

  // Helper to save config
  const saveConfig = useCallback(
    (actions: ColumnAction[]) => {
      const { actions: configActions, groupByColumns, aggregations } = columnActionsToConfig(actions);
      const newConfig: ToolConfig = {
        ...config,
        actions: configActions as unknown as ToolConfig["actions"],
        groupByColumns,
        aggregations,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          actions: true,
          groupByColumns: true,
          aggregations: true,
        },
      };
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Track selected actions from the bottom panel
  const [selectedActions, setSelectedActions] = useState<ActionItem[]>([]);

  // Handle action selection change from bottom panel
  const handleActionSelectionChange = useCallback((items: ActionItem[]) => {
    setSelectedActions(items);
  }, []);

  // Remove selected actions
  const removeSelectedActions = useCallback(() => {
    if (selectedActions.length === 0) return;
    const selectedIds = new Set(selectedActions.map((a) => a._id));
    const newActions = columnActions.filter((a) => !selectedIds.has(a._id));
    saveConfig(newActions);
    setSelectedActions([]);
  }, [selectedActions, columnActions, saveConfig]);

  // Add columns with a specific action (called from dropdown)
  const addColumnsWithAction = useCallback(
    (columnNames: string[], action: string) => {
      const newActions = [...columnActions];
      for (const columnName of columnNames) {
        newActions.push({
          _id: generateActionId(),
          column: columnName,
          action,
          outputName: getDefaultOutputName(columnName, action),
        });
      }
      saveConfig(newActions);
    },
    [columnActions, saveConfig]
  );

  // Update an action by index
  const updateAction = useCallback(
    (index: number, updates: Partial<ColumnAction>) => {
      const newActions = [...columnActions];
      const current = newActions[index];
      if (!current) return;

      // If action changed, update output name if it was the default
      if (updates.action && updates.action !== current.action) {
        const wasDefault =
          current.outputName ===
          getDefaultOutputName(current.column, current.action);
        if (wasDefault) {
          updates.outputName = getDefaultOutputName(
            current.column,
            updates.action
          );
        }
      }

      newActions[index] = { ...current, ...updates };
      saveConfig(newActions);
    },
    [columnActions, saveConfig]
  );

  // Handle reorder of actions from ConfigColumnSelector
  const handleActionsReorder = useCallback(
    (items: ActionItem[]) => {
      const newActions: ColumnAction[] = items.map((item) => ({
        _id: item._id,
        column: item.column,
        action: item.action,
        outputName: item.outputName,
      }));
      saveConfig(newActions);
    },
    [saveConfig]
  );

  // Handle reorder of columns - this is a no-op for columns
  // ConfigColumnSelector requires onReorder but we don't persist column order
  const handleColumnsReorder = useCallback((_items: ColumnItem[]) => {
    // Columns are always shown in schema order, not persisted
  }, []);

  // Handle column selection change from top panel
  const handleColumnSelectionChange = useCallback((items: ColumnItem[]) => {
    setSelectedColumns(items);
  }, []);

  // Get valid actions for the selected columns
  const validActionsForSelected = useMemo(() => {
    if (selectedColumns.length === 0) return [];
    const selectedColSchemas = selectedColumns
      .map((item) => columnMap.get(item.name))
      .filter((col): col is ColumnSchema => col !== undefined);
    return getValidActionsForColumns(selectedColSchemas);
  }, [selectedColumns, columnMap]);

  // Render a column row in the top panel
  const renderColumnItem = useCallback(
    (item: ColumnItem, handlers: ColumnSelectorItemHandlers) => {
      return (
        <div className="flex items-center w-full gap-3">
          {/* Column name */}
          <div className="flex items-center flex-1 min-w-0 gap-2">
            <span
              className={clsx(
                "text-sm whitespace-nowrap",
                handlers.isSelected
                  ? "text-theme-text-primary font-medium"
                  : "text-theme-text-secondary"
              )}
            >
              {item.name}
            </span>
            {item.aggCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full text-theme-interactive-accent whitespace-nowrap">
                {item.aggCount}
              </span>
            )}
          </div>

          {/* Type */}
          <div className="flex-shrink-0 w-20 text-xs text-theme-text-tertiary">
            {item.dtype}
          </div>
        </div>
      );
    },
    []
  );

  // Render an action row in the bottom panel
  const renderActionItem = useCallback(
    (item: ActionItem, _handlers: ColumnSelectorItemHandlers) => {
      // Find the index in columnActions by matching the stable _id
      const index = columnActions.findIndex((a) => a._id === item._id);

      return (
        <div className="flex items-center w-full gap-3">
          {/* Column name */}
          <div className="flex-1 min-w-0">
            <span className="text-sm text-theme-text-primary whitespace-nowrap">
              {item.column}
            </span>
          </div>

          {/* Action dropdown */}
          <div className="flex-shrink-0 w-32">
            <select
              value={item.action}
              onChange={(e) => {
                e.stopPropagation();
                updateAction(index, { action: e.target.value });
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className={clsx(
                "w-full px-2 py-1 text-xs rounded border appearance-none cursor-pointer",
                "bg-theme-surface-panel border-theme-border-primary",
                "text-theme-text-primary",
                "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent"
              )}
            >
              {item.availableActions.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Output name input */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={item.outputName}
              onChange={(e) => {
                updateAction(index, { outputName: e.target.value });
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className={clsx(
                "w-full px-2 py-1 text-xs rounded border",
                "bg-theme-surface-panel border-theme-border-primary",
                "text-theme-text-primary",
                "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent"
              )}
            />
          </div>
        </div>
      );
    },
    [columnActions, updateAction]
  );

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
      {/* Top Panel: Source Columns */}
      <div
        className="flex flex-col border-b border-theme-border-primary"
        style={{ height: "45%" }}
      >
        {/* Column Table Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
            <div className="flex-1">Column</div>
            <div className="flex-shrink-0 w-20">Type</div>
          </div>
        </div>

        <ConfigColumnSelector<ColumnItem>
          items={columnItems}
          onReorder={handleColumnsReorder}
          onSelectionChange={handleColumnSelectionChange}
          itemRenderer={renderColumnItem}
          emptyMessage="No columns available"
          showReorderButtons={false}
          className="flex-1 min-h-0"
        />
      </div>

      {/* Middle Bar: Add Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
        <span className="text-xs text-theme-text-tertiary">
          {selectedColumns.length > 0
            ? `${selectedColumns.length} column${selectedColumns.length > 1 ? "s" : ""} selected`
            : "Select columns above, then add an action"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={selectedColumns.length === 0}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded border flex items-center gap-1",
                "bg-theme-surface-panel text-theme-text-primary border-theme-border-primary",
                "hover:bg-theme-surface-hover hover:border-theme-text-secondary",
                "focus:outline-none focus:ring-1 focus:ring-theme-text-secondary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Add
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {validActionsForSelected.map((action) => (
              <DropdownMenuItem
                key={action.value}
                onSelect={() => {
                  const columnNames = selectedColumns.map((c) => c.name);
                  addColumnsWithAction(columnNames, action.value);
                }}
                className="text-xs"
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bottom Panel: Actions */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Actions Table Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
            <div className="flex-1">Column</div>
            <div className="flex-shrink-0 w-32">Action</div>
            <div className="flex-1">Output Name</div>
          </div>
        </div>

        <ConfigColumnSelector<ActionItem>
          items={actionItems}
          onReorder={handleActionsReorder}
          onSelectionChange={handleActionSelectionChange}
          itemRenderer={renderActionItem}
          emptyMessage="No actions configured. Select columns above and click Add."
          showReorderButtons={actionItems.length > 1}
          showDeleteButton
          onDelete={removeSelectedActions}
          className="flex-1 min-h-0"
        />
      </div>
    </div>
  );
}
