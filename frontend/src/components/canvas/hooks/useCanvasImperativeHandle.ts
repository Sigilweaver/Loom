import { useImperativeHandle } from "react";

export interface CanvasRef {
  fitView: () => void;
}

export interface UseCanvasImperativeHandleParams {
  ref: React.Ref<CanvasRef>;
  fitView: (options?: { duration?: number; padding?: number }) => void;
}

/**
 * Hook that exposes canvas API methods to parent components via ref.
 * Currently exposes fitView for programmatic viewport control.
 */
export function useCanvasImperativeHandle({
  ref,
  fitView,
}: UseCanvasImperativeHandleParams) {
  useImperativeHandle(
    ref,
    () => ({ fitView: () => fitView({ duration: 800, padding: 0.1 }) }),
    [fitView]
  );
}
