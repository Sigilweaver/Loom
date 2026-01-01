/**
 * Integration tests for metadata and Polars functions endpoints
 * 
 * Tests the Monaco editor autocomplete data sources:
 * - /api/workflow/tool/metadata - Column metadata for autocomplete
 * - /api/polars/functions - Polars function metadata for autocomplete
 * 
 * Requires backend running on http://localhost:25811
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

const createWorkflow = (tools: Tool[], wires: Wire[] = []): WorkflowJSON => ({
  version: '1.0',
  meta: {
    name: 'Metadata Test Workflow',
    description: 'Testing metadata and functions',
    author: 'Test Suite',
    workflowId: `wf_meta_${Date.now()}`,
    created: new Date().toISOString(),
  },
  tools,
  wires,
});

describe('Metadata and Functions Integration', () => {
  beforeAll(async () => {
    // Verify backend is running
    const health = await healthCheck();
    expect(health.status).toBe('healthy');
  }, 5000);

  describe('Tool Metadata Endpoint', () => {
    it('should return empty columns for tool with no inputs', async () => {
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

      const result = await getToolMetadata('filter1', workflow);

      expect(result).toBeDefined();
      expect(result.tool_id).toBe('filter1');
      expect(result.inputs).toBeDefined();
      expect(getAllColumns(result)).toEqual([]);
    });

    it('should return column metadata from connected input tool', async () => {
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

      const result = await getToolMetadata('filter1', workflow);

      expect(result.tool_id).toBe('filter1');
      expect(result.inputs).toBeDefined();
      const columns = getSocketColumns(result, 'input');
      expect(columns.length).toBeGreaterThan(0);

      // Verify column structure
      const firstColumn = columns[0];
      expect(firstColumn).toHaveProperty('name');
      expect(firstColumn).toHaveProperty('dtype');
      expect(firstColumn).toHaveProperty('nullable');

      // Check expected columns from sample.csv
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toEqual(['id', 'name', 'age', 'city']);

      const columnTypes = columns.map(c => c.dtype);
      expect(columnTypes).toEqual(['Int64', 'String', 'Int64', 'String']);
    });

    it('should return metadata for Formula tool with input', async () => {
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
            config: {
              column_name: 'calculated',
              expression: '',
            },
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

      const result = await getToolMetadata('formula1', workflow);

      expect(result.tool_id).toBe('formula1');
      expect(result.inputs).toBeDefined();
      const columns = getSocketColumns(result, 'input');
      expect(columns.length).toBe(4);

      // Should have all columns available for formula
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('city');
    });

    it('should handle multi-step workflow metadata propagation', async () => {
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
              { id: 'output-true', direction: 'output' },
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

      const result = await getToolMetadata('filter1', workflow);

      expect(result.tool_id).toBe('filter1');
      const columns = getSocketColumns(result, 'input');
      expect(columns.length).toBe(2);

      // Should only have selected columns
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toEqual(['name', 'age']);
      expect(columnNames).not.toContain('id');
      expect(columnNames).not.toContain('city');
    });

    it('should handle column type changes through transformations', async () => {
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
            config: {
              column_name: 'age_doubled',
              expression: 'pl.col("age") * 2',
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
            to: { tool: 'formula1', socket: 'input' },
          },
          {
            from: { tool: 'formula1', socket: 'output' },
            to: { tool: 'filter1', socket: 'input' },
          },
        ]
      );

      const result = await getToolMetadata('filter1', workflow);

      expect(result.tool_id).toBe('filter1');
      const columns = getSocketColumns(result, 'input');
      expect(columns.length).toBe(5); // 4 original + 1 new

      // Check for new calculated column
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('age_doubled');

      // Verify the new column has correct type
      const newColumn = columns.find(c => c.name === 'age_doubled');
      expect(newColumn).toBeDefined();
      expect(newColumn?.dtype).toBe('Int64'); // age * 2 should still be Int64
    });

    it('should handle nullable columns correctly', async () => {
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

      const result = await getToolMetadata('filter1', workflow);

      // All columns should have nullable property
      const columns = getSocketColumns(result, 'input');
      columns.forEach(column => {
        expect(column).toHaveProperty('nullable');
        expect(typeof column.nullable).toBe('boolean');
      });
    });
  });

  describe('Polars Functions Endpoint', () => {
    it('should return Polars functions metadata', async () => {
      const result = await getPolarsFunctions();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('table_level');
      expect(result).toHaveProperty('column_methods');
    });

    it('should return table-level functions', async () => {
      const result = await getPolarsFunctions();

      expect(result.table_level).toBeDefined();
      expect(Array.isArray(result.table_level)).toBe(true);
      expect(result.table_level.length).toBeGreaterThan(0);

      // Verify function structure
      const firstFunc = result.table_level[0];
      expect(firstFunc).toHaveProperty('name');
      expect(firstFunc).toHaveProperty('signature');
      expect(firstFunc).toHaveProperty('description');
      expect(firstFunc).toHaveProperty('snippet');
      expect(firstFunc).toHaveProperty('category');
    });

    it('should include essential table-level functions', async () => {
      const result = await getPolarsFunctions();

      const functionNames = result.table_level.map(f => f.name);

      // Core functions that should be available
      expect(functionNames).toContain('pl.col');
      expect(functionNames).toContain('pl.lit');
      expect(functionNames).toContain('pl.when');
    });

    it('should return column methods for all types', async () => {
      const result = await getPolarsFunctions();

      expect(result.column_methods).toBeDefined();
      expect(result.column_methods).toHaveProperty('all');
      expect(result.column_methods).toHaveProperty('string');
      expect(result.column_methods).toHaveProperty('numeric');
      expect(result.column_methods).toHaveProperty('datetime');

      // All should be arrays
      expect(Array.isArray(result.column_methods.all)).toBe(true);
      expect(Array.isArray(result.column_methods.string)).toBe(true);
      expect(Array.isArray(result.column_methods.numeric)).toBe(true);
      expect(Array.isArray(result.column_methods.datetime)).toBe(true);
    });

    it('should include common column methods', async () => {
      const result = await getPolarsFunctions();

      // Check for common methods that work on all columns
      const allMethodNames = result.column_methods.all.map(f => f.name);
      expect(allMethodNames.length).toBeGreaterThan(0);

      // Common methods that should be available
      const hasCommonMethods = allMethodNames.some(name =>
        name.includes('is_null') || name.includes('cast')
      );
      expect(hasCommonMethods).toBe(true);
    });

    it('should include string-specific methods', async () => {
      const result = await getPolarsFunctions();

      const stringMethodNames = result.column_methods.string.map(f => f.name);
      expect(stringMethodNames.length).toBeGreaterThan(0);

      // String methods typically include str namespace
      const hasStrMethods = stringMethodNames.some(name => name.includes('str.'));
      expect(hasStrMethods).toBe(true);
    });

    it('should include numeric-specific methods', async () => {
      const result = await getPolarsFunctions();

      const numericMethodNames = result.column_methods.numeric.map(f => f.name);
      expect(numericMethodNames.length).toBeGreaterThan(0);

      // Numeric methods should include mathematical operations
      const hasMathMethods = numericMethodNames.some(name =>
        name.includes('abs') ||
        name.includes('round') ||
        name.includes('sqrt') ||
        name.includes('floor') ||
        name.includes('ceil')
      );
      expect(hasMathMethods).toBe(true);
    });

    it('should include datetime-specific methods', async () => {
      const result = await getPolarsFunctions();

      const datetimeMethodNames = result.column_methods.datetime.map(f => f.name);
      expect(datetimeMethodNames.length).toBeGreaterThan(0);

      // Datetime methods typically include dt namespace
      const hasDtMethods = datetimeMethodNames.some(name => name.includes('dt.'));
      expect(hasDtMethods).toBe(true);
    });

    it('should provide snippets for autocomplete', async () => {
      const result = await getPolarsFunctions();

      // Check table-level function snippets
      const colFunc = result.table_level.find(f => f.name === 'pl.col');
      expect(colFunc).toBeDefined();
      expect(colFunc?.snippet).toBeDefined();
      // pl.col has no required params, so snippet is pl.col()
      expect(colFunc?.snippet).toContain('pl.col');

      // Some functions should have placeholders (like pl.lit)
      const litFunc = result.table_level.find(f => f.name === 'pl.lit');
      expect(litFunc).toBeDefined();
      expect(litFunc?.snippet).toContain('$'); // pl.lit has a required value param

      // Check column method snippets
      if (result.column_methods.all.length > 0) {
        const firstMethod = result.column_methods.all[0];
        expect(firstMethod?.snippet).toBeDefined();
      }
    });

    it('should provide signatures for documentation', async () => {
      const result = await getPolarsFunctions();

      // All functions should have signatures
      result.table_level.forEach(func => {
        expect(func.signature).toBeDefined();
        expect(func.signature.length).toBeGreaterThan(0);
      });

      result.column_methods.all.forEach(func => {
        expect(func.signature).toBeDefined();
        expect(func.signature.length).toBeGreaterThan(0);
      });
    });

    it('should provide descriptions for documentation', async () => {
      const result = await getPolarsFunctions();

      // All functions should have descriptions
      result.table_level.forEach(func => {
        expect(func.description).toBeDefined();
        expect(func.description.length).toBeGreaterThan(0);
      });

      result.column_methods.all.forEach(func => {
        expect(func.description).toBeDefined();
        expect(func.description.length).toBeGreaterThan(0);
      });
    });

    it('should categorize functions correctly', async () => {
      const result = await getPolarsFunctions();

      // All functions should have a category
      result.table_level.forEach(func => {
        expect(func.category).toBeDefined();
        expect(func.category.length).toBeGreaterThan(0);
      });

      result.column_methods.all.forEach(func => {
        expect(func.category).toBeDefined();
      });
    });

    it('should be consistent across multiple calls (cacheable)', async () => {
      const result1 = await getPolarsFunctions();
      const result2 = await getPolarsFunctions();

      // Results should be identical
      expect(result1.table_level.length).toBe(result2.table_level.length);
      expect(result1.column_methods.all.length).toBe(result2.column_methods.all.length);
      expect(result1.column_methods.string.length).toBe(result2.column_methods.string.length);
      expect(result1.column_methods.numeric.length).toBe(result2.column_methods.numeric.length);
      expect(result1.column_methods.datetime.length).toBe(result2.column_methods.datetime.length);

      // Function names should be the same
      const names1 = result1.table_level.map(f => f.name).sort();
      const names2 = result2.table_level.map(f => f.name).sort();
      expect(names1).toEqual(names2);
    });
  });

  describe('Combined Metadata and Functions for Monaco Editor', () => {
    it('should provide complete autocomplete data for Filter tool', async () => {
      // This simulates what the FilterConfiguration component needs
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

      // Fetch both metadata and functions (as the component would)
      const [metadata, functions] = await Promise.all([
        getToolMetadata('filter1', workflow),
        getPolarsFunctions(),
      ]);

      // Verify we have everything needed for autocomplete
      const columns = getSocketColumns(metadata, 'input');
      expect(columns.length).toBeGreaterThan(0);
      expect(functions.table_level.length).toBeGreaterThan(0);
      expect(functions.column_methods.all.length).toBeGreaterThan(0);

      // Should be able to build pl.col('column_name') suggestions
      const columnSuggestions = columns.map(col => ({
        label: col.name,
        type: col.dtype,
        insertText: `pl.col('${col.name}')`,
      }));
      expect(columnSuggestions.length).toBe(4);

      // Should be able to build function suggestions
      const functionSuggestions = functions.table_level.map(func => ({
        label: func.name,
        snippet: func.snippet,
        description: func.description,
      }));
      expect(functionSuggestions.length).toBeGreaterThan(0);
    });

    it('should provide complete autocomplete data for Formula tool', async () => {
      // This simulates what the FormulaConfiguration component needs
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
            config: {
              column_name: 'calculated',
              expression: '',
            },
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

      // Should have columns available
      const columns = getSocketColumns(metadata, 'input');
      expect(columns.length).toBe(4);
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('name');

      // Should have functions for mathematical operations
      const hasMathFunctions = functions.table_level.some(f =>
        f.name === 'pl.col' || f.name === 'pl.lit'
      );
      expect(hasMathFunctions).toBe(true);

      // Should have type-specific methods based on column types
      // For string columns, should suggest string methods
      const stringColumn = columns.find(c => c.dtype === 'String');
      expect(stringColumn).toBeDefined();
      expect(functions.column_methods.string.length).toBeGreaterThan(0);

      // For numeric columns, should suggest numeric methods
      const numericColumn = columns.find(c => c.dtype === 'Int64');
      expect(numericColumn).toBeDefined();
      expect(functions.column_methods.numeric.length).toBeGreaterThan(0);
    });

    it('should handle tools with no upstream connections gracefully', async () => {
      const workflow = createWorkflow([
        {
          id: 'formula1',
          type: 'Formula',
          x: 0,
          y: 0,
          config: {
            column_name: 'test',
            expression: '',
          },
          sockets: [
            { id: 'input', direction: 'input' },
            { id: 'output', direction: 'output' },
          ],
        },
      ]);

      const [metadata, functions] = await Promise.all([
        getToolMetadata('formula1', workflow),
        getPolarsFunctions(),
      ]);

      // Should have no columns but still have functions
      expect(getAllColumns(metadata).length).toBe(0);
      expect(functions.table_level.length).toBeGreaterThan(0);

      // Can still suggest pl.lit() even without columns
      const litFunc = functions.table_level.find(f => f.name === 'pl.lit');
      expect(litFunc).toBeDefined();
    });
  });

  describe('Per-Socket Metadata for Multi-Input Tools', () => {
    /**
     * These tests verify the core functionality that metadata returns columns
     * grouped by input socket ID, which is essential for tools like Join
     * that have multiple distinct inputs requiring separate column lists.
     */

    // Second CSV with different schema for testing Join
    // Note: Using same CSV but the principle is tested - in reality these would be different files
    const EMPLOYEES_CSV = TEST_CSV;

    it('should return columns keyed by socket ID for Join tool', async () => {
      const workflow = createWorkflow(
        [
          {
            id: 'input-people',
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
            id: 'input-employees',
            type: 'Input',
            x: 0,
            y: 200,
            config: {
              category: 'file',
              type: 'csv',
              source: EMPLOYEES_CSV,
            },
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'join1',
            type: 'Join',
            x: 300,
            y: 100,
            config: {
              joinType: 'inner',
              leftKeys: [],
              rightKeys: [],
            },
            sockets: [
              { id: 'input-left', direction: 'input', type: 'L' },
              { id: 'input-right', direction: 'input', type: 'R' },
              { id: 'output-left', direction: 'output', type: 'L' },
              { id: 'output-match', direction: 'output', type: 'J' },
              { id: 'output-right', direction: 'output', type: 'R' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input-people', socket: 'output' },
            to: { tool: 'join1', socket: 'input-left' },
          },
          {
            from: { tool: 'input-employees', socket: 'output' },
            to: { tool: 'join1', socket: 'input-right' },
          },
        ]
      );

      const result = await getToolMetadata('join1', workflow);

      // Verify response structure has inputs object
      expect(result.tool_id).toBe('join1');
      expect(result.inputs).toBeDefined();
      expect(typeof result.inputs).toBe('object');

      // Verify both input sockets are present
      expect(result.inputs).toHaveProperty('input-left');
      expect(result.inputs).toHaveProperty('input-right');

      // Verify left socket has columns
      const leftColumns = getSocketColumns(result, 'input-left');
      expect(leftColumns.length).toBeGreaterThan(0);
      const leftColumnNames = leftColumns.map(c => c.name);
      expect(leftColumnNames).toContain('id');
      expect(leftColumnNames).toContain('name');

      // Verify right socket has columns
      const rightColumns = getSocketColumns(result, 'input-right');
      expect(rightColumns.length).toBeGreaterThan(0);
      const rightColumnNames = rightColumns.map(c => c.name);
      expect(rightColumnNames).toContain('id');
    });

    it('should return empty socket when input is not connected', async () => {
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
            id: 'join1',
            type: 'Join',
            x: 300,
            y: 100,
            config: {
              joinType: 'inner',
              leftKeys: [],
              rightKeys: [],
            },
            sockets: [
              { id: 'input-left', direction: 'input', type: 'L' },
              { id: 'input-right', direction: 'input', type: 'R' },
              { id: 'output-left', direction: 'output', type: 'L' },
              { id: 'output-match', direction: 'output', type: 'J' },
              { id: 'output-right', direction: 'output', type: 'R' },
            ],
          },
        ],
        [
          // Only left is connected
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'join1', socket: 'input-left' },
          },
        ]
      );

      const result = await getToolMetadata('join1', workflow);

      // Left socket should have columns
      expect(result.inputs).toHaveProperty('input-left');
      const leftColumns = getSocketColumns(result, 'input-left');
      expect(leftColumns.length).toBeGreaterThan(0);

      // Right socket should be missing or empty (not connected)
      const rightColumns = getSocketColumns(result, 'input-right');
      expect(rightColumns.length).toBe(0);
    });

    it('should allow getSocketColumns helper to retrieve columns by socket ID', async () => {
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
              { id: 'output-true', direction: 'output' },
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

      const result = await getToolMetadata('filter1', workflow);

      // Should be able to get columns by socket ID
      const inputColumns = getSocketColumns(result, 'input');
      expect(inputColumns.length).toBe(4);
      expect(inputColumns.map(c => c.name)).toEqual(['id', 'name', 'age', 'city']);

      // Non-existent socket should return empty array
      const nonExistent = getSocketColumns(result, 'non-existent-socket');
      expect(nonExistent).toEqual([]);
    });

    it('should allow getAllColumns helper to flatten all socket columns', async () => {
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
            id: 'input2',
            type: 'Input',
            x: 0,
            y: 200,
            config: {
              category: 'file',
              type: 'csv',
              source: TEST_CSV, // Same file, so same columns
            },
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'join1',
            type: 'Join',
            x: 300,
            y: 100,
            config: { joinType: 'inner', leftKeys: [], rightKeys: [] },
            sockets: [
              { id: 'input-left', direction: 'input' },
              { id: 'input-right', direction: 'input' },
              { id: 'output-match', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'join1', socket: 'input-left' },
          },
          {
            from: { tool: 'input2', socket: 'output' },
            to: { tool: 'join1', socket: 'input-right' },
          },
        ]
      );

      const result = await getToolMetadata('join1', workflow);

      // getAllColumns should flatten all columns from all sockets
      const allColumns = getAllColumns(result);
      // Should have 4 columns from left + 4 columns from right = 8 total
      expect(allColumns.length).toBe(8);

      // Should contain columns from both inputs
      const allNames = allColumns.map(c => c.name);
      expect(allNames.filter(n => n === 'id').length).toBe(2); // 'id' appears twice
      expect(allNames.filter(n => n === 'name').length).toBe(2);
    });

    it('should return columns directly when socket_id is specified in request', async () => {
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
            id: 'input2',
            type: 'Input',
            x: 0,
            y: 200,
            config: {
              category: 'file',
              type: 'csv',
              source: TEST_CSV,
            },
            sockets: [{ id: 'output', direction: 'output' }],
          },
          {
            id: 'join1',
            type: 'Join',
            x: 300,
            y: 100,
            config: { joinType: 'inner', leftKeys: [], rightKeys: [] },
            sockets: [
              { id: 'input-left', direction: 'input' },
              { id: 'input-right', direction: 'input' },
              { id: 'output-match', direction: 'output' },
            ],
          },
        ],
        [
          {
            from: { tool: 'input1', socket: 'output' },
            to: { tool: 'join1', socket: 'input-left' },
          },
          {
            from: { tool: 'input2', socket: 'output' },
            to: { tool: 'join1', socket: 'input-right' },
          },
        ]
      );

      // Request metadata for specific socket
      const result = await getToolMetadata('join1', workflow, 'input-left');

      // Should have socket_id set
      expect(result.socket_id).toBe('input-left');

      // Should have columns array with just the left socket's columns
      expect(result.columns).toBeDefined();
      expect(result.columns).not.toBeNull();
      expect(result.columns!.length).toBe(4);
      expect(result.columns!.map(c => c.name)).toEqual(['id', 'name', 'age', 'city']);

      // inputs should still only have the requested socket
      expect(Object.keys(result.inputs)).toEqual(['input-left']);
    });

    it('should return null columns when socket_id is not specified', async () => {
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
              { id: 'output-true', direction: 'output' },
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

      // Request metadata without socket_id (gets all sockets)
      const result = await getToolMetadata('filter1', workflow);

      // socket_id should be null when not specified
      expect(result.socket_id).toBeNull();

      // columns should be null (use inputs instead)
      expect(result.columns).toBeNull();

      // inputs should have all sockets
      expect(result.inputs).toHaveProperty('input');
      expect(result.inputs['input']?.length).toBe(4);
    });

    it('should return empty columns for non-existent socket_id', async () => {
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
              { id: 'output-true', direction: 'output' },
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

      // Request metadata for non-existent socket
      const result = await getToolMetadata('filter1', workflow, 'non-existent');

      expect(result.socket_id).toBe('non-existent');
      expect(result.columns).toEqual([]);
      expect(result.inputs).toEqual({ 'non-existent': [] });
    });
  });
});
