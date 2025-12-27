import { useCallback, useMemo } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { useToolConfiguration } from "@hooks/useToolConfiguration";
import { ColumnSchema } from "@api/backend";
import { CommonSockets } from "@domain/workflow/constants/socketIds";
import { ConfigColumnSelector, ColumnSelectorItemHandlers } from "@components/primitives";

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

/**
 * Item type for the ConfigColumnSelector.
 * Must have `id` to satisfy ColumnSelectorItem constraint.
 */
interface SortColumnItem {
  [key: string]: unknown; // Required for ColumnSelectorItem constraint
  id: string; // Use name as id
  name: string;
  dtype: string;
  sortOption: SortOption;
  position: number; // 1-based position for active sorts, 0 for inactive
}

export function SortConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: SortConfigurationProps) {
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

  // Get input columns from metadata
  const inputColumns: ColumnSchema[] = columns;

  // Get current sort columns from config as a map for quick lookup
  const sortColumnsMap = useMemo(() => {
    const map = new Map<string, SortColumn>();
    const sortColumns = parseSortColumns(config);
    for (const col of sortColumns) {
      map.set(col.column, col);
    }
    return map;
  }, [config]);

  // Build items for ConfigColumnSelector: active sorts first (in order), then inactive
  const selectorItems = useMemo((): SortColumnItem[] => {
    const activeSortColumns = parseSortColumns(config);
    const activeColumnNames = new Set(activeSortColumns.map((c) => c.column));

    // Get active columns in their sort order with position
    const activeItems: SortColumnItem[] = activeSortColumns
      .map((sc, index) => {
        const col = inputColumns.find((ic) => ic.name === sc.column);
        if (!col) return null;
        return {
          id: col.name,
          name: col.name,
          dtype: col.dtype || "Unknown",
          sortOption: toSortOption(sc),
          position: index + 1,
        };
      })
      .filter((item): item is SortColumnItem => item !== null);

    // Get inactive columns
    const inactiveItems: SortColumnItem[] = inputColumns
      .filter((c) => !activeColumnNames.has(c.name))
      .map((col) => ({
        id: col.name,
        name: col.name,
        dtype: col.dtype || "Unknown",
        sortOption: "none" as SortOption,
        position: 0,
      }));

    return [...activeItems, ...inactiveItems];
  }, [inputColumns, config]);

  // Count active sorts
  const activeSortCount = sortColumnsMap.size;

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

  // Handle reorder from ConfigColumnSelector
  const handleReorder = useCallback(
    (newItems: SortColumnItem[]) => {
      // Only the active sort columns can be reordered
      // Extract just the active ones in their new order
      const newSortColumns: SortColumn[] = newItems
        .filter((item) => item.sortOption !== "none")
        .map((item) => {
          const settings = fromSortOption(item.sortOption);
          return {
            column: item.name,
            direction: settings?.direction || "asc",
            nullsFirst: settings?.nullsFirst || false,
          };
        });

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

  // Only active sort columns can be reordered
  const canReorderItem = useCallback(
    (item: SortColumnItem) => item.sortOption !== "none",
    []
  );

  // Render each column row (content only - wrapper handles click/keyboard)
  const renderColumnItem = useCallback(
    (item: SortColumnItem, _handlers: ColumnSelectorItemHandlers) => {
      const isActive = item.sortOption !== "none";

      return (
        <div className="flex items-center gap-3 w-full">
          {/* Position indicator */}
          <div className="w-6 text-center flex-shrink-0">
            {isActive && (
              <span className="text-xs font-medium text-theme-interactive-accent">
                {item.position}
              </span>
            )}
          </div>

          {/* Column name */}
          <div className="flex-1 min-w-0">
            <span
              className={`text-sm whitespace-nowrap ${
                isActive
                  ? "text-theme-text-primary font-medium"
                  : "text-theme-text-secondary"
              }`}
            >
              {item.name}
            </span>
          </div>

          {/* Sort option dropdown */}
          <div className="w-[180px] flex-shrink-0">
            <select
              value={item.sortOption}
              onChange={(e) => {
                e.stopPropagation();
                updateColumnSort(item.name, e.target.value as SortOption);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full px-2 py-1 text-xs rounded border cursor-pointer
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

          {/* Type */}
          <div className="w-20 flex-shrink-0 text-xs text-theme-text-tertiary">
            {item.dtype}
          </div>
        </div>
      );
    },
    [updateColumnSort]
  );

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
      {/* Column Table Header */}
      <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
        <div className="flex items-center gap-3 text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
          <div className="w-6 flex-shrink-0 text-center">#</div>
          <div className="flex-1">Column</div>
          <div className="w-[180px] flex-shrink-0">Sort</div>
          <div className="w-20 flex-shrink-0">Type</div>
        </div>
      </div>

      <ConfigColumnSelector<SortColumnItem>
        items={selectorItems}
        onReorder={handleReorder}
        canReorderItem={canReorderItem}
        itemRenderer={renderColumnItem}
        label={
          <span>
            Sort Columns
            {activeSortCount > 0 && (
              <span className="ml-2 text-xs font-normal text-theme-text-tertiary">
                ({activeSortCount} active)
              </span>
            )}
          </span>
        }
        emptyMessage="No columns available"
        showReorderButtons={activeSortCount > 1}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
