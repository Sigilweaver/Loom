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

/**
 * Type metadata with human-readable descriptions
 */
interface TypeInfo {
  value: string;
  label: string;
  category: "integer" | "float" | "string" | "boolean" | "temporal" | "other";
  size: number; // bytes
  sizeDisplay: string; // compact display for Size column
  description: string;
}

const TYPE_INFO: TypeInfo[] = [
  // Signed integers
  {
    value: "Int8",
    label: "Int8",
    category: "integer",
    size: 1,
    sizeDisplay: "1 Byte | -128 - 127",
    description: "-128 to 127",
  },
  {
    value: "Int16",
    label: "Int16",
    category: "integer",
    size: 2,
    sizeDisplay: "2 Bytes | -32,768 - 32,767",
    description: "-32,768 to 32,767",
  },
  {
    value: "Int32",
    label: "Int32",
    category: "integer",
    size: 4,
    sizeDisplay: "4 Bytes | -2.1B - 2.1B",
    description: "-2.1B to 2.1B",
  },
  {
    value: "Int64",
    label: "Int64",
    category: "integer",
    size: 8,
    sizeDisplay: "8 Bytes | -9.2e18 - 9.2e18",
    description: "-9.2e18 to 9.2e18",
  },
  // Unsigned integers
  {
    value: "UInt8",
    label: "UInt8",
    category: "integer",
    size: 1,
    sizeDisplay: "1 Byte | 0 - 255",
    description: "0 to 255",
  },
  {
    value: "UInt16",
    label: "UInt16",
    category: "integer",
    size: 2,
    sizeDisplay: "2 Bytes | 0 - 65,535",
    description: "0 to 65,535",
  },
  {
    value: "UInt32",
    label: "UInt32",
    category: "integer",
    size: 4,
    sizeDisplay: "4 Bytes | 0 - 4.3B",
    description: "0 to 4.3B",
  },
  {
    value: "UInt64",
    label: "UInt64",
    category: "integer",
    size: 8,
    sizeDisplay: "8 Bytes | 0 - 1.8e19",
    description: "0 to 1.8e19",
  },
  // Floats
  {
    value: "Float32",
    label: "Float32",
    category: "float",
    size: 4,
    sizeDisplay: "4 Bytes | ~7 digits precision",
    description: "~7 digits precision",
  },
  {
    value: "Float64",
    label: "Float64",
    category: "float",
    size: 8,
    sizeDisplay: "8 Bytes | ~15 digits precision",
    description: "~15 digits precision",
  },
  // String
  {
    value: "String",
    label: "String",
    category: "string",
    size: 0,
    sizeDisplay: "variable",
    description: "Variable length text",
  },
  {
    value: "Utf8",
    label: "Utf8",
    category: "string",
    size: 0,
    sizeDisplay: "variable",
    description: "UTF-8 encoded text",
  },
  // Boolean
  {
    value: "Boolean",
    label: "Boolean",
    category: "boolean",
    size: 1,
    sizeDisplay: "1 bit | true - false",
    description: "true / false",
  },
  // Temporal
  {
    value: "Date",
    label: "Date",
    category: "temporal",
    size: 4,
    sizeDisplay: "4 Bytes",
    description: "Calendar date",
  },
  {
    value: "Datetime",
    label: "Datetime",
    category: "temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Date + time (ns)",
  },
  {
    value: "Time",
    label: "Time",
    category: "temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Time of day",
  },
  {
    value: "Duration",
    label: "Duration",
    category: "temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Time duration",
  },
  // Other
  {
    value: "Categorical",
    label: "Categorical",
    category: "other",
    size: 0,
    sizeDisplay: "variable",
    description: "Enum-like values",
  },
];

const TYPE_INFO_MAP = new Map(TYPE_INFO.map((t) => [t.value, t]));

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
  const { metadata, fetchMetadata, loading } = useMetadata();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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
    fetchMetadata(toolId, JSON.parse(workflow));
  }, [toolId, wireConnections, fetchMetadata]);

  // Get input columns from metadata
  const inputColumns: ColumnSchema[] = metadata?.columns || [];

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

  // Toggle selection for a column
  const toggleSelected = useCallback(
    (index: number) => {
      const current = columnConfigs[index];
      if (!current) return;
      updateColumnConfig(index, { selected: !current.selected });
    },
    [columnConfigs, updateColumnConfig]
  );

  // Select/deselect all
  const selectAll = useCallback(
    (selected: boolean) => {
      const newConfigs = columnConfigs.map((c) => ({ ...c, selected }));
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
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-border-primary bg-theme-surface-panel">
          <div className="text-sm text-theme-text-secondary">
            {selectedCount} of {columnConfigs.length} columns selected
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => selectAll(true)}
              className="px-2 py-1 text-xs border rounded border-theme-border-primary hover:bg-theme-surface-hover text-theme-text-secondary"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => selectAll(false)}
              className="px-2 py-1 text-xs border rounded border-theme-border-primary hover:bg-theme-surface-hover text-theme-text-secondary"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Column Table Header */}
        <div className="px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <div className="grid grid-cols-[auto_1fr_1fr_120px_80px] gap-2 text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
            <div className="w-8"></div>
            <div>Column</div>
            <div>Rename</div>
            <div>Type</div>
            <div>Size</div>
          </div>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto">
          {columnConfigs.length === 0 ? (
            <div className="p-4 text-sm text-center text-theme-text-tertiary">
              No columns available
            </div>
          ) : (
            <div className="divide-y divide-theme-border-primary">
              {columnConfigs.map((col, index) => {
                const originalType = getOriginalType(col.name);
                const currentType = col.targetType || originalType;
                const typeInfo = TYPE_INFO_MAP.get(currentType);
                const showSize = isStringType(col.name, col.targetType);

                return (
                  <div
                    key={col.name}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={clsx(
                      "px-4 py-2 grid grid-cols-[auto_1fr_1fr_120px_80px] gap-2 items-center",
                      "hover:bg-theme-surface-hover cursor-move",
                      draggedIndex === index && "opacity-50 bg-theme-surface-elevated",
                      !col.selected && "opacity-60"
                    )}
                  >
                    {/* Checkbox */}
                    <div className="w-8">
                      <input
                        type="checkbox"
                        checked={col.selected}
                        onChange={() => toggleSelected(index)}
                        className="w-4 h-4 rounded border-theme-border-primary text-theme-interactive-accent focus:ring-theme-interactive-accent"
                      />
                    </div>

                    {/* Original Column Name */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate text-theme-text-primary">
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
                          updateColumnConfig(index, {
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
                          updateColumnConfig(index, {
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
                        <optgroup label="Integers (Signed)">
                          <option value="Int8">Int8</option>
                          <option value="Int16">Int16</option>
                          <option value="Int32">Int32</option>
                          <option value="Int64">Int64</option>
                        </optgroup>
                        <optgroup label="Integers (Unsigned)">
                          <option value="UInt8">UInt8</option>
                          <option value="UInt16">UInt16</option>
                          <option value="UInt32">UInt32</option>
                          <option value="UInt64">UInt64</option>
                        </optgroup>
                        <optgroup label="Decimal">
                          <option value="Float32">Float32</option>
                          <option value="Float64">Float64</option>
                        </optgroup>
                        <optgroup label="Text">
                          <option value="String">String</option>
                          <option value="Utf8">Utf8</option>
                        </optgroup>
                        <optgroup label="Other">
                          <option value="Boolean">Boolean</option>
                          <option value="Date">Date</option>
                          <option value="Datetime">Datetime</option>
                          <option value="Time">Time</option>
                          <option value="Duration">Duration</option>
                          <option value="Categorical">Categorical</option>
                        </optgroup>
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
                              updateColumnConfig(index, {
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Type Reference */}
        <details className="border-t border-theme-border-primary">
          <summary className="px-4 py-2 text-sm font-medium cursor-pointer text-theme-text-secondary hover:bg-theme-surface-hover">
            Type Reference
          </summary>
          <div className="px-4 py-3 space-y-2 text-xs bg-theme-surface-elevated">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <span className="font-semibold text-theme-text-primary">
                  Int8/16/32/64:
                </span>{" "}
                <span className="text-theme-text-secondary">
                  Signed integers
                </span>
              </div>
              <div>
                <span className="font-semibold text-theme-text-primary">
                  UInt8/16/32/64:
                </span>{" "}
                <span className="text-theme-text-secondary">
                  Unsigned (0+)
                </span>
              </div>
              <div>
                <span className="font-semibold text-theme-text-primary">
                  Float32:
                </span>{" "}
                <span className="text-theme-text-secondary">
                  ~7 decimal digits
                </span>
              </div>
              <div>
                <span className="font-semibold text-theme-text-primary">
                  Float64:
                </span>{" "}
                <span className="text-theme-text-secondary">
                  ~15 decimal digits
                </span>
              </div>
              <div>
                <span className="font-semibold text-theme-text-primary">
                  String/Utf8:
                </span>{" "}
                <span className="text-theme-text-secondary">
                  Text (Size = max chars)
                </span>
              </div>
              <div>
                <span className="font-semibold text-theme-text-primary">
                  Boolean:
                </span>{" "}
                <span className="text-theme-text-secondary">true/false</span>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
