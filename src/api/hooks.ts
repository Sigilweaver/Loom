/**
 * React hooks for backend API calls
 */

import { useState, useCallback } from 'react';
import {
  getToolSchema,
  previewTool,
  executeWorkflow,
  BackendError,
  type SchemaResponse,
  type ExecuteResponse,
  type WorkflowExecuteResponse,
  type ColumnSchema,
} from './backend';
import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';

export interface UseSchemaResult {
  schema: SchemaResponse | null;
  loading: boolean;
  error: string | null;
  fetchSchema: (toolId: string, workflow: WorkflowJSON) => Promise<void>;
  getColumns: (socketId: string) => ColumnSchema[];
}

/**
 * Hook for fetching tool schema
 * 
 * @example
 * const { schema, loading, error, fetchSchema, getColumns } = useSchema();
 * 
 * // Fetch schema when tool is connected
 * useEffect(() => {
 *   if (tool.hasUpstreamConnection) {
 *     fetchSchema(tool.id, workflow);
 *   }
 * }, [tool.connections]);
 * 
 * // Use columns to populate dropdown
 * const columns = getColumns('0');
 */
export function useSchema(): UseSchemaResult {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async (toolId: string, workflow: WorkflowJSON) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getToolSchema(toolId, workflow);
      setSchema(result);
    } catch (err) {
      const message = err instanceof BackendError 
        ? err.message 
        : 'Failed to fetch schema';
      setError(message);
      setSchema(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const getColumns = useCallback((socketId: string): ColumnSchema[] => {
    if (!schema?.outputs[socketId]?.data_schema) {
      return [];
    }
    return schema.outputs[socketId].data_schema!.columns;
  }, [schema]);

  return { schema, loading, error, fetchSchema, getColumns };
}

export interface UsePreviewResult {
  preview: ExecuteResponse | null;
  loading: boolean;
  error: string | null;
  executePreview: (toolId: string, workflow: WorkflowJSON, limit?: number) => Promise<void>;
  getData: (socketId: string) => Record<string, unknown>[];
  getColumns: (socketId: string) => ColumnSchema[];
}

/**
 * Hook for previewing tool output
 * 
 * @example
 * const { preview, loading, error, executePreview, getData } = usePreview();
 * 
 * // Preview data when user clicks preview button
 * const handlePreview = () => {
 *   executePreview(tool.id, workflow, 100);
 * };
 * 
 * // Display preview data
 * const rows = getData('0');
 */
export function usePreview(): UsePreviewResult {
  const [preview, setPreview] = useState<ExecuteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executePreview = useCallback(
    async (toolId: string, workflow: WorkflowJSON, limit = 100) => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await previewTool(toolId, workflow, limit);
        setPreview(result);
      } catch (err) {
        const message = err instanceof BackendError 
          ? err.message 
          : 'Failed to execute preview';
        setError(message);
        setPreview(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getData = useCallback((socketId: string): Record<string, unknown>[] => {
    if (!preview?.outputs[socketId]?.data) {
      return [];
    }
    return preview.outputs[socketId].data!;
  }, [preview]);

  const getColumns = useCallback((socketId: string): ColumnSchema[] => {
    if (!preview?.outputs[socketId]?.data_schema) {
      return [];
    }
    return preview.outputs[socketId].data_schema!.columns;
  }, [preview]);

  return { preview, loading, error, executePreview, getData, getColumns };
}

export interface UseWorkflowExecuteResult {
  result: WorkflowExecuteResponse | null;
  loading: boolean;
  error: string | null;
  execute: (workflow: WorkflowJSON, targetToolId?: string) => Promise<void>;
}

/**
 * Hook for executing complete workflow
 * 
 * @example
 * const { result, loading, error, execute } = useWorkflowExecute();
 * 
 * // Execute workflow when user clicks run button
 * const handleRun = () => {
 *   execute(workflow);
 * };
 */
export function useWorkflowExecute(): UseWorkflowExecuteResult {
  const [result, setResult] = useState<WorkflowExecuteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (workflow: WorkflowJSON, targetToolId?: string) => {
      setLoading(true);
      setError(null);
      
      try {
        const execResult = await executeWorkflow(workflow, targetToolId);
        setResult(execResult);
      } catch (err) {
        const message = err instanceof BackendError 
          ? err.message 
          : 'Failed to execute workflow';
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { result, loading, error, execute };
}
