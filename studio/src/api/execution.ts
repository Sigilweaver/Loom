/**
 * Execution Service
 *
 * Provides a unified interface for workflow execution across different modes:
 * - bundled: Direct connection to local bundled server
 * - external: Direct connection to external server
 * - hub: Connection through Hub with server token acquisition
 *
 * This service abstracts the execution mode complexity from the rest of the app.
 */

import { createLogger } from '../utils/logger';
import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import type { ExecutionMode } from '../types/settings';
import * as backend from './backend';
import { getHubClient, hasHubClient, type ServerToken } from './hub';

const logger = createLogger('ExecutionService');

/**
 * Execution context containing the token and endpoint for a request
 */
interface ExecutionContext {
  /** Authorization token to send to the server */
  token: string | null;
  /** Server endpoint URL */
  endpoint: string;
  /** Whether the context is valid for execution */
  valid: boolean;
  /** Error message if not valid */
  error?: string;
}

/**
 * Cached server token for hub mode
 */
let cachedServerToken: ServerToken | null = null;
let tokenExpiresAt: number = 0;

/**
 * Check if the cached token is still valid (with 30s buffer)
 */
function isTokenValid(): boolean {
  if (!cachedServerToken) return false;
  const now = Date.now();
  const bufferMs = 30 * 1000; // 30 second buffer
  return now < tokenExpiresAt - bufferMs;
}

/**
 * Clear the cached server token
 */
export function clearServerToken(): void {
  cachedServerToken = null;
  tokenExpiresAt = 0;
}

/**
 * Get execution context for the current mode
 *
 * @param mode - Current execution mode
 * @param workflow - Workflow to execute (needed for hub mode token request)
 * @param backendUrl - Backend URL (for bundled/external modes)
 * @returns Execution context with token and endpoint
 */
export async function getExecutionContext(
  mode: ExecutionMode,
  workflow: WorkflowJSON | null,
  backendUrl: string
): Promise<ExecutionContext> {
  switch (mode) {
    case 'bundled':
    case 'external':
      // Direct connection - use session token if available
      return {
        token: backend.getSessionToken(),
        endpoint: backendUrl,
        valid: true,
      };

    case 'hub':
      return await getHubExecutionContext(workflow);

    default:
      return {
        token: null,
        endpoint: backendUrl,
        valid: false,
        error: `Unknown execution mode: ${mode}`,
      };
  }
}

/**
 * Get execution context for hub mode
 */
async function getHubExecutionContext(
  workflow: WorkflowJSON | null
): Promise<ExecutionContext> {
  if (!hasHubClient()) {
    return {
      token: null,
      endpoint: '',
      valid: false,
      error: 'Not connected to Hub. Please login.',
    };
  }

  if (!workflow) {
    return {
      token: null,
      endpoint: '',
      valid: false,
      error: 'Workflow required for Hub execution',
    };
  }

  // Check if we have a valid cached token
  if (isTokenValid() && cachedServerToken) {
    logger.debug('Using cached server token');
    return {
      token: cachedServerToken.token,
      endpoint: cachedServerToken.server_endpoint,
      valid: true,
    };
  }

  // Request new token from Hub
  try {
    const hubClient = getHubClient();
    const serverToken = await hubClient.requestExecuteToken(workflow);

    // Cache the token
    cachedServerToken = serverToken;
    tokenExpiresAt = Date.now() + serverToken.expires_in * 1000;

    logger.info(`Got new server token, expires in ${serverToken.expires_in}s`);

    return {
      token: serverToken.token,
      endpoint: serverToken.server_endpoint,
      valid: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get server token: ${message}`);

    return {
      token: null,
      endpoint: '',
      valid: false,
      error: `Failed to get server token: ${message}`,
    };
  }
}

/**
 * Execute a workflow in the current execution mode
 *
 * This is a high-level wrapper that:
 * 1. Gets the appropriate execution context
 * 2. Sets the session token for the backend
 * 3. Calls the backend execute function
 *
 * @param mode - Current execution mode
 * @param workflow - Workflow to execute
 * @param backendUrl - Backend URL (for bundled/external modes)
 * @param targetToolId - Optional tool to execute up to
 */
export async function executeWorkflow(
  mode: ExecutionMode,
  workflow: WorkflowJSON,
  backendUrl: string,
  targetToolId?: string
): Promise<backend.WorkflowExecuteResponse> {
  const context = await getExecutionContext(mode, workflow, backendUrl);

  if (!context.valid) {
    throw new Error(context.error || 'Invalid execution context');
  }

  // Set the token for this request
  backend.setSessionToken(context.token);

  // For hub mode, we need to use the server endpoint from the token
  // This requires temporarily changing the API base URL
  // For now, we rely on the backend module's API_BASE which is set at startup
  // TODO: Support dynamic endpoint switching for hub mode

  return backend.executeWorkflow(workflow, targetToolId);
}

/**
 * Check if we need to prompt for Hub login
 */
export function needsHubLogin(mode: ExecutionMode): boolean {
  if (mode !== 'hub') return false;
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
