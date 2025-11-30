import { useEffect, useMemo } from "react";
import { ToolConfig, Tool, Wire, WorkflowMeta } from "../domain/workflow/entities/workflow";
import { CodeEditor } from "./common/CodeEditor";
import { useMetadata, usePolarsFunctions } from "../api/hooks";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";

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
        {/* Expression Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-text-primary">
            Filter Expression
          </label>
          <div className="border border-theme-border rounded overflow-hidden">
            <CodeEditor
              value={(config.expression as string) || ""}
              onChange={handleExpressionChange}
              language="python"
              height="300px"
              placeholder="pl.col('age') > 18"
              columns={columns}
              polarsFunctions={functions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
