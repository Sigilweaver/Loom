import { useEffect } from "react";

/**
 * Hook that manages the lasso selection visual state.
 * Shows marquee only while actively dragging a selection.
 */
export function useCanvasLasso() {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        document.body.classList.add("sig-lasso-active");
      }
    };
    const onMouseUp = () => {
      document.body.classList.remove("sig-lasso-active");
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
}
