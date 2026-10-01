/**
 * Backend API Client
 *
 * Connects to the Sigilweaver Loom backend for workflow execution,
 * schema inference, and data preview functionality.
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import { platform } from '@platform';
import { backendFetch } from './backendFetch';
import { getRuntimeLogActions, type RequestContext } from '../state/runtimeLogStore';
import { createLogger } from '../utils/logger';

// Re-export RequestContext for consumers
export type { RequestContext } from '../state/runtimeLogStore';

const logger = createLogger('API');

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:25811/api';

/**
 * Session token for backend authentication.
 * In desktop mode, retrieved from Electron via IPC.
 * In browser mode, can be set manually via localStorage.
 */
let sessionToken: string | null = null;

/**
 * Initialize authentication token.
 * Called once on app startup to retrieve the session token from the platform.
 */
export async function initializeAuth(): Promise<void> {
  sessionToken = await platform.auth.getSessionToken();
  if (sessionToken) {
    logger.info(`Session token retrieved from ${platform.name}`);
  }
}

/**
 * Set the session token manually (for browser mode configuration).
 */
export function setSessionToken(token: string | null): void {
  sessionToken = token;
  platform.auth.setSessionToken(token);
}

/**
 * Get the current session token (for debugging/display).
 */
export function getSessionToken(): string | null {
  return sessionToken;
}

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
  row_count?: number;
}

/**
 * Schema response from /api/tool/schema endpoint
 * Returns schema for the specified socket
 */
export interface SchemaResponse {
  tool_id: string;
  socket_id: string;
  data_schema?: DataSchema;
}

/**
 * Execute response from /api/tool/execute endpoint
 * Returns data for the specified socket
 */
export interface ExecuteResponse {
  tool_id: string;
  socket_id: string;
  data_schema?: DataSchema;
  data?: Record<string, unknown>[];
  row_count?: number;
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

  // Build headers with optional auth token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  try {
    const response = await backendFetch(url, {
      ...options,
      headers: {
        ...headers,
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
 * Get schema information for a tool's output socket
 *
 * This endpoint returns column names and types without executing the workflow.
 * Use this to populate dropdowns and validate configurations.
 *
 * @param toolId - The ID of the tool to get schema for
 * @param workflow - The complete workflow definition
 * @param socketId - The socket ID to get schema for
 * @param context - Optional request context for logging
 * @returns Schema information for the specified socket
 */
export async function getToolSchema(
  toolId: string,
  workflow: WorkflowJSON,
  socketId: string,
  context?: RequestContext
): Promise<SchemaResponse> {
  return apiRequest<SchemaResponse>('/workflow/tool/schema', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
      socket_id: socketId,
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
 * @param socketId - The socket ID to get data for
 * @param previewLimit - Maximum number of rows to return (default: 100)
 * @param forceRefresh - Clear cache before execution (default: false)
 * @param context - Optional request context for logging
 * @returns Preview data and schema for the specified socket
 */
export async function previewTool(
  toolId: string,
  workflow: WorkflowJSON,
  socketId: string,
  previewLimit = 100,
  forceRefresh = false,
  context?: RequestContext
): Promise<ExecuteResponse> {
  return apiRequest<ExecuteResponse>('/workflow/tool/execute', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
      socket_id: socketId,
      preview_limit: previewLimit,
      force_refresh: forceRefresh,
    }),
  }, { ...context, toolId });
}

/**
 * Execute a complete workflow
 *
 * @param workflow - The complete workflow definition
 * @param targetToolId - Optional tool ID to execute up to (default: all tools)
 * @param forceRefresh - Clear cache before execution (default: false)
 * @param context - Optional request context for logging
 * @returns Output data from the target tool (or final tool if not specified)
 */
export async function executeWorkflow(
  workflow: WorkflowJSON,
  targetToolId?: string,
  forceRefresh = false,
  context?: RequestContext
): Promise<WorkflowExecuteResponse> {
  return apiRequest<WorkflowExecuteResponse>('/workflow/execute', {
    method: 'POST',
    body: JSON.stringify({
      workflow,
      target_tool_id: targetToolId,
      force_refresh: forceRefresh,
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
 * Polars function parameter metadata
 */
export interface PolarsFunctionParameter {
  name: string;
  required: boolean;
  type?: string;
  default?: string;
  description?: string;
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
  parameters?: PolarsFunctionParameter[];
}

/**
 * Metadata response from /api/workflow/tool/metadata endpoint
 *
 * When socket_id is provided in request, columns contains that socket's columns.
 * The inputs field always contains all sockets for backward compatibility.
 */
export interface MetadataResponse {
  tool_id: string;
  socket_id: string | null;
  columns: ColumnSchema[] | null;
  inputs: Record<string, ColumnSchema[]>;
}

/**
 * Polars functions response from /api/polars/functions endpoint
 *
 * Functions are dynamically introspected from the installed Polars library,
 * so they automatically support new Polars versions.
 */
export interface PolarsFunctionsResponse {
  table_level: PolarsFunction[];
  column_methods: {
    all: PolarsFunction[];
    string: PolarsFunction[];
    numeric: PolarsFunction[];
    datetime: PolarsFunction[];
    list: PolarsFunction[];
  };
  /** The installed Polars version on the backend */
  polars_version?: string;
}

/**
 * Get metadata for a tool for autocomplete suggestions
 *
 * Returns available columns from input sockets.
 * Use this to populate Monaco editor autocomplete with column names.
 *
 * @param toolId - The ID of the tool to get metadata for
 * @param workflow - The complete workflow definition
 * @param socketId - Optional socket ID to get columns for (if not provided, returns all sockets)
 * @param context - Optional request context for logging
 * @returns Metadata including columns from input sockets
 */
export async function getToolMetadata(
  toolId: string,
  workflow: WorkflowJSON,
  socketId?: string,
  context?: RequestContext
): Promise<MetadataResponse> {
  return apiRequest<MetadataResponse>('/workflow/tool/metadata', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
      socket_id: socketId,
    }),
  }, { ...context, toolId });
}

/**
 * Top value entry in column profile
 */
export interface TopValueEntry {
  value: unknown;
  count: number;
}

/**
 * Profile data for a single column
 */
export interface ColumnProfile {
  column: string;
  dtype: string;
  // Basic metrics
  count?: number;
  null_count?: number;
  null_percent?: number;
  unique_count?: number;
  // Numeric metrics
  min?: unknown;
  max?: unknown;
  mean?: number;
  median?: number;
  std?: number;
  min_values?: unknown[];  // Smallest N unique values
  max_values?: unknown[];  // Largest N unique values
  // String quality metrics
  empty_count?: number;  // Empty strings (not null)
  whitespace_leading?: number;
  whitespace_trailing?: number;
  contains_linebreaks?: number;
  contains_non_ascii?: number;
  // Distribution
  top_values?: TopValueEntry[];
}

/**
 * Response from /api/workflow/tool/profile endpoint
 */
export interface ProfileResponse {
  tool_id: string;
  socket_id: string;
  row_count: number;
  column_count: number;
  sampled?: boolean;
  sample_limit?: number;
  columns: Record<string, ColumnProfile>;
}

/**
 * Available profile metrics
 */
export type ProfileMetric =
  | 'count'
  | 'null_count'
  | 'null_percent'
  | 'unique_count'
  | 'min'
  | 'max'
  | 'mean'
  | 'median'
  | 'std'
  | 'whitespace_leading'
  | 'whitespace_trailing'
  | 'contains_linebreaks'
  | 'contains_non_ascii'
  | 'top_values';

/**
 * Profile columns for a tool's input data
 *
 * Computes statistical profiles for columns in the data flowing into
 * the specified tool socket. Useful for:
 * - Understanding data quality (nulls, whitespace issues)
 * - Determining pivot safety (unique value counts)
 * - Exploring data distribution
 *
 * @param toolId - The tool to profile input for
 * @param workflow - The complete workflow definition
 * @param socketId - The input socket to profile
 * @param columns - Optional specific columns to profile (null = all)
 * @param metrics - Optional specific metrics to compute (null = all)
 * @param context - Optional request context for logging
 * @returns Column profiles with requested statistics
 */
export async function profileColumns(
  toolId: string,
  workflow: WorkflowJSON,
  socketId: string,
  columns?: string[],
  metrics?: ProfileMetric[],
  context?: RequestContext
): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>('/workflow/tool/profile', {
    method: 'POST',
    body: JSON.stringify({
      tool_id: toolId,
      workflow,
      socket_id: socketId,
      columns: columns ?? null,
      metrics: metrics ?? null,
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
 * @param forceRefresh - Clear cache before execution (default: false)
 * @param context - Optional request context for logging
 * @returns Preview data for all tools in the workflow
 */
export async function previewAllTools(
  workflow: WorkflowJSON,
  previewLimit = 100,
  forceRefresh = false,
  context?: RequestContext
): Promise<PreviewAllResponse> {
  return apiRequest<PreviewAllResponse>('/workflow/preview_all', {
    method: 'POST',
    body: JSON.stringify({
      workflow,
      preview_limit: previewLimit,
      force_refresh: forceRefresh,
    }),
  }, context);
}

/**
 * Response from /api/workflow/cache/clear endpoint
 */
export interface ClearCacheResponse {
  status: 'cleared' | 'cache_disabled' | 'cleared_on_close' | 'close_acknowledged';
  workflow_id: string;
}

/**
 * Clear backend disk cache for a specific workflow
 *
 * Removes all cached blocking tool outputs for the workflow from the backend.
 * Useful when you want to force re-execution of all tools.
 *
 * Note: This clears the BACKEND disk cache, not the frontend in-memory cache.
 * For frontend cache, use clearWorkflowCache from './cache'.
 *
 * @param workflowId - The workflow ID to clear cache for
 * @param context - Optional request context for logging
 * @returns Status of the cache clear operation
 */
export async function clearBackendWorkflowCache(
  workflowId: string,
  context?: RequestContext
): Promise<ClearCacheResponse> {
  return apiRequest<ClearCacheResponse>('/workflow/cache/clear', {
    method: 'POST',
    body: JSON.stringify({
      workflow_id: workflowId,
    }),
  }, context);
}

/**
 * Notify backend that a workflow has been closed
 *
 * This signals to the backend that the workflow is no longer active.
 * If cache_clear_on_close is enabled (default), the backend will clear
 * the workflow's disk cache. This is more efficient than keeping cache
 * for workflows that are no longer in use.
 *
 * Call this when:
 * - User closes a workflow tab
 * - User switches to a different workflow (for the previous workflow)
 * - Application is shutting down (for all open workflows)
 *
 * Note: This is fire-and-forget - errors are logged but not thrown.
 *
 * @param workflowId - The workflow ID being closed
 * @param context - Optional request context for logging
 */
export async function closeWorkflowCacheOnBackend(
  workflowId: string,
  context?: RequestContext
): Promise<void> {
  try {
    await apiRequest<ClearCacheResponse>('/cache/close', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId,
      }),
    }, context);
    logger.debug('Backend cache closed for workflow:', workflowId);
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    // This prevents cache cleanup failures from blocking workflow operations
    logger.warn('Failed to close backend cache for workflow:', workflowId, error);
  }
}

/**
 * Response from batch cache clear operation
 */
interface BatchClearCacheResponse {
  status: string;
  cleared_count: number;
  workflow_ids: string[];
}

/**
 * Notify backend that multiple workflows have been closed (batch)
 *
 * This is more efficient than calling closeWorkflowCacheOnBackend for each
 * workflow individually. Use this when the application is shutting down
 * to clear all open workflow caches in a single request.
 *
 * If cache_clear_on_close is enabled (default), the backend will clear
 * the disk cache for each workflow.
 *
 * Note: This is fire-and-forget - errors are logged but not thrown.
 *
 * @param workflowIds - Array of workflow IDs being closed
 * @param context - Optional request context for logging
 */
export async function closeWorkflowCachesBatchOnBackend(
  workflowIds: string[],
  context?: RequestContext
): Promise<void> {
  if (workflowIds.length === 0) {
    return;
  }

  try {
    const response = await apiRequest<BatchClearCacheResponse>('/cache/close/batch', {
      method: 'POST',
      body: JSON.stringify({
        workflow_ids: workflowIds,
      }),
    }, context);
    logger.debug('Backend caches closed for', response.cleared_count, 'workflows');
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    // This prevents cache cleanup failures from blocking app shutdown
    logger.warn('Failed to close backend caches for workflows:', workflowIds, error);
  }
}

// =============================================================================
// File Browser API
// =============================================================================

/**
 * File or directory entry from Server file browser
 */
export interface FileEntry {
  /** File or directory name */
  name: string;
  /** Absolute path */
  path: string;
  /** True if this is a directory */
  is_dir: boolean;
  /** File size in bytes (null for directories) */
  size: number | null;
  /** Last modified timestamp (ISO string) */
  modified: string | null;
  /** File extension without dot (null for directories) */
  extension: string | null;
}

/**
 * Root directory entry from Server file browser
 */
export interface RootEntry {
  /** Absolute path to the root directory */
  path: string;
  /** True if this root is read-only */
  read_only: boolean;
}

/**
 * Response from /api/files/list endpoint
 */
export interface ListFilesResponse {
  /** Absolute path of listed directory */
  path: string;
  /** File and directory entries */
  entries: FileEntry[];
  /** Whether this directory is read-only */
  read_only: boolean;
}

/**
 * Response from /api/files/stat endpoint
 */
export interface StatResponse {
  /** Absolute path */
  path: string;
  /** Whether the path exists */
  exists: boolean;
  /** True if this is a file (null if doesn't exist) */
  is_file: boolean | null;
  /** True if this is a directory (null if doesn't exist) */
  is_dir: boolean | null;
  /** File size in bytes (null for directories or non-existent) */
  size: number | null;
  /** Last modified timestamp (ISO string, null if doesn't exist) */
  modified: string | null;
  /** File extension without dot (null for directories) */
  extension: string | null;
  /** Whether this path is read-only */
  read_only: boolean;
}

/**
 * Make a request to a specific server with a browse token
 */
async function serverRequest<T>(
  serverUrl: string,
  endpoint: string,
  browseToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${serverUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (browseToken) {
    headers['Authorization'] = `Bearer ${browseToken}`;
  }

  try {
    const response = await backendFetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorType: string | undefined;

      try {
        const errorData = await response.json() as ErrorResponse;
        errorMessage = errorData.detail || errorMessage;
        errorType = errorData.error_type;
      } catch {
        // If error response isn't JSON, use status text
      }

      throw new BackendError(errorMessage, response.status, errorType);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof BackendError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new BackendError(`Failed to connect to server: ${message}`, 0);
  }
}

/**
 * List root directories available for browsing
 *
 * In Hub mode, returns the roots the user has been granted access to.
 * In non-Hub modes, returns the server's configured allowed_file_paths.
 *
 * @param serverUrl - Server base URL (e.g., "http://localhost:25811")
 * @param browseToken - Browse token from Hub (or session token for non-Hub)
 * @returns Array of browsable root directories
 */
export async function listFileRoots(
  serverUrl: string,
  browseToken: string
): Promise<RootEntry[]> {
  return serverRequest<RootEntry[]>(
    serverUrl,
    '/api/files/roots',
    browseToken
  );
}

/**
 * List contents of a directory
 *
 * @param serverUrl - Server base URL
 * @param browseToken - Browse token for authentication
 * @param path - Absolute path to the directory to list
 * @returns Directory listing with file and subdirectory entries
 */
export async function listFiles(
  serverUrl: string,
  browseToken: string,
  path: string
): Promise<ListFilesResponse> {
  const params = new URLSearchParams({ path });
  return serverRequest<ListFilesResponse>(
    serverUrl,
    `/api/files/list?${params}`,
    browseToken
  );
}

/**
 * Get information about a file or directory
 *
 * @param serverUrl - Server base URL
 * @param browseToken - Browse token for authentication
 * @param path - Absolute path to stat
 * @returns File/directory information
 */
export async function statFile(
  serverUrl: string,
  browseToken: string,
  path: string
): Promise<StatResponse> {
  const params = new URLSearchParams({ path });
  return serverRequest<StatResponse>(
    serverUrl,
    `/api/files/stat?${params}`,
    browseToken
  );
}

/**
 * A file search result with relevance score
 */
export interface SearchResultEntry {
  /** File name */
  name: string;
  /** Absolute path */
  path: string;
  /** File size in bytes */
  size: number | null;
  /** Last modified timestamp (ISO string) */
  modified: string | null;
  /** File extension without dot */
  extension: string | null;
  /** Relevance score 0.0-1.0 (1.0 = exact match) */
  score: number;
}

/**
 * Response from /api/files/search endpoint
 */
export interface SearchFilesResponse {
  /** The search query */
  query: string;
  /** Ranked matching files */
  results: SearchResultEntry[];
  /** Total data files scanned */
  total_files_scanned: number;
}

/**
 * Search for data files across all accessible directories
 *
 * Recursively scans granted root directories and returns files
 * ranked by fuzzy match relevance to the query.
 *
 * @param serverUrl - Server base URL
 * @param browseToken - Browse token for authentication
 * @param query - Search text to match against filenames
 * @param extensions - Optional comma-separated extensions filter (e.g. "csv,parquet")
 * @param limit - Max results to return (1-100, default 20)
 * @returns Ranked list of matching data files
 */
export async function searchFiles(
  serverUrl: string,
  browseToken: string,
  query: string,
  extensions?: string,
  limit?: number,
): Promise<SearchFilesResponse> {
  const params = new URLSearchParams({ query });
  if (extensions) params.set('extensions', extensions);
  if (limit !== undefined) params.set('limit', String(limit));
  return serverRequest<SearchFilesResponse>(
    serverUrl,
    `/api/files/search?${params}`,
    browseToken
  );
}

/**
 * A column reported by database schema introspection
 */
export interface DatabaseColumnInfo {
  /** Column name */
  name: string;
  /** Database-reported column type */
  type: string;
}

/**
 * A table reported by database schema introspection
 */
export interface DatabaseTableInfo {
  /** Table name */
  name: string;
  /** Columns in the table */
  columns: DatabaseColumnInfo[];
}

/**
 * Response from the /api/datasource/schema endpoint
 */
export interface DatabaseSchemaResponse {
  /** Tables discovered in the database */
  tables: DatabaseTableInfo[];
}

/**
 * Response from the /api/datasource/preview endpoint
 */
export interface DatabasePreviewResponse {
  /** Schema of the returned rows */
  data_schema?: DataSchema;
  /** Preview rows */
  data: Record<string, unknown>[];
  /** Total rows available, if known */
  total_rows: number | null;
  /** Number of rows returned */
  returned_rows: number;
}

/**
 * Introspect a database connection and list its tables and columns.
 *
 * @param serverUrl - Server base URL
 * @param browseToken - Browse/session token for authentication
 * @param source - Database connection URI
 * @param sourceType - Database type (postgresql, mysql, sqlite, mssql)
 * @returns Tables and their columns
 */
export async function describeDatabaseSchema(
  serverUrl: string,
  browseToken: string,
  source: string,
  sourceType: string,
): Promise<DatabaseSchemaResponse> {
  return serverRequest<DatabaseSchemaResponse>(
    serverUrl,
    '/api/datasource/schema',
    browseToken,
    {
      method: 'POST',
      body: JSON.stringify({ source, sourceType }),
    }
  );
}

/**
 * Run a read-only SQL query against a database connection and preview rows.
 *
 * Reuses the generic /api/datasource/preview endpoint, which validates that
 * the query is read-only and wraps it with a LIMIT.
 *
 * @param serverUrl - Server base URL
 * @param browseToken - Browse/session token for authentication
 * @param source - Database connection URI
 * @param sourceType - Database type (postgresql, mysql, sqlite, mssql)
 * @param query - The SELECT query to execute
 * @param maxRows - Maximum rows to return
 * @returns Preview rows with schema
 */
export async function previewDatabaseQuery(
  serverUrl: string,
  browseToken: string,
  source: string,
  sourceType: string,
  query: string,
  maxRows: number,
): Promise<DatabasePreviewResponse> {
  return serverRequest<DatabasePreviewResponse>(
    serverUrl,
    '/api/datasource/preview',
    browseToken,
    {
      method: 'POST',
      body: JSON.stringify({
        source,
        sourceType,
        config: { query },
        options: { max_rows: maxRows, offset: 0, columns: null },
      }),
    }
  );
}
