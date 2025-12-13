import type { Connection, Edge } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { useCallback } from "react";

export interface UseCanvasConnectionParams {
  onAddWire: (
    from: { tool: string; socket: string },
    to: { tool: string; socket: string }
  ) => void;
  onRemoveWire: (id: string) => void;
  onRemoveTool: (id: string) => void;
  onToolSelect: (tool: null) => void;
}

/**
 * Hook that handles connection (wire) events and node deletion.
 */
export function useCanvasConnection({
  onAddWire,
  onRemoveWire,
  onRemoveTool,
  onToolSelect,
}: UseCanvasConnectionParams) {
  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target && c.sourceHandle && c.targetHandle) {
        const fromSocket = c.sourceHandle.replace("output-", "");
        const toSocket = c.targetHandle.replace("input-", "");
        onAddWire(
          { tool: c.source, socket: fromSocket },
          { tool: c.target, socket: toSocket }
        );
      }
    },
    [onAddWire]
  );

  const onEdgesDelete = useCallback(
    (es: Edge[]) => {
      es.forEach((e) => onRemoveWire(e.id));
    },
    [onRemoveWire]
  );

  const onNodesDelete = useCallback(
    (ns: Node[]) => {
      ns.forEach((n) => onRemoveTool(n.id));
      onToolSelect(null);
    },
    [onRemoveTool, onToolSelect]
  );

  return {
    onConnect,
    onEdgesDelete,
    onNodesDelete,
  } as const;
}
