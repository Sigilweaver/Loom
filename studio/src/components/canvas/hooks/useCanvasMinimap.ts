import { useUIStore } from "@state/uiStore";
import { calculateMenuPosition } from "@utils/menuPositioning";
import { useCallback, useRef } from "react";

export interface UseCanvasMinimapParams {
  onOpenActionsMenu: (coords: { x: number; y: number }) => void;
}

/**
 * Hook that manages minimap state and controls.
 * Handles minimap visibility, position, and position menu interactions.
 */
export function useCanvasMinimap({ onOpenActionsMenu }: UseCanvasMinimapParams) {
  const minimapButtonRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLDivElement>(null);

  // UI store selectors
  const minimapVisible = useUIStore((s) => s.minimapVisible);
  const minimapPosition = useUIStore((s) => s.minimapPosition);
  const positionMenuOpen = useUIStore((s) => s.positionMenuOpen);
  const positionMenuCoords = useUIStore((s) => s.positionMenuCoords);
  const toggleMinimap = useUIStore((s) => s.toggleMinimap);
  const setMinimapPosition = useUIStore((s) => s.setMinimapPosition);
  const openPositionMenu = useUIStore((s) => s.openPositionMenu);
  const closePositionMenu = useUIStore((s) => s.closePositionMenu);

  const handleMinimapButtonContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (minimapButtonRef.current && !positionMenuOpen) {
        const rect = minimapButtonRef.current.getBoundingClientRect();
        const pos = calculateMenuPosition(
          rect,
          { width: 100, height: 160 },
          4,
          "bottom"
        );
        openPositionMenu({ x: pos.x, y: pos.y });
      } else if (positionMenuOpen) {
        closePositionMenu();
      }
    },
    [positionMenuOpen, openPositionMenu, closePositionMenu]
  );

  const handlePositionSelect = useCallback(
    (p: "top-left" | "top-right" | "bottom-left" | "bottom-right") =>
      setMinimapPosition(p),
    [setMinimapPosition]
  );

  const openActionsMenu = useCallback(() => {
    if (!actionsButtonRef.current) return;
    const rect = actionsButtonRef.current.getBoundingClientRect();
    const pos = calculateMenuPosition(
      rect,
      { width: 140, height: 160 },
      4,
      "bottom"
    );
    onOpenActionsMenu({ x: pos.x, y: pos.y });
  }, [onOpenActionsMenu]);

  return {
    // Refs
    minimapButtonRef,
    actionsButtonRef,
    // State
    minimapVisible,
    minimapPosition,
    positionMenuOpen,
    positionMenuCoords,
    // Handlers
    toggleMinimap,
    handleMinimapButtonContextMenu,
    handlePositionSelect,
    openActionsMenu,
    closePositionMenu,
  } as const;
}
