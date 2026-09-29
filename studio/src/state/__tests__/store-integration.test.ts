/**
 * Integration Tests: Multi-Store Workflows
 *
 * Tests real-world scenarios involving multiple stores:
 * - Workflow + History (undo/redo workflows)
 * - Workflow + UI (notifications on errors)
 * - Cross-store state independence
 * - Tab + Workflow + History (multi-tab workflows)
 * - Clipboard + Workflow + History (copy/paste with undo)
 * - Execution + Workflow (execution state tied to workflow)
 * - Settings + UI synchronization
 * - Full lifecycle scenarios
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  Tool,
  Wire,
  WorkflowMeta,
} from "../../domain/workflow/entities/workflow";
import { useHistoryStore } from "../historyStore";
import { useUIStore } from "../uiStore";
import { useWorkflowStore } from "../workflowStore";
import { useTabStore } from "../tabStore";
import { useClipboardStore } from "../clipboardStore";
import { useExecutionStore } from "../executionStore";

// Mock ID generation for predictable tests
vi.mock("@utils/id", () => ({
  generateUniqueId: vi.fn((existing: Set<string>) => {
    // Generate sequential IDs for testing
    let counter = existing.size;
    let id = `test-id-${counter}`;
    while (existing.has(id)) {
      counter++;
      id = `test-id-${counter}`;
    }
    return id;
  }),
}));

// Mock uuid for predictable tab IDs
vi.mock("uuid", () => ({
  v4: vi.fn(() => `tab-${Math.random().toString(36).substring(7)}`),
}));

// Mock window.confirm for dirty tab confirmation
const mockConfirm = vi.spyOn(window, "confirm").mockReturnValue(true);

// Mock cache functions
vi.mock("../../api/cache", () => ({
  clearWorkflowCache: vi.fn(),
  invalidateTool: vi.fn(),
  invalidateWireChange: vi.fn(),
}));

// Helper to create a test tool
const createTestTool = (
  id: string,
  type = "Input",
  x = 100,
  y = 100
): Tool => ({
  id,
  type,
  x,
  y,
  config: {},
  sockets: [
    { id: "input", direction: "input", multiple: false },
    { id: "output", direction: "output", multiple: false },
  ],
});

// Helper to create a test wire
const createTestWire = (fromTool: string, toTool: string): Wire => ({
  from: { tool: fromTool, socket: "output" },
  to: { tool: toTool, socket: "input" },
});

describe("Store Integration Tests", () => {
  beforeEach(() => {
    // Reset all stores to clean state
    useWorkflowStore.setState({
      tools: [],
      wires: [],
      workflowMeta: {
        name: "",
        description: "",
        author: "",
        workflowId: "test-workflow",
        created: new Date().toISOString(),
      },
      selectedTool: null,
    });

    useHistoryStore.getState().clear();
    useHistoryStore.getState().setMaxDepth(50); // Reset to default
    useUIStore.getState().hideNotification();
    
    // Reset tab store
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      tabData: {},
    });
    
    // Reset clipboard store
    useClipboardStore.setState({
      clipboard: null,
    });
    
    // Reset execution store
    useExecutionStore.setState({
      executions: {},
      activeTabId: null,
      isExecuting: false,
      currentToolId: null,
      result: null,
      error: null,
      logs: [],
    });

    // Reset mock
    mockConfirm.mockReturnValue(true);
  });

  describe("Workflow + History Integration", () => {
    test("should create history snapshot when adding tools", () => {
      const { pushState } = useHistoryStore.getState();
      const { addTool, tools, wires, workflowMeta } =
        useWorkflowStore.getState();

      // Push current state before making changes
      pushState(tools, wires, workflowMeta);

      const tool: Tool = {
        id: "tool1",
        type: "Input",
        x: 100,
        y: 200,
        config: {},
        sockets: [{ id: 'output', direction: 'output', multiple: false }],
      };

      addTool(tool);

      const state = useWorkflowStore.getState();
      expect(state.tools).toHaveLength(1);

      // Verify history can undo
      const prevState = useHistoryStore.getState().undo();
      expect(prevState).toBeDefined();
      expect(prevState?.tools).toHaveLength(0);
    });

    test("should restore complete workflow state on undo", () => {
      const { pushState, undo } = useHistoryStore.getState();
      const { loadWorkflow } = useWorkflowStore.getState();

      // Initial workflow
      const initialTools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
      ];

      const initialWires: Wire[] = [];
      const initialMeta: WorkflowMeta = {
        name: "Initial",
        description: "First version",
        author: "Test",
        workflowId: "test-id",
        created: new Date().toISOString(),
      };

      loadWorkflow(initialTools, initialWires, initialMeta);

      // Save snapshot
      pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      // Modify workflow
      const newTools: Tool[] = [
        ...initialTools,
        {
          id: "tool2",
          type: "Output",
          x: 300,
          y: 200,
          config: {},
          sockets: [{ id: 'input', direction: 'input', multiple: false }],
        },
      ];

      const newWires: Wire[] = [
        {
          from: { tool: "tool1", socket: 'output' },
          to: { tool: "tool2", socket: 'input' },
        },
      ];

      const newMeta: WorkflowMeta = {
        ...initialMeta,
        name: "Modified",
        description: "Second version",
      };

      loadWorkflow(newTools, newWires, newMeta);

      const modifiedState = useWorkflowStore.getState();
      expect(modifiedState.tools).toHaveLength(2);
      expect(modifiedState.wires).toHaveLength(1);
      expect(modifiedState.workflowMeta.name).toBe("Modified");

      // Undo to initial state
      const prevState = undo();
      expect(prevState).toBeDefined();

      if (prevState) {
        loadWorkflow(prevState.tools, prevState.wires, prevState.meta);

        const restoredState = useWorkflowStore.getState();
        expect(restoredState.tools).toHaveLength(1);
        expect(restoredState.wires).toHaveLength(0);
        expect(restoredState.workflowMeta.name).toBe("Initial");
      }
    });

    test("should maintain history through multiple operations", () => {
      const { pushState, undo, redo } = useHistoryStore.getState();
      const { addTool, removeTool } = useWorkflowStore.getState();

      // Operation 1: Add tool
      pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      const tool1: Tool = {
        id: "tool1",
        type: "Input",
        x: 100,
        y: 200,
        config: {},
        sockets: [],
      };

      addTool(tool1);
      expect(useWorkflowStore.getState().tools).toHaveLength(1);

      // Operation 2: Add another tool
      pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      const tool2: Tool = {
        id: "tool2",
        type: "Output",
        x: 300,
        y: 200,
        config: {},
        sockets: [],
      };

      addTool(tool2);
      expect(useWorkflowStore.getState().tools).toHaveLength(2);

      // Operation 3: Remove first tool
      pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      removeTool("tool1");
      expect(useWorkflowStore.getState().tools).toHaveLength(1);

      // Undo remove
      const state1 = undo();
      if (state1) {
        useWorkflowStore
          .getState()
          .loadWorkflow(state1.tools, state1.wires, state1.meta);
        expect(useWorkflowStore.getState().tools).toHaveLength(2);
      }

      // Undo second add
      const state2 = undo();
      if (state2) {
        useWorkflowStore
          .getState()
          .loadWorkflow(state2.tools, state2.wires, state2.meta);
        expect(useWorkflowStore.getState().tools).toHaveLength(1);
      }

      // Redo
      const state3 = redo();
      if (state3) {
        useWorkflowStore
          .getState()
          .loadWorkflow(state3.tools, state3.wires, state3.meta);
        expect(useWorkflowStore.getState().tools).toHaveLength(2);
      }
    });

    test("should handle rapid undo/redo operations", () => {
      const { pushState, undo, redo, canUndo, canRedo } =
        useHistoryStore.getState();

      // Build up history with 5 states
      for (let i = 0; i < 5; i++) {
        const workflow = useWorkflowStore.getState();
        pushState(workflow.tools, workflow.wires, workflow.workflowMeta);
        workflow.addTool({
          id: `tool${i}`,
          type: i % 2 === 0 ? "Input" : "Output",
          x: i * 100,
          y: 200,
          config: {},
          sockets: [],
        });
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(5);
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(false);

      // Undo 3 times
      for (let i = 0; i < 3; i++) {
        const prev = undo();
        if (prev) {
          useWorkflowStore
            .getState()
            .loadWorkflow(prev.tools, prev.wires, prev.meta);
        }
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(2);
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(true);

      // Redo 2 times
      for (let i = 0; i < 2; i++) {
        const next = redo();
        if (next) {
          useWorkflowStore
            .getState()
            .loadWorkflow(next.tools, next.wires, next.meta);
        }
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(4);
    });
  });

  describe("Workflow + UI Integration", () => {
    test("should show notification on workflow errors", () => {
      const { showNotification } = useUIStore.getState();
      const { validateWire } = useWorkflowStore.getState();

      // Create invalid wire (non-existent tools)
      const invalidWire: Wire = {
        from: { tool: "nonexistent1", socket: 'output' },
        to: { tool: "nonexistent2", socket: 'input' },
      };

      const result = validateWire(invalidWire);

      if (!result.valid) {
        showNotification(result.error || "Unknown error", "error", 5000);
      }

      const notification = useUIStore.getState().notification;
      expect(notification.isVisible).toBe(true);
      expect(notification.type).toBe("error");
      expect(notification.message).toContain("Tool");
    });

    test("should track UI preferences across workflow operations", () => {
      const { toggleMinimap } = useUIStore.getState();
      const { addTool } = useWorkflowStore.getState();

      // Set UI preference (toggle off if it's on)
      const initialState = useUIStore.getState().minimapVisible;
      if (initialState) {
        toggleMinimap();
      }
      expect(useUIStore.getState().minimapVisible).toBe(false);

      // Add tool (shouldn't affect UI state)
      const tool: Tool = {
        id: "tool1",
        type: "Input",
        x: 100,
        y: 200,
        config: {},
        sockets: [],
      };

      addTool(tool);

      // UI preference preserved
      expect(useUIStore.getState().minimapVisible).toBe(false);
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
    });

    test("should handle concurrent notifications", () => {
      const { showNotification, hideNotification } = useUIStore.getState();

      showNotification("First error", "error", 5000);
      expect(useUIStore.getState().notification.message).toBe("First error");

      showNotification("Second error", "error", 5000);
      expect(useUIStore.getState().notification.message).toBe("Second error");

      hideNotification();
      expect(useUIStore.getState().notification.isVisible).toBe(false);
    });
  });

  describe("Cross-Store State Consistency", () => {
    test("should maintain independent state across stores", () => {
      // Modify each store
      useWorkflowStore.getState().updateWorkflowMeta({ name: "Test Workflow" });
      useHistoryStore.getState().setMaxDepth(25);

      const ui = useUIStore.getState();
      if (ui.minimapVisible) {
        ui.toggleMinimap();
      }

      // Verify state was set correctly
      expect(useWorkflowStore.getState().workflowMeta.name).toBe(
        "Test Workflow"
      );
      expect(useHistoryStore.getState().maxHistoryDepth).toBe(25);
      expect(useUIStore.getState().minimapVisible).toBe(false);

      // Reset one store doesn't affect others
      useWorkflowStore.setState({
        tools: [],
        wires: [],
        workflowMeta: {
          name: "",
          description: "",
          author: "",
          workflowId: "new-id",
          created: new Date().toISOString(),
        },
        selectedTool: null,
      });

      expect(useWorkflowStore.getState().workflowMeta.name).toBe("");
      expect(useHistoryStore.getState().maxHistoryDepth).toBe(25); // Unchanged
      expect(useUIStore.getState().minimapVisible).toBe(false); // Unchanged
    });

    test("should allow history depth configuration during workflow", () => {
      const workflow = useWorkflowStore.getState();
      const history = useHistoryStore.getState();

      // Set max depth
      history.setMaxDepth(3);

      // Add 5 tools (exceeds depth)
      for (let i = 0; i < 5; i++) {
        history.pushState(
          workflow.tools,
          workflow.wires,
          workflow.workflowMeta
        );
        workflow.addTool({
          id: `tool${i}`,
          type: "Input",
          x: i * 100,
          y: 200,
          config: {},
          sockets: [],
        });
      }

      // Can only undo 3 times (max depth)
      let undoCount = 0;
      for (let i = 0; i < 10; i++) {
        const prev = history.undo();
        if (prev) {
          workflow.loadWorkflow(prev.tools, prev.wires, prev.meta);
          undoCount++;
        } else {
          break;
        }
      }

      expect(undoCount).toBe(3); // Limited by maxDepth
    });
  });

  describe("Complex Workflow Scenarios", () => {
    test("should handle full workflow lifecycle", () => {
      const history = useHistoryStore.getState();
      const ui = useUIStore.getState();

      // 1. Create initial workflow
      let workflow = useWorkflowStore.getState();
      history.pushState(workflow.tools, workflow.wires, workflow.workflowMeta);

      const tool1: Tool = {
        id: "input",
        type: "Input",
        x: 100,
        y: 200,
        config: { filename: "data.csv" },
        sockets: [{ id: 'output', direction: 'output', multiple: false }],
      };

      workflow.addTool(tool1);

      // 2. Add second tool
      workflow = useWorkflowStore.getState();
      history.pushState(workflow.tools, workflow.wires, workflow.workflowMeta);

      const tool2: Tool = {
        id: "filter",
        type: "Filter",
        x: 300,
        y: 200,
        config: { condition: "x > 0" },
        sockets: [
          { id: 'input', direction: 'input', multiple: false },
          { id: 'output-false', direction: 'output', multiple: false },
        ],
      };

      workflow.addTool(tool2);

      // 3. Add wire
      workflow = useWorkflowStore.getState();
      history.pushState(workflow.tools, workflow.wires, workflow.workflowMeta);

      const wire: Wire = {
        from: { tool: "input", socket: 'output' },
        to: { tool: "filter", socket: 'input' },
      };

      workflow.addWire(wire);

      expect(useWorkflowStore.getState().tools).toHaveLength(2);
      expect(useWorkflowStore.getState().wires).toHaveLength(1);

      // 4. Set UI preference
      if (ui.minimapVisible) {
        ui.toggleMinimap();
      }
      expect(ui.minimapVisible).toBe(false);

      // 5. Undo wire addition
      const prevState = history.undo();
      if (prevState) {
        useWorkflowStore
          .getState()
          .loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(2);
      expect(useWorkflowStore.getState().wires).toHaveLength(0); // Wire removed
      expect(ui.minimapVisible).toBe(false); // UI preserved

      // 6. Redo wire addition
      const nextState = history.redo();
      if (nextState) {
        useWorkflowStore
          .getState()
          .loadWorkflow(nextState.tools, nextState.wires, nextState.meta);
      }

      expect(useWorkflowStore.getState().wires).toHaveLength(1); // Wire restored
    });
  });

  describe("Tab + Workflow + History Integration", () => {
    test("should maintain independent history per tab", () => {
      // Create first tab
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      const tool1: Tool = createTestTool("tool1", "Input", 100, 100);
      
      // Add tool and push to history in tab 1
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addTool(tool1);
      
      expect(useHistoryStore.getState().past.length).toBe(1);

      // Create second tab - should have fresh history
      const tab2Id = useTabStore.getState().createTab("Tab 2");
      expect(useHistoryStore.getState().past.length).toBe(0);
      
      // Add different tool in tab 2
      const tool2: Tool = createTestTool("tool2", "Filter", 200, 200);
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addTool(tool2);
      
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
      expect(useWorkflowStore.getState().tools[0]?.id).toBe("tool2");

      // Switch back to tab 1 - should restore tab 1's state and history
      useTabStore.getState().switchTab(tab1Id);
      
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
      expect(useWorkflowStore.getState().tools[0]?.id).toBe("tool1");
      expect(useHistoryStore.getState().past.length).toBe(1);

      // Undo in tab 1 should work independently
      const prevState = useHistoryStore.getState().undo();
      if (prevState) {
        useWorkflowStore.getState().loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
      }
      expect(useWorkflowStore.getState().tools).toHaveLength(0);

      // Switch to tab 2 - should still have its tool
      useTabStore.getState().switchTab(tab2Id);
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
      expect(useWorkflowStore.getState().tools[0]?.id).toBe("tool2");
    });

    test("should preserve history when closing and reopening the same workflow", () => {
      // Create tab with workflow
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      
      // Build up some history
      for (let i = 0; i < 3; i++) {
        useHistoryStore.getState().pushState(
          useWorkflowStore.getState().tools,
          useWorkflowStore.getState().wires,
          useWorkflowStore.getState().workflowMeta
        );
        useWorkflowStore.getState().addTool(createTestTool(`tool${i}`));
      }
      
      expect(useWorkflowStore.getState().tools).toHaveLength(3);
      expect(useHistoryStore.getState().past.length).toBe(3);

      // Create new tab and switch to it
      useTabStore.getState().createTab("Tab 2");
      
      // Switch back to tab 1
      useTabStore.getState().switchTab(tab1Id);

      // History should be preserved
      expect(useWorkflowStore.getState().tools).toHaveLength(3);
      expect(useHistoryStore.getState().past.length).toBe(3);
      
      // Should be able to undo all the way back
      for (let i = 0; i < 3; i++) {
        const prev = useHistoryStore.getState().undo();
        if (prev) {
          useWorkflowStore.getState().loadWorkflow(prev.tools, prev.wires, prev.meta);
        }
      }
      expect(useWorkflowStore.getState().tools).toHaveLength(0);
    });

    test("should sync tab name with workflow metadata", () => {
      const tabId = useTabStore.getState().createTab("Initial Name");
      
      // Update workflow meta name
      useWorkflowStore.getState().updateWorkflowMeta({ name: "Updated Name" });
      
      // Save and reload tab
      useTabStore.getState().saveCurrentTab();
      useTabStore.getState().loadTab(tabId);
      
      // Tab name should be synced
      const tab = useTabStore.getState().getTabById(tabId);
      expect(tab?.name).toBe("Updated Name");
    });
  });

  describe("Clipboard + Workflow + History Integration", () => {
    test("should allow undoing paste operations", () => {
      // Setup: create source tool
      const sourceTool = createTestTool("source", "Input", 100, 100);
      useWorkflowStore.getState().addTool(sourceTool);
      
      // Copy the tool
      useClipboardStore.getState().copyTools(["source"]);
      expect(useClipboardStore.getState().clipboard).not.toBeNull();

      // Push state before paste
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      // Paste at new location
      const newIds = useClipboardStore.getState().pasteToolsAt({ x: 300, y: 300 });
      expect(newIds.length).toBe(1);
      expect(useWorkflowStore.getState().tools).toHaveLength(2);

      // Undo the paste
      const prevState = useHistoryStore.getState().undo();
      if (prevState) {
        useWorkflowStore.getState().loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
      }

      // Should be back to just the source tool
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
      expect(useWorkflowStore.getState().tools[0]?.id).toBe("source");
    });

    test("should preserve clipboard across tab switches", () => {
      // Create tab 1 and add tool
      useTabStore.getState().createTab("Tab 1");
      useWorkflowStore.getState().addTool(createTestTool("tool1", "Input", 100, 100));
      
      // Copy tool
      useClipboardStore.getState().copyTools(["tool1"]);
      expect(useClipboardStore.getState().clipboard?.tools).toHaveLength(1);

      // Switch to new tab
      useTabStore.getState().createTab("Tab 2");
      
      // Clipboard should still have the tool (clipboard is global)
      expect(useClipboardStore.getState().clipboard).not.toBeNull();
      expect(useClipboardStore.getState().clipboard?.tools).toHaveLength(1);
      
      // Should be able to paste in new tab
      const newIds = useClipboardStore.getState().pasteToolsAt({ x: 200, y: 200 });
      expect(newIds.length).toBe(1);
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
    });

    test("should copy tools with connected wires", () => {
      // Create two connected tools
      const tool1 = createTestTool("tool1", "Input", 100, 100);
      const tool2 = createTestTool("tool2", "Filter", 300, 100);
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);
      useWorkflowStore.getState().addWire(createTestWire("tool1", "tool2"));

      expect(useWorkflowStore.getState().wires).toHaveLength(1);

      // Copy both tools
      useClipboardStore.getState().copyTools(["tool1", "tool2"]);
      
      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard?.tools).toHaveLength(2);
      expect(clipboard?.wires).toHaveLength(1);

      // Push history before paste
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      // Paste the connected tools
      const newIds = useClipboardStore.getState().pasteToolsAt({ x: 100, y: 300 });
      expect(newIds.length).toBe(2);

      // Should have 4 tools and 2 wires now
      expect(useWorkflowStore.getState().tools).toHaveLength(4);
      expect(useWorkflowStore.getState().wires).toHaveLength(2);
    });
  });

  describe("Execution + Workflow Integration", () => {
    test("should track execution state independently of workflow changes", () => {
      // Start execution
      useExecutionStore.getState().startExecution();
      expect(useExecutionStore.getState().isExecuting).toBe(true);

      // Modify workflow during execution
      useWorkflowStore.getState().addTool(createTestTool("tool1"));
      
      // Execution state should be unchanged
      expect(useExecutionStore.getState().isExecuting).toBe(true);

      // Finish execution
      useExecutionStore.getState().finishExecution({
        tool_id: "tool1",
        outputs: {},
      });

      expect(useExecutionStore.getState().isExecuting).toBe(false);
      expect(useExecutionStore.getState().result?.tool_id).toBe("tool1");
    });

    test("keeps an in-flight execution and its response on the originating tab", () => {
      // Create tab and start execution
      const firstTabId = useTabStore.getState().createTab("Tab 1");
      useExecutionStore.getState().startExecution(firstTabId);
      useExecutionStore.getState().addLog({ level: "info", message: "Running..." }, firstTabId);
      
      expect(useExecutionStore.getState().logs).toHaveLength(1);

      const secondTabId = useTabStore.getState().createTab("Tab 2");
      
      expect(useExecutionStore.getState().isExecuting).toBe(false);
      expect(useExecutionStore.getState().logs).toHaveLength(0);

      // Simulate the response resolving after the active tab changed.
      useExecutionStore.getState().finishExecution({ tool_id: "output", outputs: {} }, firstTabId);

      expect(useExecutionStore.getState().executions[firstTabId]?.result?.tool_id).toBe("output");
      expect(useExecutionStore.getState().executions[firstTabId]?.logs).toHaveLength(1);
      expect(useExecutionStore.getState().executions[secondTabId]?.result).toBeNull();
      expect(useExecutionStore.getState().result).toBeNull();
    });

    test("should accumulate logs during execution", () => {
      useExecutionStore.getState().startExecution();
      
      // Add multiple logs
      useExecutionStore.getState().addLog({ level: "info", message: "Starting" });
      useExecutionStore.getState().addLog({ level: "success", message: "Tool 1 complete" });
      useExecutionStore.getState().addLog({ level: "warning", message: "Slow operation" });
      useExecutionStore.getState().addLog({ level: "success", message: "Tool 2 complete" });
      
      const logs = useExecutionStore.getState().logs;
      expect(logs).toHaveLength(4);
      expect(logs[0]?.level).toBe("info");
      expect(logs[2]?.level).toBe("warning");
      
      // Clear logs
      useExecutionStore.getState().clearLogs();
      expect(useExecutionStore.getState().logs).toHaveLength(0);
    });

    test("should handle execution failure gracefully", () => {
      useExecutionStore.getState().startExecution();
      useExecutionStore.getState().failExecution("Connection timeout");
      
      expect(useExecutionStore.getState().isExecuting).toBe(false);
      expect(useExecutionStore.getState().error).toBe("Connection timeout");
      expect(useExecutionStore.getState().result).toBeNull();
    });
  });

  describe("UI + Workflow Integration", () => {
    test("should clear preview state when switching tabs", () => {
      // Create tab with preview
      useTabStore.getState().createTab("Tab 1");
      useUIStore.getState().setPreviewState({
        toolId: "tool1",
        socketId: "output",
        socketDirection: "output",
        data: [{ col1: "value1" }],
        schema: [{ name: "col1", dtype: "String", nullable: false }],
        loading: false,
        error: null,
      });
      
      expect(useUIStore.getState().previewState).not.toBeNull();

      // Switch to new tab
      useTabStore.getState().createTab("Tab 2");
      
      // Preview should be cleared
      expect(useUIStore.getState().previewState).toBeNull();
    });

    test("should preserve UI preferences during workflow operations", () => {
      // Set some UI state
      useUIStore.getState().setBottomPaneOpen(true);
      useUIStore.getState().setActiveBottomTab("logs");
      useUIStore.getState().setActiveToolTab("compute");
      
      // Perform workflow operations
      useWorkflowStore.getState().addTool(createTestTool("tool1"));
      useWorkflowStore.getState().removeTool("tool1");
      
      // UI state should be unchanged
      expect(useUIStore.getState().bottomPaneOpen).toBe(true);
      expect(useUIStore.getState().activeBottomTab).toBe("logs");
      expect(useUIStore.getState().activeToolTab).toBe("compute");
    });

    test("should track selected tool in workflow store", () => {
      const tool1 = createTestTool("tool1");
      const tool2 = createTestTool("tool2");
      
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);
      
      // Select tool
      useWorkflowStore.getState().setSelectedTool(tool1);
      expect(useWorkflowStore.getState().selectedTool?.id).toBe("tool1");
      
      // Remove selected tool should clear selection
      useWorkflowStore.getState().removeTool("tool1");
      expect(useWorkflowStore.getState().selectedTool).toBeNull();
    });
  });

  describe("Full Lifecycle Scenarios", () => {
    test("should handle complete workflow creation lifecycle", () => {
      // 1. Create new tab (simulates File > New)
      const tabId = useTabStore.getState().createTab("My Workflow");
      expect(useWorkflowStore.getState().tools).toHaveLength(0);
      
      // 2. Add tools
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addTool(createTestTool("input1", "Input", 100, 100));
      
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addTool(createTestTool("filter1", "Filter", 300, 100));
      
      // 3. Connect tools
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addWire(createTestWire("input1", "filter1"));
      
      // 4. Verify state
      expect(useWorkflowStore.getState().tools).toHaveLength(2);
      expect(useWorkflowStore.getState().wires).toHaveLength(1);
      expect(useHistoryStore.getState().past.length).toBe(3);
      
      // 5. Undo last action
      const prev1 = useHistoryStore.getState().undo();
      if (prev1) {
        useWorkflowStore.getState().loadWorkflow(prev1.tools, prev1.wires, prev1.meta);
      }
      expect(useWorkflowStore.getState().wires).toHaveLength(0);
      
      // 6. Redo
      const next1 = useHistoryStore.getState().redo();
      if (next1) {
        useWorkflowStore.getState().loadWorkflow(next1.tools, next1.wires, next1.meta);
      }
      expect(useWorkflowStore.getState().wires).toHaveLength(1);
      
      // 7. Mark as saved
      useTabStore.getState().markTabClean(tabId);
      expect(useTabStore.getState().getTabById(tabId)?.isDirty).toBe(false);
    });

    test("should handle multi-tab workflow editing", () => {
      // Create and populate tab 1
      const tab1Id = useTabStore.getState().createTab("Workflow A");
      useWorkflowStore.getState().addTool(createTestTool("a1", "Input"));
      useWorkflowStore.getState().addTool(createTestTool("a2", "Filter"));
      useTabStore.getState().markTabDirty(tab1Id);
      
      // Create and populate tab 2
      const tab2Id = useTabStore.getState().createTab("Workflow B");
      useWorkflowStore.getState().addTool(createTestTool("b1", "Input"));
      useWorkflowStore.getState().addTool(createTestTool("b2", "Output"));
      useWorkflowStore.getState().addTool(createTestTool("b3", "Join"));
      
      // Tab 2 should have 3 tools
      expect(useWorkflowStore.getState().tools).toHaveLength(3);
      
      // Switch to tab 1
      useTabStore.getState().switchTab(tab1Id);
      expect(useWorkflowStore.getState().tools).toHaveLength(2);
      expect(useWorkflowStore.getState().tools.map(t => t.id).sort()).toEqual(["a1", "a2"]);
      
      // Modify tab 1
      useWorkflowStore.getState().addTool(createTestTool("a3", "Output"));
      expect(useWorkflowStore.getState().tools).toHaveLength(3);
      
      // Switch back to tab 2 - should have its original tools
      useTabStore.getState().switchTab(tab2Id);
      expect(useWorkflowStore.getState().tools).toHaveLength(3);
      expect(useWorkflowStore.getState().tools.map(t => t.id).sort()).toEqual(["b1", "b2", "b3"]);
      
      // Switch back to tab 1 - should include the new tool
      useTabStore.getState().switchTab(tab1Id);
      expect(useWorkflowStore.getState().tools).toHaveLength(3);
      expect(useWorkflowStore.getState().tools.map(t => t.id).sort()).toEqual(["a1", "a2", "a3"]);
    });

    test("should handle error notification workflow", () => {
      // Try to add invalid wire
      const invalidWire: Wire = {
        from: { tool: "nonexistent", socket: "output" },
        to: { tool: "alsoNonexistent", socket: "input" },
      };

      const result = useWorkflowStore.getState().validateWire(invalidWire);
      expect(result.valid).toBe(false);

      // Show notification on error
      if (!result.valid) {
        useUIStore.getState().showNotification(
          result.error || "Unknown error",
          "error",
          5000
        );
      }

      expect(useUIStore.getState().notification.isVisible).toBe(true);
      expect(useUIStore.getState().notification.type).toBe("error");
      
      // Hide notification
      useUIStore.getState().hideNotification();
      expect(useUIStore.getState().notification.isVisible).toBe(false);
    });

    test("should handle workflow with complex undo/redo across operations", () => {
      const tool1 = createTestTool("tool1", "Input", 100, 100);
      const tool2 = createTestTool("tool2", "Filter", 300, 100);
      const tool3 = createTestTool("tool3", "Output", 500, 100);

      // Add tools with history
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addTool(tool1);
      
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addTool(tool2);
      
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addTool(tool3);

      // Add wires
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addWire(createTestWire("tool1", "tool2"));
      
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().addWire(createTestWire("tool2", "tool3"));

      expect(useWorkflowStore.getState().tools).toHaveLength(3);
      expect(useWorkflowStore.getState().wires).toHaveLength(2);

      // Undo to before second wire
      let prev = useHistoryStore.getState().undo();
      if (prev) {
        useWorkflowStore.getState().loadWorkflow(prev.tools, prev.wires, prev.meta);
      }
      expect(useWorkflowStore.getState().wires).toHaveLength(1);

      // Undo to before first wire
      prev = useHistoryStore.getState().undo();
      if (prev) {
        useWorkflowStore.getState().loadWorkflow(prev.tools, prev.wires, prev.meta);
      }
      expect(useWorkflowStore.getState().wires).toHaveLength(0);
      expect(useWorkflowStore.getState().tools).toHaveLength(3);

      // Redo both wires
      let next = useHistoryStore.getState().redo();
      if (next) {
        useWorkflowStore.getState().loadWorkflow(next.tools, next.wires, next.meta);
      }
      expect(useWorkflowStore.getState().wires).toHaveLength(1);
      
      next = useHistoryStore.getState().redo();
      if (next) {
        useWorkflowStore.getState().loadWorkflow(next.tools, next.wires, next.meta);
      }
      expect(useWorkflowStore.getState().wires).toHaveLength(2);

      // New action clears redo stack
      useHistoryStore.getState().pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );
      useWorkflowStore.getState().updateToolConfiguration("tool2", { condition: "x > 0" });

      expect(useHistoryStore.getState().canRedo()).toBe(false);
      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });
  });

  describe("Edge Cases and Error Recovery", () => {
    test("should handle removing tool that has wires", () => {
      const tool1 = createTestTool("tool1");
      const tool2 = createTestTool("tool2");
      
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);
      useWorkflowStore.getState().addWire(createTestWire("tool1", "tool2"));
      
      expect(useWorkflowStore.getState().wires).toHaveLength(1);
      
      // Remove tool1 - should also remove the wire
      useWorkflowStore.getState().removeTool("tool1");
      
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
      expect(useWorkflowStore.getState().wires).toHaveLength(0);
    });

    test("should prevent duplicate wire connections", () => {
      const tool1 = createTestTool("tool1");
      const tool2 = createTestTool("tool2");
      
      useWorkflowStore.getState().addTool(tool1);
      useWorkflowStore.getState().addTool(tool2);
      
      // Add first wire
      const result1 = useWorkflowStore.getState().addWire(createTestWire("tool1", "tool2"));
      expect(result1.success).toBe(true);
      
      // Try to add duplicate - should fail
      const result2 = useWorkflowStore.getState().addWire(createTestWire("tool1", "tool2"));
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("already exists");
      
      expect(useWorkflowStore.getState().wires).toHaveLength(1);
    });

    test("should validate wire connections", () => {
      const tool1 = createTestTool("tool1");
      useWorkflowStore.getState().addTool(tool1);
      
      // Try to connect to non-existent tool
      const badWire: Wire = {
        from: { tool: "tool1", socket: "output" },
        to: { tool: "nonexistent", socket: "input" },
      };
      
      const result = useWorkflowStore.getState().addWire(badWire);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Tool not found");
    });

    test("should handle empty undo gracefully", () => {
      // No history - undo should return null
      const result = useHistoryStore.getState().undo();
      expect(result).toBeNull();
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });

    test("should handle empty redo gracefully", () => {
      // No future - redo should return null
      const result = useHistoryStore.getState().redo();
      expect(result).toBeNull();
      expect(useHistoryStore.getState().canRedo()).toBe(false);
    });

    test("should handle closing dirty tab with confirmation", () => {
      const tabId = useTabStore.getState().createTab("Dirty Tab");
      useTabStore.getState().markTabDirty(tabId);
      
      // Mock confirmation returns true
      mockConfirm.mockReturnValue(true);
      const closed = useTabStore.getState().closeTab(tabId);
      
      expect(closed).toBe(true);
      expect(mockConfirm).toHaveBeenCalled();
    });

    test("should cancel closing dirty tab when declined", () => {
      const tabId = useTabStore.getState().createTab("Dirty Tab");
      useTabStore.getState().markTabDirty(tabId);
      
      // Mock confirmation returns false
      mockConfirm.mockReturnValue(false);
      const closed = useTabStore.getState().closeTab(tabId);
      
      expect(closed).toBe(false);
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });
  });

  describe("Performance and Stress Tests", () => {
    test("should handle many undo operations efficiently", () => {
      // Build up significant history
      for (let i = 0; i < 20; i++) {
        useHistoryStore.getState().pushState(
          useWorkflowStore.getState().tools,
          useWorkflowStore.getState().wires,
          useWorkflowStore.getState().workflowMeta
        );
        useWorkflowStore.getState().addTool(createTestTool(`tool${i}`));
      }
      
      expect(useWorkflowStore.getState().tools).toHaveLength(20);
      
      // Undo all
      let undoCount = 0;
      while (useHistoryStore.getState().canUndo()) {
        const prev = useHistoryStore.getState().undo();
        if (prev) {
          useWorkflowStore.getState().loadWorkflow(prev.tools, prev.wires, prev.meta);
          undoCount++;
        }
      }
      
      expect(undoCount).toBe(20);
      expect(useWorkflowStore.getState().tools).toHaveLength(0);
    });

    test("should respect max history depth", () => {
      // Set small max depth
      useHistoryStore.getState().setMaxDepth(5);
      
      // Add more operations than max depth
      for (let i = 0; i < 10; i++) {
        useHistoryStore.getState().pushState(
          useWorkflowStore.getState().tools,
          useWorkflowStore.getState().wires,
          useWorkflowStore.getState().workflowMeta
        );
        useWorkflowStore.getState().addTool(createTestTool(`tool${i}`));
      }
      
      // Should only be able to undo 5 times
      let undoCount = 0;
      while (useHistoryStore.getState().canUndo()) {
        const prev = useHistoryStore.getState().undo();
        if (prev) {
          useWorkflowStore.getState().loadWorkflow(prev.tools, prev.wires, prev.meta);
          undoCount++;
        }
      }
      
      expect(undoCount).toBe(5);
    });

    test("should handle rapid tab creation and switching", () => {
      const tabIds: string[] = [];
      
      // Create many tabs
      for (let i = 0; i < 10; i++) {
        const tabId = useTabStore.getState().createTab(`Tab ${i}`);
        tabIds.push(tabId);
        useWorkflowStore.getState().addTool(createTestTool(`tool${i}`));
      }
      
      expect(useTabStore.getState().tabs).toHaveLength(10);
      
      // Rapidly switch between tabs
      for (let i = 0; i < 20; i++) {
        const targetTabId = tabIds[i % tabIds.length];
        if (targetTabId) {
          useTabStore.getState().switchTab(targetTabId);
        }
      }
      
      // All tabs should still be intact
      expect(useTabStore.getState().tabs).toHaveLength(10);
      
      // Each tab should have exactly one tool
      for (const tabId of tabIds) {
        useTabStore.getState().switchTab(tabId);
        expect(useWorkflowStore.getState().tools).toHaveLength(1);
      }
    });
  });
});
