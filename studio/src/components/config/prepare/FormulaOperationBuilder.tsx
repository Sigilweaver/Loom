/**
 * FormulaOperationBuilder
 *
 * GUI builder for a single formula operation.
 * Renders source column picker, operation dropdown (type-aware),
 * and dynamic parameter inputs for the selected operation.
 */

import { useMemo, useCallback } from "react";
import type { ColumnSchema } from "@api/backend";
import {
  type OperationDef,
  OPERATIONS_BY_ID,
  getOperationsGroupedForDtype,
  getTypeCategory,
} from "./formulaOperations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormulaOperationConfig {
  id: string;
  /** Basic mode: GUI-selected operation id (e.g., "multiply") */
  operationId: string;
  /** Source column name */
  sourceColumn: string;
  /** Operation-specific parameter values */
  params: Record<string, string>;
  /** Output column name */
  columnName: string;
  /** Whether the user has manually edited the column name */
  columnNameEdited: boolean;
  /** "basic" | "advanced" */
  mode: "basic" | "advanced";
  /** Raw expression for advanced mode */
  expression: string;
}

export function createEmptyOperation(columns: ColumnSchema[]): FormulaOperationConfig {
  const firstCol = columns[0];
  return {
    id: crypto.randomUUID(),
    operationId: "",
    sourceColumn: firstCol?.name ?? "",
    params: {},
    columnName: "",
    columnNameEdited: false,
    mode: "basic",
    expression: "",
  };
}

interface FormulaOperationBuilderProps {
  operation: FormulaOperationConfig;
  columns: ColumnSchema[];
  onChange: (updated: FormulaOperationConfig) => void;
  index: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormulaOperationBuilder({
  operation,
  columns,
  onChange,
  index: _index,
}: FormulaOperationBuilderProps) {
  const opDef = OPERATIONS_BY_ID[operation.operationId] as OperationDef | undefined;
  const needsSource = opDef?.needsSourceColumn !== false;

  // Determine dtype of selected source column
  const sourceDtype = useMemo(() => {
    const col = columns.find((c) => c.name === operation.sourceColumn);
    return col?.dtype || "String";
  }, [columns, operation.sourceColumn]);

  // Operations grouped by category for the dropdown
  const operationGroups = useMemo(
    () => getOperationsGroupedForDtype(sourceDtype),
    [sourceDtype]
  );

  // Generate expression preview
  const generatedExpression = useMemo(() => {
    if (!opDef) return "";
    const src = operation.sourceColumn || "column";
    try {
      return opDef.toExpression(src, operation.params);
    } catch {
      return "";
    }
  }, [opDef, operation.sourceColumn, operation.params]);

  // Auto-generate column name
  const autoColumnName = useMemo(() => {
    if (!opDef) return "";
    const src = operation.sourceColumn || "result";
    try {
      return opDef.toColumnName(src, operation.params);
    } catch {
      return "result";
    }
  }, [opDef, operation.sourceColumn, operation.params]);

  // Handle source column change
  const handleSourceChange = useCallback(
    (columnName: string) => {
      const col = columns.find((c) => c.name === columnName);
      const newDtype = col?.dtype || "String";
      const newCat = getTypeCategory(newDtype);
      const oldCat = getTypeCategory(sourceDtype);

      // If type category changed, check if current operation is still valid
      let newOpId = operation.operationId;
      if (newCat !== oldCat && opDef) {
        const isStillValid =
          opDef.applicableTypes.includes("any") ||
          opDef.applicableTypes.includes(newCat);
        if (!isStillValid) newOpId = "";
      }

      const updated: FormulaOperationConfig = {
        ...operation,
        sourceColumn: columnName,
        operationId: newOpId,
      };

      // Update auto column name if not manually edited
      if (!operation.columnNameEdited && newOpId) {
        const newOp = OPERATIONS_BY_ID[newOpId];
        if (newOp) {
          updated.columnName = newOp.toColumnName(columnName, operation.params);
        }
      }

      onChange(updated);
    },
    [columns, operation, opDef, sourceDtype, onChange]
  );

  // Handle operation change
  const handleOperationChange = useCallback(
    (opId: string) => {
      const newOp = OPERATIONS_BY_ID[opId];
      if (!newOp) return;

      // Build default params
      const defaultParams: Record<string, string> = {};
      for (const param of newOp.params) {
        if (param.defaultValue !== undefined) {
          defaultParams[param.key] = param.defaultValue;
        }
      }

      const updated: FormulaOperationConfig = {
        ...operation,
        operationId: opId,
        params: defaultParams,
      };

      // Auto-generate column name if not manually edited
      if (!operation.columnNameEdited) {
        updated.columnName = newOp.toColumnName(
          operation.sourceColumn || "result",
          defaultParams
        );
      }

      // Generate expression
      if (newOp.needsSourceColumn !== false && operation.sourceColumn) {
        updated.expression = newOp.toExpression(operation.sourceColumn, defaultParams);
      } else if (newOp.needsSourceColumn === false) {
        updated.expression = newOp.toExpression("", defaultParams);
      }

      onChange(updated);
    },
    [operation, onChange]
  );

  // Handle param change
  const handleParamChange = useCallback(
    (key: string, value: string) => {
      const newParams = { ...operation.params, [key]: value };
      const updated: FormulaOperationConfig = {
        ...operation,
        params: newParams,
      };

      // Regenerate expression
      if (opDef) {
        const src = operation.sourceColumn || "";
        try {
          updated.expression = opDef.toExpression(src, newParams);
        } catch {
          // keep current expression
        }

        // Update auto column name if not manually edited
        if (!operation.columnNameEdited) {
          try {
            updated.columnName = opDef.toColumnName(src, newParams);
          } catch {
            // keep current name
          }
        }
      }

      onChange(updated);
    },
    [operation, opDef, onChange]
  );

  // Handle column name change
  const handleColumnNameChange = useCallback(
    (name: string) => {
      onChange({
        ...operation,
        columnName: name,
        columnNameEdited: name !== "" && name !== autoColumnName,
      });
    },
    [operation, onChange, autoColumnName]
  );

  return (
    <div className="space-y-2.5">
      {/* Source Column (only if operation needs it) */}
      {needsSource && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-theme-text-secondary">
            Source Column
          </label>
          <select
            value={operation.sourceColumn}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
          >
            <option value="" disabled>
              Select column...
            </option>
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.dtype})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Operation dropdown */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-theme-text-secondary">
          Operation
        </label>
        <select
          value={operation.operationId}
          onChange={(e) => handleOperationChange(e.target.value)}
          className="w-full h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
        >
          <option value="" disabled>
            Select operation...
          </option>
          {operationGroups.map((group) => (
            <optgroup key={group.category} label={group.label}>
              {group.operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Dynamic Parameters */}
      {opDef && opDef.params.length > 0 && (
        <div className="space-y-2 pl-2 border-l-2 border-theme-border-secondary">
          {opDef.params.map((param) => {
            // Skip hidden params (mode selectors used internally)
            if (param.showWhen && !param.showWhen(operation.params)) return null;

            // column_or_value: show radio + input
            if (param.kind === "column_or_value") {
              const modeKey = param.key === "operand" ? "mode" : `${param.key.replace("_column", "").replace("_value", "")}_mode`;
              const currentMode = operation.params[modeKey] || "value";
              return (
                <div key={param.key} className="space-y-1">
                  <label className="text-xs font-medium text-theme-text-secondary">
                    {param.label}
                  </label>
                  <div className="flex items-center gap-2">
                    {currentMode === "column" ? (
                      <select
                        value={operation.params[param.key] || ""}
                        onChange={(e) => handleParamChange(param.key, e.target.value)}
                        className="flex-1 h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      >
                        <option value="" disabled>
                          Select column...
                        </option>
                        {columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={operation.params[param.key] || ""}
                        onChange={(e) => handleParamChange(param.key, e.target.value)}
                        placeholder={param.placeholder}
                        className="flex-1 h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary placeholder:text-theme-text-tertiary"
                      />
                    )}
                  </div>
                </div>
              );
            }

            if (param.kind === "select") {
              return (
                <div key={param.key} className="space-y-1">
                  <label className="text-xs font-medium text-theme-text-secondary">
                    {param.label}
                  </label>
                  <select
                    value={operation.params[param.key] || param.defaultValue || ""}
                    onChange={(e) => handleParamChange(param.key, e.target.value)}
                    className="w-full h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                  >
                    {param.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (param.kind === "number") {
              return (
                <div key={param.key} className="space-y-1">
                  <label className="text-xs font-medium text-theme-text-secondary">
                    {param.label}
                  </label>
                  <input
                    type="number"
                    value={operation.params[param.key] ?? param.defaultValue ?? ""}
                    onChange={(e) => handleParamChange(param.key, e.target.value)}
                    placeholder={param.placeholder}
                    className="w-full h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary placeholder:text-theme-text-tertiary"
                  />
                </div>
              );
            }

            // Default: text input
            return (
              <div key={param.key} className="space-y-1">
                <label className="text-xs font-medium text-theme-text-secondary">
                  {param.label}
                </label>
                <input
                  type="text"
                  value={operation.params[param.key] || ""}
                  onChange={(e) => handleParamChange(param.key, e.target.value)}
                  placeholder={param.placeholder}
                  className="w-full h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary placeholder:text-theme-text-tertiary"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Output Column Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-theme-text-secondary">
          Output Column
        </label>
        <input
          type="text"
          value={operation.columnName}
          onChange={(e) => handleColumnNameChange(e.target.value)}
          placeholder={autoColumnName || "result"}
          className="w-full h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary placeholder:text-theme-text-tertiary"
        />
      </div>

      {/* Expression Preview (basic mode only) */}
      {operation.mode === "basic" && generatedExpression && (
        <div className="space-y-1">
          <div className="text-[11px] text-theme-text-tertiary font-medium uppercase tracking-wider">
            Expression Preview
          </div>
          <div className="p-2 bg-theme-surface-panel rounded border border-dashed border-theme-border-secondary">
            <code className="text-xs text-theme-text-secondary font-mono whitespace-pre-wrap break-all">
              {generatedExpression}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
