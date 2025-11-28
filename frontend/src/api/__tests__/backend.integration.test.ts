/**
 * End-to-end integration test with real backend
 * 
 * Tests the complete workflow from schema fetching to data preview.
 * Requires backend running on http://localhost:8000
 * 
 * Run with: npm test -- src/api/__tests__/backend.e2e.test.ts
 */

import { describe, it, expect } from 'vitest';
import { getToolSchema, previewTool, executeWorkflow, healthCheck } from '../backend';
import type { WorkflowJSON } from '../../domain/workflow/services/WorkflowSerializer';
import type { Tool, Wire } from '../../domain/workflow/entities/workflow';

// Path to test fixture created in backend
const TEST_CSV = '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-app/backend/tests/fixtures/sample.csv';

describe('Backend E2E Integration', () => {
  describe('Health Check', () => {
    it('should connect to running backend', async () => {
      const result = await healthCheck();
      
      expect(result).toEqual(expect.objectContaining({
        status: 'healthy',
        version: '0.1.0',
        message: 'SigilWeaver Backend is running',
      }));
    }, { timeout: 5000 });
  });

  const createWorkflow = (tools: Tool[], wires: Wire[] = []): WorkflowJSON => ({
    version: '2.0',
    meta: {
      name: 'E2E Test Workflow',
      description: 'Testing frontend-backend integration',
      author: 'Test Suite',
      workflowId: `wf_e2e_${Date.now()}`,
      created: new Date().toISOString(),
    },
    tools,
    wires,
  });

  describe('Input Tool', () => {
    it('should fetch schema for CSV input', async () => {
      const workflow = createWorkflow([
        {
          id: 'input1',
          type: 'Input',
          x: 0,
          y: 0,
          config: {
            category: 'file',
            type: 'csv',
            source: TEST_CSV,
          },
          sockets: [{ id: 0, direction: 'output' }],
        },
      ]);

      const result = await getToolSchema('input1', workflow);

      expect(result.tool_id).toBe('input1');
      expect(result.outputs['0']).toBeDefined();
      
      const output = result.outputs['0'];
      expect(output).toBeDefined();
      
      const schema = output?.data_schema;
      expect(schema).toBeDefined();
      expect(schema?.columns).toHaveLength(4);
      
      const columnNames = schema?.columns.map(c => c.name);
      expect(columnNames).toEqual(['id', 'name', 'age', 'city']);
      
      const columnTypes = schema?.columns.map(c => c.dtype);
      expect(columnTypes).toEqual(['Int64', 'String', 'Int64', 'String']);
    }, { timeout: 5000 });

    it('should preview CSV data', async () => {
      const workflow = createWorkflow([
        {
          id: 'input1',
          type: 'Input',
          x: 0,
          y: 0,
          config: {
            category: 'file',
            type: 'csv',
            source: TEST_CSV,
          },
          sockets: [{ id: 0, direction: 'output' }],
        },
      ]);

      const result = await previewTool('input1', workflow, 3);

      expect(result.tool_id).toBe('input1');
      expect(result.outputs['0']).toBeDefined();
      
      const output = result.outputs['0'];
      expect(output).toBeDefined();
      expect(output?.data).toBeDefined();
      expect(output?.data).toHaveLength(3);
      
      // Check first row
      const firstRow = output?.data?.[0];
      expect(firstRow).toEqual({
        id: 1,
        name: 'Alice',
        age: 30,
        city: 'New York',
      });
    }, { timeout: 5000 });
  });

  describe('Filter Tool', () => {
    it('should filter data based on condition', async () => {
      const workflow = createWorkflow(
        [
          {
            id: 'input1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'file',
              type: 'csv',
              source: TEST_CSV,
            },
            sockets: [{ id: 0, direction: 'output' }],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 200,
            y: 0,
            config: {
              expression: 'pl.col("age") > 28',
            },
            sockets: [
              { id: 0, direction: 'input' },
              { id: 1, direction: 'output' }, // Matches
              { id: 2, direction: 'output' }, // Doesn't match
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 0 },
            to: { tool: 'filter1', socket: 0 },
          },
        ]
      );

      // Test schema propagation
      const schema = await getToolSchema('filter1', workflow);
      const schemaOutput = schema.outputs['1'];
      expect(schemaOutput).toBeDefined();
      expect(schemaOutput?.data_schema?.columns).toHaveLength(4);

      // Test preview with filtered data
      const result = await previewTool('filter1', workflow, 10);
      
      const output = result.outputs['1'];
      expect(output).toBeDefined();
      
      const matchedData = output?.data;
      expect(matchedData).toBeDefined();
      
      // Should have 3 rows with age > 28: Alice (30), Charlie (35), Eve (32)
      expect(matchedData?.length).toBe(3);
      
      // All ages should be > 28
      const ages = matchedData?.map(row => row.age as number) ?? [];
      expect(ages.every(age => age > 28)).toBe(true);
    }, { timeout: 5000 });
  });

  describe('Select Tool', () => {
    it('should select specific columns', async () => {
      const workflow = createWorkflow(
        [
          {
            id: 'input1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'file',
              type: 'csv',
              source: TEST_CSV,
            },
            sockets: [{ id: 0, direction: 'output' }],
          },
          {
            id: 'select1',
            type: 'Select',
            x: 200,
            y: 0,
            config: {
              columns: ['name', 'city'],
              exclude_mode: false,
            },
            sockets: [
              { id: 0, direction: 'input' },
              { id: 1, direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 0 },
            to: { tool: 'select1', socket: 0 },
          },
        ]
      );

      const result = await previewTool('select1', workflow, 5);
      
      const output = result.outputs['1'];
      expect(output).toBeDefined();
      
      const schema = output?.data_schema;
      expect(schema).toBeDefined();
      expect(schema?.columns).toHaveLength(2);
      expect(schema?.columns.map(c => c.name)).toEqual(['name', 'city']);
      
      const data = output?.data;
      expect(data).toBeDefined();
      expect(data?.[0]).toHaveProperty('name');
      expect(data?.[0]).toHaveProperty('city');
      expect(data?.[0]).not.toHaveProperty('id');
      expect(data?.[0]).not.toHaveProperty('age');
    }, { timeout: 5000 });
  });

  describe('Complete Workflow Execution', () => {
    it('should execute multi-tool workflow', async () => {
      const workflow = createWorkflow(
        [
          {
            id: 'input1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'file',
              type: 'csv',
              source: TEST_CSV,
            },
            sockets: [{ id: 0, direction: 'output' }],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 200,
            y: 0,
            config: {
              expression: 'pl.col("age") >= 30',
            },
            sockets: [
              { id: 0, direction: 'input' },
              { id: 1, direction: 'output' },
              { id: 2, direction: 'output' },
            ],
          },
          {
            id: 'select1',
            type: 'Select',
            x: 400,
            y: 0,
            config: {
              columns: ['name', 'age'],
              exclude_mode: false,
            },
            sockets: [
              { id: 0, direction: 'input' },
              { id: 1, direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 0 },
            to: { tool: 'filter1', socket: 0 },
          },
          {
            from: { tool: 'filter1', socket: 1 },
            to: { tool: 'select1', socket: 0 },
          },
        ]
      );

      const result = await executeWorkflow(workflow, 'select1');
      
      // Should return final tool output
      expect(result.tool_id).toBe('select1');
      
      const output = result.outputs['1'];
      expect(output).toBeDefined();
      
      const data = output?.data;
      expect(data).toBeDefined();
      
      // Should have 3 rows: Alice (30), Charlie (35), Eve (32)
      expect(data?.length).toBe(3);
      
      // Should only have name and age columns
      if (data && data[0]) {
        expect(Object.keys(data[0])).toEqual(['name', 'age']);
      }
      
      // Verify data
      const names = data?.map(row => row.name) ?? [];
      expect(names).toContain('Alice');
      expect(names).toContain('Charlie');
      expect(names).toContain('Eve');
    }, { timeout: 5000 });
  });
});
