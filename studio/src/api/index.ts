/**
 * API Barrel Export
 *
 * This is the primary entry point for the API layer.
 *
 * Execution functions (previewTool, getToolSchema, etc.) are Hub-aware:
 * - In bundled/external mode: calls go directly to the server
 * - In hub mode: calls go through Hub to get Server Tokens first
 *
 * Import from '@api' for execution functions, not '@api/backend'.
 *
 * Example:
 *   import { previewTool, getToolSchema } from '@api';
 *   const result = await previewTool(toolId, workflow, socketId);
 */

// =============================================================================
// Hub-aware execution functions (primary API)
// =============================================================================

export {
  // Execution functions - same signatures as backend.ts but Hub-aware
  previewTool,
  getToolSchema,
  profileColumns,
  previewAllTools,
  executeWorkflow,

  // Token management
  clearServerToken,

  // Hub session utilities
  needsHubLogin,
  isHubSessionValid,
} from './execution';

// =============================================================================
// Types from backend (re-exported for convenience)
// =============================================================================

export type {
  // Response types
  SchemaResponse,
  ExecuteResponse,
  WorkflowExecuteResponse,
  PreviewAllResponse,
  ProfileResponse,
  MetadataResponse,
  PolarsFunctionsResponse,

  // Data types
  ColumnSchema,
  ColumnProfile,
  TopValueEntry,
  ProfileMetric,

  // Request context
  RequestContext,
} from './backend';

// Re-export WorkflowJSON from domain (not backend)
export type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';

// =============================================================================
// Non-execution functions (don't need Hub routing)
// =============================================================================

export {
  // These call the server directly regardless of mode
  getToolMetadata,
  getPolarsFunctions,
  previewCode,
  healthCheck,
  clearBackendWorkflowCache,
  closeWorkflowCacheOnBackend,
  closeWorkflowCachesBatchOnBackend,

  // Auth
  initializeAuth,
  getSessionToken,
  setSessionToken,

  // BackendError class
  BackendError,
} from './backend';

// =============================================================================
// Connection resolver
// =============================================================================

export {
  resolveWorkflowConnections,
  hasDatabaseConnections,
  getWorkflowConnectionIds,
  getWorkflowConnectionIdsByOwner,
} from './connectionResolver';

// =============================================================================
// Hub client (for login/logout only)
// =============================================================================

export {
  initHubClient,
  clearHubClient,
  hasHubClient,
  getHubClient,
  HubClient,
  HubError,
  type HubConfig,
  type ServerToken,
  type HubConnectionInfo,
  type HubServerInfo,
} from './hub';
