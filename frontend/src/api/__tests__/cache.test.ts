/**
 * Tests for the workflow cache service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeWorkflow,
  getUpstreamToolIds,
  computeCacheKey,
  getCachedSchema,
  cacheSchema,
  getCachedPreview,
  cachePreview,
  getCachedMetadata,
  cacheMetadata,
  invalidateTool,
  invalidateWireChange,
  clearWorkflowCache,
  clearAllCaches,
  getCacheStats,
} from '../cache';
import type { WorkflowJSON } from '../../domain/workflow/services/WorkflowSerializer';

// Helper to create a basic workflow
function createTestWorkflow(): WorkflowJSON {
  return {
    version: '1.0',
    meta: {
      name: 'Test Workflow',
      description: '',
      author: '',
      workflowId: 'wf_test',
      created: '2024-01-01T00:00:00.000Z',
    },
    tools: [
      {
        id: 'input1',
        type: 'Input',
        x: 100,
        y: 200,
        config: { source: '/path/to/file.csv', type: 'csv' },
        sockets: [{ id: 'output', direction: 'output' }],
      },
      {
        id: 'filter1',
        type: 'Filter',
        x: 300,
        y: 200,
        config: { expression: 'age > 18' },
        sockets: [
          { id: 'input', direction: 'input' },
          { id: 'output-true', direction: 'output', type: 'T' },
        ],
      },
      {
        id: 'output1',
        type: 'Output',
        x: 500,
        y: 200,
        config: { destination: '/path/to/output.csv' },
        sockets: [{ id: 'input', direction: 'input' }],
      },
    ],
    wires: [
      { from: { tool: 'input1', socket: 'output' }, to: { tool: 'filter1', socket: 'input' } },
      { from: { tool: 'filter1', socket: 'output-true' }, to: { tool: 'output1', socket: 'input' } },
    ],
  };
}

describe('cache', () => {
  beforeEach(() => {
    clearAllCaches();
  });

  describe('normalizeWorkflow', () => {
    it('strips UI-only fields (x, y) from tools', () => {
      const workflow = createTestWorkflow();
      const normalized = normalizeWorkflow(workflow);

      // Should not have x, y in normalized tools
      for (const tool of normalized.tools) {
        expect(tool).not.toHaveProperty('x');
        expect(tool).not.toHaveProperty('y');
        expect(tool).not.toHaveProperty('sockets');
      }
    });

    it('preserves tool id, type, and config', () => {
      const workflow = createTestWorkflow();
      const normalized = normalizeWorkflow(workflow);

      const tool = normalized.tools[0];
      expect(tool).toBeDefined();
      expect(tool!.id).toBe('input1');
      expect(tool!.type).toBe('Input');
      expect(tool!.config).toEqual({
        source: '/path/to/file.csv',
        type: 'csv',
      });
    });

    it('strips _emit from config', () => {
      const workflow = createTestWorkflow();
      const inputTool = workflow.tools[0];
      expect(inputTool).toBeDefined();
      inputTool!.config._emit = { source: true };
      
      const normalized = normalizeWorkflow(workflow);
      
      const normalizedTool = normalized.tools[0];
      expect(normalizedTool).toBeDefined();
      expect(normalizedTool!.config).not.toHaveProperty('_emit');
    });

    it('preserves wire structure', () => {
      const workflow = createTestWorkflow();
      const normalized = normalizeWorkflow(workflow);

      expect(normalized.wires).toHaveLength(2);
      expect(normalized.wires[0]).toEqual({
        from: { tool: 'input1', socket: 'output' },
        to: { tool: 'filter1', socket: 'input' },
      });
    });
  });

  describe('getUpstreamToolIds', () => {
    it('returns empty set for tool with no upstream', () => {
      const workflow = createTestWorkflow();
      const upstream = getUpstreamToolIds('input1', workflow.wires);

      expect(upstream.size).toBe(0);
    });

    it('returns direct upstream tool', () => {
      const workflow = createTestWorkflow();
      const upstream = getUpstreamToolIds('filter1', workflow.wires);

      expect(upstream.size).toBe(1);
      expect(upstream.has('input1')).toBe(true);
    });

    it('returns transitive upstream tools', () => {
      const workflow = createTestWorkflow();
      const upstream = getUpstreamToolIds('output1', workflow.wires);

      expect(upstream.size).toBe(2);
      expect(upstream.has('input1')).toBe(true);
      expect(upstream.has('filter1')).toBe(true);
    });
  });

  describe('computeCacheKey', () => {
    it('generates different keys for different cache types', () => {
      const workflow = createTestWorkflow();
      
      const schemaKey = computeCacheKey('filter1', workflow, 'schema');
      const previewKey = computeCacheKey('filter1', workflow, 'preview', 100);
      const metadataKey = computeCacheKey('filter1', workflow, 'metadata');

      expect(schemaKey).not.toBe(previewKey);
      expect(schemaKey).not.toBe(metadataKey);
      expect(previewKey).not.toBe(metadataKey);
    });

    it('generates different keys for different preview limits', () => {
      const workflow = createTestWorkflow();
      
      const key100 = computeCacheKey('filter1', workflow, 'preview', 100);
      const key200 = computeCacheKey('filter1', workflow, 'preview', 200);

      expect(key100).not.toBe(key200);
    });

    it('generates same key for same inputs', () => {
      const workflow1 = createTestWorkflow();
      const workflow2 = createTestWorkflow();
      
      const key1 = computeCacheKey('filter1', workflow1, 'schema');
      const key2 = computeCacheKey('filter1', workflow2, 'schema');

      expect(key1).toBe(key2);
    });

    it('generates different keys when tool config changes', () => {
      const workflow1 = createTestWorkflow();
      const workflow2 = createTestWorkflow();
      const filterTool = workflow2.tools[1];
      expect(filterTool).toBeDefined();
      filterTool!.config.expression = 'age > 21';
      
      const key1 = computeCacheKey('filter1', workflow1, 'schema');
      const key2 = computeCacheKey('filter1', workflow2, 'schema');

      expect(key1).not.toBe(key2);
    });

    it('generates different keys when upstream config changes', () => {
      const workflow1 = createTestWorkflow();
      const workflow2 = createTestWorkflow();
      const inputTool = workflow2.tools[0];
      expect(inputTool).toBeDefined();
      inputTool!.config.source = '/different/path.csv';
      
      const key1 = computeCacheKey('filter1', workflow1, 'schema');
      const key2 = computeCacheKey('filter1', workflow2, 'schema');

      expect(key1).not.toBe(key2);
    });

    it('generates same key when only x/y changes', () => {
      const workflow1 = createTestWorkflow();
      const workflow2 = createTestWorkflow();
      const inputTool = workflow2.tools[0];
      expect(inputTool).toBeDefined();
      inputTool!.x = 999;
      inputTool!.y = 888;
      
      const key1 = computeCacheKey('filter1', workflow1, 'schema');
      const key2 = computeCacheKey('filter1', workflow2, 'schema');

      expect(key1).toBe(key2);
    });
  });

  describe('schema caching', () => {
    it('returns null when cache is empty', () => {
      const workflow = createTestWorkflow();
      const result = getCachedSchema('filter1', workflow, '1');

      expect(result).toBeNull();
    });

    it('returns cached schema after caching', () => {
      const workflow = createTestWorkflow();
      const schemaData = {
        tool_id: 'filter1',
        socket_id: '1',
        data_schema: {
          columns: [{ name: 'age', dtype: 'Int64', nullable: true }],
        },
      };

      cacheSchema('filter1', workflow, '1', schemaData);
      const result = getCachedSchema('filter1', workflow, '1');

      expect(result).toEqual(schemaData);
    });

    it('returns null after config change', () => {
      const workflow = createTestWorkflow();
      const schemaData = {
        tool_id: 'filter1',
        socket_id: '1',
        data_schema: { columns: [] },
      };

      cacheSchema('filter1', workflow, '1', schemaData);
      
      // Change config
      const filterTool = workflow.tools[1];
      expect(filterTool).toBeDefined();
      filterTool!.config.expression = 'age > 30';
      const result = getCachedSchema('filter1', workflow, '1');

      expect(result).toBeNull();
    });

    it('returns null for different socketId', () => {
      const workflow = createTestWorkflow();
      const schemaData = {
        tool_id: 'filter1',
        socket_id: '1',
        data_schema: { columns: [] },
      };

      cacheSchema('filter1', workflow, '1', schemaData);
      const result = getCachedSchema('filter1', workflow, '2');

      expect(result).toBeNull();
    });
  });

  describe('preview caching', () => {
    it('returns null when cache is empty', () => {
      const workflow = createTestWorkflow();
      const result = getCachedPreview('filter1', workflow, 100, '1');

      expect(result).toBeNull();
    });

    it('returns cached preview after caching', () => {
      const workflow = createTestWorkflow();
      const previewData = {
        tool_id: 'filter1',
        socket_id: '1',
        data: [{ age: 25, name: 'John' }],
        data_schema: {
          columns: [
            { name: 'age', dtype: 'Int64', nullable: true },
            { name: 'name', dtype: 'Utf8', nullable: true },
          ],
        },
      };

      cachePreview('filter1', workflow, 100, '1', previewData);
      const result = getCachedPreview('filter1', workflow, 100, '1');

      expect(result).toEqual(previewData);
    });

    it('returns null for different limit', () => {
      const workflow = createTestWorkflow();
      const previewData = {
        tool_id: 'filter1',
        socket_id: '1',
        data: [],
        data_schema: { columns: [] },
      };

      cachePreview('filter1', workflow, 100, '1', previewData);
      const result = getCachedPreview('filter1', workflow, 200, '1');

      expect(result).toBeNull();
    });

    it('returns null for different socketId', () => {
      const workflow = createTestWorkflow();
      const previewData = {
        tool_id: 'filter1',
        socket_id: '1',
        data: [],
        data_schema: { columns: [] },
      };

      cachePreview('filter1', workflow, 100, '1', previewData);
      const result = getCachedPreview('filter1', workflow, 100, '2');

      expect(result).toBeNull();
    });
  });

  describe('metadata caching', () => {
    it('returns cached metadata after caching', () => {
      const workflow = createTestWorkflow();
      const metadataData = {
        tool_id: 'filter1',
        columns: [
          { name: 'age', dtype: 'Int64', nullable: true },
          { name: 'name', dtype: 'Utf8', nullable: true },
        ],
      };

      cacheMetadata('filter1', workflow, metadataData);
      const result = getCachedMetadata('filter1', workflow);

      expect(result).toEqual(metadataData);
    });
  });

  describe('invalidateTool', () => {
    it('removes cache entries for a specific tool', () => {
      const workflow = createTestWorkflow();
      const schemaData = { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } };
      const previewData = { tool_id: 'filter1', socket_id: '1', data: [], data_schema: { columns: [] } };

      cacheSchema('filter1', workflow, '1', schemaData);
      cachePreview('filter1', workflow, 100, '1', previewData);

      expect(getCachedSchema('filter1', workflow, '1')).not.toBeNull();
      expect(getCachedPreview('filter1', workflow, 100, '1')).not.toBeNull();

      invalidateTool('filter1', workflow.meta.workflowId);

      expect(getCachedSchema('filter1', workflow, '1')).toBeNull();
      expect(getCachedPreview('filter1', workflow, 100, '1')).toBeNull();
    });

    it('does not affect cache entries for other tools', () => {
      const workflow = createTestWorkflow();
      const schemaData1 = { tool_id: 'input1', socket_id: 'output', data_schema: { columns: [] } };
      const schemaData2 = { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } };

      cacheSchema('input1', workflow, 'output', schemaData1);
      cacheSchema('filter1', workflow, '1', schemaData2);

      invalidateTool('filter1', workflow.meta.workflowId);

      expect(getCachedSchema('input1', workflow, 'output')).not.toBeNull();
      expect(getCachedSchema('filter1', workflow, '1')).toBeNull();
    });

    it('invalidates downstream tools that depend on the invalidated tool', () => {
      const workflow = createTestWorkflow();
      // Cache schema for filter1 (depends on input1)
      const schemaData = { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } };
      cacheSchema('filter1', workflow, '1', schemaData);

      // Invalidating input1 should also invalidate filter1's cache
      // because the cache key includes upstream configs
      invalidateTool('input1', workflow.meta.workflowId);

      // The cache entry contains input1's ID in its key, so it should be gone
      expect(getCachedSchema('filter1', workflow, '1')).toBeNull();
    });
  });

  describe('invalidateWireChange', () => {
    it('invalidates affected tool and its downstream', () => {
      const workflow = createTestWorkflow();
      const schemaFilter = { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } };
      const schemaOutput = { tool_id: 'output1', socket_id: 'input', data_schema: { columns: [] } };

      cacheSchema('filter1', workflow, '1', schemaFilter);
      cacheSchema('output1', workflow, 'input', schemaOutput);

      // Simulate wire change affecting filter1
      invalidateWireChange('filter1', workflow.wires, workflow.meta.workflowId);

      expect(getCachedSchema('filter1', workflow, '1')).toBeNull();
      expect(getCachedSchema('output1', workflow, 'input')).toBeNull();
    });
  });

  describe('clearWorkflowCache', () => {
    it('removes all cache entries for a specific workflow', () => {
      const workflow = createTestWorkflow();
      cacheSchema('input1', workflow, 'output', { tool_id: 'input1', socket_id: 'output', data_schema: { columns: [] } });
      cacheSchema('filter1', workflow, '1', { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } });
      cachePreview('filter1', workflow, 100, '1', { tool_id: 'filter1', socket_id: '1', data: [], data_schema: { columns: [] } });

      expect(getCacheStats().size).toBe(3);

      clearWorkflowCache(workflow.meta.workflowId);

      expect(getCacheStats().size).toBe(0);
    });

    it('does not affect other workflows', () => {
      const workflow1 = createTestWorkflow();
      const workflow2 = { 
        ...createTestWorkflow(), 
        meta: { ...createTestWorkflow().meta, workflowId: 'wf_other' } 
      };

      cacheSchema('filter1', workflow1, '1', { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } });
      cacheSchema('filter1', workflow2, '1', { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } });

      expect(getCacheStats().size).toBe(2);

      clearWorkflowCache(workflow1.meta.workflowId);

      expect(getCacheStats().size).toBe(1);
      expect(getCachedSchema('filter1', workflow1, '1')).toBeNull();
      expect(getCachedSchema('filter1', workflow2, '1')).not.toBeNull();
    });
  });

  describe('clearAllCaches', () => {
    it('removes all cache entries from all workflows', () => {
      const workflow1 = createTestWorkflow();
      const workflow2 = { 
        ...createTestWorkflow(), 
        meta: { ...createTestWorkflow().meta, workflowId: 'wf_other' } 
      };
      
      cacheSchema('filter1', workflow1, '1', { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } });
      cacheSchema('filter1', workflow2, '1', { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } });

      expect(getCacheStats().size).toBe(2);

      clearAllCaches();

      expect(getCacheStats().size).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('returns correct cache size', () => {
      const workflow = createTestWorkflow();

      expect(getCacheStats().size).toBe(0);

      cacheSchema('input1', workflow, 'output', { tool_id: 'input1', socket_id: 'output', data_schema: { columns: [] } });
      expect(getCacheStats().size).toBe(1);

      cacheSchema('filter1', workflow, '1', { tool_id: 'filter1', socket_id: '1', data_schema: { columns: [] } });
      expect(getCacheStats().size).toBe(2);
    });
  });
});
