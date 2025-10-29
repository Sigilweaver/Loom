import type { Tool, Wire } from "@domain/workflow/entities/workflow";
import { useClipboardStore } from "@state/clipboardStore";
import { act, renderHook } from "@testing-library/react";
import { generateUniqueId } from "@utils/id";
import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasClipboard, type ClipboardDeps } from "../useCanvasClipboard";

// Mock stores and utilities
vi.mock("@state/clipboardStore");
vi.mock("@utils/id");

describe("useCanvasClipboard", () => {
  let deps: ClipboardDeps;
  let mockNodes: Node[];
  let mockTools: Tool[];
  let mockWires: Wire[];
  let setClipboard: ReturnType<typeof vi.fn>;
  let onAddTool: ReturnType<typeof vi.fn>;
  let onAddWire: ReturnType<typeof vi.fn>;
  let onRemoveTool: ReturnType<typeof vi.fn>;
  let setNodes: ReturnType<typeof vi.fn>;
  let onToolSelect: ReturnType<typeof vi.fn>;
  let getNodes: () => Node[];
  let snap: (x: number, y: number) => { x: number; y: number };

  beforeEach(() => {
    mockNodes = [];
    mockTools = [];
    mockWires = [];

    setClipboard = vi.fn();
    onAddTool = vi.fn();
    onAddWire = vi.fn();
    onRemoveTool = vi.fn();
    setNodes = vi.fn();
    onToolSelect = vi.fn();
    getNodes = vi.fn(() => mockNodes) as () => Node[];
    snap = vi.fn((x, y) => ({ x, y })) as (
      x: number,
      y: number
    ) => { x: number; y: number };

    deps = {
      tools: mockTools,
      wires: mockWires,
      getNodes,
      snap,
      onBatchAdd: undefined, // Force fallback to individual onAddTool calls
      onAddTool,
      onAddWire,
      onRemoveTool,
      setNodes,
      onToolSelect,
    };

    // Mock clipboard store
    vi.mocked(useClipboardStore.getState).mockReturnValue({
      clipboard: null,
      setClipboard,
      clearClipboard: vi.fn(),
      copyTools: vi.fn(),
      pasteToolsAt: vi.fn().mockReturnValue([]),
    });

    // Mock ID generation
    let idCounter = 0;
    vi.mocked(generateUniqueId).mockImplementation(() => `tool_${++idCounter}`);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("doCopy", () => {
    it("should copy selected nodes to clipboard", () => {
      mockNodes = [
        { id: "tool1", selected: true, data: {} },
        { id: "tool2", selected: false, data: {} },
      ] as Node[];
      mockTools = [
        { id: "tool1", type: "input", x: 100, y: 200, config: {}, sockets: [] },
        {
          id: "tool2",
          type: "output",
          x: 300,
          y: 400,
          config: {},
          sockets: [],
        },
      ];
      deps.tools = mockTools;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doCopy();
      });

      expect(setClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [{ id: "tool1", type: "input", x: 100, y: 200 }],
          wires: [],
          minX: 100,
          minY: 200,
        })
      );
    });

    it("should copy multiple selected nodes", () => {
      mockNodes = [
        { id: "tool1", selected: true, data: {} },
        { id: "tool2", selected: true, data: {} },
        { id: "tool3", selected: false, data: {} },
      ] as Node[];
      mockTools = [
        { id: "tool1", type: "input", x: 50, y: 100, config: {}, sockets: [] },
        {
          id: "tool2",
          type: "output",
          x: 200,
          y: 150,
          config: {},
          sockets: [],
        },
        {
          id: "tool3",
          type: "filter",
          x: 300,
          y: 200,
          config: {},
          sockets: [],
        },
      ];
      deps.tools = mockTools;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doCopy();
      });

      expect(setClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            { id: "tool1", type: "input", x: 50, y: 100 },
            { id: "tool2", type: "output", x: 200, y: 150 },
          ],
          minX: 50,
          minY: 100,
        })
      );
    });

    it("should copy internal wires between selected nodes", () => {
      mockNodes = [
        { id: "tool1", selected: true, data: {} },
        { id: "tool2", selected: true, data: {} },
      ] as Node[];
      mockTools = [
        { id: "tool1", type: "input", x: 0, y: 0, config: {}, sockets: [] },
        { id: "tool2", type: "output", x: 100, y: 0, config: {}, sockets: [] },
      ];
      mockWires = [
        {
          from: { tool: "tool1", socket: 0 },
          to: { tool: "tool2", socket: 0 },
        },
      ];
      deps.tools = mockTools;
      deps.wires = mockWires;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doCopy();
      });

      expect(setClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          wires: [
            {
              from: { tool: "tool1", socket: 0 },
              to: { tool: "tool2", socket: 0 },
            },
          ],
        })
      );
    });

    it("should not copy wires to unselected nodes", () => {
      mockNodes = [
        { id: "tool1", selected: true, data: {} },
        { id: "tool2", selected: false, data: {} },
      ] as Node[];
      mockTools = [
        { id: "tool1", type: "input", x: 0, y: 0, config: {}, sockets: [] },
        { id: "tool2", type: "output", x: 100, y: 0, config: {}, sockets: [] },
      ];
      mockWires = [
        {
          from: { tool: "tool1", socket: 0 },
          to: { tool: "tool2", socket: 0 },
        },
      ];
      deps.tools = mockTools;
      deps.wires = mockWires;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doCopy();
      });

      expect(setClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          wires: [],
        })
      );
    });

    it("should not copy if no nodes selected", () => {
      mockNodes = [{ id: "tool1", selected: false, data: {} }] as Node[];
      mockTools = [
        { id: "tool1", type: "input", x: 0, y: 0, config: {}, sockets: [] },
      ];
      deps.tools = mockTools;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doCopy();
      });

      expect(setClipboard).not.toHaveBeenCalled();
    });
  });

  describe("doCut", () => {
    it("should copy and remove selected nodes", () => {
      mockNodes = [
        { id: "tool1", selected: true, data: {} },
        { id: "tool2", selected: false, data: {} },
      ] as Node[];
      mockTools = [
        { id: "tool1", type: "input", x: 0, y: 0, config: {}, sockets: [] },
        { id: "tool2", type: "output", x: 100, y: 0, config: {}, sockets: [] },
      ];
      deps.tools = mockTools;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doCut();
      });

      expect(setClipboard).toHaveBeenCalled();
      expect(onRemoveTool).toHaveBeenCalledWith("tool1");
      expect(setNodes).toHaveBeenCalled();
      expect(onToolSelect).toHaveBeenCalledWith(null);
    });

    it("should do nothing if no nodes selected", () => {
      mockNodes = [{ id: "tool1", selected: false, data: {} }] as Node[];
      deps.tools = [];

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doCut();
      });

      expect(onRemoveTool).not.toHaveBeenCalled();
    });
  });

  describe("doDelete", () => {
    it("should remove selected nodes without copying", () => {
      mockNodes = [{ id: "tool1", selected: true, data: {} }] as Node[];
      mockTools = [
        { id: "tool1", type: "input", x: 0, y: 0, config: {}, sockets: [] },
      ];
      deps.tools = mockTools;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doDelete();
      });

      expect(setClipboard).not.toHaveBeenCalled();
      expect(onRemoveTool).toHaveBeenCalledWith("tool1");
      expect(setNodes).toHaveBeenCalled();
    });
  });

  describe("doPaste", () => {
    beforeEach(() => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [{ id: "original1", type: "input", x: 100, y: 200 }],
          wires: [],
          minX: 100,
          minY: 200,
        },
        setClipboard,
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });
    });

    it("should paste tools with default offset when no anchor set", () => {
      mockTools = [
        {
          id: "existing",
          type: "output",
          x: 500,
          y: 500,
          config: {},
          sockets: [],
        },
      ];
      deps.tools = mockTools;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doPaste();
      });

      // Should generate new ID and add tool with +20 offset
      expect(onAddTool).toHaveBeenCalledWith("input", 120, 220, "tool_1");
    });

    it("should paste tools at anchor position", () => {
      mockTools = [];
      deps.tools = mockTools;

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.setPasteAnchor(500, 600);
      });

      act(() => {
        result.current.doPaste();
      });

      // Should paste at anchor (500, 600) since tool was at minX=100, minY=200
      expect(onAddTool).toHaveBeenCalledWith("input", 500, 600, "tool_1");
    });

    it("should do nothing if clipboard is empty", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: null,
        setClipboard,
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.doPaste();
      });

      expect(onAddTool).not.toHaveBeenCalled();
    });
  });

  describe("setPasteAnchor", () => {
    it("should set paste anchor position", () => {
      vi.mocked(useClipboardStore.getState).mockReturnValue({
        clipboard: {
          tools: [{ id: "tool1", type: "input", x: 0, y: 0 }],
          wires: [],
          minX: 0,
          minY: 0,
        },
        setClipboard,
        clearClipboard: vi.fn(),
        copyTools: vi.fn(),
        pasteToolsAt: vi.fn(),
      });

      const { result } = renderHook(() => useCanvasClipboard(deps));

      act(() => {
        result.current.setPasteAnchor(250, 350);
      });

      act(() => {
        result.current.doPaste();
      });

      expect(onAddTool).toHaveBeenCalledWith("input", 250, 350, "tool_1");
    });
  });

  describe("hook stability", () => {
    it("should return stable callbacks", () => {
      const { result, rerender } = renderHook(() => useCanvasClipboard(deps));

      const callbacks1 = {
        doCopy: result.current.doCopy,
        doCut: result.current.doCut,
        doPaste: result.current.doPaste,
        doDelete: result.current.doDelete,
        setPasteAnchor: result.current.setPasteAnchor,
      };

      rerender();

      const callbacks2 = {
        doCopy: result.current.doCopy,
        doCut: result.current.doCut,
        doPaste: result.current.doPaste,
        doDelete: result.current.doDelete,
        setPasteAnchor: result.current.setPasteAnchor,
      };

      expect(callbacks1.doCopy).toBe(callbacks2.doCopy);
      expect(callbacks1.doCut).toBe(callbacks2.doCut);
      expect(callbacks1.doPaste).toBe(callbacks2.doPaste);
      expect(callbacks1.doDelete).toBe(callbacks2.doDelete);
      expect(callbacks1.setPasteAnchor).toBe(callbacks2.setPasteAnchor);
    });
  });
});
