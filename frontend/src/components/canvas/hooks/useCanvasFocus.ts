import { useCallback, useRef } from "react";

export interface UseCanvasFocusParams {
  isPointerDownRef: React.MutableRefObject<boolean>;
}

export interface UseCanvasFocusResult {
  keyScopeRef: React.RefObject<HTMLDivElement>;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

/**
 * Hook that manages canvas focus and pointer state tracking.
 * Handles mousedown and touchstart events to track pointer state and focus the canvas for keyboard input.
 * Supports both mouse and touch interactions.
 */
export function useCanvasFocus({ isPointerDownRef }: UseCanvasFocusParams): UseCanvasFocusResult {
  const keyScopeRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        isPointerDownRef.current = true;
        const onUp = () => {
          isPointerDownRef.current = false;
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mouseup", onUp);
      }
      keyScopeRef.current?.focus();
    },
    [isPointerDownRef]
  );

  const onTouchStart = useCallback(
    (_e: React.TouchEvent) => {
      isPointerDownRef.current = true;
      const onTouchEnd = () => {
        isPointerDownRef.current = false;
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      };
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("touchcancel", onTouchEnd);
      keyScopeRef.current?.focus();
    },
    [isPointerDownRef]
  );

  return { keyScopeRef, onMouseDown, onTouchStart };
}
