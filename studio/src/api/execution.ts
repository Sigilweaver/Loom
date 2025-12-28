/**
 * Transparent Execution Layer
 *
 * Provides Hub-aware execution functions with the same signatures as backend.ts.
 * When in Hub mode, requests go through Hub to get Server Tokens first.
 * When in bundled/external mode, requests go directly to the backend.
 *
 * This is the primary API for all workflow execution. Import from '@api' not '@api/backend'.
 *
 * Credential Flow (Hub mode):
 * 1. Studio calls execution function
 * 2. This layer gets Server Token from Hub (requestPreviewToken/requestExecuteToken)
 * 3. Calls Server endpoint with Server Token in Authorization header
 * 4. Server validates token with Hub, Hub returns credentials just-in-time
 * 5. Server executes and returns result
 */

import { createLogger } from '../utils/logger';
import { useSettingsStore } from '../state/settingsStore';
import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import * as backend from './backend';
import { getHubClient, hasHubClient, type ServerToken } from './hub';

const logger = createLogger('ExecutionService');

// =============================================================================
// Server Token Management
// =============================================================================

// Note: Server tokens are NOT cached because:
// 1. Each token is single-use (Hub tracks JTI to prevent replay)
// 2. Tokens are bound to a specific workflow hash
// 3. Any workflow change invalidates the token

/**
 * Clear any server token state (kept for API compatibility)
 */
export function clearServerToken(): void {
  // No-op: tokens are not cached
}

/**
 * Request a server token for the workflow
 */
async function getServerToken(workflow: WorkflowJSON): Promise<ServerToken> {
  if (!hasHubClient()) {
    throw new Error('Not connected to Hub. Please login.');
  }

  // Always request a fresh token since they're single-use and workflow-bound
  const hubClient = getHubClient();
  const serverToken = await hubClient.requestPreviewToken(workflow);

  logger.debug(`Got server token, expires in ${serverToken.expires_in}s`);
  return serverToken;
}

// =============================================================================
// Hub Execution Helper
// =============================================================================

/**
 * Execute a request through Hub's token flow
 *
 * @param workflow - Workflow for token request scope
 * @param endpoint - API endpoint path (e.g., '/api/workflow/tool/execute')
 * @param body - Request body
 * @returns Response from server
 */
async function executeViaHub<T>(
  workflow: WorkflowJSON,
  endpoint: string,
  body: unknown
): Promise<T> {
  const serverToken = await getServerToken(workflow);

  const response = await fetch(`${serverToken.server_endpoint}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serverToken.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `Server error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // Use status text if not JSON
    }

    // If 401/403, clear the cached token so next request gets a fresh one
    if (response.status === 401 || response.status === 403) {
      clearServerToken();
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Check if we're in Hub mode
 */
function isHubMode(): boolean {
  const { executionMode } = useSettingsStore.getState();
  return executionMode === 'hub';
}

// =============================================================================
// Transparent Execution Functions
// =============================================================================

/**
 * Get the data schema for a tool's output socket
 *
 * Same signature as backend.getToolSchema - Hub routing is handled internally.
 *
 * @param toolId - The ID of the tool
 * @param workflow - The complete workflow definition
 * @param socketId - The socket ID to get schema for
 * @param context - Optional request context for logging
 * @returns Schema information for the specified socket
 */
export async function getToolSchema(
  toolId: string,
  workflow: WorkflowJSON,
  socketId: string,
  context?: backend.RequestContext
): Promise<backend.SchemaResponse> {
  if (isHubMode()) {
    return executeViaHub(workflow, '/api/workflow/tool/schema', {
      tool_id: toolId,
      workflow,
      socket_id: socketId,
    });
  }

  return backend.getToolSchema(toolId, workflow, socketId, context);
}

/**
 * Execute a single tool with dependencies and return preview data
 *
 * Same signature as backend.previewTool - Hub routing is handled internally.
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
  context?: backend.RequestContext
): Promise<backend.ExecuteResponse> {
  if (isHubMode()) {
    return executeViaHub(workflow, '/api/workflow/tool/execute', {
      tool_id: toolId,
      workflow,
      socket_id: socketId,
      preview_limit: previewLimit,
      force_refresh: forceRefresh,
    });
  }

  return backend.previewTool(toolId, workflow, socketId, previewLimit, forceRefresh, context);
}

/**
 * Execute a complete workflow
 *
 * Same signature as backend.executeWorkflow - Hub routing is handled internally.
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
  context?: backend.RequestContext
): Promise<backend.WorkflowExecuteResponse> {
  if (isHubMode()) {
    // For full execution, we might want a different token scope
    // For now, use the same preview token endpoint
    return executeViaHub(workflow, '/api/workflow/execute', {
      workflow,
      target_tool_id: targetToolId,
      force_refresh: forceRefresh,
    });
  }

  return backend.executeWorkflow(workflow, targetToolId, forceRefresh, context);
}

/**
 * Profile columns for a tool's output
 *
 * Same signature as backend.profileColumns - Hub routing is handled internally.
 *
 * @param toolId - The ID of the tool
 * @param workflow - The complete workflow definition
 * @param socketId - The socket ID to profile
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
  metrics?: backend.ProfileMetric[],
  context?: backend.RequestContext
): Promise<backend.ProfileResponse> {
  if (isHubMode()) {
    return executeViaHub(workflow, '/api/workflow/tool/profile', {
      tool_id: toolId,
      workflow,
      socket_id: socketId,
      columns: columns ?? null,
      metrics: metrics ?? null,
    });
  }

  return backend.profileColumns(toolId, workflow, socketId, columns, metrics, context);
}

/**
 * Preview all tools in a workflow at once
 *
 * Same signature as backend.previewAllTools - Hub routing is handled internally.
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
  context?: backend.RequestContext
): Promise<backend.PreviewAllResponse> {
  if (isHubMode()) {
    return executeViaHub(workflow, '/api/workflow/preview_all', {
      workflow,
      preview_limit: previewLimit,
      force_refresh: forceRefresh,
    });
  }

  return backend.previewAllTools(workflow, previewLimit, forceRefresh, context);
}

// =============================================================================
// Hub Session Utilities
// =============================================================================

/**
 * Check if we need to prompt for Hub login
 */
export function needsHubLogin(): boolean {
  if (!isHubMode()) return false;
  return !hasHubClient();
}

/**
 * Check if Hub session is valid
 */
export async function isHubSessionValid(): Promise<boolean> {
  if (!hasHubClient()) return false;

  try {
    await getHubClient().getCurrentUser();
    return true;
  } catch {
    return false;
  }
}
