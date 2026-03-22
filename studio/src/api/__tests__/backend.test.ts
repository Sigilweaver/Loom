import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getToolSchema, previewTool, executeWorkflow, previewCode, healthCheck, BackendError } from '../backend';
import type { WorkflowJSON } from '../../domain/workflow/services/WorkflowSerializer';

// Mock fetch globally
global.fetch = vi.fn();

describe('Backend API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWorkflow: WorkflowJSON = {
    version: '1.0',
    meta: {
      name: 'Test Workflow',
      description: '',
      author: '',
      workflowId: 'wf_test',
      created: new Date().toISOString(),
    },
    tools: [
      {
        id: 'input1',
        type: 'Input',
        x: 0,
        y: 0,
        config: {
          category: 'file',
          type: 'csv',
          source: '/test/data.csv',
        },
        sockets: [{ id: 'output', direction: 'output' }],
      },
    ],
    wires: [],
  };

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockResponse = {
        status: 'healthy',
        version: '0.0.0-dev',
        message: 'Sigilweaver Loom Backend is running',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await healthCheck();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:25811/api/health/',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('getToolSchema', () => {
    it('should fetch schema for a tool', async () => {
      const mockResponse = {
        tool_id: 'input1',
        socket_id: 'output',
        data_schema: {
          columns: [
            { name: 'id', dtype: 'Int64', nullable: true },
            { name: 'name', dtype: 'String', nullable: true },
          ],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getToolSchema('input1', mockWorkflow, 'output');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:25811/api/workflow/tool/schema',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            tool_id: 'input1',
            workflow: mockWorkflow,
            socket_id: 'output',
          }),
        })
      );
    });

    it('should throw BackendError on API error', async () => {
      const mockErrorResponse = {
        detail: 'Tool not found',
        error_type: 'ToolNotFoundError',
        tool_id: 'invalid1',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue(mockErrorResponse),
      } as unknown as Response);

      try {
        await getToolSchema('invalid1', mockWorkflow, 'output');
        expect.fail('Should have thrown BackendError');
      } catch (error) {
        expect(error).toBeInstanceOf(BackendError);
        if (error instanceof BackendError) {
          expect(error.message).toBe('Tool not found');
          expect(error.statusCode).toBe(404);
          expect(error.errorType).toBe('ToolNotFoundError');
          expect(error.toolId).toBe('invalid1');
        }
      }
    });

    it('should throw BackendError on network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(getToolSchema('input1', mockWorkflow, 'output')).rejects.toThrow(
        BackendError
      );

      try {
        await getToolSchema('input1', mockWorkflow, 'output');
      } catch (error) {
        expect(error).toBeInstanceOf(BackendError);
        if (error instanceof BackendError) {
          expect(error.message).toContain('Failed to connect to backend');
          expect(error.statusCode).toBe(0);
        }
      }
    });
  });

  describe('previewTool', () => {
    it('should fetch preview data for a tool', async () => {
      const mockResponse = {
        tool_id: 'input1',
        socket_id: 'output',
        data_schema: {
          columns: [
            { name: 'id', dtype: 'Int64', nullable: true },
            { name: 'name', dtype: 'String', nullable: true },
          ],
        },
        data: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await previewTool('input1', mockWorkflow, 'output', 100);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:25811/api/workflow/tool/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            tool_id: 'input1',
            workflow: mockWorkflow,
            socket_id: 'output',
            preview_limit: 100,
            force_refresh: false,
          }),
        })
      );
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a complete workflow', async () => {
      const mockResponse = {
        tool_id: 'input1',
        outputs: {
          '0': {
            data_schema: {
              columns: [
                { name: 'id', dtype: 'Int64', nullable: true },
                { name: 'name', dtype: 'String', nullable: true },
              ],
            },
            data: [
              { id: 1, name: 'Alice' },
              { id: 2, name: 'Bob' },
            ],
          },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await executeWorkflow(mockWorkflow);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:25811/api/workflow/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            workflow: mockWorkflow,
            target_tool_id: undefined,
            force_refresh: false,
          }),
        })
      );
    });

    it('should execute workflow up to target tool', async () => {
      const mockResponse = {
        tool_id: 'filter1',
        outputs: {
          '1': {
            data_schema: {
              columns: [{ name: 'id', dtype: 'Int64', nullable: true }],
            },
            data: [{ id: 1 }],
          },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await executeWorkflow(mockWorkflow, 'filter1');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:25811/api/workflow/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            workflow: mockWorkflow,
            target_tool_id: 'filter1',
            force_refresh: false,
          }),
        })
      );
    });
  });

  describe('previewCode', () => {
    it('should generate Python code from workflow', async () => {
      const mockResponse = {
        code: '#!/usr/bin/env python3\nimport polars as pl\n\ndf_input1 = pl.scan_csv("/test/data.csv")\n',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await previewCode(mockWorkflow);

      expect(result).toEqual(mockResponse);
      expect(result.code).toContain('import polars as pl');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:25811/api/workflow/preview_code',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            workflow: mockWorkflow,
          }),
        })
      );
    });

    it('should throw BackendError on code generation error', async () => {
      const mockErrorResponse = {
        detail: 'Code generation failed',
        error_type: 'CodeGenerationError',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue(mockErrorResponse),
      } as unknown as Response);

      try {
        await previewCode(mockWorkflow);
        expect.fail('Should have thrown BackendError');
      } catch (error) {
        expect(error).toBeInstanceOf(BackendError);
        if (error instanceof BackendError) {
          expect(error.message).toBe('Code generation failed');
          expect(error.statusCode).toBe(500);
        }
      }
    });
  });
});
