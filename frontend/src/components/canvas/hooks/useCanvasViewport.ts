/**
 * useCanvasViewport - Sync ReactFlow viewport with UIStore
 *
 * Ensures viewport state (zoom/pan) is:
 * 1. Saved to UIStore when changed by user
 * 2. Restored from UIStore when tab is loaded
 */

import { useUIStore } from "@state/uiStore";
import { useReactFlow, type Viewport } from "@xyflow/react";
import { useEffect, useRef } from "react";

export function useCanvasViewport() {
  const { setViewport: setReactFlowViewport } = useReactFlow();
  const savedViewport = useUIStore((s) => s.viewport);
  const setUIViewport = useUIStore((s) => s.setViewport);
  
  const isRestoringRef = useRef(false);

  // Restore viewport when savedViewport changes (tab switch)
  useEffect(() => {
    if (savedViewport && !isRestoringRef.current) {
      isRestoringRef.current = true;
      setReactFlowViewport(savedViewport, { duration: 0 });
      // Small delay to ensure the viewport is set
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 50);
    }
  }, [savedViewport, setReactFlowViewport]);

  // Save viewport changes to UIStore
  const handleViewportChange = (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    if (!isRestoringRef.current) {
      setUIViewport(viewport);
    }
  };

  return { onMove: handleViewportChange };
}
