import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasHandlers } from "../useCanvasHandlers";
import { useWorkflowStore } from "@state/workflowStore";
import { useHistoryStore } from "@state/historyStore";
import type { Socket, Tool } from "@domain/workflow/entities/workflow";

// Mock getToolDefinition
vi.mock("@data/tools", () => ({
  DEFAULT_FAVORITE_TOOLS: ["Input", "Output"],
  getToolDefinition: vi.fn(() => ({
    sockets: [
      { id: "output", direction: "output", type: "dataframe" },
    ],
  })),
}));

describe("useCanvasHandlers", () => {
  const createTestTool = (
    id: string,
    sockets: Socket[] = [
      { id: "output", direction: "output", type: "dataframe" },
    ]
  ): Tool => ({
    id,
    type: "csv",
    x: 0,
    y: 0,
    config: {},
    sockets,
  });

  const createInputTool = (id: string, multiple = false): Tool => ({
    id,
    type: "filter",
    x: 100,
    y: 0,
    config: {},
    sockets: [
      { id: "input", direction: "input", type: "dataframe", multiple },
      { id: "output", direction: "output", type: "dataframe" },
    ],
  });

  beforeEach(() => {
    // Reset stores before each test
    useWorkflowStore.getState().clear();
    useHistoryStore.getState().clear();
  });

  describe("handleAddWire", () => {
    it("should add a wire normally when target socket is not connected", () => {
      // Setup: Add two tools
      const tool1 = createTestTool("tool1");
      const tool2 = createInputTool("tool2");
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);

      const { result } = renderHook(() => useCanvasHandlers());

      act(() => {
        result.current.handleAddWire(
          { tool: "tool1", socket: "output" },
          { tool: "tool2", socket: "input" }
        );
      });

      const wires = useWorkflowStore.getState().wires;
      expect(wires).toHaveLength(1);
      expect(wires[0]).toEqual({
        from: { tool: "tool1", socket: "output" },
        to: { tool: "tool2", socket: "input" },
      });
    });

    it("should replace existing wire when dragging to already connected non-multiple socket", () => {
      // Setup: Add three tools
      const tool1 = createTestTool("tool1");
      const tool2 = createTestTool("tool2");
      const tool3 = createInputTool("tool3", false); // Non-multiple socket
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);
      useWorkflowStore.getState().addTool(tool3);

      // Connect tool1 -> tool3
      useWorkflowStore.getState().addWire({
        from: { tool: "tool1", socket: "output" },
        to: { tool: "tool3", socket: "input" },
      });

      // Clear history to start fresh for our test
      useHistoryStore.getState().clear();

      const { result } = renderHook(() => useCanvasHandlers());

      // Now connect tool2 -> tool3 (should replace existing wire)
      act(() => {
        result.current.handleAddWire(
          { tool: "tool2", socket: "output" },
          { tool: "tool3", socket: "input" }
        );
      });

      const wires = useWorkflowStore.getState().wires;
      expect(wires).toHaveLength(1);
      expect(wires[0]).toEqual({
        from: { tool: "tool2", socket: "output" },
        to: { tool: "tool3", socket: "input" },
      });
    });

    it("should create two undo steps when replacing a wire", () => {
      // Setup: Add three tools
      const tool1 = createTestTool("tool1");
      const tool2 = createTestTool("tool2");
      const tool3 = createInputTool("tool3", false); // Non-multiple socket
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);
      useWorkflowStore.getState().addTool(tool3);

      // Connect tool1 -> tool3
      useWorkflowStore.getState().addWire({
        from: { tool: "tool1", socket: "output" },
        to: { tool: "tool3", socket: "input" },
      });

      // Clear history to start fresh for our test
      useHistoryStore.getState().clear();

      const { result } = renderHook(() => useCanvasHandlers());

      // Now connect tool2 -> tool3 (should replace existing wire)
      act(() => {
        result.current.handleAddWire(
          { tool: "tool2", socket: "output" },
          { tool: "tool3", socket: "input" }
        );
      });

      // Should have created 2 history entries (remove old, add new)
      const history = useHistoryStore.getState();
      expect(history.past.length).toBe(2);

      // Undo once - should restore to state after removing old wire but before adding new
      let prevState = history.undo();
      expect(prevState).toBeDefined();
      if (prevState) {
        useWorkflowStore.getState().loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
      }

      // After first undo: old wire removed, new wire not added
      let wires = useWorkflowStore.getState().wires;
      expect(wires).toHaveLength(0);

      // Undo again - should restore original wire
      prevState = useHistoryStore.getState().undo();
      expect(prevState).toBeDefined();
      if (prevState) {
        useWorkflowStore.getState().loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
      }

      // After second undo: original wire restored
      wires = useWorkflowStore.getState().wires;
      expect(wires).toHaveLength(1);
      expect(wires[0]).toEqual({
        from: { tool: "tool1", socket: "output" },
        to: { tool: "tool3", socket: "input" },
      });
    });

    it("should not replace wire when target socket supports multiple connections", () => {
      // Setup: Add three tools
      const tool1 = createTestTool("tool1");
      const tool2 = createTestTool("tool2");
      const tool3 = createInputTool("tool3", true); // Multiple socket
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);
      useWorkflowStore.getState().addTool(tool3);

      // Connect tool1 -> tool3
      useWorkflowStore.getState().addWire({
        from: { tool: "tool1", socket: "output" },
        to: { tool: "tool3", socket: "input" },
      });

      const { result } = renderHook(() => useCanvasHandlers());

      // Now connect tool2 -> tool3 (should add, not replace)
      act(() => {
        result.current.handleAddWire(
          { tool: "tool2", socket: "output" },
          { tool: "tool3", socket: "input" }
        );
      });

      const wires = useWorkflowStore.getState().wires;
      expect(wires).toHaveLength(2);
    });

    it("should not replace wire when connecting same source (duplicate)", () => {
      // Setup: Add two tools
      const tool1 = createTestTool("tool1");
      const tool2 = createInputTool("tool2", false); // Non-multiple socket
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);

      // Connect tool1 -> tool2
      useWorkflowStore.getState().addWire({
        from: { tool: "tool1", socket: "output" },
        to: { tool: "tool2", socket: "input" },
      });

      const { result } = renderHook(() => useCanvasHandlers());

      // Try to connect same wire again
      act(() => {
        result.current.handleAddWire(
          { tool: "tool1", socket: "output" },
          { tool: "tool2", socket: "input" }
        );
      });

      // Should still have only one wire (duplicate rejected by addWire validation)
      const wires = useWorkflowStore.getState().wires;
      expect(wires).toHaveLength(1);
    });
  });
});
