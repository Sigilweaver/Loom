import { useClipboardStore } from "@state/clipboardStore";
import type { Edge, Node, XYPosition } from "@xyflow/react";
import { useCallback, useState } from "react";

export interface UseCanvasContextMenuParams {
  screenToFlowPosition: (pos: { x: number; y: number }) => XYPosition;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setPasteAnchor: (x: number, y: number) => void;
}

export interface ContextMenuState {
  actionsOpen: boolean;
  actionsCoords: { x: number; y: number } | null;
  edgeMenuOpen: boolean;
  edgeMenuCoords: { x: number; y: number } | null;
  edgeMenuEdge: Edge | null;
}

/**
 * Hook that manages context menu state and handlers.
 * Handles actions menu, edge menu, and pane context menu.
 */
export function useCanvasContextMenu({
  screenToFlowPosition,
  setNodes,
  setPasteAnchor,
}: UseCanvasContextMenuParams) {
  // Actions menu state (for nodes)
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsCoords, setActionsCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Edge context menu state
  const [edgeMenuOpen, setEdgeMenuOpen] = useState(false);
  const [edgeMenuCoords, setEdgeMenuCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [edgeMenuEdge, setEdgeMenuEdge] = useState<Edge | null>(null);

  const openActionsMenuAt = useCallback(
    (coords: { x: number; y: number }) => {
      setActionsCoords(coords);
      setActionsOpen(true);
    },
    []
  );

  const closeActionsMenu = useCallback(() => setActionsOpen(false), []);

  const onNodeContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent, n: Node) => {
      e.preventDefault();
      // Select only this node if it's not already part of a selection
      setNodes((ns) => {
        const alreadySelected = ns.find((nd) => nd.id === n.id)?.selected;
        if (alreadySelected) return ns; // keep multi-selection
        return ns.map((nd) => ({ ...nd, selected: nd.id === n.id }));
      });
      // Position menu at mouse cursor and set paste anchor
      const clientX =
        (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
      const clientY =
        (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setPasteAnchor(flowPos.x, flowPos.y);
      setActionsCoords({ x: clientX, y: clientY });
      setActionsOpen(true);
    },
    [setNodes, screenToFlowPosition, setPasteAnchor]
  );

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      // Update last mouse flow position to this point so Paste uses it
      const clientX =
        (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
      const clientY =
        (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setPasteAnchor(flowPos.x, flowPos.y);
      // Build a paste-only menu if clipboard exists
      const hasClipboard = !!useClipboardStore.getState().clipboard;
      if (!hasClipboard) return;
      setActionsCoords({ x: clientX, y: clientY });
      setActionsOpen(true);
    },
    [screenToFlowPosition, setPasteAnchor]
  );

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setEdgeMenuEdge(edge);
    setEdgeMenuCoords({ x: e.clientX, y: e.clientY });
    setEdgeMenuOpen(true);
  }, []);

  const closeEdgeMenu = useCallback(() => setEdgeMenuOpen(false), []);

  return {
    // Actions menu
    actionsOpen,
    actionsCoords,
    openActionsMenuAt,
    closeActionsMenu,
    onNodeContextMenu,
    onPaneContextMenu,
    // Edge menu
    edgeMenuOpen,
    edgeMenuCoords,
    edgeMenuEdge,
    onEdgeContextMenu,
    closeEdgeMenu,
  } as const;
}
