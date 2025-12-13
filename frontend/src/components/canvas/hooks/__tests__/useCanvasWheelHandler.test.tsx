import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCanvasWheelHandler } from "../useCanvasWheelHandler";

describe("useCanvasWheelHandler", () => {
  it("should return a wheel handler function", () => {
    const { result } = renderHook(() => useCanvasWheelHandler());

    expect(typeof result.current).toBe("function");
  });

  it("should be a no-op that does not throw", () => {
    const { result } = renderHook(() => useCanvasWheelHandler());
    const handler = result.current;

    // Create a mock wheel event
    const mockEvent = {
      deltaX: 0,
      deltaY: 100,
      preventDefault: () => {},
    } as unknown as React.WheelEvent;

    // Should not throw
    expect(() => handler(mockEvent)).not.toThrow();
  });
});
