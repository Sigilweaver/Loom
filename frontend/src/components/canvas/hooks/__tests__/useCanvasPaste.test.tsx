import { useClipboardStore } from "@state/clipboardStore";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasPaste, type UseCanvasPasteParams } from "../useCanvasPaste";

// Mock the clipboard store
vi.mock("@state/clipboardStore", () => ({
  useClipboardStore: {
    getState: vi.fn(),
  },
}));

describe("useCanvasPaste", () => {
  let params: UseCanvasPasteParams;
  let doPaste: ReturnType<typeof vi.fn>;
  let setNodes: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    doPaste = vi.fn();
    setNodes = vi.fn();

    params = {
      setNodes,
      doPaste,
    };

    // Default: no clipboard
    vi.mocked(useClipboardStore.getState).mockReturnValue({
      clipboard: null,
      setClipboard: vi.fn(),
      clearClipboard: vi.fn(),
      copyTools: vi.fn(),
      pasteToolsAt: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("clipboard state detection", () => {
    it("should not prevent default when clipboard is null", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: null,
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(doPaste).not.toHaveBeenCalled();
    });

    it("should prevent default and paste when clipboard has data", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [{ id: "tool1", type: "input", x: 100, y: 200, config: {}, sockets: [] }],
          wires: [],
          minX: 100,
          minY: 200,
        },
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doPaste).toHaveBeenCalled();
    });

    it("should prevent default even with empty tools array", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [],
          wires: [],
          minX: 0,
          minY: 0,
        },
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(doPaste).toHaveBeenCalled();
    });
  });

  describe("paste invocation", () => {
    beforeEach(() => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [{ id: "tool1", type: "input", x: 50, y: 100, config: {}, sockets: [] }],
          wires: [],
          minX: 50,
          minY: 100,
        },
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });
    });

    it("should call doPaste only once per event", () => {
      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      expect(doPaste).toHaveBeenCalledTimes(1);
    });

    it("should call doPaste with clipboard containing wires", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [],
          wires: [
            {
              from: { tool: "tool1", socket: 'output' },
              to: { tool: "tool2", socket: 'input' },
            },
          ],
          minX: 0,
          minY: 0,
        },
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      expect(doPaste).toHaveBeenCalled();
    });
  });

  describe("hook stability", () => {
    it("should return stable callback", () => {
      const { result, rerender } = renderHook(() => useCanvasPaste(params));
      const handler1 = result.current;

      rerender();
      const handler2 = result.current;

      expect(handler1).toBe(handler2);
    });

    it("should update callback when dependencies change", () => {
      const { result, rerender } = renderHook(() => useCanvasPaste(params));
      const handler1 = result.current;

      params.doPaste = vi.fn();
      rerender();
      const handler2 = result.current;

      expect(handler1).not.toBe(handler2);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined clipboard as having data", () => {
      // undefined !== null is true, so paste will be called
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: undefined as unknown as null,
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      // undefined !== null, so hasClipboard is true
      expect(event.preventDefault).toHaveBeenCalled();
      expect(doPaste).toHaveBeenCalled();
    });

    it("should handle multiple consecutive paste events", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [{ id: "tool1", type: "input", x: 10, y: 20, config: {}, sockets: [] }],
          wires: [],
          minX: 10,
          minY: 20,
        },
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event1 = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;
      const event2 = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event1);
      handler(event2);

      expect(doPaste).toHaveBeenCalledTimes(2);
      expect(event1.preventDefault).toHaveBeenCalled();
      expect(event2.preventDefault).toHaveBeenCalled();
    });
  });

  describe("interaction with native paste", () => {
    it("should allow native paste when internal clipboard is null", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: null,
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      // Native paste should proceed (preventDefault not called)
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("should block native paste when internal clipboard has data", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [{ id: "tool1", type: "input", x: 0, y: 0, config: {}, sockets: [] }],
          wires: [],
          minX: 0,
          minY: 0,
        },
        setClipboard: vi.fn(),
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasPaste(params));
      const handler = result.current;

      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.ClipboardEvent<HTMLDivElement>;

      handler(event);

      // Native paste should be blocked
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});
