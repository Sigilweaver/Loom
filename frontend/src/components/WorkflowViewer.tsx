import React, { useMemo, useState, useEffect } from "react";
import { WorkflowSerializer } from "../domain/workflow/services/WorkflowSerializer";
import { useCodePreview } from "../api/hooks";
import { useUIStore } from "../state/uiStore";
import { useWorkflowStore } from "../state/workflowStore";
import CodeBlock from "./common/CodeBlock";

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
  const isVisible = useUIStore((s) => s.workflowViewerVisible);
  const setWorkflowViewerVisible = useUIStore(
    (s) => s.setWorkflowViewerVisible
  );
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);

  const [viewMode, setViewMode] = useState<ViewMode>("json");
  const [width, setWidth] = useState(384); // Default width (w-96 = 384px)
  const [isResizing, setIsResizing] = useState(false);

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
    if (isVisible && viewMode === "python" && workflowJSON && !pythonCode && !pythonLoading) {
      generateCode(workflowJSON);
    }
  }, [isVisible, viewMode, workflowJSON, pythonCode, pythonLoading, generateCode]);

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
      // Could add notification here if needed
    } catch (err) {
      console.error("Failed to copy content:", err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;
    setWidth(Math.max(300, Math.min(800, newWidth))); // Min 300px, max 800px
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add global mouse event listeners when resizing
  React.useEffect(() => {
    if (!isResizing) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove]);

  if (!isVisible) return null;

  return (
    <div
      className="relative flex flex-col h-full border-l bg-theme-modal-container-bg border-theme-modal-container-border"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute top-0 left-0 z-10 w-1 h-full transition-colors cursor-col-resize hover:bg-theme-interactive-accent"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-theme-modal-header-bg border-theme-modal-header-border">
        {/* Code icon */}
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-theme-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-semibold text-theme-modal-header-text">
            Workflow Viewer
          </h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 bg-theme-modal-btn-primary-bg hover:bg-theme-modal-btn-primary-bg-hover text-theme-modal-btn-primary-text border border-theme-modal-btn-primary-border hover:border-theme-modal-btn-primary-border-hover rounded text-sm font-medium transition-colors"
            title={`Copy ${viewMode === "json" ? "JSON" : "Python code"} to clipboard`}
          >
            Copy
          </button>
          <button
            onClick={() => setWorkflowViewerVisible(false)}
            className="px-3 py-1.5 bg-theme-modal-btn-secondary-bg hover:bg-theme-modal-btn-secondary-bg-hover text-theme-modal-btn-secondary-text border border-theme-modal-btn-secondary-border hover:border-theme-modal-btn-secondary-border-hover rounded text-sm font-medium transition-colors"
            title="Close workflow viewer"
          >
            X
          </button>
        </div>
      </div>

      {/* Tab bar */}
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
