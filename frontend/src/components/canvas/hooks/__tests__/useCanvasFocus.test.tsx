import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasFocus,
  type UseCanvasFocusParams,
} from "../useCanvasFocus";

describe("useCanvasFocus", () => {
  let params: UseCanvasFocusParams;
  let isPointerDownRef: React.MutableRefObject<boolean>;

  beforeEach(() => {
    isPointerDownRef = { current: false };
    params = { isPointerDownRef };

    // Clean up any event listeners from previous tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    window.removeEventListener("mouseup", () => {});
  });

  it("should return keyScopeRef and onMouseDown handler", () => {
    const { result } = renderHook(() => useCanvasFocus(params));

    expect(result.current).toHaveProperty("keyScopeRef");
    expect(result.current).toHaveProperty("onMouseDown");
    expect(typeof result.current.onMouseDown).toBe("function");
  });

  it("should set pointer down on left click", () => {
    const { result } = renderHook(() => useCanvasFocus(params));
    const { onMouseDown } = result.current;

    const mockEvent = {
      button: 0,
    } as React.MouseEvent;

    act(() => {
      onMouseDown(mockEvent);
    });

    expect(isPointerDownRef.current).toBe(true);
  });

  it("should not set pointer down on right click", () => {
    const { result } = renderHook(() => useCanvasFocus(params));
    const { onMouseDown } = result.current;

    const mockEvent = {
      button: 2,
    } as React.MouseEvent;

    act(() => {
      onMouseDown(mockEvent);
    });

    expect(isPointerDownRef.current).toBe(false);
  });

  it("should reset pointer down on mouseup", async () => {
    const { result } = renderHook(() => useCanvasFocus(params));
    const { onMouseDown } = result.current;

    const mockEvent = {
      button: 0,
    } as React.MouseEvent;

    act(() => {
      onMouseDown(mockEvent);
    });

    expect(isPointerDownRef.current).toBe(true);

    // Simulate mouseup
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    // Wait for event to be processed
    await vi.waitFor(() => {
      expect(isPointerDownRef.current).toBe(false);
    });
  });

  it("should focus keyScopeRef element when available", () => {
    const { result } = renderHook(() => useCanvasFocus(params));
    const { keyScopeRef, onMouseDown } = result.current;

    // Create a mock element with focus method
    const mockElement = {
      focus: vi.fn(),
    } as unknown as HTMLDivElement;

    // Set the ref
    (keyScopeRef as React.MutableRefObject<HTMLDivElement | null>).current = mockElement;

    const mockEvent = {
      button: 0,
    } as React.MouseEvent;

    act(() => {
      onMouseDown(mockEvent);
    });

    expect(mockElement.focus).toHaveBeenCalled();
  });

  it("should not throw when keyScopeRef element is null", () => {
    const { result } = renderHook(() => useCanvasFocus(params));
    const { onMouseDown } = result.current;

    const mockEvent = {
      button: 0,
    } as React.MouseEvent;

    expect(() => {
      act(() => {
        onMouseDown(mockEvent);
      });
    }).not.toThrow();
  });
});
