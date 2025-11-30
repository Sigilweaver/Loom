import { useCallback, useEffect, useMemo, useState } from "react";
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
 * Field action configuration (for the bottom panel)
 */
interface FieldAction {
  field: string;
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
 * Generate default output name for a field + action
 */
function getDefaultOutputName(field: string, action: string): string {
  if (action === "GroupBy") return field;
  return `${action}_${field}`;
}

/**
 * Parse field actions from config
 */
function parseFieldActions(config: ToolConfig): FieldAction[] {
  const actions: FieldAction[] = [];

  // Parse groupByFields
  const groupByFields = Array.isArray(config.groupByFields) ? config.groupByFields : [];
  for (const field of groupByFields) {
    if (typeof field === "string") {
      actions.push({ field, action: "GroupBy", outputName: field });
    }
  }

  // Parse aggregations
  const aggregations = Array.isArray(config.aggregations) ? config.aggregations : [];
  for (const agg of aggregations) {
    if (typeof agg === "object" && agg !== null) {
      const field = typeof agg.field === "string" ? agg.field : "";
      const operation = typeof agg.operation === "string" ? agg.operation : "Sum";
      const outputName = typeof agg.outputName === "string" && agg.outputName
        ? agg.outputName
        : getDefaultOutputName(field, operation);
      if (field) {
        actions.push({ field, action: operation, outputName });
      }
    }
  }

  return actions;
}

/**
 * Convert field actions back to config format
 */
function fieldActionsToConfig(actions: FieldAction[]): { groupByFields: string[]; aggregations: Array<{ field: string; operation: string; outputName: string }> } {
  const groupByFields: string[] = [];
  const aggregations: Array<{ field: string; operation: string; outputName: string }> = [];

  for (const action of actions) {
    if (action.action === "GroupBy") {
      groupByFields.push(action.field);
    } else {
      aggregations.push({
        field: action.field,
        operation: action.action,
        outputName: action.outputName,
      });
    }
  }

  return { groupByFields, aggregations };
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
  const { metadata, fetchMetadata, loading } = useMetadata();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

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
    fetchMetadata(toolId, JSON.parse(workflow));
  }, [toolId, wireConnections, fetchMetadata]);

  // Get input columns from metadata
  const inputColumns: ColumnSchema[] = metadata?.columns || [];

  // Create column lookup by name
  const columnMap = useMemo(() => {
    const map = new Map<string, ColumnSchema>();
    for (const col of inputColumns) {
      map.set(col.name, col);
    }
    return map;
  }, [inputColumns]);

  // Get current field actions from config
  const fieldActions = useMemo(() => parseFieldActions(config), [config]);

  // Get fields already in the actions table
  const usedFields = useMemo(() => {
    return new Set(fieldActions.map((a) => a.field));
  }, [fieldActions]);

  // Get valid actions for currently selected fields
  const validActions = useMemo(() => {
    const selectedCols = Array.from(selectedFields)
      .map((name) => columnMap.get(name))
      .filter((col): col is ColumnSchema => col !== undefined);
    return getValidActions(selectedCols);
  }, [selectedFields, columnMap]);

  // Toggle field selection in top panel
  const toggleFieldSelection = useCallback((fieldName: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  }, []);

  // Select all fields
  const selectAllFields = useCallback(() => {
    setSelectedFields(new Set(inputColumns.map((c) => c.name)));
  }, [inputColumns]);

  // Deselect all fields
  const deselectAllFields = useCallback(() => {
    setSelectedFields(new Set());
  }, []);

  // Add selected fields with an action
  const addFieldsWithAction = useCallback(
    (action: string) => {
      const newActions = [...fieldActions];

      for (const fieldName of selectedFields) {
        // Skip if already in actions
        if (usedFields.has(fieldName)) continue;

        newActions.push({
          field: fieldName,
          action,
          outputName: getDefaultOutputName(fieldName, action),
        });
      }

      const { groupByFields, aggregations } = fieldActionsToConfig(newActions);

      const newConfig: ToolConfig = {
        ...config,
        groupByFields,
        aggregations,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          groupByFields: true,
          aggregations: true,
        },
      };
      onChange(newConfig);
      setSelectedFields(new Set());
    },
    [fieldActions, selectedFields, usedFields, config, onChange]
  );

  // Update an action in the bottom panel
  const updateAction = useCallback(
    (index: number, updates: Partial<FieldAction>) => {
      const newActions = [...fieldActions];
      const current = newActions[index];
      if (!current) return;

      // If action changed, update output name if it was the default
      if (updates.action && updates.action !== current.action) {
        const wasDefault = current.outputName === getDefaultOutputName(current.field, current.action);
        if (wasDefault) {
          updates.outputName = getDefaultOutputName(current.field, updates.action);
        }
      }

      newActions[index] = { ...current, ...updates };

      const { groupByFields, aggregations } = fieldActionsToConfig(newActions);

      const newConfig: ToolConfig = {
        ...config,
        groupByFields,
        aggregations,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          groupByFields: true,
          aggregations: true,
        },
      };
      onChange(newConfig);
    },
    [fieldActions, config, onChange]
  );

  // Remove an action from the bottom panel
  const removeAction = useCallback(
    (index: number) => {
      const newActions = fieldActions.filter((_, i) => i !== index);
      const { groupByFields, aggregations } = fieldActionsToConfig(newActions);

      const newConfig: ToolConfig = {
        ...config,
        groupByFields,
        aggregations,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          groupByFields: true,
          aggregations: true,
        },
      };
      onChange(newConfig);
    },
    [fieldActions, config, onChange]
  );

  // Get valid actions for a specific field (for the dropdown in actions table)
  const getActionsForField = useCallback(
    (fieldName: string): ActionInfo[] => {
      const col = columnMap.get(fieldName);
      if (!col) return ALL_ACTIONS;
      return getValidActions([col]);
    },
    [columnMap]
  );

  // Check if we have any input
  const hasInput = wireConnections.length > 0;

  // Count selected fields that are not yet in actions
  const addableCount = Array.from(selectedFields).filter(
    (f) => !usedFields.has(f)
  ).length;

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
      {/* Top Panel: Fields */}
      <div className="flex flex-col border-b border-theme-border-primary" style={{ height: "45%" }}>
        {/* Fields Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <span className="text-sm font-semibold text-theme-text-primary">Fields:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllFields}
              className="px-2 py-0.5 text-xs border rounded border-theme-border-primary hover:bg-theme-surface-hover text-theme-text-secondary"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAllFields}
              className="px-2 py-0.5 text-xs border rounded border-theme-border-primary hover:bg-theme-surface-hover text-theme-text-secondary"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Fields Table Header */}
        <div className="px-4 py-1 border-b border-theme-border-primary bg-theme-surface-panel">
          <div className="grid grid-cols-[1fr_100px] gap-2 text-xs font-medium text-theme-text-secondary">
            <div>Field</div>
            <div>Type</div>
          </div>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto">
          {inputColumns.length === 0 ? (
            <div className="p-4 text-sm text-center text-theme-text-tertiary">
              No columns available
            </div>
          ) : (
            <div className="divide-y divide-theme-border-primary">
              {inputColumns.map((col) => {
                const isSelected = selectedFields.has(col.name);
                const isUsed = usedFields.has(col.name);

                return (
                  <div
                    key={col.name}
                    onClick={() => toggleFieldSelection(col.name)}
                    className={clsx(
                      "px-4 py-1.5 grid grid-cols-[1fr_100px] gap-2 items-center cursor-pointer",
                      isSelected && "bg-theme-interactive-accent/20",
                      isUsed && "opacity-50",
                      !isSelected && !isUsed && "hover:bg-theme-surface-hover"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={clsx(
                          "text-sm truncate",
                          isSelected ? "text-theme-text-primary font-medium" : "text-theme-text-secondary"
                        )}
                      >
                        {col.name}
                      </span>
                      {isUsed && (
                        <span className="text-xs text-theme-text-disabled">(added)</span>
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
          {addableCount > 0
            ? `Add ${addableCount} field${addableCount > 1 ? "s" : ""} as:`
            : "Select fields above to add"}
        </span>
        <div className="flex flex-wrap gap-1">
          {validActions.length > 0 && addableCount > 0 ? (
            validActions.map((action) => (
              <button
                key={action.value}
                type="button"
                onClick={() => addFieldsWithAction(action.value)}
                className="px-2 py-0.5 text-xs border rounded border-theme-border-primary hover:bg-theme-surface-hover text-theme-text-secondary hover:text-theme-text-primary"
              >
                {action.label}
              </button>
            ))
          ) : addableCount === 0 && selectedFields.size > 0 ? (
            <span className="text-xs text-theme-text-disabled">
              Selected fields already added
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom Panel: Actions */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Actions Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <span className="text-sm font-semibold text-theme-text-primary">Actions:</span>
        </div>

        {/* Actions Table Header */}
        <div className="px-4 py-1 border-b border-theme-border-primary bg-theme-surface-panel">
          <div className="grid grid-cols-[1fr_120px_1fr_24px] gap-2 text-xs font-medium text-theme-text-secondary">
            <div>Field</div>
            <div>Action</div>
            <div>Output Field Name</div>
            <div></div>
          </div>
        </div>

        {/* Actions List */}
        <div className="flex-1 overflow-y-auto">
          {fieldActions.length === 0 ? (
            <div className="p-4 text-sm text-center text-theme-text-tertiary">
              No actions configured. Select fields above and add them.
            </div>
          ) : (
            <div className="divide-y divide-theme-border-primary">
              {fieldActions.map((action, index) => {
                const availableActions = getActionsForField(action.field);

                  return (
                  <div
                    key={`${action.field}-${index}`}
                    className="px-4 py-1.5 grid grid-cols-[1fr_120px_1fr_24px] gap-2 items-center hover:bg-theme-surface-hover"
                  >
                    {/* Field Name */}
                    <div className="text-sm truncate text-theme-text-primary">
                      {action.field}
                    </div>

                    {/* Action Dropdown */}
                    <select
                      value={action.action}
                      onChange={(e) =>
                        updateAction(index, { action: e.target.value })
                      }
                      className={clsx(
                        "px-2 py-1 text-xs rounded border appearance-none",
                        "bg-theme-surface-panel border-theme-border-primary",
                        "text-theme-text-primary",
                        "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent"
                      )}
                    >
                      {availableActions.map((a) => (
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
                        "px-2 py-1 text-xs rounded border",
                        "bg-theme-surface-panel border-theme-border-primary",
                        "text-theme-text-primary",
                        "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent"
                      )}
                    />

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="p-1 text-xs text-theme-text-tertiary hover:text-red-400"
                      title="Remove"
                    >
                      X
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
