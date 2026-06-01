import { renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasSelection,
  type UseCanvasSelectionParams,
} from "../useCanvasSelection";

// Mock UI store
vi.mock("@state/uiStore", () => ({
  useUIStore: vi.fn((selector) => {
    const state = {
      setPreviewState: vi.fn(),
    };
    return selector(state);
  }),
}));

describe("useCanvasSelection", () => {
  let params: UseCanvasSelectionParams;
  let setNodes: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let onToolSelect: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let onClosePositionMenu: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  beforeEach(() => {
    setNodes = vi.fn();
    onToolSelect = vi.fn();
    onClosePositionMenu = vi.fn();

    params = {
      tools: [
        { id: "tool1", type: "Source", x: 0, y: 0, config: {}, sockets: [] },
        { id: "tool2", type: "Filter", x: 100, y: 0, config: {}, sockets: [] },
      ],
      setNodes,
      onToolSelect,
      onClosePositionMenu,
    };
  });

  describe("onNodeClick", () => {
    it("should select tool when node is clicked", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      const mockNode = {
        id: "tool1",
        position: { x: 0, y: 0 },
        data: {},
      } as Node;
      const mockEvent = {} as React.MouseEvent;

      result.current.onNodeClick(mockEvent, mockNode);

      expect(onToolSelect).toHaveBeenCalledWith(params.tools[0]);
    });

    it("should call onToolSelect with undefined for unknown node", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      const mockNode = {
        id: "unknown",
        position: { x: 0, y: 0 },
        data: {},
      } as Node;
      const mockEvent = {} as React.MouseEvent;

      result.current.onNodeClick(mockEvent, mockNode);

      expect(onToolSelect).not.toHaveBeenCalled();
    });
  });

  describe("onPaneClick", () => {
    it("should close position menu", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      result.current.onPaneClick();

      expect(onClosePositionMenu).toHaveBeenCalled();
    });

    it("should clear tool selection", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      result.current.onPaneClick();

      expect(onToolSelect).toHaveBeenCalledWith(null);
    });

    it("should deselect all nodes", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      result.current.onPaneClick();

      expect(setNodes).toHaveBeenCalled();
      // Verify the updater function deselects nodes
      const updater = setNodes.mock.calls[0]?.[0] as ((ns: Node[]) => Node[]) | undefined;
      expect(updater).toBeDefined();
      const mockNodes = [
        { id: "1", selected: true },
        { id: "2", selected: true },
      ] as Node[];
      const resultNodes = updater!(mockNodes);
      expect(resultNodes.every((n: Node) => n.selected === false)).toBe(true);
    });
  });

  describe("onSelectionChange", () => {
    it("should select single node", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      result.current.onSelectionChange({
        nodes: [{ id: "tool1", position: { x: 0, y: 0 }, data: {} } as Node],
        edges: [],
      });

      expect(onToolSelect).toHaveBeenCalledWith(params.tools[0]);
    });

    it("should clear selection when multiple nodes selected", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      result.current.onSelectionChange({
        nodes: [
          { id: "tool1", position: { x: 0, y: 0 }, data: {} } as Node,
          { id: "tool2", position: { x: 0, y: 0 }, data: {} } as Node,
        ],
        edges: [],
      });

      expect(onToolSelect).toHaveBeenCalledWith(null);
    });

    it("should clear selection when no nodes selected", () => {
      const { result } = renderHook(() => useCanvasSelection(params));

      result.current.onSelectionChange({
        nodes: [],
        edges: [],
      });

      expect(onToolSelect).toHaveBeenCalledWith(null);
    });
  });
});
