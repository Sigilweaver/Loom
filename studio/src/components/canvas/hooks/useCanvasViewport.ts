/**
 * useCanvasViewport - Sync ReactFlow viewport with UIStore per tab
 *
 * Ensures viewport state (zoom/pan) is:
 * 1. Saved to UIStore when changed by user
 * 2. Restored from UIStore when tab is switched
 * 3. Fit to view when switching to a tab with no saved viewport (new workflows)
 *
 * Key insight: We must track activeTabId, not just viewport values,
 * because viewport values might be identical between tabs (e.g., both null)
 * but we still need to restore when switching.
 */

import { useTabStore } from "@state/tabStore";
import { useUIStore } from "@state/uiStore";
import { useReactFlow, type Viewport } from "@xyflow/react";
import { useEffect, useRef } from "react";

export function useCanvasViewport() {
  const { setViewport: setReactFlowViewport, fitView } = useReactFlow();
  const savedViewport = useUIStore((s) => s.viewport);
  const setUIViewport = useUIStore((s) => s.setViewport);
  const activeTabId = useTabStore((s) => s.activeTabId);
  
  const isRestoringRef = useRef(false);
  const lastTabIdRef = useRef<string | null>(null);

  // Restore viewport when tab changes
  // Track activeTabId to detect tab switches, even when viewport values are identical
  useEffect(() => {
    // Only restore on actual tab change, not on initial mount
    const isTabSwitch = lastTabIdRef.current !== null && lastTabIdRef.current !== activeTabId;
    lastTabIdRef.current = activeTabId;

    if (isTabSwitch && !isRestoringRef.current) {
      isRestoringRef.current = true;
      
      if (savedViewport) {
        // Restore the saved viewport for this tab
        setReactFlowViewport(savedViewport, { duration: 0 });
      } else {
        // New tab with no saved viewport - fit to view instantly
        // Small delay to let the nodes render first
        setTimeout(() => {
          fitView({ duration: 0, padding: 0.2 });
        }, 0);
      }
      
      // Small delay to ensure the viewport is set before accepting new changes
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 50);
    }
  }, [activeTabId, savedViewport, setReactFlowViewport, fitView]);

  // Save viewport changes to UIStore
  const handleViewportChange = (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    if (!isRestoringRef.current) {
      setUIViewport(viewport);
    }
  };

  return { onMove: handleViewportChange };
}
