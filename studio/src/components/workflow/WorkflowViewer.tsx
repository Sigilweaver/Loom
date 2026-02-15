import { useMemo, useState, useEffect } from "react";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { useCodePreview } from "@api/hooks";
import { useWorkflowStore } from "@state/workflowStore";
import { createLogger } from "@utils/logger";
import CodeBlock from "@components/common/CodeBlock";

const logger = createLogger('WorkflowViewer');

type ViewMode = "json" | "python";

// Function to format JSON with proper indentation
function formatJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

/**
 * WorkflowViewer - Display current workflow data in formatted JSON or Python
 *
 * Shows the serialized workflow state for debugging and inspection.
 * Applies syntax highlighting for JSON and Python code.
 */
export default function WorkflowViewer() {
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);

  const [viewMode, setViewMode] = useState<ViewMode>("json");

  // Use code preview hook for backend-generated Python
  const { code: pythonCode, loading: pythonLoading, error: pythonError, generateCode } = useCodePreview();

  // Compute JSON content from workflow state
  const workflowContent = useMemo(
    () => WorkflowSerializer.toJSON(tools, wires, workflowMeta),
    [tools, wires, workflowMeta]
  );

  // Parse workflow for Python generation
  const workflowJSON = useMemo(() => {
    try {
      return JSON.parse(workflowContent);
    } catch {
      return null;
    }
  }, [workflowContent]);

  // Fetch Python code from backend when switching to Python view
  useEffect(() => {
    if (viewMode === "python" && workflowJSON && !pythonCode && !pythonLoading) {
      generateCode(workflowJSON);
    }
  }, [viewMode, workflowJSON, pythonCode, pythonLoading, generateCode]);

  // Determine content to display based on mode
  const pythonContent = pythonError 
    ? `# Error generating code:\n# ${pythonError}`
    : pythonLoading
    ? "# Generating code..."
    : pythonCode || "# No code generated yet";

  // Format content based on mode
  const formattedContent = viewMode === "json" 
    ? formatJSON(workflowContent)
    : pythonContent;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formattedContent);
    } catch (err) {
      logger.error("Failed to copy content:", err);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-theme-modal-container-bg"
    >
      {/* Tab bar with copy button */}
      <div className="flex border-b bg-theme-modal-header-bg border-theme-modal-header-border">
        <button
          onClick={() => setViewMode("json")}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "json"
              ? "text-theme-modal-header-text border-b-2 border-theme-interactive-accent"
              : "text-theme-text-tertiary hover:text-theme-modal-header-text"
          }`}
        >
          JSON
        </button>
        <button
          onClick={() => setViewMode("python")}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "python"
              ? "text-theme-modal-header-text border-b-2 border-theme-interactive-accent"
              : "text-theme-text-tertiary hover:text-theme-modal-header-text"
          }`}
        >
          Python
        </button>
        <button
          onClick={copyToClipboard}
          className="px-3 py-2 text-xs font-medium text-theme-text-tertiary hover:text-theme-modal-header-text transition-colors"
          title={`Copy ${viewMode === "json" ? "JSON" : "Python code"} to clipboard`}
        >
          Copy
        </button>
      </div>

      {/* Description below tabs */}
      <div className="px-4 py-3 border-b bg-theme-modal-header-bg border-theme-modal-header-border">
        <p className="text-sm opacity-75 text-theme-modal-header-text">
          {viewMode === "json" 
            ? "Live JSON representation of the current workflow (v2.0 format)"
            : "Executable Python code using Polars (generated from workflow)"
          }
        </p>
      </div>

      {/* Content with syntax highlighting */}
      <div className="flex-1 overflow-auto bg-theme-modal-content-bg">
        <CodeBlock 
          code={formattedContent}
          language={viewMode === "json" ? "json" : "python"}
          showLineNumbers={true}
        />
      </div>
    </div>
  );
}
