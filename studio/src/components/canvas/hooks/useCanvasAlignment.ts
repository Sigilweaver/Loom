import { autoLayout } from "@domain/workflow/services/autoLayout";
import { useWorkflowStore } from "@state/workflowStore";
import { useCallback } from "react";

export interface UseCanvasAlignmentParams {
  onToolMove: (id: string, x: number, y: number) => void;
  onBeginTransaction: () => void;
  onCommitTransaction: () => void;
}

/**
 * Hook that provides auto-layout for the workflow canvas.
 *
 * Uses topological sort to arrange tools left-to-right following the DAG
 * structure, with parallel branches stacked vertically.
 */
export function useCanvasAlignment({
  onToolMove,
  onBeginTransaction,
  onCommitTransaction,
}: UseCanvasAlignmentParams) {
  const doAutoLayout = useCallback(() => {
    const { tools, wires } = useWorkflowStore.getState();
    if (tools.length === 0) return;

    const { positions } = autoLayout(tools, wires);
    if (positions.length === 0) return;

    onBeginTransaction();
    positions.forEach((p) => onToolMove(p.id, p.x, p.y));
    onCommitTransaction();
  }, [onToolMove, onBeginTransaction, onCommitTransaction]);

  return { autoLayout: doAutoLayout } as const;
}
