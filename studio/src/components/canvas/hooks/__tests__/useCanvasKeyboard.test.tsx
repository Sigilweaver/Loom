import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasKeyboard,
  type UseCanvasKeyboardParams,
} from "../useCanvasKeyboard";

// Helper to create mock keyboard event
function createKeyEvent(
  key: string,
  modifiers: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  } = {}
): Partial<React.KeyboardEvent<HTMLDivElement>> {
  return {
    key,
    ctrlKey: modifiers.ctrl || false,
    metaKey: modifiers.meta || false,
    shiftKey: modifiers.shift || false,
    altKey: modifiers.alt || false,
    preventDefault: vi.fn(),
    target: document.createElement("div"),
  } as Partial<React.KeyboardEvent<HTMLDivElement>>;
}

describe("useCanvasKeyboard", () => {
  let params: UseCanvasKeyboardParams;
  let setNodes: ReturnType<typeof vi.fn>;
  let setEdges: ReturnType<typeof vi.fn>;
  let onToolSelect: ReturnType<typeof vi.fn>;
  let doCopy: ReturnType<typeof vi.fn>;
  let doCut: ReturnType<typeof vi.fn>;
  let doPaste: ReturnType<typeof vi.fn>;
  let moveSelectedNodes: (e: React.KeyboardEvent) => boolean;

  beforeEach(() => {
    setNodes = vi.fn();
    setEdges = vi.fn();
    onToolSelect = vi.fn();
    doCopy = vi.fn();
    doCut = vi.fn();
    doPaste = vi.fn();
    moveSelectedNodes = vi.fn().mockReturnValue(false) as (
      e: React.KeyboardEvent
    ) => boolean;

    params = {
      isFirefox: false,
      setNodes,
      setEdges,
      onToolSelect,
      doCopy,
      doCut,
      doPaste,
      moveSelectedNodes,
    };
  });

  describe("typing detection", () => {
    it("should ignore keys when typing in input", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true });
      const input = document.createElement("input");
      event.target = input;

      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).not.toHaveBeenCalled();
    });

    it("should ignore keys when typing in textarea", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true });
      const textarea = document.createElement("textarea");
      event.target = textarea;

      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).not.toHaveBeenCalled();
    });

    it("should ignore keys when typing in contentEditable element", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true });
      const div = document.createElement("div");
      div.contentEditable = "true";
      // Need to set isContentEditable flag which is read by the hook
      Object.defineProperty(div, "isContentEditable", {
        value: true,
        configurable: true,
      });
      event.target = div;

      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).not.toHaveBeenCalled();
    });

    it("should process keys when not typing", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true });
      const div = document.createElement("div");
      event.target = div;

      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).toHaveBeenCalled();
    });
  });

  describe("arrow key movement", () => {
    it("should defer to moveSelectedNodes for arrow keys", () => {
      (moveSelectedNodes as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("ArrowUp");
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(moveSelectedNodes).toHaveBeenCalledWith(event);
      expect(doCopy).not.toHaveBeenCalled();
    });

    it("should continue processing if moveSelectedNodes returns false", () => {
      (moveSelectedNodes as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(moveSelectedNodes).toHaveBeenCalled();
      expect(doCopy).toHaveBeenCalled();
    });
  });

  describe("Escape key", () => {
    it("should deselect all nodes on Escape", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("Escape");
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(setNodes).toHaveBeenCalledWith(expect.any(Function));
      expect(setEdges).toHaveBeenCalledWith(expect.any(Function));
      expect(onToolSelect).toHaveBeenCalledWith(null);
    });

    it("should set selected=false for all nodes", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("Escape");
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      const updater = setNodes.mock.calls[0]?.[0];
      const nodes = [
        { id: "1", selected: true },
        { id: "2", selected: true },
      ];
      const updated = updater(nodes);

      expect(updated).toEqual([
        { id: "1", selected: false },
        { id: "2", selected: false },
      ]);
    });

    it("should set selected=false for all edges", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("Escape");
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      const updater = setEdges.mock.calls[0]?.[0];
      const edges = [
        { id: "e1", selected: true },
        { id: "e2", selected: false },
      ];
      const updated = updater(edges);

      expect(updated).toEqual([
        { id: "e1", selected: false },
        { id: "e2", selected: false },
      ]);
    });
  });

  describe("Copy (Ctrl+C / Cmd+C)", () => {
    it("should call doCopy on Ctrl+C", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doCopy).toHaveBeenCalled();
    });

    it("should call doCopy on Cmd+C (Mac)", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { meta: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doCopy).toHaveBeenCalled();
    });

    it("should handle uppercase C", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("C", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).toHaveBeenCalled();
    });

    it("should not call doCopy without modifier", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c");
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).not.toHaveBeenCalled();
    });
  });

  describe("Cut (Ctrl+X / Cmd+X)", () => {
    it("should call doCut on Ctrl+X", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("x", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doCut).toHaveBeenCalled();
    });

    it("should call doCut on Cmd+X (Mac)", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("x", { meta: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doCut).toHaveBeenCalled();
    });

    it("should handle uppercase X", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("X", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCut).toHaveBeenCalled();
    });
  });

  describe("Paste (Ctrl+V / Cmd+V)", () => {
    it("should call doPaste on Ctrl+V", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("v", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doPaste).toHaveBeenCalled();
    });

    it("should call doPaste on Cmd+V (Mac)", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("v", { meta: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doPaste).toHaveBeenCalled();
    });

    it("should handle uppercase V", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("V", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doPaste).toHaveBeenCalled();
    });

    it("should NOT call doPaste on Firefox (quirk)", () => {
      params.isFirefox = true;
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("v", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doPaste).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("Select All (Ctrl+A / Cmd+A)", () => {
    it("should select all nodes on Ctrl+A", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("a", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(setNodes).toHaveBeenCalledWith(expect.any(Function));
      expect(onToolSelect).toHaveBeenCalledWith(null);
    });

    it("should select all nodes on Cmd+A (Mac)", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("a", { meta: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(setNodes).toHaveBeenCalled();
    });

    it("should set selected=true for all nodes", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("a", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      const updater = setNodes.mock.calls[0]?.[0];
      const nodes = [
        { id: "1", selected: false },
        { id: "2", selected: false },
      ];
      const updated = updater(nodes);

      expect(updated).toEqual([
        { id: "1", selected: true },
        { id: "2", selected: true },
      ]);
    });

    it("should handle uppercase A", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("A", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(setNodes).toHaveBeenCalled();
    });
  });

  describe("irrelevant keys", () => {
    it("should ignore unhandled keys", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("z");
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).not.toHaveBeenCalled();
      expect(doCut).not.toHaveBeenCalled();
      expect(doPaste).not.toHaveBeenCalled();
      expect(setNodes).not.toHaveBeenCalled();
    });

    it("should ignore modifier-only keys", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("Control", { ctrl: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).not.toHaveBeenCalled();
    });

    it("should ignore keys with wrong modifier", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { alt: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).not.toHaveBeenCalled();
    });
  });

  describe("hook stability", () => {
    it("should return stable callback", () => {
      const { result, rerender } = renderHook(() => useCanvasKeyboard(params));
      const handler1 = result.current;

      rerender();
      const handler2 = result.current;

      expect(handler1).toBe(handler2);
    });

    it("should update callback when dependencies change", () => {
      const { result, rerender } = renderHook(() => useCanvasKeyboard(params));
      const handler1 = result.current;

      params.doCopy = vi.fn();
      rerender();
      const handler2 = result.current;

      expect(handler1).not.toBe(handler2);
    });
  });

  describe("edge cases", () => {
    it("should handle missing onToolSelect callback", () => {
      params.onToolSelect = undefined;
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("Escape");
      expect(() =>
        handler(event as React.KeyboardEvent<HTMLDivElement>)
      ).not.toThrow();
    });

    it("should handle null-like target", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true });
      // Simulate a detached DOM node (falsy target)
      Object.defineProperty(event, "target", {
        value: null,
        configurable: true,
      });

      // Should handle gracefully (typing check will fail on null, allowing copy)
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).toHaveBeenCalled();
    });

    it("should handle both Ctrl and Cmd pressed (Mac)", () => {
      const { result } = renderHook(() => useCanvasKeyboard(params));
      const handler = result.current;

      const event = createKeyEvent("c", { ctrl: true, meta: true });
      handler(event as React.KeyboardEvent<HTMLDivElement>);

      expect(doCopy).toHaveBeenCalled();
    });
  });
});
