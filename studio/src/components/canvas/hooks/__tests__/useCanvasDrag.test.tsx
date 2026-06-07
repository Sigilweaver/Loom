import { renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasDrag,
  type UseCanvasDragParams,
} from "../useCanvasDrag";

describe("useCanvasDrag", () => {
  let params: UseCanvasDragParams;
  let getNodes: () => Node[];
  let snap: (x: number, y: number) => { x: number; y: number };
  let onToolMove: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let onBeginTransaction: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let onCommitTransaction: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let mockNodes: Node[];

  beforeEach(() => {
    mockNodes = [
      { id: "n1", position: { x: 10, y: 20 }, selected: true } as Node,
      { id: "n2", position: { x: 100, y: 200 }, selected: false } as Node,
    ];
    getNodes = vi.fn(() => mockNodes);
    snap = vi.fn((x, y) => ({ x: Math.round(x / 20) * 20, y: Math.round(y / 20) * 20 }));
    onToolMove = vi.fn();
    onBeginTransaction = vi.fn();
    onCommitTransaction = vi.fn();

    params = {
      getNodes,
      snap,
      onToolMove,
      onBeginTransaction,
      onCommitTransaction,
    };
  });

  describe("onNodeDragStart", () => {
    it("should begin transaction", () => {
      const { result } = renderHook(() => useCanvasDrag(params));
      const mockEvent = {} as React.MouseEvent;
      const mockNode = { id: "n1" } as Node;

      result.current.onNodeDragStart(mockEvent, mockNode);

      expect(onBeginTransaction).toHaveBeenCalled();
    });
  });

  describe("onNodeDragStop", () => {
    it("should persist positions for selected nodes with snapping", () => {
      const { result } = renderHook(() => useCanvasDrag(params));
      const mockEvent = {} as React.MouseEvent;
      const mockNode = { id: "n1" } as Node;

      result.current.onNodeDragStop(mockEvent, mockNode);

      // Only selected node should have position updated
      expect(onToolMove).toHaveBeenCalledTimes(1);
      expect(onToolMove).toHaveBeenCalledWith("n1", 20, 20); // Snapped from 10,20
      expect(onCommitTransaction).toHaveBeenCalled();
    });

    it("should persist positions for all selected nodes in group move", () => {
      mockNodes = [
        { id: "n1", position: { x: 15, y: 25 }, selected: true } as Node,
        { id: "n2", position: { x: 115, y: 125 }, selected: true } as Node,
        { id: "n3", position: { x: 200, y: 200 }, selected: false } as Node,
      ];

      const { result } = renderHook(() => useCanvasDrag(params));
      const mockEvent = {} as React.MouseEvent;
      const mockNode = { id: "n1" } as Node;

      result.current.onNodeDragStop(mockEvent, mockNode);

      expect(onToolMove).toHaveBeenCalledTimes(2);
      expect(onToolMove).toHaveBeenCalledWith("n1", 20, 20); // Snapped
      expect(onToolMove).toHaveBeenCalledWith("n2", 120, 120); // Snapped
      expect(onCommitTransaction).toHaveBeenCalled();
    });
  });
});
