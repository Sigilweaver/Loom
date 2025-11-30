import { useCallback, useEffect, useMemo } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "../domain/workflow/entities/workflow";
import { useMetadata } from "../api/hooks";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { ColumnSchema } from "../api/backend";

/**
 * Sort options for dropdown
 */
type SortOption = "none" | "asc" | "desc" | "asc-nulls-first" | "desc-nulls-first";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
  { value: "asc-nulls-first", label: "Ascending (nulls first)" },
  { value: "desc-nulls-first", label: "Descending (nulls first)" },
];

/**
 * Sort column configuration (internal)
 */
interface SortColumn {
  column: string;
  direction: string;
  nullsFirst: boolean;
}

/**
 * Convert SortColumn to SortOption
 */
function toSortOption(col: SortColumn | undefined): SortOption {
  if (!col) return "none";
  if (col.direction === "asc" && col.nullsFirst) return "asc-nulls-first";
  if (col.direction === "desc" && col.nullsFirst) return "desc-nulls-first";
  if (col.direction === "asc") return "asc";
  if (col.direction === "desc") return "desc";
  return "none";
}

/**
 * Convert SortOption to direction/nullsFirst
 */
function fromSortOption(option: SortOption): { direction: string; nullsFirst: boolean } | null {
  switch (option) {
    case "asc": return { direction: "asc", nullsFirst: false };
    case "desc": return { direction: "desc", nullsFirst: false };
    case "asc-nulls-first": return { direction: "asc", nullsFirst: true };
    case "desc-nulls-first": return { direction: "desc", nullsFirst: true };
    default: return null;
  }
}

/**
 * Parse sort columns from config
 */
function parseSortColumns(config: ToolConfig): SortColumn[] {
  const sortColumns = Array.isArray(config.sortColumns) ? config.sortColumns : [];
  const result: SortColumn[] = [];

  for (const col of sortColumns) {
    if (typeof col === "object" && col !== null) {
      const column = typeof col.column === "string" ? col.column : "";
      const direction = typeof col.direction === "string" ? col.direction : "asc";
      const nullsFirst = typeof col.nullsFirst === "boolean" ? col.nullsFirst : false;
      if (column) {
        result.push({ column, direction, nullsFirst });
      }
    }
  }

  return result;
}

interface SortConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function SortConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: SortConfigurationProps) {
  const { metadata, fetchMetadata, loading } = useMetadata();

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

  // Get current sort columns from config as a map for quick lookup
  const sortColumnsMap = useMemo(() => {
    const map = new Map<string, SortColumn>();
    const sortColumns = parseSortColumns(config);
    for (const col of sortColumns) {
      map.set(col.column, col);
    }
    return map;
  }, [config]);

  // Update sort option for a column
  const updateColumnSort = useCallback(
    (columnName: string, option: SortOption) => {
      const currentSortColumns = parseSortColumns(config);
      const settings = fromSortOption(option);

      let newSortColumns: SortColumn[];

      if (settings === null) {
        // Remove from sort
        newSortColumns = currentSortColumns.filter((c) => c.column !== columnName);
      } else {
        // Check if column already exists
        const existingIndex = currentSortColumns.findIndex((c) => c.column === columnName);
        if (existingIndex >= 0) {
          // Update existing
          newSortColumns = [...currentSortColumns];
          newSortColumns[existingIndex] = {
            column: columnName,
            direction: settings.direction,
            nullsFirst: settings.nullsFirst,
          };
        } else {
          // Add new at the end
          newSortColumns = [
            ...currentSortColumns,
            {
              column: columnName,
              direction: settings.direction,
              nullsFirst: settings.nullsFirst,
            },
          ];
        }
      }

      const newConfig = {
        ...config,
        sortColumns: newSortColumns as unknown,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          sortColumns: true,
        },
      } as ToolConfig;
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Get sort option for a column
  const getColumnSortOption = useCallback(
    (columnName: string): SortOption => {
      return toSortOption(sortColumnsMap.get(columnName));
    },
    [sortColumnsMap]
  );

  // Get sort position (1-based) for display
  const getSortPosition = useCallback(
    (columnName: string): number => {
      const sortColumns = parseSortColumns(config);
      const index = sortColumns.findIndex((c) => c.column === columnName);
      return index >= 0 ? index + 1 : 0;
    },
    [config]
  );

  // Move a sort column up or down
  const moveSortColumn = useCallback(
    (columnName: string, direction: "up" | "down") => {
      const currentSortColumns = parseSortColumns(config);
      const currentIndex = currentSortColumns.findIndex((c) => c.column === columnName);
      if (currentIndex < 0) return;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentSortColumns.length) return;

      // Swap positions using splice
      const newSortColumns = [...currentSortColumns];
      const removed = newSortColumns.splice(currentIndex, 1)[0];
      if (!removed) return;
      newSortColumns.splice(targetIndex, 0, removed);

      const newConfig = {
        ...config,
        sortColumns: newSortColumns as unknown,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          sortColumns: true,
        },
      } as ToolConfig;
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Check if we have any input
  const hasInput = wireConnections.length > 0;

  // Count active sorts
  const activeSortCount = sortColumnsMap.size;

  // Sort columns: active sorts first (in sort order), then inactive columns
  const sortedInputColumns = useMemo(() => {
    const activeSortColumns = parseSortColumns(config);
    const activeColumnNames = new Set(activeSortColumns.map((c) => c.column));
    
    // Get active columns in their sort order
    const activeColumns = activeSortColumns
      .map((sc) => inputColumns.find((ic) => ic.name === sc.column))
      .filter((c): c is ColumnSchema => c !== undefined);
    
    // Get inactive columns in original order
    const inactiveColumns = inputColumns.filter((c) => !activeColumnNames.has(c.name));
    
    return [...activeColumns, ...inactiveColumns];
  }, [inputColumns, config]);

  if (!hasInput) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4">
          <div className="p-4 text-center border border-dashed rounded border-theme-border-primary">
            <div className="text-sm text-theme-text-tertiary">
              Connect an input to configure sort
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
      {/* Header */}
      <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
        <span className="text-sm font-semibold text-theme-text-primary">Sort Columns</span>
        {activeSortCount > 0 && (
          <span className="ml-2 text-xs text-theme-text-tertiary">
            ({activeSortCount} active)
          </span>
        )}
      </div>

      {/* Column List */}
      <div className="flex-1 overflow-y-auto">
        {sortedInputColumns.length === 0 ? (
          <div className="p-4 text-sm text-center text-theme-text-tertiary">
            No columns available
          </div>
        ) : (
          <div className="divide-y divide-theme-border-primary">
            {sortedInputColumns.map((col) => {
              const currentOption = getColumnSortOption(col.name);
              const isActive = currentOption !== "none";
              const position = getSortPosition(col.name);

              return (
                <div
                  key={col.name}
                  className="flex items-center gap-2 px-4 py-2"
                >
                  {/* Reorder buttons - only for active sorts with multiple columns */}
                  {isActive && activeSortCount > 1 ? (
                    <div className="flex flex-col w-5">
                      <button
                        type="button"
                        onClick={() => moveSortColumn(col.name, "up")}
                        disabled={position === 1}
                        className="p-0.5 text-theme-text-tertiary hover:text-theme-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up (higher priority)"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSortColumn(col.name, "down")}
                        disabled={position === activeSortCount}
                        className="p-0.5 text-theme-text-tertiary hover:text-theme-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down (lower priority)"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="w-5 text-center">
                      {isActive && (
                        <span className="text-xs font-medium text-theme-interactive-accent">
                          {position}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Column info */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm truncate ${
                        isActive
                          ? "text-theme-text-primary font-medium"
                          : "text-theme-text-secondary"
                      }`}
                    >
                      {col.name}
                    </span>
                    <span className="ml-2 text-xs text-theme-text-tertiary">
                      {col.dtype}
                    </span>
                  </div>

                  {/* Sort option dropdown */}
                  <select
                    value={currentOption}
                    onChange={(e) =>
                      updateColumnSort(col.name, e.target.value as SortOption)
                    }
                    className={`px-2 py-1 text-xs rounded border cursor-pointer min-w-[160px]
                      ${
                        isActive
                          ? "bg-theme-surface-elevated border-theme-interactive-accent text-theme-text-primary"
                          : "bg-theme-surface-panel border-theme-border-primary text-theme-text-secondary"
                      }
                      focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent`}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option 
                        key={opt.value} 
                        value={opt.value}
                        className="bg-theme-surface-panel text-theme-text-primary"
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
