import type { Edge } from "@xyflow/react";
import { useEffect } from "react";

export interface UseCanvasEdgeSyncParams {
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

/**
 * Hook that synchronizes React Flow edge state with workflow store edges.
 * Updates the visual edge representation when workflow wires change.
 */
export function useCanvasEdgeSync({ edges, setEdges }: UseCanvasEdgeSyncParams) {
  useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);
}
