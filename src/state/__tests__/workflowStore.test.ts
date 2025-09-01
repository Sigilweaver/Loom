import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useWorkflowStore } from '../workflowStore';
import type { Tool, Wire, WorkflowMeta } from '../../domain/workflow/entities/workflow';
import type { Edge } from '@xyflow/react';

// Mock uuid to get predictable IDs in tests
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

describe('WorkflowStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the store state before each test
    useWorkflowStore.setState({
      tools: [],
      wires: [],
      edges: [],
      workflowMeta: {
        name: 'New Workflow',
        description: 'A new workflow',
        author: 'SigilWeaver',
        workflowId: 'test-uuid-123',
        created: new Date('2025-09-01T00:00:00.000Z').toISOString(),
      },
      selectedTool: null,
    });
  });

  describe('Initial State', () => {
    test('has correct default state', () => {
      const state = useWorkflowStore.getState();
      
      expect(state.tools).toEqual([]);
      expect(state.wires).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.selectedTool).toBeNull();
      expect(state.workflowMeta).toEqual({
        name: 'New Workflow',
        description: 'A new workflow',
        author: 'SigilWeaver',
        workflowId: 'test-uuid-123',
        created: '2025-09-01T00:00:00.000Z',
      });
    });

    test('workflowMeta has valid UUID and ISO date', () => {
      const state = useWorkflowStore.getState();
      
      expect(state.workflowMeta.workflowId).toBe('test-uuid-123');
      expect(() => new Date(state.workflowMeta.created)).not.toThrow();
      expect(new Date(state.workflowMeta.created).toISOString()).toBe(state.workflowMeta.created);
    });
  });

  describe('setFromXML', () => {
    test('sets tools, wires, and metadata from XML data', () => {
      const tools: Tool[] = [
        {
          id: 'tool1',
          type: 'Input',
          x: 100,
          y: 200,
          config: { filename: 'test.csv' },
          sockets: [{ id: 1, direction: 'output', multiple: false }]
        },
        {
          id: 'tool2',
          type: 'Filter',
          x: 300,
          y: 200,
          config: { condition: 'value > 10' },
          sockets: [
            { id: 1, direction: 'input', multiple: false },
            { id: 2, direction: 'output', multiple: false }
          ]
        }
      ];

      const wires: Wire[] = [
        {
          from: { tool: 'tool1', socket: 1 },
          to: { tool: 'tool2', socket: 1 }
        }
      ];

      const meta: WorkflowMeta = {
        name: 'Imported Workflow',
        description: 'A workflow imported from XML',
        author: 'Test Author',
        workflowId: 'imported-id',
        created: '2025-08-01T12:00:00.000Z'
      };

      useWorkflowStore.getState().setFromXML(tools, wires, meta);

      const state = useWorkflowStore.getState();
      expect(state.tools).toEqual(tools);
      expect(state.wires).toEqual(wires);
      expect(state.workflowMeta).toEqual(meta);
    });

    test('preserves edges and selectedTool when setting from XML', () => {
      const edges: Edge[] = [
        { id: 'edge1', source: 'tool1', target: 'tool2', sourceHandle: '1', targetHandle: '1' }
      ];
      
      const selectedTool: Tool = {
        id: 'selected',
        type: 'Test',
        x: 0,
        y: 0,
        config: {},
        sockets: []
      };

      // Set initial state
      useWorkflowStore.setState({ edges, selectedTool });

      const tools: Tool[] = [
        {
          id: 'new-tool',
          type: 'New',
          x: 50,
          y: 50,
          config: {},
          sockets: []
        }
      ];

      const meta: WorkflowMeta = {
        name: 'New Meta',
        description: 'New description',
        author: 'New Author',
        workflowId: 'new-id',
        created: '2025-09-01T00:00:00.000Z'
      };

      useWorkflowStore.getState().setFromXML(tools, [], meta);

      const state = useWorkflowStore.getState();
      expect(state.tools).toEqual(tools);
      expect(state.wires).toEqual([]);
      expect(state.workflowMeta).toEqual(meta);
      expect(state.edges).toEqual(edges); // Preserved
      expect(state.selectedTool).toEqual(selectedTool); // Preserved
    });

    test('handles empty arrays for tools and wires', () => {
      const meta: WorkflowMeta = {
        name: 'Empty Workflow',
        description: 'No tools or wires',
        author: 'Empty Author',
        workflowId: 'empty-id',
        created: '2025-09-01T00:00:00.000Z'
      };

      useWorkflowStore.getState().setFromXML([], [], meta);

      const state = useWorkflowStore.getState();
      expect(state.tools).toEqual([]);
      expect(state.wires).toEqual([]);
      expect(state.workflowMeta).toEqual(meta);
    });
  });

  describe('setEdges', () => {
    test('sets edges from React Flow', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'tool1', target: 'tool2', sourceHandle: '1', targetHandle: '1' },
        { id: 'e2', source: 'tool2', target: 'tool3', sourceHandle: '2', targetHandle: '1' }
      ];

      useWorkflowStore.getState().setEdges(edges);

      const state = useWorkflowStore.getState();
      expect(state.edges).toEqual(edges);
    });

    test('replaces existing edges', () => {
      const initialEdges: Edge[] = [
        { id: 'initial', source: 'a', target: 'b', sourceHandle: '1', targetHandle: '1' }
      ];

      const newEdges: Edge[] = [
        { id: 'new1', source: 'x', target: 'y', sourceHandle: '1', targetHandle: '1' },
        { id: 'new2', source: 'y', target: 'z', sourceHandle: '2', targetHandle: '1' }
      ];

      useWorkflowStore.setState({ edges: initialEdges });
      useWorkflowStore.getState().setEdges(newEdges);

      const state = useWorkflowStore.getState();
      expect(state.edges).toEqual(newEdges);
      expect(state.edges).not.toContain(initialEdges[0]);
    });

    test('handles empty edges array', () => {
      const initialEdges: Edge[] = [
        { id: 'will-be-removed', source: 'a', target: 'b', sourceHandle: '1', targetHandle: '1' }
      ];

      useWorkflowStore.setState({ edges: initialEdges });
      useWorkflowStore.getState().setEdges([]);

      const state = useWorkflowStore.getState();
      expect(state.edges).toEqual([]);
    });

    test('preserves other state when setting edges', () => {
      const tools: Tool[] = [
        { id: 'preserved-tool', type: 'Test', x: 100, y: 100, config: {}, sockets: [] }
      ];
      
      const selectedTool: Tool = {
        id: 'selected-tool',
        type: 'Selected',
        x: 200,
        y: 200,
        config: {},
        sockets: []
      };

      useWorkflowStore.setState({ tools, selectedTool });

      const edges: Edge[] = [
        { id: 'new-edge', source: 'a', target: 'b', sourceHandle: '1', targetHandle: '1' }
      ];

      useWorkflowStore.getState().setEdges(edges);

      const state = useWorkflowStore.getState();
      expect(state.edges).toEqual(edges);
      expect(state.tools).toEqual(tools); // Preserved
      expect(state.selectedTool).toEqual(selectedTool); // Preserved
    });
  });

  describe('setSelectedTool', () => {
    test('sets selected tool', () => {
      const tool: Tool = {
        id: 'selected-tool',
        type: 'Filter',
        x: 150,
        y: 250,
        config: { condition: 'active' },
        sockets: [{ id: 1, direction: 'input', multiple: false }]
      };

      useWorkflowStore.getState().setSelectedTool(tool);

      const state = useWorkflowStore.getState();
      expect(state.selectedTool).toEqual(tool);
    });

    test('clears selected tool when set to null', () => {
      const tool: Tool = {
        id: 'initially-selected',
        type: 'Test',
        x: 0,
        y: 0,
        config: {},
        sockets: []
      };

      useWorkflowStore.setState({ selectedTool: tool });
      useWorkflowStore.getState().setSelectedTool(null);

      const state = useWorkflowStore.getState();
      expect(state.selectedTool).toBeNull();
    });

    test('replaces previously selected tool', () => {
      const firstTool: Tool = {
        id: 'first-tool',
        type: 'First',
        x: 100,
        y: 100,
        config: {},
        sockets: []
      };

      const secondTool: Tool = {
        id: 'second-tool',
        type: 'Second',
        x: 200,
        y: 200,
        config: {},
        sockets: []
      };

      useWorkflowStore.getState().setSelectedTool(firstTool);
      useWorkflowStore.getState().setSelectedTool(secondTool);

      const state = useWorkflowStore.getState();
      expect(state.selectedTool).toEqual(secondTool);
      expect(state.selectedTool).not.toEqual(firstTool);
    });

    test('preserves other state when setting selected tool', () => {
      const tools: Tool[] = [
        { id: 'existing-tool', type: 'Existing', x: 50, y: 50, config: {}, sockets: [] }
      ];
      
      const edges: Edge[] = [
        { id: 'existing-edge', source: 'a', target: 'b', sourceHandle: '1', targetHandle: '1' }
      ];

      useWorkflowStore.setState({ tools, edges });

      const selectedTool: Tool = {
        id: 'new-selection',
        type: 'NewSelection',
        x: 300,
        y: 300,
        config: {},
        sockets: []
      };

      useWorkflowStore.getState().setSelectedTool(selectedTool);

      const state = useWorkflowStore.getState();
      expect(state.selectedTool).toEqual(selectedTool);
      expect(state.tools).toEqual(tools); // Preserved
      expect(state.edges).toEqual(edges); // Preserved
    });
  });

  describe('updateWorkflowMeta', () => {
    test('updates name only', () => {
      const newName = 'Updated Workflow Name';
      
      useWorkflowStore.getState().updateWorkflowMeta({ name: newName });

      const state = useWorkflowStore.getState();
      expect(state.workflowMeta.name).toBe(newName);
      expect(state.workflowMeta.description).toBe('A new workflow'); // Unchanged
      expect(state.workflowMeta.author).toBe('SigilWeaver'); // Unchanged
    });

    test('updates description only', () => {
      const newDescription = 'This is an updated description';
      
      useWorkflowStore.getState().updateWorkflowMeta({ description: newDescription });

      const state = useWorkflowStore.getState();
      expect(state.workflowMeta.description).toBe(newDescription);
      expect(state.workflowMeta.name).toBe('New Workflow'); // Unchanged
      expect(state.workflowMeta.author).toBe('SigilWeaver'); // Unchanged
    });

    test('updates author only', () => {
      const newAuthor = 'New Author Name';
      
      useWorkflowStore.getState().updateWorkflowMeta({ author: newAuthor });

      const state = useWorkflowStore.getState();
      expect(state.workflowMeta.author).toBe(newAuthor);
      expect(state.workflowMeta.name).toBe('New Workflow'); // Unchanged
      expect(state.workflowMeta.description).toBe('A new workflow'); // Unchanged
    });

    test('updates multiple fields at once', () => {
      const updates = {
        name: 'Multi-Update Workflow',
        description: 'Updated description',
        author: 'Multi-Update Author'
      };
      
      useWorkflowStore.getState().updateWorkflowMeta(updates);

      const state = useWorkflowStore.getState();
      expect(state.workflowMeta.name).toBe(updates.name);
      expect(state.workflowMeta.description).toBe(updates.description);
      expect(state.workflowMeta.author).toBe(updates.author);
    });

    test('preserves workflowId and created fields', () => {
      const originalMeta = useWorkflowStore.getState().workflowMeta;
      
      useWorkflowStore.getState().updateWorkflowMeta({
        name: 'Changed Name',
        description: 'Changed Description',
        author: 'Changed Author'
      });

      const state = useWorkflowStore.getState();
      expect(state.workflowMeta.workflowId).toBe(originalMeta.workflowId);
      expect(state.workflowMeta.created).toBe(originalMeta.created);
    });

    test('handles empty updates', () => {
      const originalMeta = useWorkflowStore.getState().workflowMeta;
      
      useWorkflowStore.getState().updateWorkflowMeta({});

      const state = useWorkflowStore.getState();
      expect(state.workflowMeta).toEqual(originalMeta);
    });

    test('preserves other state when updating metadata', () => {
      const tools: Tool[] = [
        { id: 'preserved-tool', type: 'Preserved', x: 100, y: 100, config: {}, sockets: [] }
      ];
      
      const selectedTool: Tool = {
        id: 'selected-tool',
        type: 'Selected',
        x: 200,
        y: 200,
        config: {},
        sockets: []
      };

      useWorkflowStore.setState({ tools, selectedTool });

      useWorkflowStore.getState().updateWorkflowMeta({ name: 'New Name' });

      const state = useWorkflowStore.getState();
      expect(state.workflowMeta.name).toBe('New Name');
      expect(state.tools).toEqual(tools); // Preserved
      expect(state.selectedTool).toEqual(selectedTool); // Preserved
    });
  });

  describe('updateToolPositionLocal', () => {
    test('updates tool position when tool exists', () => {
      const tools: Tool[] = [
        {
          id: 'tool1',
          type: 'Input',
          x: 100,
          y: 200,
          config: { filename: 'test.csv' },
          sockets: [{ id: 1, direction: 'output', multiple: false }]
        },
        {
          id: 'tool2',
          type: 'Filter',
          x: 300,
          y: 400,
          config: { condition: 'active' },
          sockets: [{ id: 1, direction: 'input', multiple: false }]
        }
      ];

      useWorkflowStore.setState({ tools });

      useWorkflowStore.getState().updateToolPositionLocal('tool1', 150, 250);

      const state = useWorkflowStore.getState();
      expect(state.tools[0]?.x).toBe(150);
      expect(state.tools[0]?.y).toBe(250);
      expect(state.tools[0]?.id).toBe('tool1');
      
      // Other tool unchanged
      expect(state.tools[1]?.x).toBe(300);
      expect(state.tools[1]?.y).toBe(400);
      expect(state.tools[1]?.id).toBe('tool2');
    });

    test('preserves all other tool properties when updating position', () => {
      const tool: Tool = {
        id: 'position-test-tool',
        type: 'PositionTest',
        x: 100,
        y: 200,
        config: { important: 'data', preserved: true },
        sockets: [
          { id: 1, direction: 'input', multiple: false },
          { id: 2, direction: 'output', multiple: true, type: 'string' }
        ]
      };

      useWorkflowStore.setState({ tools: [tool] });

      useWorkflowStore.getState().updateToolPositionLocal('position-test-tool', 500, 600);

      const state = useWorkflowStore.getState();
      const updatedTool = state.tools[0];
      expect(updatedTool).toBeDefined();
      
      expect(updatedTool!.x).toBe(500);
      expect(updatedTool!.y).toBe(600);
      expect(updatedTool!.id).toBe(tool.id);
      expect(updatedTool!.type).toBe(tool.type);
      expect(updatedTool!.config).toEqual(tool.config);
      expect(updatedTool!.sockets).toEqual(tool.sockets);
    });

    test('does nothing when tool ID does not exist', () => {
      const tools: Tool[] = [
        {
          id: 'existing-tool',
          type: 'Existing',
          x: 100,
          y: 200,
          config: {},
          sockets: []
        }
      ];

      useWorkflowStore.setState({ tools });

      useWorkflowStore.getState().updateToolPositionLocal('non-existent-tool', 999, 888);

      const state = useWorkflowStore.getState();
      expect(state.tools).toEqual(tools); // Unchanged
      expect(state.tools[0]?.x).toBe(100); // Original position
      expect(state.tools[0]?.y).toBe(200); // Original position
    });

    test('handles negative coordinates', () => {
      const tool: Tool = {
        id: 'negative-test',
        type: 'NegativeTest',
        x: 100,
        y: 200,
        config: {},
        sockets: []
      };

      useWorkflowStore.setState({ tools: [tool] });

      useWorkflowStore.getState().updateToolPositionLocal('negative-test', -50, -100);

      const state = useWorkflowStore.getState();
      expect(state.tools[0]?.x).toBe(-50);
      expect(state.tools[0]?.y).toBe(-100);
    });

    test('handles floating point coordinates', () => {
      const tool: Tool = {
        id: 'float-test',
        type: 'FloatTest',
        x: 100,
        y: 200,
        config: {},
        sockets: []
      };

      useWorkflowStore.setState({ tools: [tool] });

      useWorkflowStore.getState().updateToolPositionLocal('float-test', 123.456, 789.012);

      const state = useWorkflowStore.getState();
      expect(state.tools[0]?.x).toBe(123.456);
      expect(state.tools[0]?.y).toBe(789.012);
    });

    test('preserves other state when updating tool position', () => {
      const tool: Tool = {
        id: 'position-tool',
        type: 'Position',
        x: 100,
        y: 200,
        config: {},
        sockets: []
      };

      const selectedTool: Tool = {
        id: 'selected-tool',
        type: 'Selected',
        x: 300,
        y: 400,
        config: {},
        sockets: []
      };

      const edges: Edge[] = [
        { id: 'preserved-edge', source: 'a', target: 'b', sourceHandle: '1', targetHandle: '1' }
      ];

      const wires: Wire[] = [
        { from: { tool: 'a', socket: 1 }, to: { tool: 'b', socket: 1 } }
      ];

      useWorkflowStore.setState({ 
        tools: [tool], 
        selectedTool, 
        edges, 
        wires 
      });

      useWorkflowStore.getState().updateToolPositionLocal('position-tool', 500, 600);

      const state = useWorkflowStore.getState();
      expect(state.tools[0]?.x).toBe(500);
      expect(state.tools[0]?.y).toBe(600);
      expect(state.selectedTool).toEqual(selectedTool); // Preserved
      expect(state.edges).toEqual(edges); // Preserved
      expect(state.wires).toEqual(wires); // Preserved
    });
  });

  describe('Store Integration', () => {
    test('multiple operations work together correctly', () => {
      // Step 1: Load from XML
      const tools: Tool[] = [
        {
          id: 'integration-tool',
          type: 'Integration',
          x: 100,
          y: 200,
          config: { test: 'value' },
          sockets: [{ id: 1, direction: 'output', multiple: false }]
        }
      ];

      const wires: Wire[] = [];

      const meta: WorkflowMeta = {
        name: 'Integration Test',
        description: 'Testing integration',
        author: 'Integration Author',
        workflowId: 'integration-id',
        created: '2025-09-01T12:00:00.000Z'
      };

      useWorkflowStore.getState().setFromXML(tools, wires, meta);

      // Step 2: Set edges
      const edges: Edge[] = [
        { id: 'integration-edge', source: 'integration-tool', target: 'other', sourceHandle: '1', targetHandle: '1' }
      ];

      useWorkflowStore.getState().setEdges(edges);

      // Step 3: Select the tool
      useWorkflowStore.getState().setSelectedTool(tools[0]!);

      // Step 4: Update metadata
      useWorkflowStore.getState().updateWorkflowMeta({ name: 'Updated Integration Test' });

      // Step 5: Update tool position
      useWorkflowStore.getState().updateToolPositionLocal('integration-tool', 300, 400);

      // Verify final state
      const state = useWorkflowStore.getState();
      expect(state.tools).toHaveLength(1);
      expect(state.tools[0]?.x).toBe(300);
      expect(state.tools[0]?.y).toBe(400);
      expect(state.tools[0]?.id).toBe('integration-tool');
      expect(state.edges).toEqual(edges);
      expect(state.selectedTool?.id).toBe('integration-tool');
      expect(state.workflowMeta.name).toBe('Updated Integration Test');
      expect(state.workflowMeta.workflowId).toBe('integration-id');
      expect(state.wires).toEqual([]);
    });

    test('state remains consistent after complex operations', () => {
      // Create a complex initial state
      const complexTools: Tool[] = [
        {
          id: 'tool-a',
          type: 'Input',
          x: 0,
          y: 0,
          config: { file: 'input.csv' },
          sockets: [{ id: 1, direction: 'output', multiple: false }]
        },
        {
          id: 'tool-b',
          type: 'Transform',
          x: 200,
          y: 0,
          config: { operation: 'filter' },
          sockets: [
            { id: 1, direction: 'input', multiple: false },
            { id: 2, direction: 'output', multiple: false }
          ]
        }
      ];

      const complexWires: Wire[] = [
        { from: { tool: 'tool-a', socket: 1 }, to: { tool: 'tool-b', socket: 1 } }
      ];

      const complexEdges: Edge[] = [
        { id: 'complex-edge', source: 'tool-a', target: 'tool-b', sourceHandle: '1', targetHandle: '1' }
      ];

      // Load the complex state
      useWorkflowStore.getState().setFromXML(complexTools, complexWires, {
        name: 'Complex Workflow',
        description: 'A complex test workflow',
        author: 'Complex Author',
        workflowId: 'complex-id',
        created: '2025-09-01T12:00:00.000Z'
      });

      useWorkflowStore.getState().setEdges(complexEdges);

      // Perform various operations
      useWorkflowStore.getState().setSelectedTool(complexTools[1]!);
      useWorkflowStore.getState().updateToolPositionLocal('tool-a', 50, 50);
      useWorkflowStore.getState().updateWorkflowMeta({ description: 'Updated complex description' });

      // Verify consistency
      const state = useWorkflowStore.getState();
      expect(state.tools).toHaveLength(2);
      expect(state.tools.find(t => t.id === 'tool-a')?.x).toBe(50);
      expect(state.tools.find(t => t.id === 'tool-a')?.y).toBe(50);
      expect(state.tools.find(t => t.id === 'tool-b')?.x).toBe(200); // Unchanged
      expect(state.wires).toEqual(complexWires);
      expect(state.edges).toEqual(complexEdges);
      expect(state.selectedTool?.id).toBe('tool-b');
      expect(state.workflowMeta.description).toBe('Updated complex description');
      expect(state.workflowMeta.name).toBe('Complex Workflow'); // Unchanged
    });
  });

  describe('Store Immutability', () => {
    test('state updates do not mutate original objects', () => {
      const originalTool: Tool = {
        id: 'immutable-test',
        type: 'ImmutableTest',
        x: 100,
        y: 200,
        config: { test: 'original' },
        sockets: [{ id: 1, direction: 'output', multiple: false }]
      };

      useWorkflowStore.setState({ tools: [originalTool] });

      // Update position
      useWorkflowStore.getState().updateToolPositionLocal('immutable-test', 300, 400);

      // Original object should be unchanged
      expect(originalTool.x).toBe(100);
      expect(originalTool.y).toBe(200);

      // Store should have new object with updated position
      const state = useWorkflowStore.getState();
      expect(state.tools[0]?.x).toBe(300);
      expect(state.tools[0]?.y).toBe(400);
      expect(state.tools[0]).not.toBe(originalTool); // Different object reference
    });

    test('metadata updates do not mutate original metadata', () => {
      const originalMeta: WorkflowMeta = {
        name: 'Original Name',
        description: 'Original Description',
        author: 'Original Author',
        workflowId: 'original-id',
        created: '2025-09-01T00:00:00.000Z'
      };

      useWorkflowStore.setState({ workflowMeta: originalMeta });

      useWorkflowStore.getState().updateWorkflowMeta({ name: 'Updated Name' });

      // Original should be unchanged
      expect(originalMeta.name).toBe('Original Name');

      // Store should have new object
      const state = useWorkflowStore.getState();
      expect(state.workflowMeta.name).toBe('Updated Name');
      expect(state.workflowMeta).not.toBe(originalMeta); // Different object reference
    });
  });
});
