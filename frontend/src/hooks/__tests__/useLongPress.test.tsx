import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress, type UseLongPressOptions } from "../useLongPress";

describe("useLongPress", () => {
  let onLongPress: ReturnType<typeof vi.fn>;
  let onTap: ReturnType<typeof vi.fn>;
  let options: UseLongPressOptions;

  beforeEach(() => {
    vi.useFakeTimers();
    onLongPress = vi.fn();
    onTap = vi.fn();
    options = { onLongPress, onTap, delay: 500 };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return touch event handlers", () => {
    const { result } = renderHook(() => useLongPress(options));

    expect(result.current).toHaveProperty("onTouchStart");
    expect(result.current).toHaveProperty("onTouchEnd");
    expect(result.current).toHaveProperty("onTouchMove");
    expect(typeof result.current.onTouchStart).toBe("function");
    expect(typeof result.current.onTouchEnd).toBe("function");
    expect(typeof result.current.onTouchMove).toBe("function");
  });

  it("should trigger onLongPress after delay", () => {
    const { result } = renderHook(() => useLongPress(options));

    const mockEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockEvent);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("should trigger onTap for short press", () => {
    const { result } = renderHook(() => useLongPress(options));

    const mockStartEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;
    const mockEndEvent = {} as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockStartEvent);
    });

    // Release before delay
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.onTouchEnd(mockEndEvent);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("should not trigger onTap after long press", () => {
    const { result } = renderHook(() => useLongPress(options));

    const mockStartEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;
    const mockEndEvent = {} as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockStartEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.onTouchEnd(mockEndEvent);
    });

    expect(onTap).not.toHaveBeenCalled();
  });

  it("should cancel long press on movement beyond threshold", () => {
    const { result } = renderHook(() => useLongPress(options));

    const mockStartEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const mockMoveEvent = {
      touches: [{ clientX: 150, clientY: 150 }], // Move > 10px
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockStartEvent);
    });

    act(() => {
      vi.advanceTimersByTime(200);
      result.current.onTouchMove(mockMoveEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("should not cancel long press on small movement", () => {
    const { result } = renderHook(() => useLongPress(options));

    const mockStartEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const mockMoveEvent = {
      touches: [{ clientX: 105, clientY: 105 }], // Move < 10px
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockStartEvent);
    });

    act(() => {
      result.current.onTouchMove(mockMoveEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("should use custom delay", () => {
    const customOptions = { ...options, delay: 1000 };
    const { result } = renderHook(() => useLongPress(customOptions));

    const mockEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("should work without onTap callback", () => {
    const optionsWithoutTap = { onLongPress, delay: 500 };
    const { result } = renderHook(() => useLongPress(optionsWithoutTap));

    const mockStartEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;
    const mockEndEvent = {} as React.TouchEvent;

    act(() => {
      result.current.onTouchStart(mockStartEvent);
      result.current.onTouchEnd(mockEndEvent);
    });

    // Should not throw
    expect(true).toBe(true);
  });
});
