/**
 * React hooks for backend API calls
 */

import { useState, useCallback } from 'react';
import {
  getToolSchema,
  getToolMetadata,
  getPolarsFunctions,
  previewTool,
  executeWorkflow,
  previewCode,
  BackendError,
  type SchemaResponse,
  type MetadataResponse,
  type PolarsFunctionsResponse,
  type ExecuteResponse,
  type WorkflowExecuteResponse,
  type ColumnSchema,
} from './backend';
import {
  getCachedSchema,
  cacheSchema,
  getCachedPreview,
  cachePreview,
  getCachedMetadata,
  cacheMetadata,
} from './cache';
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
    // Check cache first
    const cached = getCachedSchema(toolId, workflow);
    if (cached) {
      setSchema(cached);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await getToolSchema(toolId, workflow);
      setSchema(result);
      // Cache the result
      cacheSchema(toolId, workflow, result);
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
      // Check cache first
      const cached = getCachedPreview(toolId, workflow, limit);
      if (cached) {
        setPreview(cached);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const result = await previewTool(toolId, workflow, limit);
        setPreview(result);
        // Cache the result
        cachePreview(toolId, workflow, limit, result);
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

export interface UseCodePreviewResult {
  code: string | null;
  loading: boolean;
  error: string | null;
  generateCode: (workflow: WorkflowJSON) => Promise<void>;
}

/**
 * Hook for generating Python code preview from workflow
 * 
 * @example
 * const { code, loading, error, generateCode } = useCodePreview();
 * 
 * // Generate code when user switches to Python tab
 * useEffect(() => {
 *   if (isVisible && viewMode === 'python') {
 *     generateCode(workflow);
 *   }
 * }, [isVisible, viewMode]);
 */
export function useCodePreview(): UseCodePreviewResult {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = useCallback(
    async (workflow: WorkflowJSON) => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await previewCode(workflow);
        setCode(result.code);
      } catch (err) {
        const message = err instanceof BackendError 
          ? err.message 
          : 'Failed to generate code preview';
        setError(message);
        setCode(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { code, loading, error, generateCode };
}

export interface UseMetadataResult {
  metadata: MetadataResponse | null;
  loading: boolean;
  error: string | null;
  fetchMetadata: (toolId: string, workflow: WorkflowJSON) => Promise<void>;
  getColumns: () => ColumnSchema[];
}

/**
 * Hook for fetching tool metadata for autocomplete
 * 
 * Returns available columns from input sockets.
 * 
 * @example
 * const { metadata, loading, error, fetchMetadata, getColumns } = useMetadata();
 * 
 * // Fetch metadata when tool is connected
 * useEffect(() => {
 *   if (tool.hasUpstreamConnection) {
 *     fetchMetadata(tool.id, workflow);
 *   }
 * }, [tool.connections]);
 * 
 * // Use columns for autocomplete
 * const columns = getColumns();
 */
export function useMetadata(): UseMetadataResult {
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async (toolId: string, workflow: WorkflowJSON) => {
    // Check cache first
    const cached = getCachedMetadata(toolId, workflow);
    if (cached) {
      setMetadata(cached);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await getToolMetadata(toolId, workflow);
      setMetadata(result);
      // Cache the result
      cacheMetadata(toolId, workflow, result);
    } catch (err) {
      const message = err instanceof BackendError 
        ? err.message 
        : 'Failed to fetch metadata';
      setError(message);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const getColumns = useCallback((): ColumnSchema[] => {
    return metadata?.columns || [];
  }, [metadata]);

  return { metadata, loading, error, fetchMetadata, getColumns };
}

export interface UsePolarsFunctionsResult {
  functions: PolarsFunctionsResponse | null;
  loading: boolean;
  error: string | null;
  fetchFunctions: () => Promise<void>;
}

/**
 * Hook for fetching Polars functions for autocomplete
 * 
 * Should be called once on app startup and cached.
 * 
 * @example
 * const { functions, loading, fetchFunctions } = usePolarsFunctions();
 * 
 * // Fetch on mount
 * useEffect(() => {
 *   fetchFunctions();
 * }, []);
 * 
 * // Use functions for Monaco autocomplete
 * const tableFunctions = functions?.table_level || [];
 * const stringMethods = functions?.column_methods.string || [];
 */
export function usePolarsFunctions(): UsePolarsFunctionsResult {
  const [functions, setFunctions] = useState<PolarsFunctionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFunctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getPolarsFunctions();
      setFunctions(result);
    } catch (err) {
      const message = err instanceof BackendError 
        ? err.message 
        : 'Failed to fetch Polars functions';
      setError(message);
      setFunctions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { functions, loading, error, fetchFunctions };
}

// Re-export cache utilities for manual invalidation
export {
  invalidateTool,
  invalidateWireChange,
  clearCache,
  getCacheStats,
} from './cache';
