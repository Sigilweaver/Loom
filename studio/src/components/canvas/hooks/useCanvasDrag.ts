import type { Node } from "@xyflow/react";
import { useCallback } from "react";

export interface UseCanvasDragParams {
  getNodes: () => Node[];
  snap: (x: number, y: number) => { x: number; y: number };
  onToolMove: (id: string, x: number, y: number) => void;
  onBeginTransaction: () => void;
  onCommitTransaction: () => void;
}

/**
 * Hook that handles node drag start and stop events.
 * Manages transaction boundaries and applies snapping on drag end.
 */
export function useCanvasDrag({
  getNodes,
  snap,
  onToolMove,
  onBeginTransaction,
  onCommitTransaction,
}: UseCanvasDragParams) {
  const onNodeDragStart = useCallback(
    (_e: MouseEvent | TouchEvent, _n: Node) => {
      onBeginTransaction();
    },
    [onBeginTransaction]
  );

  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, _n: Node) => {
      // Persist positions for all selected nodes (group move)
      const current = getNodes();
      current
        .filter((nd) => nd.selected)
        .forEach((nd) => {
          const s = snap(nd.position.x, nd.position.y);
          onToolMove(nd.id, s.x, s.y);
        });
      onCommitTransaction();
    },
    [getNodes, onToolMove, snap, onCommitTransaction]
  );

  return {
    onNodeDragStart,
    onNodeDragStop,
  } as const;
}
