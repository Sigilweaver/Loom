import { useCallback, useRef } from "react";

export interface UseCanvasFocusParams {
  isPointerDownRef: React.MutableRefObject<boolean>;
}

/**
 * Hook that manages canvas focus and pointer state tracking.
 * Handles mousedown events to track pointer state and focus the canvas for keyboard input.
 */
export function useCanvasFocus({ isPointerDownRef }: UseCanvasFocusParams) {
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

  return { keyScopeRef, onMouseDown };
}
