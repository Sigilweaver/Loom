import { act, renderHook } from "@testing-library/react";
import type { XYPosition } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasMouseTracking,
  type UseCanvasMouseTrackingParams,
} from "../useCanvasMouseTracking";

describe("useCanvasMouseTracking", () => {
  let params: UseCanvasMouseTrackingParams;
  let screenToFlowPosition: (pos: { x: number; y: number }) => XYPosition;
  let setPasteAnchor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    screenToFlowPosition = vi.fn((pos: { x: number; y: number }) => ({
      x: pos.x + 10,
      y: pos.y + 20,
    })) as (pos: { x: number; y: number }) => XYPosition;
    setPasteAnchor = vi.fn();

    params = {
      screenToFlowPosition,
      setPasteAnchor,
    };
  });

  it("should return a mouse move handler", () => {
    const { result } = renderHook(() => useCanvasMouseTracking(params));

    expect(typeof result.current).toBe("function");
  });

  it("should convert screen coordinates to flow coordinates", () => {
    const { result } = renderHook(() => useCanvasMouseTracking(params));
    const handler = result.current;

    const mockEvent = {
      clientX: 100,
      clientY: 200,
    } as React.MouseEvent;

    act(() => {
      handler(mockEvent);
    });

    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 100, y: 200 });
  });

  it("should update paste anchor with flow coordinates", () => {
    const { result } = renderHook(() => useCanvasMouseTracking(params));
    const handler = result.current;

    const mockEvent = {
      clientX: 100,
      clientY: 200,
    } as React.MouseEvent;

    act(() => {
      handler(mockEvent);
    });

    expect(setPasteAnchor).toHaveBeenCalledWith(110, 220);
  });

  it("should memoize handler when dependencies do not change", () => {
    const { result, rerender } = renderHook(() => useCanvasMouseTracking(params));

    const firstHandler = result.current;
    rerender();
    const secondHandler = result.current;

    expect(firstHandler).toBe(secondHandler);
  });

  it("should update handler when screenToFlowPosition changes", () => {
    const { result, rerender } = renderHook(() => useCanvasMouseTracking(params));

    const firstHandler = result.current;

    params.screenToFlowPosition = vi.fn((pos) => ({ x: pos.x, y: pos.y })) as (
      pos: { x: number; y: number }
    ) => XYPosition;
    rerender();

    const secondHandler = result.current;
    expect(firstHandler).not.toBe(secondHandler);
  });
});
