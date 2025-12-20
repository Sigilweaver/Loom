import { useCallback, useMemo } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "../domain/workflow/entities/workflow";
import { useToolConfiguration } from "../hooks/useToolConfiguration";
import { ColumnSchema } from "../api/backend";
import { CommonSockets } from "@domain/workflow/constants/socketIds";

interface UnpivotConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function UnpivotConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: UnpivotConfigurationProps) {
  // Unified configuration hook - handles metadata and connections
  const { columns, loading, hasInput } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  const inputColumns: ColumnSchema[] = columns;

  // Get current configuration values
  const selectedOn = useMemo(() => {
    const on = config.on;
    if (!Array.isArray(on)) return [];
    return on.filter((c): c is string => typeof c === "string");
  }, [config.on]);

  const selectedIndex = useMemo(() => {
    const index = config.index;
    if (!Array.isArray(index)) return [];
    return index.filter((c): c is string => typeof c === "string");
  }, [config.index]);

  const variableName = (config.variableName as string) || "variable";
  const valueName = (config.valueName as string) || "value";

  // Toggle column in 'on' list (columns to unpivot)
  const toggleOnColumn = useCallback(
    (columnName: string) => {
      let newOn: string[];
      if (selectedOn.includes(columnName)) {
        newOn = selectedOn.filter((c) => c !== columnName);
      } else {
        // Remove from index if it was there
        const newIndex = selectedIndex.filter((c) => c !== columnName);
        newOn = [...selectedOn, columnName];
        onChange({
          ...config,
          on: newOn,
          index: newIndex,
        });
        return;
      }
      onChange({ ...config, on: newOn });
    },
    [config, onChange, selectedOn, selectedIndex]
  );

  // Toggle column in 'index' list (columns to keep as identifiers)
  const toggleIndexColumn = useCallback(
    (columnName: string) => {
      let newIndex: string[];
      if (selectedIndex.includes(columnName)) {
        newIndex = selectedIndex.filter((c) => c !== columnName);
      } else {
        // Remove from 'on' if it was there
        const newOn = selectedOn.filter((c) => c !== columnName);
        newIndex = [...selectedIndex, columnName];
        onChange({
          ...config,
          on: newOn,
          index: newIndex,
        });
        return;
      }
      onChange({ ...config, index: newIndex });
    },
    [config, onChange, selectedOn, selectedIndex]
  );

  // Handle variable name change
  const handleVariableNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, variableName: e.target.value });
    },
    [config, onChange]
  );

  // Handle value name change
  const handleValueNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, valueName: e.target.value });
    },
    [config, onChange]
  );

  // Select all remaining columns for 'on'
  const selectAllForOn = useCallback(() => {
    const remaining = inputColumns
      .map((c) => c.name)
      .filter((name) => !selectedIndex.includes(name));
    onChange({ ...config, on: remaining });
  }, [config, onChange, inputColumns, selectedIndex]);

  // Clear 'on' selection
  const clearOn = useCallback(() => {
    onChange({ ...config, on: [] });
  }, [config, onChange]);

  // Get columns not in either selection (available for selection)
  const getColumnStatus = (columnName: string): "on" | "index" | "none" => {
    if (selectedOn.includes(columnName)) return "on";
    if (selectedIndex.includes(columnName)) return "index";
    return "none";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Info Section */}
        <div className="p-3 text-sm rounded bg-theme-surface-elevated">
          <h3 className="mb-2 font-semibold text-theme-text-primary">
            Unpivot Tool
          </h3>
          <p className="mb-2 text-theme-text-secondary">
            Transform wide data to long format. Selected columns become rows with
            a "variable" column showing the original column name and a "value"
            column holding the data.
          </p>
        </div>

        {/* Output Column Names */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-theme-text-primary">
            Output Column Names
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs text-theme-text-tertiary">
                Variable Column
              </label>
              <input
                type="text"
                value={variableName}
                onChange={handleVariableNameChange}
                placeholder="variable"
                className="w-full px-3 py-2 text-sm rounded border bg-theme-surface-elevated border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-accent"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs text-theme-text-tertiary">
                Value Column
              </label>
              <input
                type="text"
                value={valueName}
                onChange={handleValueNameChange}
                placeholder="value"
                className="w-full px-3 py-2 text-sm rounded border bg-theme-surface-elevated border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-accent"
              />
            </div>
          </div>
        </div>

        {/* Column Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-theme-text-primary">
              Columns
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllForOn}
                className="px-2 py-1 rounded text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-elevated"
              >
                All to Unpivot
              </button>
              <button
                type="button"
                onClick={clearOn}
                disabled={selectedOn.length === 0}
                className="px-2 py-1 rounded text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-elevated disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
          <p className="text-xs text-theme-text-tertiary">
            Mark columns to <span className="text-blue-400">Unpivot</span> (become rows) or <span className="text-amber-400">Keep</span> (as identifiers).
          </p>

          {!hasInput && (
            <div className="p-3 text-sm rounded bg-theme-surface-elevated text-theme-text-tertiary">
              Connect an input to see available columns.
            </div>
          )}

          {hasInput && loading && (
            <div className="p-3 text-sm rounded bg-theme-surface-elevated text-theme-text-tertiary">
              Loading columns...
            </div>
          )}

          {hasInput && !loading && inputColumns.length === 0 && (
            <div className="p-3 text-sm rounded bg-theme-surface-elevated text-theme-text-tertiary">
              No columns available from input.
            </div>
          )}

          {hasInput && !loading && inputColumns.length > 0 && (
            <div className="border rounded border-theme-border-subtle bg-theme-surface-elevated">
              <div className="grid grid-cols-[1fr_auto_auto] px-3 py-2 text-xs border-b border-theme-border-subtle text-theme-text-tertiary">
                <span>Column</span>
                <span className="w-16 text-center">Unpivot</span>
                <span className="w-16 text-center">Keep</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {inputColumns.map((col) => {
                  const status = getColumnStatus(col.name);
                  return (
                    <div
                      key={col.name}
                      className="grid grid-cols-[1fr_auto_auto] px-3 py-2 items-center hover:bg-theme-surface-hover"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm truncate text-theme-text-primary">
                          {col.name}
                        </span>
                        <span className="text-xs text-theme-text-tertiary">
                          {col.dtype}
                        </span>
                      </div>
                      <div className="flex justify-center w-16">
                        <input
                          type="checkbox"
                          checked={status === "on"}
                          onChange={() => toggleOnColumn(col.name)}
                          className="w-4 h-4 rounded border-blue-500 bg-theme-surface text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                      </div>
                      <div className="flex justify-center w-16">
                        <input
                          type="checkbox"
                          checked={status === "index"}
                          onChange={() => toggleIndexColumn(col.name)}
                          className="w-4 h-4 rounded border-amber-500 bg-theme-surface text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {selectedOn.length > 0 && (
          <div className="p-3 text-sm border rounded bg-theme-surface-elevated border-theme-border-subtle">
            <h4 className="mb-1 font-medium text-theme-text-primary">
              Result Preview
            </h4>
            <p className="text-theme-text-secondary">
              {selectedIndex.length > 0 ? (
                <>
                  Keep <span className="text-amber-400">{selectedIndex.length}</span> identifier column{selectedIndex.length !== 1 ? "s" : ""}.{" "}
                </>
              ) : null}
              Transform <span className="text-blue-400">{selectedOn.length}</span> column{selectedOn.length !== 1 ? "s" : ""} into rows.
              Each input row will produce <span className="text-blue-400">{selectedOn.length}</span> output row{selectedOn.length !== 1 ? "s" : ""}.
            </p>
          </div>
        )}

        {selectedOn.length === 0 && hasInput && !loading && inputColumns.length > 0 && (
          <div className="p-3 text-sm border rounded bg-amber-500/10 border-amber-500/30 text-amber-200">
            Select at least one column to unpivot.
          </div>
        )}
      </div>
    </div>
  );
}
