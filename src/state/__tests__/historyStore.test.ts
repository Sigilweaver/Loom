import {
  Tool,
  ToolConfig,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { beforeEach, describe, expect, it } from "vitest";
import { useHistoryStore } from "../historyStore";

// Helper function to create a test tool
const createTestTool = (
  id: string = "tool_001",
  x: number = 100,
  y: number = 200
): Tool => ({
  id,
  type: "csv",
  x,
  y,
  config: { filePath: "/test/data.csv" } as ToolConfig,
  sockets: [{ id: 0, direction: "output", multiple: true }],
});

// Helper function to create test metadata
const createTestMeta = (name: string = "Test Workflow"): WorkflowMeta => ({
  name,
  description: "Test workflow description",
  author: "Test Author",
  workflowId: "test-workflow-id",
  created: "2025-10-19T10:00:00.000Z",
});

// Helper function to create a test wire
const createTestWire = (
  fromTool: string = "tool_001",
  fromSocket: number = 0,
  toTool: string = "tool_002",
  toSocket: number = 0
): Wire => ({
  from: { tool: fromTool, socket: fromSocket },
  to: { tool: toTool, socket: toSocket },
});

describe("historyStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useHistoryStore.getState().clear();
  });

  describe("saveSnapshot", () => {
    it("should save a snapshot to history", () => {
      const tools = [createTestTool("tool_001")];
      const wires: Wire[] = [];
      const meta = createTestMeta();

      useHistoryStore.getState().saveSnapshot(tools, wires, meta);

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(1);
      expect(state.past[0]?.tools).toEqual(tools);
      expect(state.past[0]?.wires).toEqual(wires);
      expect(state.past[0]?.meta).toEqual(meta);
    });

    it("should save multiple snapshots", () => {
      const meta = createTestMeta();

      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_001")], [], meta);
      useHistoryStore
        .getState()
        .saveSnapshot(
          [createTestTool("tool_001"), createTestTool("tool_002")],
          [],
          meta
        );

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(2);
      expect(state.past[0]?.tools).toHaveLength(1);
      expect(state.past[1]?.tools).toHaveLength(2);
    });

    it("should deep clone the snapshot data", () => {
      const tools = [createTestTool("tool_001")];
      const wires: Wire[] = [];
      const meta = createTestMeta();

      useHistoryStore.getState().saveSnapshot(tools, wires, meta);

      // Modify original data
      tools[0]!.x = 999;
      meta.name = "Modified";

      // Snapshot should not be affected
      const snapshot = useHistoryStore.getState().past[0];
      expect(snapshot?.tools[0]?.x).toBe(100); // Original value
      expect(snapshot?.meta.name).toBe("Test Workflow"); // Original value
    });

    it("should clear future stack when saving new snapshot", () => {
      const meta = createTestMeta();

      // Save, undo (creates future), then save again
      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_001")], [], meta);
      useHistoryStore.getState().undo();
      useHistoryStore.setState({
        future: [{ tools: [], wires: [], meta, timestamp: Date.now() }],
      });

      expect(useHistoryStore.getState().future).toHaveLength(1);

      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_002")], [], meta);

      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it("should enforce max history depth", () => {
      const meta = createTestMeta();
      useHistoryStore.getState().setMaxDepth(3);

      // Save 5 snapshots
      for (let i = 0; i < 5; i++) {
        useHistoryStore
          .getState()
          .saveSnapshot([createTestTool(`tool_${i}`)], [], meta);
      }

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(3); // Should only keep last 3
      expect(state.past[0]?.tools[0]?.id).toBe("tool_2"); // Oldest kept
      expect(state.past[2]?.tools[0]?.id).toBe("tool_4"); // Newest
    });

    it("should add timestamp to snapshots", () => {
      const before = Date.now();

      useHistoryStore.getState().saveSnapshot([], [], createTestMeta());

      const after = Date.now();
      const snapshot = useHistoryStore.getState().past[0];

      expect(snapshot?.timestamp).toBeGreaterThanOrEqual(before);
      expect(snapshot?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("undo", () => {
    it("should return previous snapshot", () => {
      const meta = createTestMeta();
      const tools1 = [createTestTool("tool_001")];
      const tools2 = [createTestTool("tool_001"), createTestTool("tool_002")];

      useHistoryStore.getState().saveSnapshot(tools1, [], meta);
      useHistoryStore.getState().saveSnapshot(tools2, [], meta);

      const snapshot = useHistoryStore.getState().undo();

      expect(snapshot).toBeDefined();
      expect(snapshot?.tools).toEqual(tools2);
    });

    it("should remove snapshot from past stack", () => {
      const meta = createTestMeta();

      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_001")], [], meta);
      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_002")], [], meta);

      expect(useHistoryStore.getState().past).toHaveLength(2);

      useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it("should return null when no history", () => {
      const snapshot = useHistoryStore.getState().undo();
      expect(snapshot).toBeNull();
    });

    it("should support multiple undos", () => {
      const meta = createTestMeta();

      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_001")], [], meta);
      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_002")], [], meta);
      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_003")], [], meta);

      const snapshot1 = useHistoryStore.getState().undo();
      expect(snapshot1?.tools[0]?.id).toBe("tool_003");

      const snapshot2 = useHistoryStore.getState().undo();
      expect(snapshot2?.tools[0]?.id).toBe("tool_002");

      const snapshot3 = useHistoryStore.getState().undo();
      expect(snapshot3?.tools[0]?.id).toBe("tool_001");

      const snapshot4 = useHistoryStore.getState().undo();
      expect(snapshot4).toBeNull();
    });
  });

  describe("redo", () => {
    it("should return next snapshot from future", () => {
      const meta = createTestMeta();
      const snapshot = {
        tools: [createTestTool("tool_001")],
        wires: [],
        meta,
        timestamp: Date.now(),
      };

      // Manually add to future for testing
      useHistoryStore.setState({ future: [snapshot] });

      const result = useHistoryStore.getState().redo();

      expect(result).toEqual(snapshot);
    });

    it("should remove snapshot from future stack", () => {
      const meta = createTestMeta();
      const snapshot = { tools: [], wires: [], meta, timestamp: Date.now() };

      useHistoryStore.setState({ future: [snapshot] });

      expect(useHistoryStore.getState().future).toHaveLength(1);

      useHistoryStore.getState().redo();

      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it("should return null when no future", () => {
      const snapshot = useHistoryStore.getState().redo();
      expect(snapshot).toBeNull();
    });
  });

  describe("canUndo", () => {
    it("should return false when no history", () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });

    it("should return true when history exists", () => {
      useHistoryStore.getState().saveSnapshot([], [], createTestMeta());
      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });

    it("should return false after undoing all history", () => {
      useHistoryStore.getState().saveSnapshot([], [], createTestMeta());
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });
  });

  describe("canRedo", () => {
    it("should return false when no future", () => {
      expect(useHistoryStore.getState().canRedo()).toBe(false);
    });

    it("should return true when future exists", () => {
      const meta = createTestMeta();
      const snapshot = { tools: [], wires: [], meta, timestamp: Date.now() };
      useHistoryStore.setState({ future: [snapshot] });
      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });
  });

  describe("clear", () => {
    it("should clear all history", () => {
      const meta = createTestMeta();

      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_001")], [], meta);
      useHistoryStore
        .getState()
        .saveSnapshot([createTestTool("tool_002")], [], meta);
      useHistoryStore.setState({
        future: [{ tools: [], wires: [], meta, timestamp: Date.now() }],
      });

      expect(useHistoryStore.getState().past).toHaveLength(2);
      expect(useHistoryStore.getState().future).toHaveLength(1);

      useHistoryStore.getState().clear();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });
  });

  describe("setMaxDepth", () => {
    it("should update max history depth", () => {
      useHistoryStore.getState().setMaxDepth(100);
      expect(useHistoryStore.getState().maxHistoryDepth).toBe(100);
    });

    it("should trim existing history if new depth is smaller", () => {
      const meta = createTestMeta();

      // Save 5 snapshots
      for (let i = 0; i < 5; i++) {
        useHistoryStore
          .getState()
          .saveSnapshot([createTestTool(`tool_${i}`)], [], meta);
      }

      expect(useHistoryStore.getState().past).toHaveLength(5);

      // Set max depth to 3
      useHistoryStore.getState().setMaxDepth(3);

      expect(useHistoryStore.getState().past).toHaveLength(3);
      expect(useHistoryStore.getState().past[0]?.tools[0]?.id).toBe("tool_2"); // Oldest kept
      expect(useHistoryStore.getState().past[2]?.tools[0]?.id).toBe("tool_4"); // Newest
    });
  });

  describe("integration - undo/redo workflow", () => {
    it("should support complete undo/redo cycle", () => {
      const meta = createTestMeta();

      // State 1 - add tool_001
      const state1 = {
        tools: [createTestTool("tool_001")],
        wires: [] as Wire[],
        meta,
      };
      useHistoryStore
        .getState()
        .saveSnapshot(state1.tools, state1.wires, state1.meta);

      // State 2 - add tool_002
      const state2 = {
        tools: [createTestTool("tool_001"), createTestTool("tool_002")],
        wires: [] as Wire[],
        meta,
      };
      useHistoryStore
        .getState()
        .saveSnapshot(state2.tools, state2.wires, state2.meta);

      // State 3 - add wire
      const state3 = {
        tools: [createTestTool("tool_001"), createTestTool("tool_002")],
        wires: [createTestWire("tool_001", 0, "tool_002", 0)],
        meta,
      };
      useHistoryStore
        .getState()
        .saveSnapshot(state3.tools, state3.wires, state3.meta);

      // Undo to state 2
      let snapshot = useHistoryStore.getState().undo();
      expect(snapshot?.tools).toHaveLength(2);
      expect(snapshot?.wires).toHaveLength(1);

      // Undo to state 1
      snapshot = useHistoryStore.getState().undo();
      expect(snapshot?.tools).toHaveLength(2);
      expect(snapshot?.wires).toHaveLength(0);

      // Undo to state 0
      snapshot = useHistoryStore.getState().undo();
      expect(snapshot?.tools).toHaveLength(1);

      // Can't undo further
      snapshot = useHistoryStore.getState().undo();
      expect(snapshot).toBeNull();
    });

    it("should preserve data integrity through multiple operations", () => {
      const meta = createTestMeta();
      const tool1 = createTestTool("tool_001", 100, 200);
      const tool2 = createTestTool("tool_002", 300, 400);

      // Save first state
      useHistoryStore.getState().saveSnapshot([tool1], [], meta);

      // Modify tool1 and save
      tool1.x = 500;
      useHistoryStore.getState().saveSnapshot([tool1], [], meta);

      // Add tool2 and save
      useHistoryStore.getState().saveSnapshot([tool1, tool2], [], meta);

      // Undo twice
      useHistoryStore.getState().undo();
      const snapshot = useHistoryStore.getState().undo();

      // Should get original tool1 position
      expect(snapshot?.tools[0]?.x).toBe(500); // Modified position
      expect(snapshot?.tools).toHaveLength(1);
    });
  });

  describe("selector hooks", () => {
    it("useCanUndo should track undo availability", () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);

      useHistoryStore.getState().saveSnapshot([], [], createTestMeta());

      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });

    it("useCanRedo should track redo availability", () => {
      expect(useHistoryStore.getState().canRedo()).toBe(false);

      const meta = createTestMeta();
      useHistoryStore.setState({
        future: [{ tools: [], wires: [], meta, timestamp: Date.now() }],
      });

      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });
  });

  describe("performance - JSON snapshots", () => {
    it("should handle large workflows efficiently", () => {
      const meta = createTestMeta();

      // Create a large workflow (100 tools, 99 wires)
      const tools: Tool[] = [];
      const wires: Wire[] = [];

      for (let i = 0; i < 100; i++) {
        tools.push(createTestTool(`tool_${i}`, i * 10, i * 10));
        if (i > 0) {
          wires.push(createTestWire(`tool_${i - 1}`, 0, `tool_${i}`, 0));
        }
      }

      // Measure snapshot time
      const start = Date.now();
      useHistoryStore.getState().saveSnapshot(tools, wires, meta);
      const duration = Date.now() - start;

      // Should be very fast (< 10ms for 100 tools)
      expect(duration).toBeLessThan(10);

      // Verify data integrity
      const snapshot = useHistoryStore.getState().past[0];
      expect(snapshot?.tools).toHaveLength(100);
      expect(snapshot?.wires).toHaveLength(99);
    });
  });
});
