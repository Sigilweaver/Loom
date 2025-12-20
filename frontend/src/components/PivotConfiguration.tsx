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
import { AlertTriangle } from "lucide-react";
import { isNumericPolarsType } from "../data/polarsTypes";

/**
 * Aggregation functions available for pivot
 */
interface AggregationInfo {
  value: string;
  label: string;
  numericOnly: boolean;
}

const PIVOT_AGGREGATIONS: AggregationInfo[] = [
  { value: "first", label: "First", numericOnly: false },
  { value: "last", label: "Last", numericOnly: false },
  { value: "sum", label: "Sum", numericOnly: true },
  { value: "mean", label: "Mean", numericOnly: true },
  { value: "median", label: "Median", numericOnly: true },
  { value: "min", label: "Min", numericOnly: false },
  { value: "max", label: "Max", numericOnly: false },
  { value: "count", label: "Count", numericOnly: false },
  { value: "len", label: "Length", numericOnly: false },
];

interface PivotConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function PivotConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: PivotConfigurationProps) {
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
  const selectedOn = (config.on as string) || "";
  const selectedValues = (config.values as string) || "";
  const aggregateFunction = (config.aggregateFunction as string) || "first";

  const selectedIndex = useMemo(() => {
    const index = config.index;
    if (!Array.isArray(index)) return [];
    return index.filter((c): c is string => typeof c === "string");
  }, [config.index]);

  // Get the dtype of the selected values column
  const valuesColumnType = useMemo(() => {
    if (!selectedValues) return null;
    const col = inputColumns.find((c) => c.name === selectedValues);
    return col?.dtype || null;
  }, [selectedValues, inputColumns]);

  const isValuesNumeric = valuesColumnType
    ? isNumericPolarsType(valuesColumnType)
    : false;

  // Filter aggregations based on values column type
  const availableAggregations = useMemo(() => {
    if (!selectedValues) return PIVOT_AGGREGATIONS;
    return PIVOT_AGGREGATIONS.filter(
      (agg) => !agg.numericOnly || isValuesNumeric
    );
  }, [selectedValues, isValuesNumeric]);

  // Handle 'on' column change (pivot column)
  const handleOnChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newOn = e.target.value;
      // Remove from index if it was there
      const newIndex = selectedIndex.filter((c) => c !== newOn);
      // If it was the values column, clear values
      const newValues = selectedValues === newOn ? "" : selectedValues;
      onChange({
        ...config,
        on: newOn,
        index: newIndex,
        values: newValues,
      });
    },
    [config, onChange, selectedIndex, selectedValues]
  );

  // Handle 'values' column change
  const handleValuesChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newValues = e.target.value;
      // Remove from index if it was there
      const newIndex = selectedIndex.filter((c) => c !== newValues);
      onChange({
        ...config,
        values: newValues,
        index: newIndex,
      });
    },
    [config, onChange, selectedIndex]
  );

  // Handle aggregate function change
  const handleAggregateChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...config,
        aggregateFunction: e.target.value,
      });
    },
    [config, onChange]
  );

  // Toggle column in index list
  const toggleIndexColumn = useCallback(
    (columnName: string) => {
      // Don't allow 'on' or 'values' columns in index
      if (columnName === selectedOn || columnName === selectedValues) return;

      let newIndex: string[];
      if (selectedIndex.includes(columnName)) {
        newIndex = selectedIndex.filter((c) => c !== columnName);
      } else {
        newIndex = [...selectedIndex, columnName];
      }
      onChange({ ...config, index: newIndex });
    },
    [config, onChange, selectedIndex, selectedOn, selectedValues]
  );

  // Get columns available for 'on' and 'values' dropdowns
  const availableColumnsForOn = useMemo(() => {
    return inputColumns.filter((c) => c.name !== selectedValues);
  }, [inputColumns, selectedValues]);

  const availableColumnsForValues = useMemo(() => {
    return inputColumns.filter((c) => c.name !== selectedOn);
  }, [inputColumns, selectedOn]);

  // Validate current aggregation is still valid
  const currentAggValid = availableAggregations.some(
    (agg) => agg.value === aggregateFunction
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Info Section */}
        <div className="p-3 text-sm rounded bg-theme-surface-elevated">
          <h3 className="mb-2 font-semibold text-theme-text-primary">
            Pivot Tool
          </h3>
          <p className="mb-2 text-theme-text-secondary">
            Transform long data to wide format. Values from one column become new
            column headers, values from another column fill those columns.
          </p>
        </div>

        {/* Blocking Warning */}
        <div className="flex items-start gap-2 p-3 text-sm border rounded bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-200">Performance Note</p>
            <p className="text-theme-text-secondary">
              This tool requires scanning all data to determine unique values.
              Results will be cached to avoid re-computation.
            </p>
          </div>
        </div>

        {!hasInput && (
          <div className="p-3 text-sm rounded bg-theme-surface-elevated text-theme-text-tertiary">
            Connect an input to configure pivot settings.
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
          <>
            {/* Group By Columns (Index) - at top for workflow clarity */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-theme-text-primary">
                Group By Columns
              </label>
              <p className="text-xs text-theme-text-tertiary">
                Select columns to group by. These become row identifiers in the output.
              </p>

              <div className="border rounded border-theme-border-subtle bg-theme-surface-elevated">
                <div className="px-3 py-2 text-xs border-b border-theme-border-subtle text-theme-text-tertiary">
                  {selectedIndex.length === 0
                    ? "No columns selected (will use all non-pivot/value columns)"
                    : `${selectedIndex.length} column${selectedIndex.length !== 1 ? "s" : ""} selected`}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {inputColumns.map((col) => {
                    const isDisabled = col.name === selectedOn || col.name === selectedValues;
                    const disabledReason = col.name === selectedOn 
                      ? "(pivot column)" 
                      : col.name === selectedValues 
                        ? "(values column)" 
                        : "";
                    return (
                      <label
                        key={col.name}
                        className={`flex items-center gap-3 px-3 py-2 ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-theme-surface-hover"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIndex.includes(col.name)}
                          onChange={() => toggleIndexColumn(col.name)}
                          disabled={isDisabled}
                          className="w-4 h-4 rounded border-theme-border-subtle bg-theme-surface text-theme-accent focus:ring-theme-accent focus:ring-offset-0 disabled:opacity-50"
                        />
                        <span className="flex-1 text-sm truncate text-theme-text-primary">
                          {col.name}
                        </span>
                        <span className="text-xs text-theme-text-tertiary">
                          {isDisabled ? disabledReason : col.dtype}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pivot Column (on) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-theme-text-primary">
                Pivot Column
              </label>
              <p className="text-xs text-theme-text-tertiary">
                Unique values from this column become new column headers.
              </p>
              <select
                value={selectedOn}
                onChange={handleOnChange}
                className="w-full px-3 py-2 text-sm rounded border bg-theme-surface-elevated border-theme-border-primary text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-accent"
              >
                <option value="">Select column...</option>
                {availableColumnsForOn.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dtype})
                  </option>
                ))}
              </select>
            </div>

            {/* Values Column */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-theme-text-primary">
                Values Column
              </label>
              <p className="text-xs text-theme-text-tertiary">
                Values from this column fill the new pivot columns.
              </p>
              <select
                value={selectedValues}
                onChange={handleValuesChange}
                className="w-full px-3 py-2 text-sm rounded border bg-theme-surface-elevated border-theme-border-primary text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-accent"
              >
                <option value="">Select column...</option>
                {availableColumnsForValues.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dtype})
                  </option>
                ))}
              </select>
            </div>

            {/* Aggregate Function */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-theme-text-primary">
                Aggregate Function
              </label>
              <p className="text-xs text-theme-text-tertiary">
                How to combine values when multiple rows have the same index.
              </p>
              <select
                value={currentAggValid ? aggregateFunction : "first"}
                onChange={handleAggregateChange}
                className="w-full px-3 py-2 text-sm rounded border bg-theme-surface-elevated border-theme-border-primary text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-accent"
              >
                {availableAggregations.map((agg) => (
                  <option key={agg.value} value={agg.value}>
                    {agg.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Validation Messages */}
            {(!selectedOn || !selectedValues) && (
              <div className="p-3 text-sm border rounded bg-amber-500/10 border-amber-500/30 text-amber-200">
                {!selectedOn && !selectedValues
                  ? "Select both a pivot column and a values column."
                  : !selectedOn
                    ? "Select a pivot column."
                    : "Select a values column."}
              </div>
            )}

            {/* Summary */}
            {selectedOn && selectedValues && (
              <div className="p-3 text-sm border rounded bg-theme-surface-elevated border-theme-border-subtle">
                <h4 className="mb-1 font-medium text-theme-text-primary">
                  Result Preview
                </h4>
                <p className="text-theme-text-secondary">
                  New columns will be created for each unique value in{" "}
                  <span className="text-theme-accent">{selectedOn}</span>, filled with{" "}
                  <span className="text-theme-accent">{aggregateFunction}</span> of{" "}
                  <span className="text-theme-accent">{selectedValues}</span>.
                  {selectedIndex.length > 0 && (
                    <>
                      {" "}
                      Grouped by{" "}
                      <span className="text-theme-accent">
                        {selectedIndex.join(", ")}
                      </span>
                      .
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
