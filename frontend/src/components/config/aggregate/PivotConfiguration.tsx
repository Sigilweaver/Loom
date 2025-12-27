import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { useToolConfiguration } from "@hooks/useToolConfiguration";
import { ColumnSchema, profileColumns, ProfileResponse } from "@api/backend";
import { resolveWorkflowConnections } from "@api/connectionResolver";
import { CommonSockets } from "@domain/workflow/constants/socketIds";
import { AlertTriangle, Info } from "lucide-react";
import { isNumericPolarsType } from "@data/polarsTypes";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";

/** Threshold for warning about too many unique values for pivot */
const PIVOT_UNIQUE_WARNING = 100;
/** Threshold for blocking pivot (too many columns would be created) */
const PIVOT_UNIQUE_DANGER = 1000;

/** Emoji indicators for cardinality levels */
const CARDINALITY_EMOJI = {
  safe: "\u{1F7E2}",    // Green circle
  warning: "\u{1F7E1}", // Yellow circle
  danger: "\u{1F534}",  // Red circle
} as const;

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
  const { columns, loading, hasInput, connectionKey } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  const inputColumns: ColumnSchema[] = columns;

  // Profile state for unique counts
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Fetch profile data when connection changes
  useEffect(() => {
    if (!hasInput || !connectionKey) {
      setProfileData(null);
      setProfileError(null);
      return;
    }

    // Ensure the current tool exists in the tools array
    const currentTool = tools.find(t => t.id === toolId);
    if (!currentTool) {
      console.warn("[PivotConfiguration] Current tool not found in tools array:", toolId);
      setProfileError("Tool not ready");
      return;
    }

    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const { tools: upstreamTools, wires: upstreamWires } =
          WorkflowSerializer.extractUpstreamSubgraph(tools, wires, toolId);
        const workflowJson = JSON.parse(
          WorkflowSerializer.toJSON(upstreamTools, upstreamWires, workflowMeta)
        );
        // Resolve database connections before profiling
        const resolvedWorkflow = await resolveWorkflowConnections(workflowJson);
        // Only fetch unique_count for pivot safety
        const result = await profileColumns(
          toolId,
          resolvedWorkflow,
          CommonSockets.INPUT,
          undefined, // all columns
          ["unique_count"]
        );
        setProfileData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load profile";
        console.warn("[PivotConfiguration] Profile fetch failed:", message);
        setProfileError(message);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [toolId, hasInput, connectionKey, tools, wires, workflowMeta]);

  // Get unique count for a column
  const getUniqueCount = useCallback(
    (columnName: string): number | null => {
      if (!profileData?.columns) return null;
      const profile = profileData.columns[columnName];
      return profile?.unique_count ?? null;
    },
    [profileData]
  );

  // Get safety level for a column's unique count
  const getUniqueSafetyLevel = useCallback(
    (uniqueCount: number | null): "safe" | "warning" | "danger" | "unknown" => {
      if (uniqueCount === null) return "unknown";
      if (uniqueCount >= PIVOT_UNIQUE_DANGER) return "danger";
      if (uniqueCount >= PIVOT_UNIQUE_WARNING) return "warning";
      return "safe";
    },
    []
  );

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
  // Sort pivot columns by cardinality bucket: safe (green) -> warning (yellow) -> danger (red) -> unknown
  const availableColumnsForOn = useMemo(() => {
    const filtered = inputColumns.filter((c) => c.name !== selectedValues);
    
    // Sort by safety bucket
    const bucketOrder = { safe: 0, warning: 1, danger: 2, unknown: 3 };
    return [...filtered].sort((a, b) => {
      const aCount = profileData?.columns?.[a.name]?.unique_count ?? null;
      const bCount = profileData?.columns?.[b.name]?.unique_count ?? null;
      const aLevel = aCount === null ? "unknown" : aCount >= PIVOT_UNIQUE_DANGER ? "danger" : aCount >= PIVOT_UNIQUE_WARNING ? "warning" : "safe";
      const bLevel = bCount === null ? "unknown" : bCount >= PIVOT_UNIQUE_DANGER ? "danger" : bCount >= PIVOT_UNIQUE_WARNING ? "warning" : "safe";
      return bucketOrder[aLevel] - bucketOrder[bLevel];
    });
  }, [inputColumns, selectedValues, profileData]);

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
        <div className="flex items-start gap-2 p-3 text-sm border rounded bg-theme-status-warning-bg border-theme-status-warning-border">
          <AlertTriangle className="w-4 h-4 text-theme-status-warning-text mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-theme-status-warning-text">Performance Note</p>
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
                {availableColumnsForOn.map((col) => {
                  const uniqueCount = getUniqueCount(col.name);
                  const safetyLevel = getUniqueSafetyLevel(uniqueCount);
                  const emoji = safetyLevel !== "unknown" ? CARDINALITY_EMOJI[safetyLevel] + " " : "";
                  const countLabel = uniqueCount !== null ? ` (${uniqueCount.toLocaleString()} unique)` : "";
                  return (
                    <option key={col.name} value={col.name}>
                      {emoji}{col.name} - {col.dtype}{countLabel}
                    </option>
                  );
                })}
              </select>
              
              {/* Status messages */}
              {profileLoading && (
                <p className="text-xs text-theme-text-tertiary">Loading column statistics...</p>
              )}
              {profileError && (
                <div className="flex items-start gap-2 text-xs text-theme-status-warning-text" title={profileError}>
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="truncate">Could not load statistics</span>
                </div>
              )}
              
              {/* Cardinality warning for selected column */}
              {selectedOn && (() => {
                const uniqueCount = getUniqueCount(selectedOn);
                const safetyLevel = getUniqueSafetyLevel(uniqueCount);
                if (safetyLevel === "danger") {
                  return (
                    <div className="flex items-start gap-2 p-2 text-xs border rounded bg-theme-status-error-bg border-theme-status-error-border">
                      <AlertTriangle className="w-3 h-3 text-theme-status-error-text mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-theme-status-error-text">High cardinality warning</p>
                        <p className="text-theme-text-secondary">
                          This column has {uniqueCount?.toLocaleString()} unique values. 
                          Pivoting will create {uniqueCount?.toLocaleString()} new columns, 
                          which may cause performance issues or crash the application.
                        </p>
                      </div>
                    </div>
                  );
                } else if (safetyLevel === "warning") {
                  return (
                    <div className="flex items-start gap-2 p-2 text-xs border rounded bg-theme-status-warning-bg border-theme-status-warning-border">
                      <AlertTriangle className="w-3 h-3 text-theme-status-warning-text mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-theme-status-warning-text">Moderate cardinality</p>
                        <p className="text-theme-text-secondary">
                          This column has {uniqueCount?.toLocaleString()} unique values. 
                          This will create {uniqueCount?.toLocaleString()} new columns.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
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
              <div className="p-3 text-sm border rounded bg-theme-status-warning-bg border-theme-status-warning-border text-theme-status-warning-text">
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
