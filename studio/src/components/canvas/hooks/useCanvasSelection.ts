import type { Tool } from "@domain/workflow/entities/workflow";
import { useUIStore } from "@state/uiStore";
import type { Node, Edge } from "@xyflow/react";
import { useCallback } from "react";

export interface UseCanvasSelectionParams {
  tools: Tool[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onToolSelect: (tool: Tool | null) => void;
  onClosePositionMenu: () => void;
}

/**
 * Hook that manages canvas selection state and selection-related callbacks.
 * Handles node clicks, pane clicks, and selection change synchronization.
 */
export function useCanvasSelection({
  tools,
  setNodes,
  onToolSelect,
  onClosePositionMenu,
}: UseCanvasSelectionParams) {
  const setPreviewState = useUIStore((s) => s.setPreviewState);

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, n: Node) => {
      const tool = tools.find((t) => t.id === n.id);
      if (tool) {
        onToolSelect(tool);
        // Note: Preview only happens when clicking sockets, not the node itself
      }
    },
    [tools, onToolSelect]
  );

  const onPaneClick = useCallback(() => {
    onClosePositionMenu();
    onToolSelect(null);
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
    // Clear preview when clicking away
    setPreviewState(null);
  }, [onClosePositionMenu, onToolSelect, setNodes, setPreviewState]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      if (selectedNodes.length === 1) {
        const first = selectedNodes[0];
        const tool = first
          ? (tools.find((t) => t.id === first.id) ?? null)
          : null;
        onToolSelect(tool);
      } else {
        onToolSelect(null);
      }
    },
    [tools, onToolSelect]
  );

  return {
    onNodeClick,
    onPaneClick,
    onSelectionChange,
  } as const;
}
