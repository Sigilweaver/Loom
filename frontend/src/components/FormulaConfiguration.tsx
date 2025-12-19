import { useEffect, useMemo } from "react";
import { ToolConfig, EmissionMap, Tool, Wire, WorkflowMeta } from "../domain/workflow/entities/workflow";
import { ConfigText } from "./primitives/ConfigText";
import { ConfigSelect } from "./primitives/ConfigSelect";
import { CodeEditor } from "./common/CodeEditor";
import { HelpLink } from "./common/HelpLink";
import { usePolarsFunctions } from "../api/hooks";
import { useToolConfiguration } from "../hooks/useToolConfiguration";
import { EXPRESSION_DOCS_URL } from "@data/tools";
import { CommonSockets } from "@domain/workflow/constants/socketIds";

// Special value indicating creation of a new column
const NEW_COLUMN_VALUE = "__new_column__";

// Default values for Formula tool (must match TOOL_DEFINITIONS)
const FORMULA_DEFAULTS = {
  expression: "",
  column_name: "",
} as const;

/**
 * Build the emission map for Formula tool config.
 * Preserves existing _emit entries and updates Formula-specific fields
 * based on whether they differ from defaults.
 */
function buildFormulaEmit(config: ToolConfig): EmissionMap {
  // Start with existing _emit to preserve entries for other fields
  const emit: EmissionMap = { ...(config._emit as EmissionMap | undefined) };
  
  const expression = (config.expression as string) ?? "";
  const columnName = (config.column_name as string) ?? "";
  
  // Update Formula-specific fields based on whether they differ from defaults
  if (expression !== FORMULA_DEFAULTS.expression) {
    emit.expression = true;
  } else {
    delete emit.expression;
  }
  if (columnName !== FORMULA_DEFAULTS.column_name) {
    emit.column_name = true;
  } else {
    delete emit.column_name;
  }
  
  return emit;
}

interface FormulaConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function FormulaConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: FormulaConfigurationProps) {
  // Unified configuration hook - handles metadata and connections
  const { columns } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  // Polars functions for autocomplete
  const { functions, fetchFunctions } = usePolarsFunctions();
  useEffect(() => {
    if (!functions) fetchFunctions();
  }, [functions, fetchFunctions]);

  // Build dropdown options from available columns
  const targetColumnOptions = useMemo(() => {
    const options = [
      {
        value: NEW_COLUMN_VALUE,
        label: "(New Column)",
        description: "Create a new calculated column",
      },
    ];

    // Add existing columns as replacement options
    for (const col of columns) {
      options.push({
        value: col.name,
        label: col.name,
        description: `Replace existing ${col.dtype || "column"}`,
      });
    }

    return options;
  }, [columns]);

  // Determine current dropdown selection - if column_name matches an existing column, show it selected
  const currentTargetColumn = useMemo(() => {
    const columnName = config.column_name as string | undefined;
    
    // If column_name matches an existing column, show it as selected
    if (columnName) {
      const existingColumn = columns.find(col => col.name === columnName);
      if (existingColumn) {
        return columnName;
      }
    }
    return NEW_COLUMN_VALUE;
  }, [config.column_name, columns]);

  // Check if we're creating a new column
  const isNewColumn = currentTargetColumn === NEW_COLUMN_VALUE;

  const handleTargetColumnChange = (
    value: string | undefined,
    _emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const isNew = value === NEW_COLUMN_VALUE || !value;
    const newColumnName = isNew ? "" : value;
    const newConfig: ToolConfig = {
      ...config,
      column_name: newColumnName,
    };
    // Build emission map based on what differs from defaults
    newConfig._emit = buildFormulaEmit(newConfig);
    onChange(newConfig);
  };

  const handleColumnNameChange = (
    value: string | undefined,
    _emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig: ToolConfig = {
      ...config,
      column_name: value || "",
    };
    // Build emission map based on what differs from defaults
    newConfig._emit = buildFormulaEmit(newConfig);
    onChange(newConfig);
  };

  const handleExpressionChange = (value: string) => {
    const newConfig: ToolConfig = {
      ...config,
      expression: value || "",
    };
    // Build emission map based on what differs from defaults
    newConfig._emit = buildFormulaEmit(newConfig);
    onChange(newConfig);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Info Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-sm">
          <h3 className="font-semibold text-theme-text-primary mb-2">
            Formula Tool
          </h3>
          <p className="text-theme-text-secondary mb-2">
            Create or update a column using Polars expressions. You can either
            add a new calculated column or replace an existing one.
          </p>
        </div>

        {/* Target Column Selection */}
        <div className="space-y-2">
          <ConfigSelect
            configKey="column_name"
            value={currentTargetColumn}
            onChange={handleTargetColumnChange}
            label="Target Column"
            description="Select an existing column to replace, or create a new column"
            options={targetColumnOptions}
            placeholder="Select target column"
            searchable={columns.length > 5}
            searchPlaceholder="Search columns..."
          />
        </div>

        {/* Column Name Input - only shown when creating new column */}
        {isNewColumn && (
          <div className="space-y-2">
            <ConfigText
              configKey="column_name"
              label="New Column Name"
              value={(config.column_name as string) || ""}
              onChange={handleColumnNameChange}
              placeholder="result"
              description="Name for the new calculated column"
              required
            />
          </div>
        )}

        {/* Expression Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-theme-text-primary">
              Formula Expression
              <span className="text-theme-error ml-1">*</span>
            </label>
            <HelpLink url={EXPRESSION_DOCS_URL} label="Expression syntax help" />
          </div>
          <div className="border border-theme-border rounded overflow-hidden">
            <CodeEditor
              value={(config.expression as string) || ""}
              onChange={handleExpressionChange}
              language="python"
              height="200px"
              placeholder="pl.col('amount') * 1.1"
              columns={columns}
              polarsFunctions={functions}
            />
          </div>
          <p className="text-xs text-theme-text-tertiary">
            Write a Polars expression that calculates the column value
          </p>
        </div>

        {/* Examples Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs space-y-3">
          <h4 className="font-semibold text-theme-text-primary mb-2">
            Example Expressions:
          </h4>

          <div className="space-y-2">
            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('price') * pl.col('quantity')
              </div>
              <div className="text-theme-text-tertiary">
                Multiply two columns together
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('amount') * 1.1
              </div>
              <div className="text-theme-text-tertiary">
                Increase values by 10%
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.when(pl.col('x') &gt; 0).then(pl.lit('Positive')).otherwise(pl.lit('Negative'))
              </div>
              <div className="text-theme-text-tertiary">
                Conditional expressions (if-then-else)
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('first_name') + ' ' + pl.col('last_name')
              </div>
              <div className="text-theme-text-tertiary">
                Concatenate text columns
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('date').str.slice(0, 4)
              </div>
              <div className="text-theme-text-tertiary">
                Extract year from date string
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                (pl.col('total') - pl.col('discount')).round(2)
              </div>
              <div className="text-theme-text-tertiary">
                Math operations with rounding
              </div>
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs">
          <h4 className="font-semibold text-theme-text-primary mb-2">Tips:</h4>
          <ul className="space-y-1 text-theme-text-secondary list-disc list-inside">
            <li>Use pl.col('column_name') to reference existing columns</li>
            <li>Use pl.lit(value) for literal values in expressions</li>
            <li>Chain methods with dots: pl.col('x').abs().sqrt()</li>
            <li>Select an existing column to replace it with a calculated value</li>
            <li>Choose "(New Column)" to add a new column to your dataframe</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
