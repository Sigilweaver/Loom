/* eslint-disable no-useless-escape -- Regex patterns include forward slashes and character classes; disabling to keep readable explicit escaping */
import React, { useMemo, useState } from "react";
import { WorkflowSerializer } from "../domain/workflow/services/WorkflowSerializer";
import { useUIStore } from "../state/uiStore";
import { useWorkflowStore } from "../state/workflowStore";

// Function to format JSON with proper indentation
function formatJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

// Simple JSON syntax highlighter
function highlightJSON(json: string): JSX.Element[] {
  const lines = json.split("\n");

  return lines.map((line, index) => {
    const leadingWhitespace = line.match(/^(\s*)/)?.[1] || "";
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return <div key={index} className="h-6 leading-relaxed"></div>;
    }

    const parts: JSX.Element[] = [];
    let partKey = 0;

    // Add leading whitespace
    if (leadingWhitespace) {
      parts.push(
        <span key={partKey++} className="whitespace-pre">
          {leadingWhitespace}
        </span>
      );
    }

    // JSON syntax highlighting regex
    const jsonRegex =
      /("(?:[^"\\]|\\.)*")|(\d+\.?\d*)|(\btrue\b|\bfalse\b|\bnull\b)|([\{\}\[\],:])/g;
    let lastIndex = 0;
    let match;

    while ((match = jsonRegex.exec(trimmedLine)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(
          <span key={partKey++} className="text-theme-syntax-text">
            {trimmedLine.substring(lastIndex, match.index)}
          </span>
        );
      }

      if (match[1]) {
        // String (property name or value)
        const str = match[1];
        // Check if it's a property name (followed by :)
        const nextChar = trimmedLine[match.index + str.length];
        if (nextChar === ":") {
          parts.push(
            <span
              key={partKey++}
              className="font-medium text-theme-syntax-attribute"
            >
              {str}
            </span>
          );
        } else {
          parts.push(
            <span key={partKey++} className="text-theme-syntax-value">
              {str}
            </span>
          );
        }
      } else if (match[2]) {
        // Number
        parts.push(
          <span key={partKey++} className="text-theme-syntax-number">
            {match[2]}
          </span>
        );
      } else if (match[3]) {
        // Boolean or null
        parts.push(
          <span
            key={partKey++}
            className="font-medium text-theme-syntax-keyword"
          >
            {match[3]}
          </span>
        );
      } else if (match[4]) {
        // Punctuation
        parts.push(
          <span key={partKey++} className="text-theme-syntax-tag">
            {match[4]}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < trimmedLine.length) {
      parts.push(
        <span key={partKey++} className="text-theme-syntax-text">
          {trimmedLine.substring(lastIndex)}
        </span>
      );
    }

    return (
      <div key={index} className="font-mono leading-relaxed">
        {parts.length > 0 ? (
          parts
        ) : (
          <span className="text-theme-syntax-text">{trimmedLine}</span>
        )}
      </div>
    );
  });
}

/**
 * WorkflowViewer - Display current workflow data in formatted JSON
 *
 * Shows the serialized workflow state for debugging and inspection.
 * Applies JSON syntax highlighting.
 */
export default function WorkflowViewer() {
  const isVisible = useUIStore((s) => s.workflowViewerVisible);
  const setWorkflowViewerVisible = useUIStore(
    (s) => s.setWorkflowViewerVisible
  );
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);

  // Compute JSON content from workflow state
  const workflowContent = useMemo(
    () => WorkflowSerializer.toJSON(tools, wires, workflowMeta),
    [tools, wires, workflowMeta]
  );

  const [width, setWidth] = useState(384); // Default width (w-96 = 384px)
  const [isResizing, setIsResizing] = useState(false);

  // Format and highlight JSON content
  const formattedContent = formatJSON(workflowContent);
  const highlightedContent = highlightJSON(formattedContent);

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
            title="Copy formatted JSON to clipboard"
          >
            Copy
          </button>
          <button
            onClick={() => setWorkflowViewerVisible(false)}
            className="px-3 py-1.5 bg-theme-modal-btn-secondary-bg hover:bg-theme-modal-btn-secondary-bg-hover text-theme-modal-btn-secondary-text border border-theme-modal-btn-secondary-border hover:border-theme-modal-btn-secondary-border-hover rounded text-sm font-medium transition-colors"
            title="Close workflow viewer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Description below header */}
      <div className="px-4 py-3 border-b bg-theme-modal-header-bg border-theme-modal-header-border">
        <p className="text-sm opacity-75 text-theme-modal-header-text">
          Live JSON representation of the current workflow (v2.0 format)
        </p>
      </div>

      {/* Content with syntax highlighting */}
      <div className="flex-1 p-4 overflow-auto bg-theme-modal-content-bg">
        <div className="p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap border rounded bg-theme-surface-elevated overflow-wrap-anywhere">
          {highlightedContent}
        </div>
      </div>
    </div>
  );
}
