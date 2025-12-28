/**
 * React hooks for backend API calls
 */

import { useState, useCallback } from 'react';
import {
  getToolSchema,
  getToolMetadata,
  getPolarsFunctions,
  previewTool,
  previewAllTools,
  executeWorkflow,
  previewCode,
  BackendError,
  type SchemaResponse,
  type MetadataResponse,
  type PolarsFunctionsResponse,
  type ExecuteResponse,
  type WorkflowExecuteResponse,
  type PreviewAllResponse,
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
import { resolveWorkflowConnections } from './connectionResolver';
import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';

export interface UseSchemaResult {
  schema: SchemaResponse | null;
  loading: boolean;
  error: string | null;
  fetchSchema: (toolId: string, workflow: WorkflowJSON, socketId: string) => Promise<void>;
  getColumns: () => ColumnSchema[];
}

/**
 * Hook for fetching tool schema for a specific socket
 * 
 * @example
 * const { schema, loading, error, fetchSchema, getColumns } = useSchema();
 * 
 * // Fetch schema when tool is connected
 * useEffect(() => {
 *   if (tool.hasUpstreamConnection) {
 *     fetchSchema(tool.id, workflow, '1');  // Socket ID is required
 *   }
 * }, [tool.connections]);
 * 
 * // Use columns to populate dropdown
 * const columns = getColumns();
 */
export function useSchema(): UseSchemaResult {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async (toolId: string, workflow: WorkflowJSON, socketId: string) => {
    // Check cache first (includes socketId to prevent cross-socket collisions)
    const cached = getCachedSchema(toolId, workflow, socketId);
    if (cached) {
      setSchema(cached);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await getToolSchema(toolId, workflow, socketId);
      setSchema(result);
      // Cache the result (includes socketId in cache key)
      cacheSchema(toolId, workflow, socketId, result);
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

  const getColumns = useCallback((): ColumnSchema[] => {
    if (!schema?.data_schema) return [];
    return schema.data_schema.columns;
  }, [schema]);

  return { schema, loading, error, fetchSchema, getColumns };
}

export interface UsePreviewResult {
  preview: ExecuteResponse | null;
  loading: boolean;
  error: string | null;
  executePreview: (toolId: string, workflow: WorkflowJSON, socketId: string, limit?: number) => Promise<void>;
  getData: () => Record<string, unknown>[];
  getColumns: () => ColumnSchema[];
}

/**
 * Hook for previewing tool output for a specific socket
 * 
 * @example
 * const { preview, loading, error, executePreview, getData } = usePreview();
 * 
 * // Preview data when user clicks preview button
 * const handlePreview = () => {
 *   executePreview(tool.id, workflow, '1', 100);  // Socket ID is required
 * };
 * 
 * // Display preview data
 * const rows = getData();
 */
export function usePreview(): UsePreviewResult {
  const [preview, setPreview] = useState<ExecuteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executePreview = useCallback(
    async (toolId: string, workflow: WorkflowJSON, socketId: string, limit = 100) => {
      // Check cache first (includes socketId in cache key)
      const cached = getCachedPreview(toolId, workflow, limit, socketId);
      if (cached) {
        setPreview(cached);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Resolve database connections before preview
        const resolvedWorkflow = await resolveWorkflowConnections(workflow);
        const result = await previewTool(toolId, resolvedWorkflow, socketId, limit);
        setPreview(result);
        // Cache with original workflow (pre-resolution) for consistent cache keys
        cachePreview(toolId, workflow, limit, socketId, result);
      } catch (err) {
        const message = err instanceof BackendError 
          ? err.message 
          : err instanceof Error
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

  const getData = useCallback((): Record<string, unknown>[] => {
    if (!preview?.data) return [];
    return preview.data;
  }, [preview]);

  const getColumns = useCallback((): ColumnSchema[] => {
    if (!preview?.data_schema) return [];
    return preview.data_schema.columns;
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
        // Resolve database connections (replace connectionIds with URIs)
        const resolvedWorkflow = await resolveWorkflowConnections(workflow);
        const execResult = await executeWorkflow(resolvedWorkflow, targetToolId);
        setResult(execResult);
      } catch (err) {
        const message = err instanceof BackendError 
          ? err.message 
          : err instanceof Error
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
        // Resolve database connections before generating code
        const resolvedWorkflow = await resolveWorkflowConnections(workflow);
        const result = await previewCode(resolvedWorkflow);
        setCode(result.code);
      } catch (err) {
        const message = err instanceof BackendError 
          ? err.message 
          : err instanceof Error
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
  columns: ColumnSchema[];
  loading: boolean;
  error: string | null;
  fetchMetadata: (toolId: string, workflow: WorkflowJSON, socketId: string) => Promise<void>;
}

/**
 * Hook for fetching tool metadata for autocomplete
 * 
 * Returns available columns from a specific input socket.
 * Every tool must specify which socket to fetch metadata for.
 * 
 * @example
 * const { columns, loading, error, fetchMetadata } = useMetadata();
 * 
 * // Fetch metadata for a specific socket
 * useEffect(() => {
 *   if (tool.hasUpstreamConnection) {
 *     fetchMetadata(tool.id, workflow, 'input');
 *   }
 * }, [tool.connections]);
 * 
 * // Use columns for autocomplete - directly available
 * <Dropdown options={columns.map(c => c.name)} />
 */
export function useMetadata(): UseMetadataResult {
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async (toolId: string, workflow: WorkflowJSON, socketId: string) => {
    // Check cache first (include socketId in cache key)
    const cached = getCachedMetadata(toolId, workflow, socketId);
    if (cached) {
      setMetadata(cached);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Resolve database connections before fetching metadata
      const resolvedWorkflow = await resolveWorkflowConnections(workflow);
      const result = await getToolMetadata(toolId, resolvedWorkflow, socketId);
      setMetadata(result);
      // Cache with original workflow (pre-resolution) for consistent cache keys
      cacheMetadata(toolId, workflow, result, socketId);
    } catch (err) {
      const message = err instanceof BackendError 
        ? err.message 
        : err instanceof Error
          ? err.message
          : 'Failed to fetch metadata';
      setError(message);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Columns directly from the socket-specific response
  const columns: ColumnSchema[] = metadata?.columns ?? [];

  return { metadata, columns, loading, error, fetchMetadata };
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
  clearWorkflowCache,
  clearAllCaches,
  getCacheStats,
} from './cache';

export interface UsePreviewAllResult {
  previews: PreviewAllResponse | null;
  loading: boolean;
  error: string | null;
  executePreviewAll: (workflow: WorkflowJSON, limit?: number) => Promise<void>;
  getToolData: (toolId: string, socketId: string) => Record<string, unknown>[];
  getToolColumns: (toolId: string, socketId: string) => ColumnSchema[];
}

/**
 * Hook for previewing all tools in one request
 * 
 * This is more efficient than previewing tools individually because
 * upstream tools are only executed once on the backend.
 * 
 * @example
 * const { previews, loading, executePreviewAll, getToolData } = usePreviewAll();
 * 
 * // Preview all tools when user clicks "Preview All" button
 * const handlePreviewAll = () => {
 *   executePreviewAll(workflow, 100);
 * };
 * 
 * // Get data for a specific tool
 * const data = getToolData('tool-123', '0');
 */
export function usePreviewAll(): UsePreviewAllResult {
  const [previews, setPreviews] = useState<PreviewAllResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executePreviewAll = useCallback(
    async (workflow: WorkflowJSON, limit = 100) => {
      setLoading(true);
      setError(null);
      
      try {
        // Resolve database connections before preview all
        const resolvedWorkflow = await resolveWorkflowConnections(workflow);
        const result = await previewAllTools(resolvedWorkflow, limit);
        setPreviews(result);
      } catch (err) {
        const message = err instanceof BackendError 
          ? err.message 
          : err instanceof Error
            ? err.message
            : 'Failed to execute preview all';
        setError(message);
        setPreviews(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getToolData = useCallback(
    (toolId: string, socketId: string): Record<string, unknown>[] => {
      if (!previews?.tools[toolId]?.outputs[socketId]?.data) {
        return [];
      }
      return previews.tools[toolId].outputs[socketId].data!;
    },
    [previews]
  );

  const getToolColumns = useCallback(
    (toolId: string, socketId: string): ColumnSchema[] => {
      if (!previews?.tools[toolId]?.outputs[socketId]?.data_schema) {
        return [];
      }
      return previews.tools[toolId].outputs[socketId].data_schema!.columns;
    },
    [previews]
  );

  return { previews, loading, error, executePreviewAll, getToolData, getToolColumns };
}
