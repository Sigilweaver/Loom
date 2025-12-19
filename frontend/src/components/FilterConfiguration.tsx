import { useEffect } from "react";
import { ToolConfig, EmissionMap, Tool, Wire, WorkflowMeta } from "../domain/workflow/entities/workflow";
import { CodeEditor } from "./common/CodeEditor";
import { HelpLink } from "./common/HelpLink";
import { usePolarsFunctions } from "../api/hooks";
import { useToolConfiguration } from "../hooks/useToolConfiguration";
import { EXPRESSION_DOCS_URL } from "@data/tools";
import { CommonSockets } from "@domain/workflow/constants/socketIds";

// Default values for Filter tool (must match TOOL_DEFINITIONS)
const FILTER_DEFAULTS = {
  expression: "",
  mode: "Custom",
} as const;

/**
 * Build the emission map for Filter tool config.
 * Preserves existing _emit entries and updates Filter-specific fields
 * based on whether they differ from defaults.
 */
function buildFilterEmit(config: ToolConfig): EmissionMap {
  // Start with existing _emit to preserve entries for other fields
  const emit: EmissionMap = { ...(config._emit as EmissionMap | undefined) };
  
  const expression = (config.expression as string) ?? "";
  const mode = (config.mode as string) ?? FILTER_DEFAULTS.mode;
  
  // Update Filter-specific fields based on whether they differ from defaults
  if (expression !== FILTER_DEFAULTS.expression) {
    emit.expression = true;
  } else {
    delete emit.expression;
  }
  if (mode !== FILTER_DEFAULTS.mode) {
    emit.mode = true;
  } else {
    delete emit.mode;
  }
  
  return emit;
}

interface FilterConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function FilterConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: FilterConfigurationProps) {
  // Unified configuration hook - handles metadata, connections, emissions
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

  const handleExpressionChange = (value: string) => {
    const newConfig: ToolConfig = {
      ...config,
      expression: value || "",
    };
    // Build emission map based on what differs from defaults
    newConfig._emit = buildFilterEmit(newConfig);
    onChange(newConfig);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Info Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-sm">
          <h3 className="font-semibold text-theme-text-primary mb-2">
            Filter Tool
          </h3>
          <p className="text-theme-text-secondary mb-2">
            Split data based on a condition. Rows matching the expression go to
            the True (T) output, others go to False (F).
          </p>
        </div>

        {/* Expression Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-theme-text-primary">
              Filter Expression
            </label>
            <HelpLink url={EXPRESSION_DOCS_URL} label="Expression syntax help" />
          </div>
          <div className="border border-theme-border rounded overflow-hidden">
            <CodeEditor
              value={(config.expression as string) || ""}
              onChange={handleExpressionChange}
              language="python"
              height="200px"
              placeholder="pl.col('age') > 18"
              columns={columns}
              polarsFunctions={functions}
            />
          </div>
          <p className="text-xs text-theme-text-tertiary">
            Write a Polars expression that returns True/False for each row
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
                pl.col('age') &gt; 30
              </div>
              <div className="text-theme-text-tertiary">
                Filter rows where age is greater than 30
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('status') == 'active'
              </div>
              <div className="text-theme-text-tertiary">
                Filter rows where status equals 'active'
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                (pl.col('a') &gt; 10) &amp; (pl.col('b') &lt; 20)
              </div>
              <div className="text-theme-text-tertiary">
                Multiple conditions with AND
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('name').str.contains('test')
              </div>
              <div className="text-theme-text-tertiary">
                Filter rows where name contains 'test'
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('value').is_not_null()
              </div>
              <div className="text-theme-text-tertiary">
                Filter out null values
              </div>
            </div>
          </div>
        </div>

        {/* Output Sockets Info */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs">
          <h4 className="font-semibold text-theme-text-primary mb-2">
            Output Sockets:
          </h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-theme-surface-panel px-2 py-0.5 rounded text-green-500">
                T
              </span>
              <span className="text-theme-text-secondary">
                Rows where expression is True
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-theme-surface-panel px-2 py-0.5 rounded text-red-500">
                F
              </span>
              <span className="text-theme-text-secondary">
                Rows where expression is False
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
