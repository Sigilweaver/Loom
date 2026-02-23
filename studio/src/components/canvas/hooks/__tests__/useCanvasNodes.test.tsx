import { renderHook } from "@testing-library/react";
import type { Tool } from "@domain/workflow/entities/workflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasNodes,
  type UseCanvasNodesParams,
} from "../useCanvasNodes";

// Mock tool definitions
vi.mock("@data/tools", () => ({
  getToolDefinition: vi.fn((type: string) => ({
    type,
    name: `${type} Tool`,
    category: "compute",
    description: "Test tool",
  })),
}));

describe("useCanvasNodes", () => {
  let params: UseCanvasNodesParams;
  let mockTools: Tool[];
  let onToolMove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToolMove = vi.fn();
    mockTools = [
      {
        id: "tool1",
        type: "Filter",
        x: 100,
        y: 200,
        config: {},
        sockets: [],
      },
      {
        id: "tool2",
        type: "Select",
        x: 300,
        y: 400,
        config: {},
        sockets: [],
      },
    ];

    params = {
      tools: mockTools,
      onToolMove,
    };
  });

  it("should transform tools into React Flow nodes", () => {
    const { result } = renderHook(() => useCanvasNodes(params));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toMatchObject({
      id: "tool1",
      type: "workflow",
      position: { x: 100, y: 200 },
      deletable: true,
      selectable: true,
    });
    expect(result.current[1]).toMatchObject({
      id: "tool2",
      type: "workflow",
      position: { x: 300, y: 400 },
      deletable: true,
      selectable: true,
    });
  });

  it("should include tool and definition in node data", () => {
    const { result } = renderHook(() => useCanvasNodes(params));

    expect(result.current[0]?.data).toHaveProperty("tool");
    expect(result.current[0]?.data.tool).toBe(mockTools[0]);
    expect(result.current[0]?.data).toHaveProperty("definition");
    expect(result.current[0]?.data).toHaveProperty("onToolMove");
    expect(result.current[0]?.data.onToolMove).toBe(onToolMove);
  });

  it("should update when tools change", () => {
    const { result, rerender } = renderHook(() => useCanvasNodes(params));

    expect(result.current).toHaveLength(2);

    // Update tools
    params.tools = [mockTools[0]!];
    rerender();

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.id).toBe("tool1");
  });

  it("should memoize result when tools and onToolMove do not change", () => {
    const { result, rerender } = renderHook(() => useCanvasNodes(params));

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it("should update when onToolMove changes", () => {
    const { result, rerender } = renderHook(() => useCanvasNodes(params));

    const firstResult = result.current;

    // Change onToolMove
    params.onToolMove = vi.fn();
    rerender();

    const secondResult = result.current;
    expect(firstResult).not.toBe(secondResult);
  });
});
