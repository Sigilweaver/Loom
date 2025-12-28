/**
 * Integration tests for Monaco editor autocomplete in Filter and Formula tools
 * 
 * Tests the complete data flow:
 * 1. Backend provides metadata (columns) and functions
 * 2. Frontend hooks fetch and cache data
 * 3. Configuration components pass data to CodeEditor
 * 4. Monaco completion provider uses data for suggestions
 * 
 * Requires backend running on http://localhost:8001
 * Run with: npm run test:integration
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll } from 'vitest';
import { getToolMetadata, getPolarsFunctions, healthCheck, type MetadataResponse, type ColumnSchema } from '../backend';
import type { WorkflowJSON } from '../../domain/workflow/services/WorkflowSerializer';
import type { Tool, Wire } from '../../domain/workflow/entities/workflow';

// Path to test fixture created in backend (computed relative to this file)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_CSV = path.resolve(__dirname, '../../../../server/tests/fixtures/sample.csv');

/**
 * Helper to get all columns from metadata response (flattened from all input sockets)
 */
const getAllColumns = (result: MetadataResponse): ColumnSchema[] => {
  return Object.values(result.inputs).flat();
};

/**
 * Helper to get columns from a specific input socket
 */
const getSocketColumns = (result: MetadataResponse, socketId: string): ColumnSchema[] => {
  return result.inputs[socketId] || [];
};

// Helper to create workflow JSON
const createWorkflow = (tools: Tool[], wires: Wire[] = []): WorkflowJSON => ({
  version: '1.0',
  meta: {
    name: 'Monaco Autocomplete Test',
    description: 'Testing Monaco completions with real backend data',
    author: 'Test Suite',
    workflowId: `wf_monaco_${Date.now()}`,
    created: new Date().toISOString(),
  },
  tools,
  wires,
});

describe('Monaco Editor Autocomplete Integration', () => {
  beforeAll(async () => {
    const health = await healthCheck();
    expect(health.status).toBe('healthy');
  }, 5000);

  describe('Column Metadata for Completions', () => {
    it('provides columns with correct dtype for type-specific completions', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 200,
            y: 0,
            config: { expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
              { id: 'output-false', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'filter1', socket: 'input' },
          },
        ]
      );

      const metadata = await getToolMetadata('filter1', workflow);

      // Verify dtype information is available
      const columns = getSocketColumns(metadata, 'input');
      expect(columns).toBeDefined();
      expect(columns.length).toBeGreaterThan(0);

      // Each column should have dtype for type-specific methods
      columns.forEach(col => {
        expect(col.dtype).toBeDefined();
        expect(typeof col.dtype).toBe('string');
        expect(col.dtype.length).toBeGreaterThan(0);
      });

      // Verify we have both String and Int64 columns for testing
      const dtypes = columns.map(c => c.dtype);
      expect(dtypes).toContain('String');
      expect(dtypes).toContain('Int64');
    });

    it('provides nullable info for documentation hints', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'formula1',
            type: 'Formula',
            x: 200,
            y: 0,
            config: { column_name: 'test', expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'formula1', socket: 'input' },
          },
        ]
      );

      const metadata = await getToolMetadata('formula1', workflow);

      // Each column should have nullable info
      const columns = getSocketColumns(metadata, 'input');
      columns.forEach(col => {
        expect(col).toHaveProperty('nullable');
        expect(typeof col.nullable).toBe('boolean');
      });
    });

    it('returns empty columns for disconnected tools', async () => {
      const workflow = createWorkflow([
        {
          id: 'filter1',
          type: 'Filter',
          x: 0,
          y: 0,
          config: { expression: '' },
          sockets: [
            { id: 'input', direction: 'input' },
            { id: 'output', direction: 'output' },
            { id: 'output-false', direction: 'output' },
          ],
        },
      ]);

      const metadata = await getToolMetadata('filter1', workflow);

      // Should have empty columns, not null/undefined
      expect(metadata.inputs).toBeDefined();
      const columns = getAllColumns(metadata);
      expect(Array.isArray(columns)).toBe(true);
      expect(columns.length).toBe(0);
    });

    it('propagates schema through multi-step workflow', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'select1',
            type: 'Select',
            x: 200,
            y: 0,
            config: {
              columnConfigs: [
                { name: 'name', selected: true },
                { name: 'age', selected: true },
              ],
            },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
            ],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 400,
            y: 0,
            config: { expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
              { id: 'output-false', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'select1', socket: 'input' },
          },
          {
            from: { tool: 'select1', socket: 'output' },
            to: { tool: 'filter1', socket: 'input' },
          },
        ]
      );

      const metadata = await getToolMetadata('filter1', workflow);

      // Should only have the selected columns
      const columns = getSocketColumns(metadata, 'input');
      expect(columns.length).toBe(2);
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');
      expect(columnNames).not.toContain('id');
      expect(columnNames).not.toContain('city');
    });
  });

  describe('Polars Functions for Completions', () => {
    it('provides table-level functions with snippets', async () => {
      const functions = await getPolarsFunctions();

      expect(functions.table_level).toBeDefined();
      expect(functions.table_level.length).toBeGreaterThan(0);

      // pl.col should be available
      const colFunc = functions.table_level.find(f => f.name === 'pl.col');
      expect(colFunc).toBeDefined();
      expect(colFunc!.snippet).toContain('pl.col');
      expect(colFunc!.signature).toBeDefined();
      expect(colFunc!.description).toBeDefined();

      // pl.lit should be available
      const litFunc = functions.table_level.find(f => f.name === 'pl.lit');
      expect(litFunc).toBeDefined();

      // pl.when should be available
      const whenFunc = functions.table_level.find(f => f.name === 'pl.when');
      expect(whenFunc).toBeDefined();
    });

    it('provides "all" column methods for any dtype', async () => {
      const functions = await getPolarsFunctions();

      expect(functions.column_methods).toBeDefined();
      expect(functions.column_methods.all).toBeDefined();
      expect(functions.column_methods.all.length).toBeGreaterThan(0);

      // Common methods should be present
      const methodNames = functions.column_methods.all.map(m => m.name);
      expect(methodNames).toContain('.is_null');
      expect(methodNames).toContain('.is_not_null');
    });

    it('provides string-specific methods', async () => {
      const functions = await getPolarsFunctions();

      expect(functions.column_methods.string).toBeDefined();
      expect(functions.column_methods.string.length).toBeGreaterThan(0);

      const stringMethods = functions.column_methods.string.map(m => m.name);
      expect(stringMethods.some(m => m.startsWith('.str.'))).toBe(true);
    });

    it('provides numeric-specific methods', async () => {
      const functions = await getPolarsFunctions();

      expect(functions.column_methods.numeric).toBeDefined();
      expect(functions.column_methods.numeric.length).toBeGreaterThan(0);

      const numericMethods = functions.column_methods.numeric.map(m => m.name);
      expect(numericMethods).toContain('.abs');
      expect(numericMethods).toContain('.round');
    });

    it('provides datetime-specific methods', async () => {
      const functions = await getPolarsFunctions();

      expect(functions.column_methods.datetime).toBeDefined();
      expect(functions.column_methods.datetime.length).toBeGreaterThan(0);

      const dtMethods = functions.column_methods.datetime.map(m => m.name);
      expect(dtMethods.some(m => m.startsWith('.dt.'))).toBe(true);
    });

    it('all functions have proper snippet format', async () => {
      const functions = await getPolarsFunctions();

      const allFunctions = [
        ...functions.table_level,
        ...functions.column_methods.all,
        ...functions.column_methods.string,
        ...functions.column_methods.numeric,
        ...functions.column_methods.datetime,
      ];

      allFunctions.forEach(fn => {
        expect(fn.snippet).toBeDefined();
        expect(typeof fn.snippet).toBe('string');
        // Snippets should end with ) or be simple like .is_null()
        expect(fn.snippet).toMatch(/\)$/);
      });
    });
  });

  describe('Combined Data for Monaco Editor', () => {
    it('provides all data needed for Filter tool completions', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 200,
            y: 0,
            config: { expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
              { id: 'output-false', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'filter1', socket: 'input' },
          },
        ]
      );

      // Fetch both in parallel (as FilterConfiguration does)
      const [metadata, functions] = await Promise.all([
        getToolMetadata('filter1', workflow),
        getPolarsFunctions(),
      ]);

      const columns = getSocketColumns(metadata, 'input');

      // Context 1 data: columns wrapped in pl.col()
      const columnSuggestions = columns.map(col => ({
        label: col.name,
        insertText: `pl.col('${col.name}')`,
        detail: col.dtype,
      }));
      expect(columnSuggestions.length).toBe(4);

      // Context 2 data: pl. functions
      const plFunctions = functions.table_level.map(fn => ({
        label: fn.name.replace('pl.', ''),
        insertText: fn.snippet.replace('pl.', ''),
      }));
      // Should have at least the core functions (col, lit, when, etc.)
      expect(plFunctions.length).toBeGreaterThanOrEqual(3);

      // Context 3 data: column names
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');

      // Context 4 data: methods based on dtype
      const stringColumn = columns.find(c => c.dtype === 'String');
      expect(stringColumn).toBeDefined();
      expect(functions.column_methods.string.length).toBeGreaterThan(0);

      const numericColumn = columns.find(c => c.dtype === 'Int64');
      expect(numericColumn).toBeDefined();
      expect(functions.column_methods.numeric.length).toBeGreaterThan(0);
    });

    it('provides all data needed for Formula tool completions', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'formula1',
            type: 'Formula',
            x: 200,
            y: 0,
            config: { column_name: 'calculated', expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'formula1', socket: 'input' },
          },
        ]
      );

      const [metadata, functions] = await Promise.all([
        getToolMetadata('formula1', workflow),
        getPolarsFunctions(),
      ]);

      // Formula needs columns for expressions
      const columns = getSocketColumns(metadata, 'input');
      expect(columns.length).toBe(4);

      // Formula needs numeric methods for calculations
      expect(functions.column_methods.numeric).toBeDefined();
      expect(functions.column_methods.numeric.some(m => m.name === '.round')).toBe(true);

      // Formula needs pl.when for conditional logic
      expect(functions.table_level.some(f => f.name === 'pl.when')).toBe(true);
    });

    it('handles workflow with formula after filter', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 200,
            y: 0,
            config: { expression: "pl.col('age') > 25" },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output-true', direction: 'output' },
              { id: 'output-false', direction: 'output' },
            ],
          },
          {
            id: 'formula1',
            type: 'Formula',
            x: 400,
            y: 0,
            config: { column_name: 'age_plus_ten', expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'filter1', socket: 'input' },
          },
          {
            from: { tool: 'filter1', socket: 'output-true' },
            to: { tool: 'formula1', socket: 'input' },
          },
        ]
      );

      // Formula should still see all columns (schema is preserved through filter)
      const metadata = await getToolMetadata('formula1', workflow);
      const columns = getSocketColumns(metadata, 'input');
      expect(columns.length).toBe(4);

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('age');
    });
  });

  describe('Data Type Detection for Method Suggestions', () => {
    it('correctly identifies String dtype for string methods', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 200,
            y: 0,
            config: { expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
              { id: 'output-false', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'filter1', socket: 'input' },
          },
        ]
      );

      const [metadata, functions] = await Promise.all([
        getToolMetadata('filter1', workflow),
        getPolarsFunctions(),
      ]);

      // Find string columns
      const columns = getSocketColumns(metadata, 'input');
      const stringColumns = columns.filter(c => c.dtype === 'String');
      expect(stringColumns.length).toBeGreaterThan(0);

      // String columns should use string methods
      const stringMethods = functions.column_methods.string;
      expect(stringMethods.some(m => m.name.includes('.str.'))).toBe(true);
    });

    it('correctly identifies Int64/Float64 dtypes for numeric methods', async () => {
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
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'formula1',
            type: 'Formula',
            x: 200,
            y: 0,
            config: { column_name: 'test', expression: '' },
            sockets: [
              { id: 'input', direction: 'input' },
              { id: 'output', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'formula1', socket: 'input' },
          },
        ]
      );

      const [metadata, functions] = await Promise.all([
        getToolMetadata('formula1', workflow),
        getPolarsFunctions(),
      ]);

      // Find numeric columns (Int64 in sample.csv)
      const columns = getSocketColumns(metadata, 'input');
      const numericColumns = columns.filter(c => 
        c.dtype === 'Int64' || c.dtype === 'Float64'
      );
      expect(numericColumns.length).toBeGreaterThan(0);

      // Numeric methods should be available
      const numericMethods = functions.column_methods.numeric;
      expect(numericMethods.some(m => m.name === '.abs')).toBe(true);
      expect(numericMethods.some(m => m.name === '.round')).toBe(true);
    });
  });
});
