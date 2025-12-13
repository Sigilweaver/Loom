import type { XYPosition } from "@xyflow/react";
import { useCallback } from "react";

export interface UseCanvasMouseTrackingParams {
  screenToFlowPosition: (pos: { x: number; y: number }) => XYPosition;
  setPasteAnchor: (x: number, y: number) => void;
}

/**
 * Hook that tracks mouse movement to update the paste anchor position.
 * The paste anchor determines where pasted tools will be positioned.
 */
export function useCanvasMouseTracking({
  screenToFlowPosition,
  setPasteAnchor,
}: UseCanvasMouseTrackingParams) {
  return useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPasteAnchor(pos.x, pos.y);
    },
    [screenToFlowPosition, setPasteAnchor]
  );
}
