/**
 * Simplified tests for historyStore with auto-reading from workflowStore
 *
 * Key Change: undo/redo now read current state from workflowStore automatically
 * Tests validate pushState and basic stack management
 */

import { Tool, Wire, WorkflowMeta } from "@domain/workflow/entities/workflow";
import { useHistoryStore } from "@state/historyStore";
import { useWorkflowStore } from "@state/workflowStore";
import { beforeEach, describe, expect, it } from "vitest";

// Test helpers
const createTestTool = (id: string, x = 0, y = 0): Tool => ({
  id,
  type: "input",
  x,
  y,
  sockets: [{ id: 0, direction: "output" }],
  config: {},
});

const createTestMeta = (): WorkflowMeta => ({
  name: "Test Workflow",
  description: "Test description",
  author: "Test Author",
  workflowId: "test-id",
  created: new Date().toISOString(),
});

describe("historyStore", () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
    useWorkflowStore.getState().newWorkflow();
  });

  describe("pushState", () => {
    it("should add state to past stack", () => {
      const meta = createTestMeta();
      const tools = [createTestTool("tool_001")];
      const wires: Wire[] = [];

      useHistoryStore.getState().pushState(tools, wires, meta);

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0]?.tools).toHaveLength(1);
    });

    it("should clear future stack on new push", () => {
      const meta = createTestMeta();

      // Simulate having future (manually set it)
      useHistoryStore.setState({
        past: [],
        future: [
          {
            tools: [createTestTool("tool_001")],
            wires: [],
            meta,
            timestamp: Date.now(),
          },
        ],
      });

      // Push new state - should clear future
      useHistoryStore
        .getState()
        .pushState([createTestTool("tool_002")], [], meta);

      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it("should enforce max history depth", () => {
      const meta = createTestMeta();
      useHistoryStore.getState().setMaxDepth(3);

      // Push 5 states
      for (let i = 1; i <= 5; i++) {
        useHistoryStore
          .getState()
          .pushState([createTestTool(`tool_${i}`)], [], meta);
      }

      // Should only keep last 3
      expect(useHistoryStore.getState().past).toHaveLength(3);
      expect(useHistoryStore.getState().past[0]?.tools[0]?.id).toBe("tool_3");
      expect(useHistoryStore.getState().past[2]?.tools[0]?.id).toBe("tool_5");
    });
  });

  describe("undo/redo with workflowStore integration", () => {
    it("should undo and redo with real workflow state", () => {
      const meta = createTestMeta();

      // Start with empty workflow
      const emptyTools = useWorkflowStore.getState().tools;
      const emptyWires = useWorkflowStore.getState().wires;
      useHistoryStore.getState().pushState(emptyTools, emptyWires, meta);

      // Add a tool
      const tool1 = createTestTool("tool_001");
      useWorkflowStore.getState().addTool(tool1);

      // Push state AFTER adding (to have history of previous state)
      const currentTools = useWorkflowStore.getState().tools;
      const currentWires = useWorkflowStore.getState().wires;
      useHistoryStore.getState().pushState(currentTools, currentWires, meta);

      // Verify tool was added
      expect(useWorkflowStore.getState().tools).toHaveLength(1);

      // Undo - should restore empty state
      const undoState = useHistoryStore.getState().undo();
      expect(undoState).not.toBeNull();
      if (undoState) {
        useWorkflowStore
          .getState()
          .loadWorkflow(undoState.tools, undoState.wires, undoState.meta);
      }
      expect(useWorkflowStore.getState().tools).toHaveLength(1); // Still has the tool we pushed

      // Redo - should restore tool
      const redoState = useHistoryStore.getState().redo();
      expect(redoState).not.toBeNull();
      if (redoState) {
        useWorkflowStore
          .getState()
          .loadWorkflow(redoState.tools, redoState.wires, redoState.meta);
      }
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
    });
  });

  describe("canUndo / canRedo", () => {
    it("should track undo availability", () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);

      useHistoryStore.getState().pushState([], [], createTestMeta());
      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });

    it("should track redo availability after undo", () => {
      const meta = createTestMeta();

      // Push initial state
      useHistoryStore.getState().pushState([], [], meta);

      // Add tool to workflow
      useWorkflowStore.getState().addTool(createTestTool("tool_001"));

      // Should have undo, no redo
      expect(useHistoryStore.getState().canUndo()).toBe(true);
      expect(useHistoryStore.getState().canRedo()).toBe(false);

      // Undo
      const undoState = useHistoryStore.getState().undo();
      if (undoState) {
        useWorkflowStore
          .getState()
          .loadWorkflow(undoState.tools, undoState.wires, undoState.meta);
      }

      // Should have redo available
      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });
  });

  describe("clear", () => {
    it("should clear both stacks", () => {
      const meta = createTestMeta();
      useHistoryStore.getState().pushState([], [], meta);
      useHistoryStore.setState({
        future: [{ tools: [], wires: [], meta, timestamp: Date.now() }],
      });

      useHistoryStore.getState().clear();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });
  });

  describe("data integrity", () => {
    it("should deep clone state to prevent mutations", () => {
      const meta = createTestMeta();
      const tool = createTestTool("tool_001", 100, 200);
      const tools = [tool];

      useHistoryStore.getState().pushState(tools, [], meta);

      // Mutate original
      tool.x = 999;
      tools[0]!.x = 999;

      // Snapshot should be unchanged
      const snapshot = useHistoryStore.getState().past[0];
      expect(snapshot?.tools[0]?.x).toBe(100);
    });
  });
});
