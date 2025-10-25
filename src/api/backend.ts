/**
 * Backend API Client
 * 
 * Connects to the SigilWeaver backend for workflow execution,
 * schema inference, and data preview functionality.
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';

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
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
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

      throw new BackendError(errorMessage, response.status, errorType, toolId);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof BackendError) {
      throw error;
    }
    
    // Network or other errors
    throw new BackendError(
      `Failed to connect to backend: ${error instanceof Error ? error.message : String(error)}`,
      0
    );
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
 * @returns Schema information for each output socket
 */
export async function getToolSchema(
  toolId: string,
  workflow: WorkflowJSON
): Promise<SchemaResponse> {
  return apiRequest<SchemaResponse>('/workflow/tool/schema', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
    }),
  });
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
 * @returns Preview data and schema for each output socket
 */
export async function previewTool(
  toolId: string,
  workflow: WorkflowJSON,
  previewLimit = 100
): Promise<ExecuteResponse> {
  return apiRequest<ExecuteResponse>('/workflow/tool/execute', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
      preview_limit: previewLimit,
    }),
  });
}

/**
 * Execute a complete workflow
 * 
 * @param workflow - The complete workflow definition
 * @param targetToolId - Optional tool ID to execute up to (default: all tools)
 * @returns Output data from the target tool (or final tool if not specified)
 */
export async function executeWorkflow(
  workflow: WorkflowJSON,
  targetToolId?: string
): Promise<WorkflowExecuteResponse> {
  return apiRequest<WorkflowExecuteResponse>('/workflow/execute', {
    method: 'POST',
    body: JSON.stringify({
      workflow,
      target_tool_id: targetToolId,
    }),
  });
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
