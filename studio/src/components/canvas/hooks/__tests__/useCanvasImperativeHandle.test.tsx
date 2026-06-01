import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasImperativeHandle,
  type UseCanvasImperativeHandleParams,
  type CanvasRef,
} from "../useCanvasImperativeHandle";

describe("useCanvasImperativeHandle", () => {
  let params: UseCanvasImperativeHandleParams;
  let fitView: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let refObject: React.MutableRefObject<CanvasRef | null>;

  beforeEach(() => {
    fitView = vi.fn();
    refObject = { current: null };

    params = {
      ref: refObject,
      fitView,
    };
  });

  it("should expose fitView method via ref", () => {
    renderHook(() => useCanvasImperativeHandle(params));

    expect(refObject.current).toBeTruthy();
    expect(refObject.current).toHaveProperty("fitView");
    expect(typeof refObject.current?.fitView).toBe("function");
  });

  it("should call fitView with correct options when exposed method is called", () => {
    renderHook(() => useCanvasImperativeHandle(params));
    
    refObject.current?.fitView();

    expect(fitView).toHaveBeenCalledWith({ duration: 800, padding: 0.1 });
  });

  it("should update when fitView changes", () => {
    const { rerender } = renderHook(() => useCanvasImperativeHandle(params));

    const firstFitView = fitView;

    // Call with first fitView
    refObject.current?.fitView();
    expect(firstFitView).toHaveBeenCalledWith({ duration: 800, padding: 0.1 });

    // Change fitView
    const newFitView = vi.fn();
    params.fitView = newFitView;
    rerender();

    // Call with new fitView
    refObject.current?.fitView();
    expect(newFitView).toHaveBeenCalledWith({ duration: 800, padding: 0.1 });
  });
});
