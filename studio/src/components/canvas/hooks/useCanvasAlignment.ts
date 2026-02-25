import {
  autoLayout,
  type LayoutOptions,
} from "@domain/workflow/services/autoLayout";
import { useWorkflowStore } from "@state/workflowStore";
import { useSettingsStore } from "@state/settingsStore";
import { useCallback } from "react";

export interface UseCanvasAlignmentParams {
  onToolMove: (id: string, x: number, y: number) => void;
  onBeginTransaction: () => void;
  onCommitTransaction: () => void;
}

/**
 * Hook that provides auto-layout for the workflow canvas.
 *
 * Uses a Sugiyama-style layered layout to arrange tools following the DAG
 * structure, with socket-aware crossing minimization and configurable
 * alignment (upstream, downstream, or balanced).
 *
 * Layout options are read from the settings store and can be overridden
 * by passing {@link LayoutOptions} to the returned function.
 */
export function useCanvasAlignment({
  onToolMove,
  onBeginTransaction,
  onCommitTransaction,
}: UseCanvasAlignmentParams) {
  const doAutoLayout = useCallback(
    (overrides?: LayoutOptions) => {
      const { tools, wires } = useWorkflowStore.getState();
      if (tools.length === 0) return;

      // Read persisted layout preferences from settings store
      const { layout } = useSettingsStore.getState();
      const options: LayoutOptions = {
        alignment: layout.alignment,
        horizontalSpacing: layout.horizontalSpacing,
        verticalSpacing: layout.verticalSpacing,
        gridSnap: layout.gridSnap,
        ...overrides,
      };

      const { positions } = autoLayout(tools, wires, options);
      if (positions.length === 0) return;

      onBeginTransaction();
      positions.forEach((p) => onToolMove(p.id, p.x, p.y));
      onCommitTransaction();
    },
    [onToolMove, onBeginTransaction, onCommitTransaction],
  );

  return { autoLayout: doAutoLayout } as const;
}
