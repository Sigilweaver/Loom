import { useMemo } from "react";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { TOOL_DEFINITIONS } from "@data/tools";
import { useSocketPreview } from "@hooks/useSocketPreview";

interface SocketTabInfo {
  socketId: string;
  direction: "input" | "output";
  label: string;
  type: string | undefined;
  isConnected: boolean;
}

/**
 * Sidebar component showing socket tabs for the selected tool's preview
 * Groups sockets by input/output and allows switching between them
 */
const SocketTabs = () => {
  const previewState = useUIStore((s) => s.previewState);
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const { previewSocket } = useSocketPreview();

  // Get the current tool - prefer selectedTool (what user clicked), fallback to previewState
  const currentTool = useMemo(() => {
    // Prefer the currently selected tool on canvas (most recent user action)
    if (selectedTool) {
      return selectedTool;
    }
    // Fallback to tool from preview state if nothing selected
    if (previewState?.toolId) {
      return tools.find((t) => t.id === previewState.toolId) ?? null;
    }
    return null;
  }, [selectedTool, previewState?.toolId, tools]);

  // Get tool definition for socket info
  const toolDefinition = useMemo(() => {
    if (!currentTool) return null;
    return TOOL_DEFINITIONS.find((def) => def.type === currentTool.type);
  }, [currentTool]);

  // Build socket tab info with labels and connection status
  const socketTabs = useMemo((): { inputs: SocketTabInfo[]; outputs: SocketTabInfo[] } => {
    if (!currentTool || !toolDefinition) {
      return { inputs: [], outputs: [] };
    }

    const inputs: SocketTabInfo[] = [];
    const outputs: SocketTabInfo[] = [];

    // Count sockets by direction for labeling
    const inputSockets = toolDefinition.sockets.filter((s) => s.direction === "input");
    const outputSockets = toolDefinition.sockets.filter((s) => s.direction === "output");

    for (const socket of toolDefinition.sockets) {
      const isConnected =
        socket.direction === "input"
          ? wires.some((w) => w.to.tool === currentTool.id && w.to.socket === socket.id)
          : wires.some((w) => w.from.tool === currentTool.id && w.from.socket === socket.id);

      // Generate label based on socket type and count
      let label: string;
      if (socket.type) {
        // Use type-based labels
        switch (socket.type) {
          case "T":
            label = "True";
            break;
          case "F":
            label = "False";
            break;
          case "L":
            label = socket.direction === "input" ? "Left In" : "Left Out";
            break;
          case "R":
            label = socket.direction === "input" ? "Right In" : "Right Out";
            break;
          case "J":
            label = "Join Out";
            break;
          default:
            label = socket.type;
        }
      } else if (socket.direction === "input") {
        // For inputs, check if multiple or single
        if (socket.multiple || inputSockets.length > 1) {
          // Find index among input sockets
          const idx = inputSockets.findIndex((s) => s.id === socket.id);
          label = `Input ${idx + 1}`;
        } else {
          label = "Input";
        }
      } else {
        // For outputs
        if (outputSockets.length > 1) {
          const idx = outputSockets.findIndex((s) => s.id === socket.id);
          label = `Output ${idx + 1}`;
        } else {
          label = "Output";
        }
      }

      const tabInfo: SocketTabInfo = {
        socketId: socket.id,
        direction: socket.direction,
        label,
        type: socket.type,
        isConnected,
      };

      if (socket.direction === "input") {
        inputs.push(tabInfo);
      } else {
        outputs.push(tabInfo);
      }
    }

    return { inputs, outputs };
  }, [currentTool, toolDefinition, wires]);

  // Get tool category color
  const categoryColorClass = useMemo(() => {
    if (!toolDefinition) return "text-theme-text-primary";
    
    switch (toolDefinition.category) {
      case "connect": return "text-theme-tool-connect";
      case "compute": return "text-theme-tool-compute";
      case "reshape": return "text-theme-tool-reshape";
      case "combine": return "text-theme-tool-combine";
      default: return "text-theme-text-primary";
    }
  }, [toolDefinition]);

  // Handle tab click
  const handleTabClick = (socketId: string, direction: "input" | "output") => {
    if (!currentTool) return;
    previewSocket(currentTool.id, socketId, direction);
  };

  // Check if a tab is currently selected
  const isSelected = (socketId: string, direction: "input" | "output") => {
    return (
      previewState?.socketId === socketId && previewState?.socketDirection === direction
    );
  };

  if (!currentTool || !toolDefinition) {
    return (
      <div className="flex items-center justify-center h-full p-3 text-xs text-theme-text-tertiary">
        Select a socket to preview
      </div>
    );
  }

  // Filter inputs to only show connected ones
  const connectedInputs = socketTabs.inputs.filter((tab) => tab.isConnected);

  // Don't show sidebar if no sockets to display
  if (connectedInputs.length === 0 && socketTabs.outputs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col h-full py-2">
      {/* Tool Name Header */}
      <div className="px-3 pb-2 mb-2 border-b border-theme-border-secondary">
        <div className="flex items-center gap-2">
          <toolDefinition.icon className={`w-4 h-4 ${categoryColorClass}`} />
          <span className="text-xs font-medium truncate text-theme-text-primary">
            {currentTool.type}
          </span>
        </div>
      </div>

      {/* Inputs Section */}
      {connectedInputs.length > 0 && (
        <div className="mb-3">
          <div className="px-3 mb-1 text-xs font-medium tracking-wider uppercase text-theme-text-tertiary">
            Inputs
          </div>
          <div className="space-y-0.5">
            {connectedInputs.map((tab) => (
              <button
                key={`input-${tab.socketId}`}
                onClick={() => handleTabClick(tab.socketId, "input")}
                disabled={previewState?.loading}
                className={`w-full px-3 py-1.5 text-left text-xs transition-colors rounded ${
                  isSelected(tab.socketId, "input")
                    ? "bg-theme-interactive-accent/20 text-theme-interactive-accent font-medium border border-theme-interactive-accent"
                    : "text-theme-text-secondary hover:bg-theme-surface-elevated hover:text-theme-text-primary border border-transparent"
                } ${previewState?.loading ? "opacity-50 cursor-wait" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Outputs Section */}
      {socketTabs.outputs.length > 0 && (
        <div>
          <div className="px-3 mb-1 text-xs font-medium tracking-wider uppercase text-theme-text-tertiary">
            Outputs
          </div>
          <div className="space-y-0.5">
            {socketTabs.outputs.map((tab) => (
              <button
                key={`output-${tab.socketId}`}
                onClick={() => handleTabClick(tab.socketId, "output")}
                disabled={previewState?.loading}
                className={`w-full px-3 py-1.5 text-left text-xs transition-colors rounded ${
                  isSelected(tab.socketId, "output")
                    ? "bg-theme-interactive-accent/20 text-theme-interactive-accent font-medium border border-theme-interactive-accent"
                    : "text-theme-text-secondary hover:bg-theme-surface-elevated hover:text-theme-text-primary border border-transparent"
                } ${previewState?.loading ? "opacity-50 cursor-wait" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SocketTabs;
