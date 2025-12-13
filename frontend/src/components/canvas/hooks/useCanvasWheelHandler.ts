import { useCallback } from "react";

/**
 * Hook that provides a no-op wheel event handler.
 * Prevents default wheel behavior on the canvas when needed.
 */
export function useCanvasWheelHandler() {
  return useCallback((_e: React.WheelEvent) => {}, []);
}
