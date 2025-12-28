import { act, renderHook } from "@testing-library/react";
import type { Edge, Node, XYPosition } from "@xyflow/react";

// Helper to create mock edge
function createMockEdge(id: string): Edge {
  return { id, source: "a", target: "b", type: "default" } as Edge;
}
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasContextMenu,
  type UseCanvasContextMenuParams,
} from "../useCanvasContextMenu";

// Mock clipboard store
vi.mock("@state/clipboardStore", () => ({
  useClipboardStore: {
    getState: vi.fn(() => ({ clipboard: null })),
  },
}));

describe("useCanvasContextMenu", () => {
  let params: UseCanvasContextMenuParams;
  let screenToFlowPosition: (pos: { x: number; y: number }) => XYPosition;
  let setNodes: ReturnType<typeof vi.fn>;
  let setPasteAnchor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    screenToFlowPosition = vi.fn((pos: { x: number; y: number }) => ({ x: pos.x, y: pos.y })) as unknown as (pos: { x: number; y: number }) => XYPosition;
    setNodes = vi.fn();
    setPasteAnchor = vi.fn();

    params = {
      screenToFlowPosition,
      setNodes,
      setPasteAnchor,
    };
  });

  describe("actionsMenu state", () => {
    it("should start with actions menu closed", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));

      expect(result.current.actionsOpen).toBe(false);
      expect(result.current.actionsCoords).toBeNull();
    });

    it("should open actions menu at specified coords", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));

      act(() => {
        result.current.openActionsMenuAt({ x: 100, y: 200 });
      });

      expect(result.current.actionsOpen).toBe(true);
      expect(result.current.actionsCoords).toEqual({ x: 100, y: 200 });
    });

    it("should close actions menu", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));

      act(() => {
        result.current.openActionsMenuAt({ x: 100, y: 200 });
        result.current.closeActionsMenu();
      });

      expect(result.current.actionsOpen).toBe(false);
    });
  });

  describe("onNodeContextMenu", () => {
    it("should prevent default", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;
      const mockNode = { id: "node1", selected: false } as Node;

      act(() => {
        result.current.onNodeContextMenu(mockEvent, mockNode);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("should select unselected node", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;
      const mockNode = { id: "node1", selected: false } as Node;

      act(() => {
        result.current.onNodeContextMenu(mockEvent, mockNode);
      });

      expect(setNodes).toHaveBeenCalled();
    });

    it("should keep multi-selection when node is already selected", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;
      const mockNode = { id: "node1", selected: true } as Node;

      act(() => {
        result.current.onNodeContextMenu(mockEvent, mockNode);
      });

      // Verify updater keeps existing selection
      const updater = setNodes.mock.calls[0]?.[0] as ((ns: Node[]) => Node[]) | undefined;
      expect(updater).toBeDefined();
      const mockNodes = [
        { id: "node1", selected: true },
        { id: "node2", selected: true },
      ] as Node[];
      const resultNodes = updater!(mockNodes);
      // Should keep both selected since node1 was already selected
      expect(resultNodes).toEqual(mockNodes);
    });

    it("should set paste anchor", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;
      const mockNode = { id: "node1", selected: false } as Node;

      act(() => {
        result.current.onNodeContextMenu(mockEvent, mockNode);
      });

      expect(setPasteAnchor).toHaveBeenCalledWith(100, 200);
    });

    it("should open actions menu at cursor position", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;
      const mockNode = { id: "node1", selected: false } as Node;

      act(() => {
        result.current.onNodeContextMenu(mockEvent, mockNode);
      });

      expect(result.current.actionsOpen).toBe(true);
      expect(result.current.actionsCoords).toEqual({ x: 100, y: 200 });
    });
  });

  describe("onPaneContextMenu", () => {
    it("should prevent default", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.onPaneContextMenu(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("should set paste anchor", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.onPaneContextMenu(mockEvent);
      });

      expect(setPasteAnchor).toHaveBeenCalledWith(100, 200);
    });
  });

  describe("edgeMenu state", () => {
    it("should start with edge menu closed", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));

      expect(result.current.edgeMenuOpen).toBe(false);
      expect(result.current.edgeMenuCoords).toBeNull();
      expect(result.current.edgeMenuEdge).toBeNull();
    });

    it("should open edge menu on edge context menu", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 150,
        clientY: 250,
      } as unknown as React.MouseEvent;
      const mockEdge = createMockEdge("edge1");

      act(() => {
        result.current.onEdgeContextMenu(mockEvent, mockEdge);
      });

      expect(result.current.edgeMenuOpen).toBe(true);
      expect(result.current.edgeMenuCoords).toEqual({ x: 150, y: 250 });
      expect(result.current.edgeMenuEdge).toEqual(mockEdge);
    });

    it("should close edge menu", () => {
      const { result } = renderHook(() => useCanvasContextMenu(params));
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 150,
        clientY: 250,
      } as unknown as React.MouseEvent;
      const mockEdge = createMockEdge("edge1");

      act(() => {
        result.current.onEdgeContextMenu(mockEvent, mockEdge);
        result.current.closeEdgeMenu();
      });

      expect(result.current.edgeMenuOpen).toBe(false);
    });
  });
});
