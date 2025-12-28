import { act, renderHook } from "@testing-library/react";
import type { Edge } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasEdgeSync,
  type UseCanvasEdgeSyncParams,
} from "../useCanvasEdgeSync";

describe("useCanvasEdgeSync", () => {
  let params: UseCanvasEdgeSyncParams;
  let setEdges: ReturnType<typeof vi.fn>;
  let mockEdges: Edge[];

  beforeEach(() => {
    setEdges = vi.fn();
    mockEdges = [
      {
        id: "edge1",
        source: "node1",
        target: "node2",
        sourceHandle: "out",
        targetHandle: "in",
      },
    ];

    params = {
      edges: mockEdges,
      setEdges,
    };
  });

  it("should call setEdges with initial edges", () => {
    renderHook(() => useCanvasEdgeSync(params));

    expect(setEdges).toHaveBeenCalledWith(mockEdges);
  });

  it("should call setEdges when edges change", () => {
    const { rerender } = renderHook(() => useCanvasEdgeSync(params));

    expect(setEdges).toHaveBeenCalledTimes(1);

    // Change edges
    const newEdges: Edge[] = [
      {
        id: "edge2",
        source: "node3",
        target: "node4",
        sourceHandle: "out",
        targetHandle: "in",
      },
    ];
    params.edges = newEdges;

    act(() => {
      rerender();
    });

    expect(setEdges).toHaveBeenCalledTimes(2);
    expect(setEdges).toHaveBeenLastCalledWith(newEdges);
  });

  it("should not call setEdges when edges reference does not change", () => {
    const { rerender } = renderHook(() => useCanvasEdgeSync(params));

    expect(setEdges).toHaveBeenCalledTimes(1);

    // Rerender without changing edges
    rerender();

    // Should not call setEdges again (same reference)
    expect(setEdges).toHaveBeenCalledTimes(1);
  });
});
