/**
 * Connection Resolution Utilities
 *
 * Prepares database connection references in workflows before execution.
 * Credentials are never stored in workflow files, and the renderer never
 * holds them either.
 *
 * Connection ownership:
 * - owner='client': Credentials live in the OS keychain, owned by the desktop
 *   shell. The workflow carries a `loom-connection://<id>` reference and
 *   `backendFetch` sends the request through the shell, which swaps the
 *   reference for the real connection URI and forwards it to a Server on this
 *   computer (see `tauri/src/commands/proxy.rs`). There is no way for the
 *   renderer to read a stored password.
 * - owner='hub': Credentials stored on Hub, resolved by Server during execution via Hub validation
 * - owner='server': DEPRECATED - use 'hub' instead
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import type { Tool } from '../domain/workflow/entities/workflow';
import type { ConnectionOwner, DatabaseType } from '../types/connections';
import { platform, hasSecureStorage } from '@platform';
import { connectionRef } from '../platform/connectionUri';
import { useSettingsStore } from '../state/settingsStore';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConnectionResolver');

const DESKTOP_REQUIRED =
  'Client database connections require the desktop app. Please run Sigilweaver Loom as a desktop application to use client-managed database features.';

const HUB_MODE_REFUSED =
  'Client-owned database connections cannot be used when executing through Hub. Use a Hub-managed connection instead.';

/**
 * Throws unless client-owned connections can be used right now: the desktop
 * shell must hold them (secure storage plus the credential proxy), and the
 * request must not be headed for a Hub-chosen Server, which the shell will
 * not send local credentials to.
 */
function assertClientConnectionsUsable(): void {
  if (!hasSecureStorage() || !platform.capabilities.credentialProxy) {
    throw new Error(DESKTOP_REQUIRED);
  }
  if (useSettingsStore.getState().executionMode === 'hub') {
    throw new Error(HUB_MODE_REFUSED);
  }
}

/**
 * Resolves a single client-managed connection to a connection reference and
 * its database type.
 *
 * Intended for ad-hoc lookups (e.g. AI schema introspection) where only a
 * connection id is known. The returned `uri` is a `loom-connection://<id>`
 * reference: send it with `backendFetch` so the shell injects the
 * credentials.
 *
 * @param connectionId - The id of a client-owned connection
 * @returns The connection reference and database type
 * @throws If client connections are unavailable or the connection does not exist
 */
export async function resolveConnectionUri(
  connectionId: string
): Promise<{ uri: string; type: DatabaseType }> {
  assertClientConnectionsUsable();

  const info = await platform.credentials.get(connectionId);
  if (!info) {
    throw new Error(`Connection not found: "${connectionId}"`);
  }
  return { uri: connectionRef(connectionId), type: info.type };
}

/**
 * Resolves all database connection references in a workflow.
 *
 * For client-owned connections (owner='client'), puts a connection reference
 * (`loom-connection://<id>`) in the `source` field. The desktop shell swaps it
 * for the real connection URI when the request is sent (see `backendFetch`).
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

  if (clientTools.length > 0) {
    try {
      assertClientConnectionsUsable();
    } catch (error) {
      logger.error('Client connections are not usable here');
      throw error;
    }
  }

  // Confirm each client connection exists; the shell injects the credentials
  // when the request is sent.
  const resolutions = await Promise.all(
    clientTools.map(async (tool: Tool) => {
      const connectionId = tool.config?.connectionId as string;
      logger.debug('Resolving client connection:', connectionId);
      try {
        const info = await platform.credentials.get(connectionId);
        logger.debug('Reference:', info ? 'success' : 'null');
        return { toolId: tool.id, uri: info ? connectionRef(connectionId) : null };
      } catch {
        // Native errors are not logged verbatim: keep connection details out
        // of the log. The tool is reported as unresolved below.
        logger.error(`Failed to look up connection ${connectionId}`);
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

      // Client-owned: set the connection reference in the source field
      const resolvedUri = resolutionMap.get(tool.id);
      if (resolvedUri) {
        logger.debug(`Tool ${tool.id}: client-owned, resolved to a reference`);
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
