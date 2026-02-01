import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { useToolConfiguration } from "@hooks/useToolConfiguration";
import { ColumnSchema } from "@api/backend";
import clsx from "clsx";
import { ChevronUp, ChevronDown } from "lucide-react";
import { POLARS_TYPES_MAP, CASTABLE_TYPES_BY_UI_GROUP } from "@data/polarsTypes";
import { CommonSockets } from "@domain/workflow/constants/socketIds";
import { ConfigColumnSelector, ColumnSelectorItemHandlers, ReorderButtonsProps } from "@components/primitives";

// Re-export for local use with original name for minimal code changes
const TYPE_INFO_MAP = POLARS_TYPES_MAP;

/**
 * Configuration for a single column in the Select tool.
 * `id` is required for ConfigColumnSelector constraint.
 * All optional fields use explicit undefined to work with exactOptionalPropertyTypes
 */
interface ColumnConfig {
  [key: string]: unknown; // Required for ColumnSelectorItem constraint
  id: string; // Same as name, required for ConfigColumnSelector
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
    id: name,
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
    const name = typeof obj.name === "string" ? obj.name : "";
    return {
      id: name,
      name,
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

  const [searchQuery, setSearchQuery] = useState("");

  // Ref for portal target (reorder buttons in toolbar)
  const reorderButtonsRef = useRef<HTMLDivElement>(null);

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

  // Handle reordering from ConfigColumnSelector
  const handleReorder = useCallback(
    (newItems: ColumnConfig[]) => {
      // Don't allow reordering while filtering - the UI is complex and
      // reorder buttons are hidden anyway when searchQuery is active
      if (searchQuery) {
        return;
      }

      const newConfig: ToolConfig = {
        ...config,
        columnConfigs: serializeColumnConfigs(newItems),
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          columnConfigs: true,
        },
      };
      onChange(newConfig);
    },
    [config, onChange, searchQuery]
  );

  // Render reorder buttons via portal into the toolbar
  const renderReorderButtons = useCallback(
    ({ onMoveUp, onMoveDown, canMoveUp, canMoveDown, disabled: isDisabled }: ReorderButtonsProps) => {
      if (!reorderButtonsRef.current || searchQuery) {
        return null;
      }
      return createPortal(
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isDisabled || !canMoveUp}
            className={clsx(
              "p-1 rounded border border-theme-border-primary",
              "text-theme-text-secondary hover:text-theme-text-primary",
              "hover:bg-theme-surface-hover transition-colors",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
            title="Move selection up (Arrow Up)"
            aria-label="Move selection up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isDisabled || !canMoveDown}
            className={clsx(
              "p-1 rounded border border-theme-border-primary",
              "text-theme-text-secondary hover:text-theme-text-primary",
              "hover:bg-theme-surface-hover transition-colors",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
            title="Move selection down (Arrow Down)"
            aria-label="Move selection down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>,
        reorderButtonsRef.current
      );
    },
    [searchQuery]
  );

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

  // Render each column row
  const renderColumnItem = useCallback(
    (col: ColumnConfig, _handlers: ColumnSelectorItemHandlers) => {
      const originalType = getOriginalType(col.name);
      const currentType = col.targetType || originalType;
      const typeInfo = TYPE_INFO_MAP.get(currentType);
      const showSize = isStringType(col.name, col.targetType);
      const isModified = col.rename || col.targetType || col.size;

      // Build tooltip with type and size info
      const tooltipParts = [originalType];
      if (typeInfo?.sizeDisplay) tooltipParts.push(typeInfo.sizeDisplay);
      if (showSize && col.size) tooltipParts.push(`Max ${col.size} chars`);
      if (typeInfo?.description) tooltipParts.push(typeInfo.description);
      const tooltip = tooltipParts.join(' • ');

      return (
        <div
          className={clsx(
            "flex items-center gap-3 w-full",
            !col.selected && "opacity-60"
          )}
        >
          {/* Checkbox */}
          <div className="w-4 flex-shrink-0">
            <input
              type="checkbox"
              checked={col.selected}
              onChange={(e) => {
                e.stopPropagation();
                toggleSelectedByName(col.name);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-theme-border-primary text-theme-interactive-accent focus:ring-theme-interactive-accent"
            />
          </div>

          {/* Column Name */}
          <div className="w-[200px] flex-shrink-0">
            <span className="text-sm font-medium text-theme-text-primary whitespace-nowrap" title={tooltip}>
              {col.name}
            </span>
          </div>

          {/* Rename Input */}
          <div className="w-[180px] flex-shrink-0">
            <input
              type="text"
              value={col.rename || ""}
              onChange={(e) =>
                updateColumnByName(col.name, {
                  rename: e.target.value || undefined,
                })
              }
              onClick={(e) => e.stopPropagation()}
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

          {/* Type Selector with inline size for strings */}
          <div className="flex-1 flex items-center gap-2">
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
              onClick={(e) => e.stopPropagation()}
              disabled={!col.selected}
              className={clsx(
                "w-[140px] px-2 py-1 text-sm rounded border appearance-none",
                "bg-theme-surface-panel border-theme-border-primary",
                "text-theme-text-primary",
                "focus:outline-none focus:ring-1 focus:ring-theme-interactive-accent",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                col.targetType && col.targetType !== originalType
                  ? "border-theme-interactive-accent"
                  : ""
              )}
              title={tooltip}
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
            {showSize && (
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
                  onClick={(e) => e.stopPropagation()}
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
                  title="Maximum string length"
                />
                <span className="text-xs text-theme-text-tertiary whitespace-nowrap">ch</span>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <div className="w-4 flex-shrink-0">
            {isModified && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetColumn(col.name);
                }}
                className="text-theme-text-tertiary hover:text-theme-interactive-accent"
                title="Reset to original"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      );
    },
    [getOriginalType, isStringType, toggleSelectedByName, updateColumnByName, resetColumn]
  );

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
              Select, rename, reorder, and convert columns. Use arrow keys to
              reorder (shift+click to select multiple). Unchecked columns will be excluded from output.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 px-4 py-2 border-b border-theme-border-primary bg-theme-surface-panel">
          <div className="flex items-center justify-between">
            <div className="text-sm text-theme-text-secondary">
              {selectedCount} of {columnConfigs.length} columns selected
            </div>
            <div className="flex items-center gap-2">
              {/* Reorder buttons portal target */}
              <div ref={reorderButtonsRef} className="flex items-center" />
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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable table container */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div>
            {/* Column Table Header */}
            <div className="border-b border-theme-border-primary bg-theme-surface-elevated sticky top-0 z-10">
              <div className="px-4 py-2 flex items-center gap-3 text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
                <div className="w-4 flex-shrink-0">
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
                <div className="w-[200px] flex-shrink-0">Column</div>
                <div className="w-[180px] flex-shrink-0">Rename</div>
                <div className="flex-1 flex items-center gap-1">
                  Type
                  <a
                    href="https://sigilweaver.app/docs/user/data-types"
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
                <div className="w-4 flex-shrink-0"></div>
              </div>
            </div>

            {/* Column List using ConfigColumnSelector */}
            <ConfigColumnSelector<ColumnConfig>
              items={filteredConfigs}
              onReorder={handleReorder}
              itemRenderer={renderColumnItem}
              emptyMessage={searchQuery ? "No matching columns found" : "No columns available"}
              showReorderButtons={false}
              {...(!searchQuery && filteredConfigs.length > 1 ? { renderReorderButtons } : {})}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
