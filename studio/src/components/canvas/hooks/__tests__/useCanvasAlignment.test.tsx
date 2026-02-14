import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasAlignment,
  type UseCanvasAlignmentParams,
} from "../useCanvasAlignment";

// Mock the autoLayout utility
vi.mock("@domain/workflow/services/autoLayout", () => ({
  autoLayout: vi.fn(() => ({ positions: [] })),
}));

// Mock workflowStore
vi.mock("@state/workflowStore", () => ({
  useWorkflowStore: {
    getState: vi.fn(() => ({
      tools: [],
      wires: [],
    })),
  },
}));

import { autoLayout } from "@domain/workflow/services/autoLayout";
import { useWorkflowStore } from "@state/workflowStore";

describe("useCanvasAlignment", () => {
  let params: UseCanvasAlignmentParams;
  let onToolMove: ReturnType<typeof vi.fn>;
  let onBeginTransaction: ReturnType<typeof vi.fn>;
  let onCommitTransaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToolMove = vi.fn();
    onBeginTransaction = vi.fn();
    onCommitTransaction = vi.fn();

    params = {
      onToolMove,
      onBeginTransaction,
      onCommitTransaction,
    };

    vi.clearAllMocks();
  });

  it("should call autoLayout with tools and wires from store", () => {
    const mockTools = [{ id: "A" }, { id: "B" }];
    const mockWires = [{ from: { tool: "A", socket: "output" }, to: { tool: "B", socket: "input" } }];
    vi.mocked(useWorkflowStore.getState).mockReturnValue({
      tools: mockTools,
      wires: mockWires,
    } as ReturnType<typeof useWorkflowStore.getState>);

    vi.mocked(autoLayout).mockReturnValue({
      positions: [
        { id: "A", x: 100, y: 100 },
        { id: "B", x: 380, y: 100 },
      ],
    });

    const { result } = renderHook(() => useCanvasAlignment(params));
    result.current.autoLayout();

    expect(autoLayout).toHaveBeenCalledWith(mockTools, mockWires);
    expect(onBeginTransaction).toHaveBeenCalled();
    expect(onToolMove).toHaveBeenCalledWith("A", 100, 100);
    expect(onToolMove).toHaveBeenCalledWith("B", 380, 100);
    expect(onCommitTransaction).toHaveBeenCalled();
  });

  it("should not call handlers if no tools", () => {
    vi.mocked(useWorkflowStore.getState).mockReturnValue({
      tools: [],
      wires: [],
    } as unknown as ReturnType<typeof useWorkflowStore.getState>);

    const { result } = renderHook(() => useCanvasAlignment(params));
    result.current.autoLayout();

    expect(autoLayout).not.toHaveBeenCalled();
    expect(onBeginTransaction).not.toHaveBeenCalled();
    expect(onToolMove).not.toHaveBeenCalled();
    expect(onCommitTransaction).not.toHaveBeenCalled();
  });

  it("should not call handlers if autoLayout returns empty positions", () => {
    vi.mocked(useWorkflowStore.getState).mockReturnValue({
      tools: [{ id: "A" }],
      wires: [],
    } as unknown as ReturnType<typeof useWorkflowStore.getState>);

    vi.mocked(autoLayout).mockReturnValue({ positions: [] });

    const { result } = renderHook(() => useCanvasAlignment(params));
    result.current.autoLayout();

    expect(autoLayout).toHaveBeenCalled();
    expect(onBeginTransaction).not.toHaveBeenCalled();
    expect(onToolMove).not.toHaveBeenCalled();
    expect(onCommitTransaction).not.toHaveBeenCalled();
  });
});
