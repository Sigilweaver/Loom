import { useEffect, useMemo } from "react";
import { ToolConfig, EmissionMap, Tool, Wire, WorkflowMeta } from "../domain/workflow/entities/workflow";
import { ConfigText } from "./primitives/ConfigText";
import { CodeEditor } from "./common/CodeEditor";
import { useMetadata, usePolarsFunctions } from "../api/hooks";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";

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
  const { metadata, fetchMetadata } = useMetadata();
  const { functions, fetchFunctions } = usePolarsFunctions();

  const columns = metadata?.columns || [];

  // Fetch Polars functions on mount
  useEffect(() => {
    if (!functions) {
      fetchFunctions();
    }
  }, [functions, fetchFunctions]);

  // Track wire connections to this tool - only refetch when they change
  const wireConnections = useMemo(() => {
    return wires.filter(w => w.to.tool === toolId).map(w => `${w.from.tool}-${w.from.socket}`).sort().join(',');
  }, [wires, toolId]);

  // Fetch metadata when component mounts or connections change
  useEffect(() => {
    const workflow = WorkflowSerializer.toJSON(tools, wires, workflowMeta);
    fetchMetadata(toolId, JSON.parse(workflow));
  }, [toolId, wireConnections, fetchMetadata]); // Only depend on wireConnections, not all tools/wires/meta
  const handleColumnNameChange = (
    value: string | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      column_name: value || "",
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  const handleExpressionChange = (value: string) => {
    const newConfig = {
      ...config,
      expression: value || "",
      _emit: {
        ...config._emit,
        expression: true,
      },
    };
    onChange(newConfig);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Column Name Input */}
        <div className="space-y-2">
          <ConfigText
            configKey="column_name"
            label="New Column Name"
            value={(config.column_name as string) || ""}
            onChange={handleColumnNameChange}
            placeholder="result"
            required
          />
        </div>

        {/* Expression Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-text-primary">
            Formula Expression
            <span className="text-theme-error ml-1">*</span>
          </label>
          <div className="border border-theme-border rounded overflow-hidden">
            <CodeEditor
              value={(config.expression as string) || ""}
              onChange={handleExpressionChange}
              language="python"
              height="300px"
              placeholder="pl.col('amount') * 1.1"
              columns={columns}
              polarsFunctions={functions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
