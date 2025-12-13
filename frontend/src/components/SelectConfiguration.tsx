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
import { POLARS_TYPES_MAP, CASTABLE_TYPES_BY_UI_GROUP } from "../data/polarsTypes";

// Re-export for local use with original name for minimal code changes
const TYPE_INFO_MAP = POLARS_TYPES_MAP;

/**
 * Configuration for a single column in the Select tool
 * All optional fields use explicit undefined to work with exactOptionalPropertyTypes
 */
interface ColumnConfig {
  name: string;
  selected: boolean;
  rename: string | undefined;
  targetType: string | undefined;
  size: number | undefined;
}

/**
 * Create a new column config with default values
 */
function createColumnConfig(name: string): ColumnConfig {
  return {
    name,
    selected: true,
    rename: undefined,
    targetType: undefined,
    size: undefined,
  };
}

/**
 * Convert raw config data to typed ColumnConfig array
 */
function parseColumnConfigs(raw: unknown): ColumnConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item !== "object" || item === null) {
      return createColumnConfig("");
    }
    const obj = item as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : "",
      selected: typeof obj.selected === "boolean" ? obj.selected : true,
      rename: typeof obj.rename === "string" ? obj.rename : undefined,
      targetType: typeof obj.targetType === "string" ? obj.targetType : undefined,
      size: typeof obj.size === "number" ? obj.size : undefined,
    };
  });
}

/**
 * Convert ColumnConfig array to serializable format
 */
function serializeColumnConfigs(configs: ColumnConfig[]): Record<string, unknown>[] {
  return configs.map((c) => ({
    name: c.name,
    selected: c.selected,
    rename: c.rename,
    targetType: c.targetType,
    size: c.size,
  }));
}

interface SelectConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function SelectConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: SelectConfigurationProps) {
  const { columns, fetchMetadata, loading } = useMetadata();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Track wire connections to this tool
  const wireConnections = useMemo(() => {
    return wires
      .filter((w) => w.to.tool === toolId)
      .map((w) => `${w.from.tool}-${w.from.socket}`)
      .sort()
      .join(",");
  }, [wires, toolId]);

  // Fetch metadata when component mounts or connections change
  // Use upstream subgraph only to avoid errors from downstream tools
  useEffect(() => {
    const { tools: upstreamTools, wires: upstreamWires } = 
      WorkflowSerializer.extractUpstreamSubgraph(tools, wires, toolId);
    const workflow = WorkflowSerializer.toJSON(upstreamTools, upstreamWires, workflowMeta);
    fetchMetadata(toolId, JSON.parse(workflow), 'input');
  }, [toolId, wireConnections, fetchMetadata]);

  // Get input columns from metadata
  const inputColumns: ColumnSchema[] = columns;

  // Get current column configs from tool config
  const columnConfigs: ColumnConfig[] = useMemo(() => {
    const existing = parseColumnConfigs(config.columnConfigs);

    // If we have input columns but no config, initialize from input
    if (existing.length === 0 && inputColumns.length > 0) {
      return inputColumns.map((col) => createColumnConfig(col.name));
    }

    // Merge existing config with input columns (handle new/removed columns)
    if (inputColumns.length > 0) {
      const existingMap = new Map(existing.map((c) => [c.name, c]));
      const inputColumnNames = new Set(inputColumns.map((c) => c.name));

      // Start with existing configs that are still in input
      const merged: ColumnConfig[] = [];
      for (const col of existing) {
        if (inputColumnNames.has(col.name)) {
          merged.push(col);
        }
      }

      // Add new columns from input that aren't in config
      for (const col of inputColumns) {
        if (!existingMap.has(col.name)) {
          merged.push(createColumnConfig(col.name));
        }
      }

      return merged;
    }

    return existing;
  }, [config.columnConfigs, inputColumns]);

  // Get original type for a column
  const getOriginalType = useCallback(
    (name: string): string => {
      const col = inputColumns.find((c) => c.name === name);
      return col?.dtype || "String";
    },
    [inputColumns]
  );

  // Check if a column is a string type
  const isStringType = useCallback(
    (name: string, targetType: string | undefined): boolean => {
      const type = targetType || getOriginalType(name);
      return type === "String" || type === "Utf8";
    },
    [getOriginalType]
  );

  // Update a single column config
  const updateColumnConfig = useCallback(
    (index: number, updates: Partial<ColumnConfig>) => {
      const newConfigs = [...columnConfigs];
      const current = newConfigs[index];
      if (!current) return;
      newConfigs[index] = { ...current, ...updates };

      const newConfig: ToolConfig = {
        ...config,
        columnConfigs: serializeColumnConfigs(newConfigs),
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          columnConfigs: true,
        },
      };
      onChange(newConfig);
    },
    [columnConfigs, config, onChange]
  );

  // Update a column by name (useful when filtering)
  const updateColumnByName = useCallback(
    (name: string, updates: Partial<ColumnConfig>) => {
      const index = columnConfigs.findIndex((c) => c.name === name);
      if (index !== -1) {
        updateColumnConfig(index, updates);
      }
    },
    [columnConfigs, updateColumnConfig]
  );

  // Toggle selection for a column
  const toggleSelected = useCallback(
    (index: number) => {
      const current = columnConfigs[index];
      if (!current) return;
      updateColumnConfig(index, { selected: !current.selected });
    },
    [columnConfigs, updateColumnConfig]
  );

  // Toggle selection by name
  const toggleSelectedByName = useCallback(
    (name: string) => {
      const index = columnConfigs.findIndex((c) => c.name === name);
      if (index !== -1) {
        toggleSelected(index);
      }
    },
    [columnConfigs, toggleSelected]
  );

  // Reset a column to its original state
  const resetColumn = useCallback(
    (name: string) => {
      updateColumnByName(name, {
        rename: undefined,
        targetType: undefined,
        size: undefined,
      });
    },
    [updateColumnByName]
  );

  // Select/deselect all
  const selectAll = useCallback(
    (selected: boolean) => {
      const newConfigs = columnConfigs.map((c) => {
        if (searchQuery) {
          const lower = searchQuery.toLowerCase();
          const isVisible =
            c.name.toLowerCase().includes(lower) ||
            (c.rename && c.rename.toLowerCase().includes(lower));
          if (!isVisible) return c;
        }
        return { ...c, selected };
      });

      const newConfig: ToolConfig = {
        ...config,
        columnConfigs: serializeColumnConfigs(newConfigs),
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          columnConfigs: true,
        },
      };
      onChange(newConfig);
    },
    [columnConfigs, config, onChange, searchQuery]
  );

  // Reset all columns (respecting filter)
  const resetAll = useCallback(() => {
    const newConfigs = columnConfigs.map((c) => {
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        const isVisible =
          c.name.toLowerCase().includes(lower) ||
          (c.rename && c.rename.toLowerCase().includes(lower));
        if (!isVisible) return c;
      }
      return {
        ...c,
        rename: undefined,
        targetType: undefined,
        size: undefined,
      };
    });

    const newConfig: ToolConfig = {
      ...config,
      columnConfigs: serializeColumnConfigs(newConfigs),
      _emit: {
        ...(config._emit as Record<string, boolean> | undefined),
        columnConfigs: true,
      },
    };
    onChange(newConfig);
  }, [columnConfigs, config, onChange, searchQuery]);

  // Handle drag and drop reordering
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, _index: number) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        return;
      }

      const newConfigs = [...columnConfigs];
      const [removed] = newConfigs.splice(draggedIndex, 1);
      if (!removed) {
        setDraggedIndex(null);
        return;
      }
      newConfigs.splice(dropIndex, 0, removed);

      const newConfig: ToolConfig = {
        ...config,
        columnConfigs: serializeColumnConfigs(newConfigs),
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          columnConfigs: true,
        },
      };
      onChange(newConfig);
      setDraggedIndex(null);
    },
    [draggedIndex, columnConfigs, config, onChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  // Count selected columns
  const selectedCount = columnConfigs.filter((c) => c.selected).length;

  // Filter columns based on search query
  const filteredConfigs = useMemo(() => {
    if (!searchQuery) return columnConfigs;
    const lower = searchQuery.toLowerCase();
    return columnConfigs.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.rename && c.rename.toLowerCase().includes(lower))
    );
  }, [columnConfigs, searchQuery]);

  // Calculate selection state for header checkbox
  const allSelected =
    filteredConfigs.length > 0 && filteredConfigs.every((c) => c.selected);
  const someSelected = filteredConfigs.some((c) => c.selected);
  const isIndeterminate = someSelected && !allSelected;

  // Check if we have any input
  const hasInput = wireConnections.length > 0;

  if (!hasInput) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4">
          <div className="p-4 text-center border border-dashed rounded border-theme-border-primary">
            <div className="text-sm text-theme-text-tertiary">
              Connect an input to configure columns
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
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Info Section */}
        <div className="p-4 border-b border-theme-border-primary">
          <div className="p-3 text-sm rounded bg-theme-surface-elevated">
            <h3 className="mb-2 font-semibold text-theme-text-primary">
              Select Tool
            </h3>
            <p className="text-theme-text-secondary">
              Select, rename, reorder, and convert columns. Drag rows to
              reorder. Unchecked columns will be excluded from output.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 px-4 py-2 border-b border-theme-border-primary bg-theme-surface-panel">
          <div className="flex items-center justify-between">
            <div className="text-sm text-theme-text-secondary">
              {selectedCount} of {columnConfigs.length} columns selected
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="px-2 py-1 text-xs border rounded border-theme-border-primary hover:bg-theme-surface-hover text-theme-text-secondary"
                title="Reset rename, type, and size"
              >
                Reset All
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search columns..."
              className="w-full px-3 py-1.5 text-sm rounded border bg-theme-surface-elevated border-theme-border-primary text-theme-text-primary placeholder-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-text-tertiary hover:text-theme-text-primary"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Column Table Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <div className="grid grid-cols-[auto_1fr_1fr_120px_80px_24px] gap-2 text-xs font-semibold text-theme-text-secondary uppercase tracking-wide items-center">
            <div className="w-8 flex justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isIndeterminate;
                }}
                onChange={() => selectAll(!allSelected)}
                className="w-4 h-4 rounded border-theme-border-primary text-theme-interactive-accent focus:ring-theme-interactive-accent"
                title={allSelected ? "Deselect All" : "Select All"}
              />
            </div>
            <div>Column</div>
            <div>Rename</div>
            <div className="flex items-center gap-1">
              Type
              <a
                href="https://docs.sigilweaver.app/user/data-types"
                target="_blank"
                rel="noopener noreferrer"
                className="text-theme-text-tertiary hover:text-theme-interactive-accent"
                title="View Data Types Documentation"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
            <div>Size</div>
            <div></div>
          </div>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConfigs.length === 0 ? (
            <div className="p-4 text-sm text-center text-theme-text-tertiary">
              {searchQuery ? "No matching columns found" : "No columns available"}
            </div>
          ) : (
            <div className="divide-y divide-theme-border-primary">
              {filteredConfigs.map((col) => {
                // Find the original index for drag and drop
                const index = columnConfigs.findIndex(c => c.name === col.name);
                const originalType = getOriginalType(col.name);
                const currentType = col.targetType || originalType;
                const typeInfo = TYPE_INFO_MAP.get(currentType);
                const showSize = isStringType(col.name, col.targetType);
                const isModified = col.rename || col.targetType || col.size;

                return (
                  <div
                    key={col.name}
                    draggable={!searchQuery} // Disable drag when filtering
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={clsx(
                      "px-4 py-2 grid grid-cols-[auto_1fr_1fr_120px_80px_24px] gap-2 items-center",
                      "hover:bg-theme-surface-hover",
                      !searchQuery && "cursor-move",
                      draggedIndex === index && "opacity-50 bg-theme-surface-elevated",
                      !col.selected && "opacity-60"
                    )}
                  >
                    {/* Checkbox */}
                    <div className="w-8 flex justify-center">
                      <input
                        type="checkbox"
                        checked={col.selected}
                        onChange={() => toggleSelectedByName(col.name)}
                        className="w-4 h-4 rounded border-theme-border-primary text-theme-interactive-accent focus:ring-theme-interactive-accent"
                      />
                    </div>

                    {/* Original Column Name */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate text-theme-text-primary" title={col.name}>
                        {col.name}
                      </span>
                      <span className="text-xs text-theme-text-tertiary">
                        {originalType}
                      </span>
                    </div>

                    {/* Rename Input */}
                    <div>
                      <input
                        type="text"
                        value={col.rename || ""}
                        onChange={(e) =>
                          updateColumnByName(col.name, {
                            rename: e.target.value || undefined,
                          })
                        }
                        placeholder={col.name}
                        disabled={!col.selected}
                        className={clsx(
                          "w-full px-2 py-1 text-sm rounded border",
                          "bg-theme-surface-panel border-theme-border-primary",
                          "text-theme-text-primary placeholder-theme-text-disabled",
                          "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      />
                    </div>

                    {/* Type Selector */}
                    <div className="relative">
                      <select
                        value={col.targetType || originalType}
                        onChange={(e) =>
                          updateColumnByName(col.name, {
                            targetType:
                              e.target.value === originalType
                                ? undefined
                                : e.target.value,
                          })
                        }
                        disabled={!col.selected}
                        className={clsx(
                          "w-full px-2 py-1 text-sm rounded border appearance-none",
                          "bg-theme-surface-panel border-theme-border-primary",
                          "text-theme-text-primary",
                          "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          col.targetType && col.targetType !== originalType
                            ? "border-theme-interactive-accent"
                            : ""
                        )}
                        title={typeInfo?.description}
                      >
                        {Array.from(CASTABLE_TYPES_BY_UI_GROUP.entries()).map(([groupName, types]) => (
                          <optgroup key={groupName} label={groupName}>
                            {types.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Size column - shows size/range for fixed types, input for strings */}
                    <div>
                      {showSize ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={col.size || ""}
                            onChange={(e) =>
                              updateColumnByName(col.name, {
                                size: e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : undefined,
                              })
                            }
                            placeholder="Max"
                            min={1}
                            disabled={!col.selected}
                            className={clsx(
                              "w-16 px-2 py-1 text-sm rounded border",
                              "bg-theme-surface-panel border-theme-border-primary",
                              "text-theme-text-primary placeholder-theme-text-disabled",
                              "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          />
                          <span className="text-xs text-theme-text-tertiary">chars</span>
                        </div>
                      ) : (
                        <span className="text-xs text-theme-text-secondary">
                          {typeInfo?.sizeDisplay || "-"}
                        </span>
                      )}
                    </div>

                    {/* Reset Button */}
                    <div className="flex justify-center">
                      {isModified && (
                        <button
                          onClick={() => resetColumn(col.name)}
                          className="text-theme-text-tertiary hover:text-theme-interactive-accent"
                          title="Reset to original"
                        >
                          ↺
                        </button>
                      )}
                    </div>
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
