/**
 * Connection Resolution Utilities
 *
 * Resolves database connection references in workflows before execution.
 * This ensures credentials are only passed to the backend at execution time,
 * never stored in workflow files.
 *
 * Where the desktop shell owns the server (`capabilities.credentialProxy`),
 * client connections are NOT resolved here: the workflow carries a
 * `loom-connection://<id>` reference and `backendFetch` sends it through the
 * shell, which injects the credentials. Plaintext credentials then never
 * reach the renderer. Otherwise (Client build, dev, remote server) the
 * credentials are resolved here as before.
 *
 * Connection ownership:
 * - owner='client': Credentials stored locally, resolved here before sending to backend
 * - owner='hub': Credentials stored on Hub, resolved by Server during execution via Hub validation
 * - owner='server': DEPRECATED - use 'hub' instead
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import type { Tool } from '../domain/workflow/entities/workflow';
import type { ConnectionOwner, ResolvedConnection } from '../types/connections';
import { platform, hasSecureStorage } from '@platform';
import { buildConnectionUri, connectionRef } from '../platform/connectionUri';
import { useSettingsStore } from '../state/settingsStore';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConnectionResolver');

/**
 * Whether client connections should be sent as references for the shell to
 * expand. Not possible in Hub mode: those requests go to a remote server the
 * shell does not own, so it cannot (and must not) inject credentials there.
 */
function shouldProxyCredentials(): boolean {
  return (
    platform.capabilities.credentialProxy === true &&
    useSettingsStore.getState().executionMode !== 'hub'
  );
}

/**
 * Resolves a single client-managed connection to its URI and database type.
 *
 * Intended for ad-hoc lookups (e.g. AI schema introspection) where only a
 * connection id is known. Requires secure storage (desktop app) since the
 * credentials live in the local keychain.
 *
 * @param connectionId - The id of a client-owned connection
 * @returns The connection URI and database type
 * @throws If secure storage is unavailable or the connection cannot be resolved
 */
export async function resolveConnectionUri(
  connectionId: string
): Promise<{ uri: string; type: ResolvedConnection['type'] }> {
  if (!hasSecureStorage()) {
    throw new Error(
      'Database connections require the desktop app with secure storage.'
    );
  }

  if (shouldProxyCredentials()) {
    const info = await platform.credentials.get(connectionId);
    if (!info) {
      throw new Error(`Connection not found: "${connectionId}"`);
    }
    return { uri: connectionRef(connectionId), type: info.type };
  }

  const resolved = await platform.credentials.resolve(connectionId);
  if (!resolved) {
    throw new Error(`Connection not found: "${connectionId}"`);
  }

  return { uri: buildConnectionUri(resolved), type: resolved.type };
}

/**
 * Resolves all database connection references in a workflow.
 *
 * For client-owned connections (owner='client'), resolves the connectionId to a full
 * connection URI with embedded credentials. The resolved URI is stored in the
 * `source` field which the backend expects.
 *
 * For server-owned connections (owner='server'), passes the connectionId through
 * without resolving - the backend will resolve these during execution.
 *
 * @param workflow - The workflow to resolve connections for
 * @returns A new workflow with resolved connections, or the original if no database tools
 */
export async function resolveWorkflowConnections(
  workflow: WorkflowJSON
): Promise<WorkflowJSON> {
  // Debug: log all tools to see their structure
  logger.debug('All tools:', workflow.tools.map((t: Tool) => ({
    id: t.id,
    type: t.type,
    configCategory: t.config?.category,
    configType: t.config?.type,
    connectionId: t.config?.connectionId,
    owner: t.config?.owner,
  })));

  // Find all Input tools with database category
  const databaseTools = workflow.tools.filter(
    (tool: Tool) =>
      tool.type === 'Input' &&
      tool.config?.category === 'database' &&
      tool.config?.connectionId
  );

  logger.debug('Found database tools:', databaseTools.length);

  if (databaseTools.length === 0) {
    // No database connections to resolve
    return workflow;
  }

  // Separate by ownership: client (local), hub (Hub-managed), server (deprecated)
  const clientTools = databaseTools.filter(
    (tool: Tool) => {
      const owner = tool.config?.owner as ConnectionOwner | undefined;
      return !owner || owner === 'client';
    }
  );
  const hubTools = databaseTools.filter(
    (tool: Tool) => (tool.config?.owner as ConnectionOwner) === 'hub'
  );
  const serverTools = databaseTools.filter(
    (tool: Tool) => (tool.config?.owner as ConnectionOwner) === 'server'
  );

  logger.debug('Client-owned connections:', clientTools.length);
  logger.debug('Hub-owned connections:', hubTools.length);
  logger.debug('Server-owned connections (deprecated):', serverTools.length);

  // For client-owned connections, we need secure storage
  if (clientTools.length > 0 && !hasSecureStorage()) {
    logger.error('Secure storage not available - client connections require the desktop app');
    throw new Error('Client database connections require the desktop app. Please run Sigilweaver Loom as a desktop application to use client-managed database features.');
  }

  const proxied = shouldProxyCredentials();
  if (clientTools.length > 0 && platform.capabilities.credentialProxy && !proxied) {
    // The shell refuses to hand credentials to the renderer and cannot inject
    // them into requests for a remote server.
    throw new Error('Client-owned database connections cannot be used when executing through Hub. Use a Hub-managed connection instead.');
  }

  // Resolve client-owned connections
  const resolutions = await Promise.all(
    clientTools.map(async (tool: Tool) => {
      const connectionId = tool.config?.connectionId as string;
      logger.debug('Resolving client connection:', connectionId);
      try {
        if (proxied) {
          // Only confirm the connection exists; the shell injects the
          // credentials when the request is sent (see backendFetch).
          const info = await platform.credentials.get(connectionId);
          logger.debug('Reference:', info ? 'success' : 'null');
          return { toolId: tool.id, uri: info ? connectionRef(connectionId) : null };
        }
        const resolved = await platform.credentials.resolve(connectionId);
        logger.debug('Resolved:', resolved ? 'success' : 'null');
        return { toolId: tool.id, uri: resolved ? buildConnectionUri(resolved) : null };
      } catch (error) {
        logger.error(`Failed to resolve connection ${connectionId}:`, error);
        return { toolId: tool.id, uri: null };
      }
    })
  );

  // Create a map of tool ID to resolved URI (for client connections only)
  const resolutionMap = new Map<string, string>();
  for (const { toolId, uri } of resolutions) {
    if (uri) {
      resolutionMap.set(toolId, uri);
    }
  }

  // Check if any client connections failed to resolve
  const failedClientCount = clientTools.length - resolutionMap.size;
  if (failedClientCount > 0) {
    logger.warn(`${failedClientCount} client connections could not be resolved`);
  }

  // Create a new workflow with:
  // - Client connections: resolved URI in source field, owner='client'
  // - Hub connections: pass through unchanged with owner='hub' (Server resolves via Hub)
  // - Server connections (deprecated): pass connectionId through, owner='server'
  const resolvedWorkflow: WorkflowJSON = {
    ...workflow,
    tools: workflow.tools.map((tool: Tool) => {
      // Skip non-database tools
      if (tool.type !== 'Input' || tool.config?.category !== 'database') {
        return tool;
      }

      const owner = (tool.config?.owner as ConnectionOwner) || 'client';

      if (owner === 'hub') {
        // Hub-owned: pass through unchanged
        // Server will validate with Hub and get credentials just-in-time
        logger.debug(`Tool ${tool.id}: hub-owned, passing to server for Hub validation`);
        return {
          ...tool,
          config: {
            ...tool.config,
            owner: 'hub',
            // connectionId stays as-is, no source - Hub provides credentials
          },
        };
      }

      if (owner === 'server') {
        // Server-owned (deprecated): pass connectionId and owner, no source
        // Backend will resolve during execution
        logger.debug(`Tool ${tool.id}: server-owned (deprecated), passing connectionId to backend`);
        return {
          ...tool,
          config: {
            ...tool.config,
            owner: 'server',
            // Explicitly don't set source - backend will resolve
          },
        };
      }

      // Client-owned: set resolved URI in source field
      const resolvedUri = resolutionMap.get(tool.id);
      if (resolvedUri) {
        logger.debug(`Tool ${tool.id}: client-owned, resolved to URI`);
        return {
          ...tool,
          config: {
            ...tool.config,
            owner: 'client',
            source: resolvedUri,
          },
        };
      }

      // Client connection but failed to resolve - pass through unchanged
      logger.warn(`Tool ${tool.id}: client-owned but failed to resolve`);
      return tool;
    }),
  };

  return resolvedWorkflow;
}

/**
 * Checks if a workflow contains any database connection tools.
 *
 * @param workflow - The workflow to check
 * @returns True if the workflow has database tools
 */
export function hasDatabaseConnections(workflow: WorkflowJSON): boolean {
  return workflow.tools.some(
    (tool: Tool) =>
      tool.type === 'Input' &&
      tool.config?.category === 'database'
  );
}

/**
 * Gets all connection IDs used in a workflow.
 *
 * @param workflow - The workflow to inspect
 * @returns Array of connection IDs
 */
export function getWorkflowConnectionIds(workflow: WorkflowJSON): string[] {
  return workflow.tools
    .filter(
      (tool: Tool) =>
        tool.type === 'Input' &&
        tool.config?.category === 'database' &&
        tool.config?.connectionId
    )
    .map((tool: Tool) => tool.config!.connectionId as string);
}

/**
 * Gets connection IDs by owner type.
 *
 * @param workflow - The workflow to inspect
 * @param owner - The owner type to filter by
 * @returns Array of connection IDs
 */
export function getWorkflowConnectionIdsByOwner(
  workflow: WorkflowJSON,
  owner: ConnectionOwner
): string[] {
  return workflow.tools
    .filter(
      (tool: Tool) =>
        tool.type === 'Input' &&
        tool.config?.category === 'database' &&
        tool.config?.connectionId &&
        (tool.config?.owner || 'client') === owner
    )
    .map((tool: Tool) => tool.config!.connectionId as string);
}
