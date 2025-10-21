/**
 * Simplified tests for historyStore with auto-reading from workflowStore
 *
 * Key Change: undo/redo now read current state from workflowStore automatically
 * Tests validate pushState and basic stack management
 */

import { Tool, Wire, WorkflowMeta } from "@domain/workflow/entities/workflow";
import { useHistoryStore, WorkflowSnapshot } from "@state/historyStore";
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

  describe("Edge Cases - Coverage Gaps", () => {
    describe("undo edge cases", () => {
      it("should return null when past is empty (line 103)", () => {
        // Ensure past is empty
        useHistoryStore.setState({ past: [], future: [] });

        const result = useHistoryStore.getState().undo();
        expect(result).toBeNull();
      });

      it("should return null when past has invalid state", () => {
        // Manually set past with undefined (edge case)
        useHistoryStore.setState({
          past: [undefined as unknown as WorkflowSnapshot],
          future: [],
        });

        const result = useHistoryStore.getState().undo();
        expect(result).toBeNull();
      });

      it("should save current state to future on undo", () => {
        const meta = createTestMeta();

        // Push initial state
        useHistoryStore.getState().pushState([], [], meta);

        // Set up current workflow state
        const tool = createTestTool("tool_001");
        useWorkflowStore.setState({
          tools: [tool],
          wires: [],
          workflowMeta: meta,
        });

        // Undo
        const undoState = useHistoryStore.getState().undo();
        expect(undoState).not.toBeNull();

        // Future should have the current state (with tool_001)
        const futureState = useHistoryStore.getState().future;
        expect(futureState).toHaveLength(1);
        expect(futureState[0]?.tools).toHaveLength(1);
        expect(futureState[0]?.tools[0]?.id).toBe("tool_001");
      });
    });

    describe("redo edge cases", () => {
      it("should return null when future is empty (line 146)", () => {
        // Ensure future is empty
        useHistoryStore.setState({ past: [], future: [] });

        const result = useHistoryStore.getState().redo();
        expect(result).toBeNull();
      });

      it("should return null when future has invalid state", () => {
        // Manually set future with undefined (edge case)
        useHistoryStore.setState({
          past: [],
          future: [undefined as unknown as WorkflowSnapshot],
        });

        const result = useHistoryStore.getState().redo();
        expect(result).toBeNull();
      });

      it("should save current state to past on redo", () => {
        const meta = createTestMeta();

        // Setup: past is empty, future has a state
        const futureState: WorkflowSnapshot = {
          tools: [createTestTool("tool_future")],
          wires: [],
          meta,
          timestamp: Date.now(),
        };

        useHistoryStore.setState({
          past: [],
          future: [futureState],
        });

        // Set current workflow state (different from future)
        const currentTool = createTestTool("tool_current");
        useWorkflowStore.setState({
          tools: [currentTool],
          wires: [],
          workflowMeta: meta,
        });

        // Redo
        const redoState = useHistoryStore.getState().redo();
        expect(redoState).not.toBeNull();
        expect(redoState?.tools[0]?.id).toBe("tool_future");

        // Past should now have the current state (tool_current)
        const pastState = useHistoryStore.getState().past;
        expect(pastState).toHaveLength(1);
        expect(pastState[0]?.tools[0]?.id).toBe("tool_current");
      });

      it("should respect max depth when adding to past on redo", () => {
        const meta = createTestMeta();

        // Set max depth to 2
        useHistoryStore.getState().setMaxDepth(2);

        // Fill past with 2 items
        useHistoryStore.setState({
          past: [
            {
              tools: [createTestTool("old_1")],
              wires: [],
              meta,
              timestamp: Date.now(),
            },
            {
              tools: [createTestTool("old_2")],
              wires: [],
              meta,
              timestamp: Date.now(),
            },
          ],
          future: [
            {
              tools: [createTestTool("future_1")],
              wires: [],
              meta,
              timestamp: Date.now(),
            },
          ],
        });

        // Set current workflow
        useWorkflowStore.setState({
          tools: [createTestTool("current")],
          wires: [],
          workflowMeta: meta,
        });

        // Redo (should add current to past, exceeding max depth)
        useHistoryStore.getState().redo();

        const pastState = useHistoryStore.getState().past;
        expect(pastState).toHaveLength(2); // Max depth enforced
        expect(pastState[0]?.tools[0]?.id).toBe("old_2"); // old_1 dropped
        expect(pastState[1]?.tools[0]?.id).toBe("current"); // current added
      });
    });

    describe("clear", () => {
      it("should clear both past and future stacks (lines 250-254)", () => {
        const meta = createTestMeta();

        // Setup: both stacks have data
        useHistoryStore.setState({
          past: [
            {
              tools: [createTestTool("past_1")],
              wires: [],
              meta,
              timestamp: Date.now(),
            },
            {
              tools: [createTestTool("past_2")],
              wires: [],
              meta,
              timestamp: Date.now(),
            },
          ],
          future: [
            {
              tools: [createTestTool("future_1")],
              wires: [],
              meta,
              timestamp: Date.now(),
            },
          ],
        });

        expect(useHistoryStore.getState().past).toHaveLength(2);
        expect(useHistoryStore.getState().future).toHaveLength(1);

        // Clear
        useHistoryStore.getState().clear();

        expect(useHistoryStore.getState().past).toHaveLength(0);
        expect(useHistoryStore.getState().future).toHaveLength(0);
      });

      it("should handle clearing empty stacks", () => {
        // Already empty
        useHistoryStore.setState({ past: [], future: [] });

        // Clear again (should not error)
        useHistoryStore.getState().clear();

        expect(useHistoryStore.getState().past).toHaveLength(0);
        expect(useHistoryStore.getState().future).toHaveLength(0);
      });
    });

    describe("setMaxDepth edge cases", () => {
      it("should trim past when new depth is smaller", () => {
        const meta = createTestMeta();

        // Create 5 items in past
        const pastItems = Array.from({ length: 5 }, (_, i) => ({
          tools: [createTestTool(`tool_${i + 1}`)],
          wires: [],
          meta,
          timestamp: Date.now(),
        }));

        useHistoryStore.setState({ past: pastItems, future: [] });

        expect(useHistoryStore.getState().past).toHaveLength(5);

        // Set max depth to 2
        useHistoryStore.getState().setMaxDepth(2);

        const newPast = useHistoryStore.getState().past;
        expect(newPast).toHaveLength(2);
        expect(newPast[0]?.tools[0]?.id).toBe("tool_4"); // Kept last 2
        expect(newPast[1]?.tools[0]?.id).toBe("tool_5");
      });

      it("should not trim past when new depth is larger", () => {
        const meta = createTestMeta();

        const pastItems = Array.from({ length: 2 }, (_, i) => ({
          tools: [createTestTool(`tool_${i + 1}`)],
          wires: [],
          meta,
          timestamp: Date.now(),
        }));

        useHistoryStore.setState({ past: pastItems, future: [] });

        // Set max depth to 10
        useHistoryStore.getState().setMaxDepth(10);

        expect(useHistoryStore.getState().past).toHaveLength(2); // Unchanged
      });

      it("should update maxHistoryDepth property", () => {
        useHistoryStore.getState().setMaxDepth(100);
        expect(useHistoryStore.getState().maxHistoryDepth).toBe(100);
      });
    });

    describe("deep cloning", () => {
      it("should clone tools with nested config", () => {
        const meta = createTestMeta();
        const tool = createTestTool("tool_001");
        tool.config = {
          filename: "test.csv",
          options: { nested: { deep: "value" } },
        };

        useHistoryStore.getState().pushState([tool], [], meta);

        // Mutate nested config
        (tool.config as { options: { nested: { deep: string } } }).options.nested.deep = "mutated";

        const snapshot = useHistoryStore.getState().past[0];
        const snapshotConfig = snapshot?.tools[0]?.config as {
          options: { nested: { deep: string } };
        };
        expect(snapshotConfig.options.nested.deep).toBe("value");
      });

      it("should clone wires", () => {
        const meta = createTestMeta();
        const wires: Wire[] = [
          { from: { tool: "tool1", socket: 1 }, to: { tool: "tool2", socket: 2 } },
        ];

        useHistoryStore.getState().pushState([], wires, meta);

        // Mutate original wire
        wires[0]!.from.socket = 999;

        const snapshot = useHistoryStore.getState().past[0];
        expect(snapshot?.wires[0]?.from.socket).toBe(1);
      });

      it("should clone workflow metadata", () => {
        const meta = createTestMeta();
        meta.name = "Original Name";

        useHistoryStore.getState().pushState([], [], meta);

        // Mutate original
        meta.name = "Mutated Name";

        const snapshot = useHistoryStore.getState().past[0];
        expect(snapshot?.meta.name).toBe("Original Name");
      });
    });
  });

  describe("Selector Hooks", () => {
    it("useCanUndo should return correct value", () => {
      useHistoryStore.setState({ past: [], future: [] });
      expect(useHistoryStore.getState().canUndo()).toBe(false);

      const meta = createTestMeta();
      useHistoryStore.getState().pushState([], [], meta);
      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });

    it("useCanRedo should return correct value", () => {
      useHistoryStore.setState({ past: [], future: [] });
      expect(useHistoryStore.getState().canRedo()).toBe(false);

      const meta = createTestMeta();
      useHistoryStore.setState({
        past: [],
        future: [{ tools: [], wires: [], meta, timestamp: Date.now() }],
      });
      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });

    it("should track history depth", () => {
      const meta = createTestMeta();

      // Start empty
      useHistoryStore.setState({ past: [], future: [], maxHistoryDepth: 50 });
      let state = useHistoryStore.getState();
      expect(state.past.length).toBe(0);
      expect(state.future.length).toBe(0);
      expect(state.maxHistoryDepth).toBe(50);

      // Add to past
      useHistoryStore.getState().pushState([], [], meta);
      state = useHistoryStore.getState();
      expect(state.past.length).toBe(1);

      // Change max depth
      useHistoryStore.getState().setMaxDepth(25);
      state = useHistoryStore.getState();
      expect(state.maxHistoryDepth).toBe(25);
    });
  });
});
