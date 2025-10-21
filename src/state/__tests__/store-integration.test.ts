/**
 * Integration Tests: Multi-Store Workflows (Simplified)
 * 
 * Tests real-world scenarios involving multiple stores:
 * - Workflow + History (undo/redo workflows)
 * - Workflow + UI (notifications on errors)
 * - Cross-store state independence
 * 
 * Note: Clipboard integration tests are in clipboardStore.test.ts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useWorkflowStore } from '../workflowStore';
import { useHistoryStore } from '../historyStore';
import { useUIStore } from '../uiStore';
import type { Tool, Wire, WorkflowMeta } from '../../domain/workflow/entities/workflow';

// Mock ID generation for predictable tests
vi.mock('@utils/id', () => ({
  generateUniqueId: vi.fn(() => {
    let counter = 0;
    return () => `test-id-${counter++}`;
  })()
}));

describe('Store Integration Tests', () => {
  beforeEach(() => {
    // Reset all stores to clean state
    useWorkflowStore.setState({
      tools: [],
      wires: [],
      edges: [],
      workflowMeta: {
        name: '',
        description: '',
        author: '',
        workflowId: 'test-workflow',
        created: new Date().toISOString()
      },
      selectedTool: null
    });

    useHistoryStore.getState().clear();
    useUIStore.getState().hideNotification();
  });

  describe('Workflow + History Integration', () => {
    test('should create history snapshot when adding tools', () => {
      const { pushState } = useHistoryStore.getState();
      const { addTool, tools, wires, workflowMeta } = useWorkflowStore.getState();

      // Push current state before making changes
      pushState(tools, wires, workflowMeta);

      const tool: Tool = {
        id: 'tool1',
        type: 'Input',
        x: 100,
        y: 200,
        config: {},
        sockets: [{ id: 1, direction: 'output', multiple: false }]
      };

      addTool(tool);

      const state = useWorkflowStore.getState();
      expect(state.tools).toHaveLength(1);

      // Verify history can undo
      const prevState = useHistoryStore.getState().undo();
      expect(prevState).toBeDefined();
      expect(prevState?.tools).toHaveLength(0);
    });

    test('should restore complete workflow state on undo', () => {
      const { pushState, undo } = useHistoryStore.getState();
      const { loadWorkflow } = useWorkflowStore.getState();

      // Initial workflow
      const initialTools: Tool[] = [
        {
          id: 'tool1',
          type: 'Input',
          x: 100,
          y: 200,
          config: {},
          sockets: [{ id: 1, direction: 'output', multiple: false }]
        }
      ];

      const initialWires: Wire[] = [];
      const initialMeta: WorkflowMeta = {
        name: 'Initial',
        description: 'First version',
        author: 'Test',
        workflowId: 'test-id',
        created: new Date().toISOString()
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
          id: 'tool2',
          type: 'Output',
          x: 300,
          y: 200,
          config: {},
          sockets: [{ id: 1, direction: 'input', multiple: false }]
        }
      ];

      const newWires: Wire[] = [
        { from: { tool: 'tool1', socket: 1 }, to: { tool: 'tool2', socket: 1 } }
      ];

      const newMeta: WorkflowMeta = {
        ...initialMeta,
        name: 'Modified',
        description: 'Second version'
      };

      loadWorkflow(newTools, newWires, newMeta);

      const modifiedState = useWorkflowStore.getState();
      expect(modifiedState.tools).toHaveLength(2);
      expect(modifiedState.wires).toHaveLength(1);
      expect(modifiedState.workflowMeta.name).toBe('Modified');

      // Undo to initial state
      const prevState = undo();
      expect(prevState).toBeDefined();
      
      if (prevState) {
        loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
        
        const restoredState = useWorkflowStore.getState();
        expect(restoredState.tools).toHaveLength(1);
        expect(restoredState.wires).toHaveLength(0);
        expect(restoredState.workflowMeta.name).toBe('Initial');
      }
    });

    test('should maintain history through multiple operations', () => {
      const { pushState, undo, redo } = useHistoryStore.getState();
      const { addTool, removeTool } = useWorkflowStore.getState();

      // Operation 1: Add tool
      pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      const tool1: Tool = {
        id: 'tool1',
        type: 'Input',
        x: 100,
        y: 200,
        config: {},
        sockets: []
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
        id: 'tool2',
        type: 'Output',
        x: 300,
        y: 200,
        config: {},
        sockets: []
      };

      addTool(tool2);
      expect(useWorkflowStore.getState().tools).toHaveLength(2);

      // Operation 3: Remove first tool
      pushState(
        useWorkflowStore.getState().tools,
        useWorkflowStore.getState().wires,
        useWorkflowStore.getState().workflowMeta
      );

      removeTool('tool1');
      expect(useWorkflowStore.getState().tools).toHaveLength(1);

      // Undo remove
      const state1 = undo();
      if (state1) {
        useWorkflowStore.getState().loadWorkflow(state1.tools, state1.wires, state1.meta);
        expect(useWorkflowStore.getState().tools).toHaveLength(2);
      }

      // Undo second add
      const state2 = undo();
      if (state2) {
        useWorkflowStore.getState().loadWorkflow(state2.tools, state2.wires, state2.meta);
        expect(useWorkflowStore.getState().tools).toHaveLength(1);
      }

      // Redo
      const state3 = redo();
      if (state3) {
        useWorkflowStore.getState().loadWorkflow(state3.tools, state3.wires, state3.meta);
        expect(useWorkflowStore.getState().tools).toHaveLength(2);
      }
    });

    test('should handle rapid undo/redo operations', () => {
      const { pushState, undo, redo, canUndo, canRedo } = useHistoryStore.getState();

      // Build up history with 5 states
      for (let i = 0; i < 5; i++) {
        const workflow = useWorkflowStore.getState();
        pushState(workflow.tools, workflow.wires, workflow.workflowMeta);
        workflow.addTool({
          id: `tool${i}`,
          type: i % 2 === 0 ? 'Input' : 'Output',
          x: i * 100,
          y: 200,
          config: {},
          sockets: []
        });
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(5);
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(false);

      // Undo 3 times
      for (let i = 0; i < 3; i++) {
        const prev = undo();
        if (prev) {
          useWorkflowStore.getState().loadWorkflow(prev.tools, prev.wires, prev.meta);
        }
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(2);
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(true);

      // Redo 2 times
      for (let i = 0; i < 2; i++) {
        const next = redo();
        if (next) {
          useWorkflowStore.getState().loadWorkflow(next.tools, next.wires, next.meta);
        }
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(4);
    });
  });

  describe('Workflow + UI Integration', () => {
    test('should show notification on workflow errors', () => {
      const { showNotification } = useUIStore.getState();
      const { validateWire } = useWorkflowStore.getState();

      // Create invalid wire (non-existent tools)
      const invalidWire: Wire = {
        from: { tool: 'nonexistent1', socket: 1 },
        to: { tool: 'nonexistent2', socket: 1 }
      };

      const result = validateWire(invalidWire);

      if (!result.valid) {
        showNotification(
          result.error || 'Unknown error',
          'error',
          5000
        );
      }

      const notification = useUIStore.getState().notification;
      expect(notification.isVisible).toBe(true);
      expect(notification.type).toBe('error');
      expect(notification.message).toContain('Tool');
    });

    test('should track UI preferences across workflow operations', () => {
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
        id: 'tool1',
        type: 'Input',
        x: 100,
        y: 200,
        config: {},
        sockets: []
      };

      addTool(tool);

      // UI preference preserved
      expect(useUIStore.getState().minimapVisible).toBe(false);
      expect(useWorkflowStore.getState().tools).toHaveLength(1);
    });

    test('should handle concurrent notifications', () => {
      const { showNotification, hideNotification } = useUIStore.getState();

      showNotification('First error', 'error', 5000);
      expect(useUIStore.getState().notification.message).toBe('First error');

      showNotification('Second error', 'error', 5000);
      expect(useUIStore.getState().notification.message).toBe('Second error');

      hideNotification();
      expect(useUIStore.getState().notification.isVisible).toBe(false);
    });
  });

  describe('Cross-Store State Consistency', () => {
    test('should maintain independent state across stores', () => {
      // Modify each store
      useWorkflowStore.getState().updateWorkflowMeta({ name: 'Test Workflow' });
      useHistoryStore.getState().setMaxDepth(25);
      
      const ui = useUIStore.getState();
      if (ui.minimapVisible) {
        ui.toggleMinimap();
      }

      // Verify state was set correctly
      expect(useWorkflowStore.getState().workflowMeta.name).toBe('Test Workflow');
      expect(useHistoryStore.getState().maxHistoryDepth).toBe(25);
      expect(useUIStore.getState().minimapVisible).toBe(false);

      // Reset one store doesn't affect others
      useWorkflowStore.setState({
        tools: [],
        wires: [],
        edges: [],
        workflowMeta: {
          name: '',
          description: '',
          author: '',
          workflowId: 'new-id',
          created: new Date().toISOString()
        },
        selectedTool: null
      });

      expect(useWorkflowStore.getState().workflowMeta.name).toBe('');
      expect(useHistoryStore.getState().maxHistoryDepth).toBe(25); // Unchanged
      expect(useUIStore.getState().minimapVisible).toBe(false); // Unchanged
    });

    test('should allow history depth configuration during workflow', () => {
      const workflow = useWorkflowStore.getState();
      const history = useHistoryStore.getState();

      // Set max depth
      history.setMaxDepth(3);

      // Add 5 tools (exceeds depth)
      for (let i = 0; i < 5; i++) {
        history.pushState(workflow.tools, workflow.wires, workflow.workflowMeta);
        workflow.addTool({
          id: `tool${i}`,
          type: 'Input',
          x: i * 100,
          y: 200,
          config: {},
          sockets: []
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

  describe('Complex Workflow Scenarios', () => {
    test('should handle full workflow lifecycle', () => {
      const history = useHistoryStore.getState();
      const ui = useUIStore.getState();

      // 1. Create initial workflow
      let workflow = useWorkflowStore.getState();
      history.pushState(workflow.tools, workflow.wires, workflow.workflowMeta);

      const tool1: Tool = {
        id: 'input',
        type: 'Input',
        x: 100,
        y: 200,
        config: { filename: 'data.csv' },
        sockets: [{ id: 1, direction: 'output', multiple: false }]
      };

      workflow.addTool(tool1);

      // 2. Add second tool
      workflow = useWorkflowStore.getState();
      history.pushState(workflow.tools, workflow.wires, workflow.workflowMeta);

      const tool2: Tool = {
        id: 'filter',
        type: 'Filter',
        x: 300,
        y: 200,
        config: { condition: 'x > 0' },
        sockets: [
          { id: 1, direction: 'input', multiple: false },
          { id: 2, direction: 'output', multiple: false }
        ]
      };

      workflow.addTool(tool2);

      // 3. Add wire
      workflow = useWorkflowStore.getState();
      history.pushState(workflow.tools, workflow.wires, workflow.workflowMeta);

      const wire: Wire = {
        from: { tool: 'input', socket: 1 },
        to: { tool: 'filter', socket: 1 }
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
        useWorkflowStore.getState().loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
      }

      expect(useWorkflowStore.getState().tools).toHaveLength(2);
      expect(useWorkflowStore.getState().wires).toHaveLength(0); // Wire removed
      expect(ui.minimapVisible).toBe(false); // UI preserved

      // 6. Redo wire addition
      const nextState = history.redo();
      if (nextState) {
        useWorkflowStore.getState().loadWorkflow(nextState.tools, nextState.wires, nextState.meta);
      }

      expect(useWorkflowStore.getState().wires).toHaveLength(1); // Wire restored
    });
  });
});
