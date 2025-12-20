import { useCallback, useMemo } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "../domain/workflow/entities/workflow";
import { useToolConfiguration } from "../hooks/useToolConfiguration";
import { ColumnSchema } from "../api/backend";
import { ConfigSelect } from "./primitives/ConfigSelect";
import { EmissionMap } from "../domain/workflow/entities/workflow";
import { AlertTriangle } from "lucide-react";
import { UniqueSockets } from "@domain/workflow/constants/socketIds";

/**
 * Unique modes and their descriptions
 */
const UNIQUE_MODES = [
  {
    value: "First",
    label: "First Occurrence",
    description: "Keep first occurrence of each value. Subsequent duplicates go to Duplicate output.",
  },
  {
    value: "Strict",
    label: "Strictly Unique",
    description: "Only keep values appearing exactly once. All repeated values go to Duplicate output.",
  },
];

interface UniqueConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function UniqueConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: UniqueConfigurationProps) {
  // Unified configuration hook - handles metadata and connections
  const { columns, loading, hasInput } = useToolConfiguration({
    toolId,
    socketId: UniqueSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  // Get input columns from metadata
  const inputColumns: ColumnSchema[] = columns;

  // Get current selected columns from config (empty = all columns)
  const selectedColumns = useMemo(() => {
    const cols = config.columns;
    if (!Array.isArray(cols)) return [];
    return cols.filter((c): c is string => typeof c === "string");
  }, [config.columns]);

  const currentMode = (config.mode as string) || "First";

  // Check if a column is selected
  const isColumnSelected = useCallback(
    (columnName: string): boolean => {
      // If no columns selected, all are implicitly selected
      if (selectedColumns.length === 0) return true;
      return selectedColumns.includes(columnName);
    },
    [selectedColumns]
  );

  // Toggle column selection
  const toggleColumn = useCallback(
    (columnName: string) => {
      let newColumns: string[];

      if (selectedColumns.length === 0) {
        // Currently "all columns" - switch to explicit selection
        // Select all except the toggled one
        newColumns = inputColumns
          .map((c) => c.name)
          .filter((name) => name !== columnName);
      } else if (selectedColumns.includes(columnName)) {
        // Remove from selection
        newColumns = selectedColumns.filter((c) => c !== columnName);
      } else {
        // Add to selection
        newColumns = [...selectedColumns, columnName];
      }

      // If all columns would be selected, switch back to empty array (all columns)
      if (newColumns.length === inputColumns.length) {
        newColumns = [];
      }

      const newConfig = {
        ...config,
        columns: newColumns,
      };
      onChange(newConfig);
    },
    [config, onChange, selectedColumns, inputColumns]
  );

  // Select all columns (reset to empty array = all)
  const selectAllColumns = useCallback(() => {
    const newConfig = {
      ...config,
      columns: [],
    };
    onChange(newConfig);
  }, [config, onChange]);

  // Deselect all columns
  const deselectAllColumns = useCallback(() => {
    const firstColumn = inputColumns[0];
    const newConfig = {
      ...config,
      columns: firstColumn ? [firstColumn.name] : [],
    };
    onChange(newConfig);
  }, [config, onChange, inputColumns]);

  const handleModeChange = (
    value: string | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      mode: value || "First",
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  const allSelected = selectedColumns.length === 0;
  const selectedCount = allSelected ? inputColumns.length : selectedColumns.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Info Section */}
        <div className="p-3 text-sm rounded bg-theme-surface-elevated">
          <h3 className="mb-2 font-semibold text-theme-text-primary">
            Unique Tool
          </h3>
          <p className="mb-2 text-theme-text-secondary">
            Split data into unique and duplicate rows based on selected columns.
          </p>
          <div className="mt-2 space-y-1 text-xs text-theme-text-tertiary">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">U</span>
              <span>Unique rows (based on mode)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">D</span>
              <span>Duplicate rows</span>
            </div>
          </div>
        </div>

        {/* Blocking Warning */}
        <div className="flex items-start gap-2 p-3 text-sm border rounded bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-200">Performance Note</p>
            <p className="text-theme-text-secondary">
              This tool requires scanning all data to identify duplicates.
              Results will be cached to avoid re-computation.
            </p>
          </div>
        </div>

        {/* Mode Selection */}
        <ConfigSelect
          configKey="mode"
          value={currentMode}
          onChange={handleModeChange}
          label="Duplicate Detection Mode"
          description="How to determine which rows are unique vs duplicates"
          defaultValue="First"
          options={UNIQUE_MODES}
        />

        {/* Column Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-theme-text-primary">
              Columns to Check
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllColumns}
                className="px-2 py-1 rounded text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-elevated"
              >
                All
              </button>
              <button
                type="button"
                onClick={deselectAllColumns}
                disabled={inputColumns.length === 0}
                className="px-2 py-1 rounded text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-elevated disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
          <p className="text-xs text-theme-text-tertiary">
            Select columns to check for duplicates. If none selected, all columns are used.
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
              <div className="px-3 py-2 text-xs border-b border-theme-border-subtle text-theme-text-tertiary">
                {allSelected
                  ? `All ${inputColumns.length} columns selected`
                  : `${selectedCount} of ${inputColumns.length} columns selected`}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {inputColumns.map((col) => (
                  <label
                    key={col.name}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-theme-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={isColumnSelected(col.name)}
                      onChange={() => toggleColumn(col.name)}
                      className="w-4 h-4 rounded border-theme-border-subtle bg-theme-surface text-theme-accent focus:ring-theme-accent focus:ring-offset-0"
                    />
                    <span className="flex-1 text-sm text-theme-text-primary truncate">
                      {col.name}
                    </span>
                    <span className="text-xs text-theme-text-tertiary">
                      {col.dtype}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mode Description */}
        <div className="p-3 text-sm border rounded bg-theme-surface-elevated border-theme-border-subtle">
          <h4 className="mb-1 font-medium text-theme-text-primary">
            {currentMode === "First" ? "First Occurrence Mode" : "Strictly Unique Mode"}
          </h4>
          {currentMode === "First" ? (
            <p className="text-theme-text-secondary">
              The <span className="text-green-400">Unique</span> output contains the first row for each distinct combination of values.
              The <span className="text-orange-400">Duplicate</span> output contains all subsequent rows with the same values.
            </p>
          ) : (
            <p className="text-theme-text-secondary">
              The <span className="text-green-400">Unique</span> output contains only rows where the value combination appears exactly once.
              The <span className="text-orange-400">Duplicate</span> output contains all rows where the value appears more than once (including the first occurrence).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
