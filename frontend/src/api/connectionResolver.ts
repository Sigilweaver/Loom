/**
 * Connection Resolution Utilities
 * 
 * Resolves database connection references in workflows before execution.
 * This ensures credentials are only passed to the backend at execution time,
 * never stored in workflow files.
 * 
 * Connection ownership:
 * - owner='client': Credentials stored locally, resolved here before sending to backend
 * - owner='server': Credentials stored on backend, resolved by executor during execution
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import type { Tool } from '../domain/workflow/entities/workflow';
import type { ConnectionOwner, ResolvedConnection } from '../types/connections';
import { platform, hasSecureStorage } from '@platform';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConnectionResolver');

/**
 * Builds a connection URI from a resolved connection.
 * 
 * URI formats by database type:
 * - PostgreSQL: postgresql://user:password@host:port/database
 * - MySQL: mysql://user:password@host:port/database
 * - SQLite: sqlite:///path/to/database.db (no credentials)
 * - SQL Server: mssql://user:password@host:port/database?encrypt=true&trust_server_certificate=true
 * 
 * @param connection - The resolved connection with credentials
 * @returns Connection URI string
 */
function buildConnectionUri(connection: ResolvedConnection): string {
  // URL encode the password and username in case they contain special characters
  const encodedPassword = encodeURIComponent(connection.password);
  const encodedUsername = encodeURIComponent(connection.username);
  
  switch (connection.type) {
    case 'sqlite': {
      // SQLite uses file path, no credentials needed
      // The 'database' field contains the file path
      const encodedPath = encodeURIComponent(connection.database).replace(/%2F/g, '/');
      return `sqlite://${encodedPath}`;
    }
    
    case 'mssql':
      // SQL Server requires specific parameters for secure connections
      // encrypt=true: Use TLS encryption
      // trust_server_certificate=true: Accept self-signed certs (common in dev)
      return `mssql://${encodedUsername}:${encodedPassword}@${connection.host}:${connection.port}/${connection.database}?encrypt=true&trust_server_certificate=true`;
    
    default:
      // PostgreSQL and MySQL use standard format
      return `${connection.type}://${encodedUsername}:${encodedPassword}@${connection.host}:${connection.port}/${connection.database}`;
  }
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

  // Separate client-owned and server-owned connections
  const clientTools = databaseTools.filter(
    (tool: Tool) => (tool.config?.owner as ConnectionOwner) !== 'server'
  );
  const serverTools = databaseTools.filter(
    (tool: Tool) => (tool.config?.owner as ConnectionOwner) === 'server'
  );

  logger.debug('Client-owned connections:', clientTools.length);
  logger.debug('Server-owned connections:', serverTools.length);

  // For client-owned connections, we need secure storage
  if (clientTools.length > 0 && !hasSecureStorage()) {
    logger.error('Secure storage not available - client connections require the desktop app');
    throw new Error('Client database connections require the desktop app. Please run Sigilweaver as a desktop application to use client-managed database features.');
  }

  // Resolve client-owned connections
  const resolutions = await Promise.all(
    clientTools.map(async (tool: Tool) => {
      const connectionId = tool.config?.connectionId as string;
      logger.debug('Resolving client connection:', connectionId);
      try {
        const resolved = await platform.credentials.resolve(connectionId);
        logger.debug('Resolved:', resolved ? 'success' : 'null');
        return { toolId: tool.id, resolved };
      } catch (error) {
        logger.error(`Failed to resolve connection ${connectionId}:`, error);
        return { toolId: tool.id, resolved: null };
      }
    })
  );

  // Create a map of tool ID to resolved URI (for client connections only)
  const resolutionMap = new Map<string, string>();
  for (const { toolId, resolved } of resolutions) {
    if (resolved) {
      const uri = buildConnectionUri(resolved);
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
  // - Server connections: connectionId passed through, owner='server' (no source)
  const resolvedWorkflow: WorkflowJSON = {
    ...workflow,
    tools: workflow.tools.map((tool: Tool) => {
      // Skip non-database tools
      if (tool.type !== 'Input' || tool.config?.category !== 'database') {
        return tool;
      }

      const owner = (tool.config?.owner as ConnectionOwner) || 'client';
      
      if (owner === 'server') {
        // Server-owned: pass connectionId and owner, no source
        // Backend will resolve during execution
        logger.debug(`Tool ${tool.id}: server-owned, passing connectionId to backend`);
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
