/**
 * Backend API Client
 * 
 * Connects to the SigilWeaver backend for workflow execution,
 * schema inference, and data preview functionality.
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import { getRuntimeLogActions, type RequestContext } from '../state/runtimeLogStore';

// Re-export RequestContext for consumers
export type { RequestContext } from '../state/runtimeLogStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * Column schema information returned by the backend
 */
export interface ColumnSchema {
  name: string;
  dtype: string;
  nullable: boolean;
}

/**
 * Data schema for a tool output socket
 */
export interface DataSchema {
  columns: ColumnSchema[];
}

/**
 * Tool output information (schema + optional data)
 */
export interface ToolOutput {
  data_schema?: DataSchema;
  data?: Record<string, unknown>[];
}

/**
 * Schema response from /api/tool/schema endpoint
 */
export interface SchemaResponse {
  tool_id: string;
  outputs: Record<string, ToolOutput>;
}

/**
 * Execute response from /api/tool/execute endpoint
 */
export interface ExecuteResponse {
  tool_id: string;
  outputs: Record<string, ToolOutput>;
}

/**
 * Workflow execution response from /api/workflow/execute endpoint
 */
export interface WorkflowExecuteResponse {
  tool_id: string;
  outputs: Record<string, ToolOutput>;
}

/**
 * Error response from backend
 */
export interface ErrorResponse {
  detail: string;
  error_type?: string;
  tool_id?: string;
}

/**
 * Custom error class for backend API errors
 */
export class BackendError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string,
    public toolId?: string
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

/**
 * Make a request to the backend API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  context?: RequestContext
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const method = options.method || 'GET';
  const { logRequest, logResponse, logError } = getRuntimeLogActions();
  
  // Log the outgoing request
  const requestId = logRequest(endpoint, method, context);
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorType: string | undefined;
      let toolId: string | undefined;

      try {
        const errorData = await response.json() as ErrorResponse;
        errorMessage = errorData.detail || errorMessage;
        errorType = errorData.error_type;
        toolId = errorData.tool_id;
      } catch {
        // If error response isn't JSON, use status text
      }

      const duration = performance.now() - startTime;
      logError(requestId, errorMessage, duration, response.status);
      throw new BackendError(errorMessage, response.status, errorType, toolId);
    }

    const result = await response.json() as T;
    const duration = performance.now() - startTime;
    logResponse(requestId, response.status, duration);
    return result;
  } catch (error) {
    if (error instanceof BackendError) {
      throw error;
    }
    
    // Network or other errors
    const duration = performance.now() - startTime;
    const errorMessage = `Failed to connect to backend: ${error instanceof Error ? error.message : String(error)}`;
    logError(requestId, errorMessage, duration);
    throw new BackendError(errorMessage, 0);
  }
}

/**
 * Get schema information for a tool's outputs
 * 
 * This endpoint returns column names and types without executing the workflow.
 * Use this to populate dropdowns and validate configurations.
 * 
 * @param toolId - The ID of the tool to get schema for
 * @param workflow - The complete workflow definition
 * @param context - Optional request context for logging
 * @returns Schema information for each output socket
 */
export async function getToolSchema(
  toolId: string,
  workflow: WorkflowJSON,
  context?: RequestContext
): Promise<SchemaResponse> {
  return apiRequest<SchemaResponse>('/workflow/tool/schema', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
    }),
  }, { ...context, toolId });
}

/**
 * Execute a single tool with dependencies and return preview data
 * 
 * This endpoint executes the target tool plus all upstream dependencies,
 * returning a sample of the data for preview purposes.
 * 
 * @param toolId - The ID of the tool to preview
 * @param workflow - The complete workflow definition
 * @param previewLimit - Maximum number of rows to return (default: 100)
 * @param context - Optional request context for logging
 * @returns Preview data and schema for each output socket
 */
export async function previewTool(
  toolId: string,
  workflow: WorkflowJSON,
  previewLimit = 100,
  context?: RequestContext
): Promise<ExecuteResponse> {
  return apiRequest<ExecuteResponse>('/workflow/tool/execute', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
      preview_limit: previewLimit,
    }),
  }, { ...context, toolId });
}

/**
 * Execute a complete workflow
 * 
 * @param workflow - The complete workflow definition
 * @param targetToolId - Optional tool ID to execute up to (default: all tools)
 * @param context - Optional request context for logging
 * @returns Output data from the target tool (or final tool if not specified)
 */
export async function executeWorkflow(
  workflow: WorkflowJSON,
  targetToolId?: string,
  context?: RequestContext
): Promise<WorkflowExecuteResponse> {
  return apiRequest<WorkflowExecuteResponse>('/workflow/execute', {
    method: 'POST',
    body: JSON.stringify({
      workflow,
      target_tool_id: targetToolId,
    }),
  }, context);
}

/**
 * Generate Python code preview for a workflow
 * 
 * This endpoint generates executable Python code using Polars that
 * replicates the workflow's data transformations.
 * 
 * @param workflow - The complete workflow definition
 * @param context - Optional request context for logging
 * @returns Generated Python code as a string
 */
export async function previewCode(
  workflow: WorkflowJSON,
  context?: RequestContext
): Promise<{ code: string }> {
  return apiRequest<{ code: string }>('/workflow/preview_code', {
    method: 'POST',
    body: JSON.stringify({
      workflow,
    }),
  }, context);
}

/**
 * Health check endpoint
 * 
 * @returns Backend health status
 */
export async function healthCheck(): Promise<{
  status: string;
  version: string;
  message: string;
}> {
  return apiRequest('/health/');
}

/**
 * Polars function metadata for autocomplete
 */
export interface PolarsFunction {
  name: string;
  signature: string;
  description: string;
  snippet: string;
  category: string;
}

/**
 * Metadata response from /api/workflow/tool/metadata endpoint
 */
export interface MetadataResponse {
  tool_id: string;
  columns: ColumnSchema[];
}

/**
 * Polars functions response from /api/polars/functions endpoint
 */
export interface PolarsFunctionsResponse {
  table_level: PolarsFunction[];
  column_methods: {
    all: PolarsFunction[];
    string: PolarsFunction[];
    numeric: PolarsFunction[];
    datetime: PolarsFunction[];
  };
}

/**
 * Get metadata for a tool for autocomplete suggestions
 * 
 * Returns available columns from input sockets.
 * Use this to populate Monaco editor autocomplete with column names.
 * 
 * @param toolId - The ID of the tool to get metadata for
 * @param workflow - The complete workflow definition
 * @param context - Optional request context for logging
 * @returns Metadata including columns from input sockets
 */
export async function getToolMetadata(
  toolId: string,
  workflow: WorkflowJSON,
  context?: RequestContext
): Promise<MetadataResponse> {
  return apiRequest<MetadataResponse>('/workflow/tool/metadata', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
    }),
  }, { ...context, toolId });
}

/**
 * Get available Polars functions for autocomplete
 * 
 * Returns all Polars functions categorized by scope and type.
 * This should be called once on app startup and cached.
 * 
 * @returns Polars functions categorized by scope
 */
export async function getPolarsFunctions(): Promise<PolarsFunctionsResponse> {
  return apiRequest<PolarsFunctionsResponse>('/polars/functions', {
    method: 'GET',
  });
}

/**
 * Response from /api/workflow/preview_all endpoint
 */
export interface PreviewAllResponse {
  tools: Record<string, {
    outputs: Record<string, ToolOutput>;
  }>;
}

/**
 * Preview all tools in workflow in a single request
 * 
 * This is more efficient than calling previewTool multiple times
 * because upstream tools are only executed once. Useful for loading
 * all previews after opening a workflow or when input data changes.
 * 
 * @param workflow - The complete workflow definition
 * @param previewLimit - Maximum number of rows to return per tool (default: 100)
 * @param context - Optional request context for logging
 * @returns Preview data for all tools in the workflow
 */
export async function previewAllTools(
  workflow: WorkflowJSON,
  previewLimit = 100,
  context?: RequestContext
): Promise<PreviewAllResponse> {
  return apiRequest<PreviewAllResponse>('/workflow/preview_all', {
    method: 'POST',
    body: JSON.stringify({
      workflow,
      preview_limit: previewLimit,
    }),
  }, context);
}
