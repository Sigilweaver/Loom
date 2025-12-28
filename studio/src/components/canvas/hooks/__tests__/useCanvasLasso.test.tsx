import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasLasso } from "../useCanvasLasso";

describe("useCanvasLasso", () => {
  beforeEach(() => {
    // Clean up class from previous tests
    document.body.classList.remove("sig-lasso-active");
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.classList.remove("sig-lasso-active");
  });

  it("should add class on mousedown with left button", () => {
    renderHook(() => useCanvasLasso());

    const event = new MouseEvent("mousedown", { button: 0 });
    window.dispatchEvent(event);

    expect(document.body.classList.contains("sig-lasso-active")).toBe(true);
  });

  it("should not add class on mousedown with right button", () => {
    renderHook(() => useCanvasLasso());

    const event = new MouseEvent("mousedown", { button: 2 });
    window.dispatchEvent(event);

    expect(document.body.classList.contains("sig-lasso-active")).toBe(false);
  });

  it("should remove class on mouseup", () => {
    renderHook(() => useCanvasLasso());

    // First add the class
    const downEvent = new MouseEvent("mousedown", { button: 0 });
    window.dispatchEvent(downEvent);
    expect(document.body.classList.contains("sig-lasso-active")).toBe(true);

    // Then remove it
    const upEvent = new MouseEvent("mouseup");
    window.dispatchEvent(upEvent);
    expect(document.body.classList.contains("sig-lasso-active")).toBe(false);
  });

  it("should add class on touchstart", () => {
    renderHook(() => useCanvasLasso());

    const event = new TouchEvent("touchstart", { touches: [] });
    window.dispatchEvent(event);

    expect(document.body.classList.contains("sig-lasso-active")).toBe(true);
  });

  it("should remove class on touchend", () => {
    renderHook(() => useCanvasLasso());

    // First add the class
    const startEvent = new TouchEvent("touchstart", { touches: [] });
    window.dispatchEvent(startEvent);
    expect(document.body.classList.contains("sig-lasso-active")).toBe(true);

    // Then remove it
    const endEvent = new TouchEvent("touchend", { touches: [] });
    window.dispatchEvent(endEvent);
    expect(document.body.classList.contains("sig-lasso-active")).toBe(false);
  });

  it("should remove class on touchcancel", () => {
    renderHook(() => useCanvasLasso());

    // First add the class
    const startEvent = new TouchEvent("touchstart", { touches: [] });
    window.dispatchEvent(startEvent);
    expect(document.body.classList.contains("sig-lasso-active")).toBe(true);

    // Then remove it via cancel
    const cancelEvent = new TouchEvent("touchcancel", { touches: [] });
    window.dispatchEvent(cancelEvent);
    expect(document.body.classList.contains("sig-lasso-active")).toBe(false);
  });

  it("should clean up event listeners on unmount", () => {
    const { unmount } = renderHook(() => useCanvasLasso());

    // Manually add class to verify cleanup
    const startEvent = new TouchEvent("touchstart", { touches: [] });
    window.dispatchEvent(startEvent);
    expect(document.body.classList.contains("sig-lasso-active")).toBe(true);

    // Unmount the hook
    unmount();

    // Clean up manually for test
    document.body.classList.remove("sig-lasso-active");

    // Now events should not add the class
    window.dispatchEvent(startEvent);
    // After unmount, listener is removed so class won't be added
    expect(document.body.classList.contains("sig-lasso-active")).toBe(false);
  });
});
