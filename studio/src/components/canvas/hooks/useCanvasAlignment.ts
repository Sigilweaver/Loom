import {
  alignHorizontally as doAlignH,
  alignVertically as doAlignV,
  distributeHorizontally as doDistH,
  distributeVertically as doDistV,
  type PositionUpdate,
} from "@utils/alignDistribute";
import type { Node } from "@xyflow/react";
import { useCallback } from "react";

export interface UseCanvasAlignmentParams {
  getNodes: () => Node[];
  snap: (x: number, y: number) => { x: number; y: number };
  onToolMove: (id: string, x: number, y: number) => void;
  onBeginTransaction: () => void;
  onCommitTransaction: () => void;
}

/**
 * Hook that provides alignment and distribution operations for selected nodes.
 */
export function useCanvasAlignment({
  getNodes,
  snap,
  onToolMove,
  onBeginTransaction,
  onCommitTransaction,
}: UseCanvasAlignmentParams) {
  const applyPositions = useCallback(
    (updates: PositionUpdate[]) => {
      if (!updates.length) return;
      onBeginTransaction();
      updates.forEach((u) => onToolMove(u.id, u.x, u.y));
      onCommitTransaction();
    },
    [onBeginTransaction, onCommitTransaction, onToolMove]
  );

  const alignHorizontally = useCallback(() => {
    const updates = doAlignH(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);

  const alignVertically = useCallback(() => {
    const updates = doAlignV(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);

  const distributeHorizontally = useCallback(() => {
    const updates = doDistH(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);

  const distributeVertically = useCallback(() => {
    const updates = doDistV(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);

  return {
    alignHorizontally,
    alignVertically,
    distributeHorizontally,
    distributeVertically,
  } as const;
}
