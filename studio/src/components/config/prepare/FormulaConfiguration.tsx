import { useEffect, useMemo, useCallback, useState } from "react";
import { ToolConfig, EmissionMap, Tool, Wire, WorkflowMeta } from "@domain/workflow/entities/workflow";
import { CodeEditor } from "@components/common/CodeEditor";
import { usePolarsFunctions } from "@api/hooks";
import { useToolConfiguration } from "@hooks/useToolConfiguration";
import { EXPRESSION_DOCS_URL } from "@data/tools";
import { CommonSockets } from "@domain/workflow/constants/socketIds";
import { Plus, X, ChevronDown, ChevronRight, Copy, GripVertical } from "lucide-react";
import {
  FormulaOperationBuilder,
  type FormulaOperationConfig,
  createEmptyOperation,
} from "./FormulaOperationBuilder";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

/**
 * New config format (multi-operation):
 * {
 *   operations: FormulaOperationConfig[],   // the full GUI state
 *   _emit: EmissionMap,
 * }
 *
 * Legacy config (single operation):
 * {
 *   expression: string,
 *   column_name: string,
 *   _emit: EmissionMap,
 * }
 *
 * The config stored in the workflow file always includes the flat
 * `operations` array with `column_name` + `expression` per entry
 * (the server-side shape).  The GUI-specific fields (operationId,
 * params, mode, etc.) are stored alongside so re-opening the
 * workflow restores the full GUI state.
 */

// Sentinel value for the "create new column" dropdown option
const NEW_COLUMN_VALUE = "__new_column__";

/**
 * Build emission map for the new multi-operation config.
 */
function buildFormulaEmit(config: ToolConfig): EmissionMap {
  const emit: EmissionMap = { ...(config._emit as EmissionMap | undefined) };

  const ops = config.operations as FormulaOperationConfig[] | undefined;
  if (ops && ops.length > 0) {
    emit.operations = true;
  } else {
    delete emit.operations;
  }

  // Legacy fields — always emit if present for backward compat
  const expression = (config.expression as string) ?? "";
  const columnName = (config.column_name as string) ?? "";
  if (expression) emit.expression = true;
  else delete emit.expression;
  if (columnName) emit.column_name = true;
  else delete emit.column_name;

  return emit;
}

/**
 * Convert legacy single-operation config to the new format.
 */
function migrateLegacyConfig(config: ToolConfig): FormulaOperationConfig[] {
  const colName = (config.column_name as string) || "";
  const expr = (config.expression as string) || "";
  if (!colName && !expr) return [];

  return [
    {
      id: crypto.randomUUID(),
      operationId: "",
      sourceColumn: "",
      params: {},
      columnName: colName,
      columnNameEdited: true,
      mode: "advanced",
      expression: expr,
    },
  ];
}

/**
 * Resolve operations from config (handles legacy + new format).
 */
function resolveOperations(config: ToolConfig): FormulaOperationConfig[] {
  const ops = config.operations as FormulaOperationConfig[] | undefined;
  if (Array.isArray(ops) && ops.length > 0) {
    // Ensure all have IDs
    return ops.map((op) => ({
      ...op,
      id: op.id || crypto.randomUUID(),
    }));
  }
  return migrateLegacyConfig(config);
}

/**
 * Convert FormulaOperationConfig[] to the flat server format
 * that goes into config for serialization + execution.
 */
function operationsToServerConfig(
  ops: FormulaOperationConfig[]
): { column_name: string; expression: string }[] {
  return ops.map((op) => ({
    column_name: op.columnName || "",
    expression: op.expression || "",
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FormulaConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function FormulaConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: FormulaConfigurationProps) {
  // Unified configuration hook
  const { columns } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  // Polars functions for autocomplete
  const { functions, fetchFunctions } = usePolarsFunctions();
  useEffect(() => {
    if (!functions) fetchFunctions();
  }, [functions, fetchFunctions]);

  // Resolve operations from config
  const operations = useMemo(() => resolveOperations(config), [config]);

  // Track collapsed state per operation
  const [collapsedOps, setCollapsedOps] = useState<Set<string>>(new Set());

  // Drag state for reordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Persist operation changes
  const updateOperations = useCallback(
    (newOps: FormulaOperationConfig[]) => {
      // Build config with both GUI state and server-compatible flat format
      const newConfig: ToolConfig = {
        ...config,
        operations: newOps,
        // Server-compatible format: top-level operations array
        // The server reads config.operations[].column_name / .expression
      };

      // For backward compat: if single operation, also set top-level fields
      if (newOps.length === 1) {
        const serverOps = operationsToServerConfig(newOps);
        newConfig.column_name = serverOps[0]?.column_name ?? "";
        newConfig.expression = serverOps[0]?.expression ?? "";
      } else if (newOps.length > 1) {
        // Clear legacy fields for multi-op
        newConfig.column_name = "";
        newConfig.expression = "";
      }

      newConfig._emit = buildFormulaEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Add new operation
  const handleAddOperation = useCallback(() => {
    const newOp = createEmptyOperation(columns);
    const newOps = [...operations, newOp];
    updateOperations(newOps);
  }, [operations, columns, updateOperations]);

  // Remove operation
  const handleRemoveOperation = useCallback(
    (opId: string) => {
      const newOps = operations.filter((op) => op.id !== opId);
      updateOperations(newOps);
    },
    [operations, updateOperations]
  );

  // Update single operation
  const handleOperationChange = useCallback(
    (opId: string, updated: FormulaOperationConfig) => {
      // If in basic mode, regenerate expression from the builder
      const newOps = operations.map((op) => (op.id === opId ? updated : op));
      updateOperations(newOps);
    },
    [operations, updateOperations]
  );

  // Duplicate operation
  const handleDuplicateOperation = useCallback(
    (opId: string) => {
      const idx = operations.findIndex((op) => op.id === opId);
      if (idx === -1) return;
      const original = operations[idx]!;
      const dup: FormulaOperationConfig = {
        ...original,
        id: crypto.randomUUID(),
        columnName: original.columnName ? `${original.columnName}_copy` : "",
      };
      const newOps = [...operations];
      newOps.splice(idx + 1, 0, dup);
      updateOperations(newOps);
    },
    [operations, updateOperations]
  );

  // Toggle collapse
  const toggleCollapse = useCallback((opId: string) => {
    setCollapsedOps((prev) => {
      const next = new Set(prev);
      if (next.has(opId)) next.delete(opId);
      else next.add(opId);
      return next;
    });
  }, []);

  // Toggle mode per operation
  const handleModeToggle = useCallback(
    (opId: string, advanced: boolean) => {
      const op = operations.find((o) => o.id === opId);
      if (!op) return;

      const updated: FormulaOperationConfig = {
        ...op,
        mode: advanced ? "advanced" : "basic",
      };

      handleOperationChange(opId, updated);
    },
    [operations, handleOperationChange]
  );

  // Handle expression change in advanced mode
  const handleExpressionChange = useCallback(
    (opId: string, value: string) => {
      const op = operations.find((o) => o.id === opId);
      if (!op) return;
      handleOperationChange(opId, { ...op, expression: value });
    },
    [operations, handleOperationChange]
  );

  // Handle column name change in advanced mode
  const handleAdvancedColumnNameChange = useCallback(
    (opId: string, value: string) => {
      const op = operations.find((o) => o.id === opId);
      if (!op) return;
      handleOperationChange(opId, {
        ...op,
        columnName: value,
        columnNameEdited: true,
      });
    },
    [operations, handleOperationChange]
  );

  // Drag and drop reorder
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragIndex]
  );

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const newOps = [...operations];
      const [moved] = newOps.splice(dragIndex, 1);
      if (moved) {
        newOps.splice(dragOverIndex, 0, moved);
        updateOperations(newOps);
      }
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, operations, updateOperations]);

  // Build target column options for advanced mode dropdown
  const targetColumnOptions = useMemo(() => {
    const options = [
      {
        value: NEW_COLUMN_VALUE,
        label: "(New Column)",
      },
    ];
    for (const col of columns) {
      options.push({
        value: col.name,
        label: `${col.name} (replace)`,
      });
    }
    return options;
  }, [columns]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-theme-text-primary">
              Formula
            </h3>
            <p className="text-xs text-theme-text-tertiary mt-0.5">
              Create or transform columns with calculated expressions
            </p>
          </div>
        </div>

        {/* Operations List */}
        {operations.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-theme-text-tertiary mb-3">
              No operations defined yet
            </p>
            <button
              type="button"
              onClick={handleAddOperation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-dashed border-theme-interactive-accent text-theme-interactive-accent hover:bg-theme-interactive-accent/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add operation
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {operations.map((op, index) => {
              const isCollapsed = collapsedOps.has(op.id);
              const isAdvanced = op.mode === "advanced";
              const isDragOver = dragOverIndex === index;
              const isTargetNewColumn =
                !columns.some((c) => c.name === op.columnName);

              return (
                <div
                  key={op.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`rounded border transition-colors ${
                    isDragOver
                      ? "border-theme-interactive-accent bg-theme-interactive-accent/5"
                      : "border-theme-border-secondary"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-theme-surface-elevated/50 rounded-t border-b border-theme-border-secondary">
                    {/* Drag handle */}
                    {operations.length > 1 && (
                      <div className="cursor-grab text-theme-text-tertiary hover:text-theme-text-secondary">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                    )}

                    {/* Collapse toggle */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(op.id)}
                      className="text-theme-text-tertiary hover:text-theme-text-primary transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Position badge */}
                    <span className="text-[10px] font-mono font-bold text-theme-text-tertiary min-w-[16px]">
                      {index + 1}
                    </span>

                    {/* Summary */}
                    <span className="flex-1 text-xs text-theme-text-primary truncate">
                      {op.columnName || (
                        <span className="text-theme-text-tertiary italic">
                          untitled
                        </span>
                      )}
                    </span>

                    {/* Mode toggle */}
                    <button
                      type="button"
                      onClick={() => handleModeToggle(op.id, !isAdvanced)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        isAdvanced
                          ? "bg-theme-interactive-accent/15 text-theme-interactive-accent"
                          : "bg-theme-surface-elevated text-theme-text-tertiary hover:text-theme-text-secondary"
                      }`}
                      title={isAdvanced ? "Switch to basic mode" : "Switch to advanced mode"}
                    >
                      {isAdvanced ? "Advanced" : "Basic"}
                    </button>

                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={() => handleDuplicateOperation(op.id)}
                      className="h-6 w-6 flex items-center justify-center rounded text-theme-text-tertiary hover:text-theme-text-secondary hover:bg-theme-bg-hover transition-colors"
                      title="Duplicate operation"
                    >
                      <Copy className="h-3 w-3" />
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveOperation(op.id)}
                      className="h-6 w-6 flex items-center justify-center rounded text-theme-text-tertiary hover:text-theme-status-error-text hover:bg-theme-bg-hover transition-colors"
                      title="Remove operation"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Card Body */}
                  {!isCollapsed && (
                    <div className="p-2.5">
                      {isAdvanced ? (
                        /* === Advanced Mode === */
                        <div className="space-y-2.5">
                          {/* Target Column */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-theme-text-secondary">
                              Target Column
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={
                                  isTargetNewColumn
                                    ? NEW_COLUMN_VALUE
                                    : op.columnName
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  handleAdvancedColumnNameChange(
                                    op.id,
                                    v === NEW_COLUMN_VALUE ? "" : v
                                  );
                                }}
                                className="flex-1 h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                              >
                                {targetColumnOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {isTargetNewColumn && (
                                <input
                                  type="text"
                                  value={op.columnName}
                                  onChange={(e) =>
                                    handleAdvancedColumnNameChange(
                                      op.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder="column name"
                                  className="flex-1 h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary placeholder:text-theme-text-tertiary"
                                />
                              )}
                            </div>
                          </div>

                          {/* Expression Editor */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-theme-text-secondary">
                              Expression
                              <span className="text-theme-error ml-1">*</span>
                            </label>
                            <div className="border border-theme-border rounded overflow-hidden">
                              <CodeEditor
                                value={op.expression}
                                onChange={(v) =>
                                  handleExpressionChange(op.id, v)
                                }
                                language="python"
                                height="120px"
                                placeholder="pl.col('amount') * 1.1"
                                columns={columns}
                                polarsFunctions={functions}
                                docsUrl={EXPRESSION_DOCS_URL}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* === Basic Mode === */
                        <FormulaOperationBuilder
                          operation={op}
                          columns={columns}
                          onChange={(updated) =>
                            handleOperationChange(op.id, updated)
                          }
                          index={index}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Operation Button */}
        {operations.length > 0 && (
          <button
            type="button"
            onClick={handleAddOperation}
            className="flex items-center gap-1 text-xs font-medium text-theme-interactive-accent hover:text-theme-interactive-accent-hover transition-colors py-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add operation
          </button>
        )}

      </div>
    </div>
  );
}
