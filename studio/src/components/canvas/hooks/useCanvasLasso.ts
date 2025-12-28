import { useEffect } from "react";

/**
 * Hook that manages the lasso selection visual state.
 * Shows marquee only while actively dragging a selection.
 * Supports both mouse and touch interactions.
 */
export function useCanvasLasso() {
  useEffect(() => {
    const activateLasso = () => {
      document.body.classList.add("sig-lasso-active");
    };
    const deactivateLasso = () => {
      document.body.classList.remove("sig-lasso-active");
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        activateLasso();
      }
    };
    const onMouseUp = () => {
      deactivateLasso();
    };
    const onTouchStart = () => {
      activateLasso();
    };
    const onTouchEnd = () => {
      deactivateLasso();
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);
}
