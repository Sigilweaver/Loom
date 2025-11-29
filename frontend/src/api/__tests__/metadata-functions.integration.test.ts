/**
 * Integration tests for metadata and Polars functions endpoints
 * 
 * Tests the Monaco editor autocomplete data sources:
 * - /api/workflow/tool/metadata - Column metadata for autocomplete
 * - /api/polars/functions - Polars function metadata for autocomplete
 * 
 * Requires backend running on http://localhost:8000
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getToolMetadata, getPolarsFunctions, healthCheck } from '../backend';
import type { WorkflowJSON } from '../../domain/workflow/services/WorkflowSerializer';
import type { Tool, Wire } from '../../domain/workflow/entities/workflow';

const TEST_CSV = '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-app/backend/tests/fixtures/sample.csv';

const createWorkflow = (tools: Tool[], wires: Wire[] = []): WorkflowJSON => ({
  version: '2.0',
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
      expect(result.columns).toBeDefined();
      expect(result.columns).toEqual([]);
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
      expect(result.columns).toBeDefined();
      expect(result.columns.length).toBeGreaterThan(0);

      // Verify column structure
      const firstColumn = result.columns[0];
      expect(firstColumn).toHaveProperty('name');
      expect(firstColumn).toHaveProperty('dtype');
      expect(firstColumn).toHaveProperty('nullable');

      // Check expected columns from sample.csv
      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).toEqual(['id', 'name', 'age', 'city']);

      const columnTypes = result.columns.map(c => c.dtype);
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
      expect(result.columns).toBeDefined();
      expect(result.columns.length).toBe(4);

      // Should have all columns available for formula
      const columnNames = result.columns.map(c => c.name);
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
              columns: ['name', 'age'],
              exclude_mode: false,
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

      const result = await getToolMetadata('filter1', workflow);

      expect(result.tool_id).toBe('filter1');
      expect(result.columns.length).toBe(2);

      // Should only have selected columns
      const columnNames = result.columns.map(c => c.name);
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
      expect(result.columns.length).toBe(5); // 4 original + 1 new

      // Check for new calculated column
      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).toContain('age_doubled');

      // Verify the new column has correct type
      const newColumn = result.columns.find(c => c.name === 'age_doubled');
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
      result.columns.forEach(column => {
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
      expect(colFunc?.snippet).toContain('$'); // Should have placeholder

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
      expect(metadata.columns.length).toBeGreaterThan(0);
      expect(functions.table_level.length).toBeGreaterThan(0);
      expect(functions.column_methods.all.length).toBeGreaterThan(0);

      // Should be able to build pl.col('column_name') suggestions
      const columnSuggestions = metadata.columns.map(col => ({
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
      expect(metadata.columns.length).toBe(4);
      const columnNames = metadata.columns.map(c => c.name);
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('name');

      // Should have functions for mathematical operations
      const hasMathFunctions = functions.table_level.some(f => 
        f.name === 'pl.col' || f.name === 'pl.lit'
      );
      expect(hasMathFunctions).toBe(true);

      // Should have type-specific methods based on column types
      // For string columns, should suggest string methods
      const stringColumn = metadata.columns.find(c => c.dtype === 'String');
      expect(stringColumn).toBeDefined();
      expect(functions.column_methods.string.length).toBeGreaterThan(0);

      // For numeric columns, should suggest numeric methods
      const numericColumn = metadata.columns.find(c => c.dtype === 'Int64');
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
      expect(metadata.columns.length).toBe(0);
      expect(functions.table_level.length).toBeGreaterThan(0);

      // Can still suggest pl.lit() even without columns
      const litFunc = functions.table_level.find(f => f.name === 'pl.lit');
      expect(litFunc).toBeDefined();
    });
  });
});
