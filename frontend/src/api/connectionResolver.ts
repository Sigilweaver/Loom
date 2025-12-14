/**
 * Connection Resolution Utilities
 * 
 * Resolves database connection references in workflows before execution.
 * This ensures credentials are only passed to the backend at execution time,
 * never stored in workflow files.
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import type { Tool } from '../domain/workflow/entities/workflow';
import type { ResolvedConnection } from '../types/connections';

/**
 * Builds a connection URI from a resolved connection.
 * 
 * @param connection - The resolved connection with credentials
 * @returns Connection URI string
 */
function buildConnectionUri(connection: ResolvedConnection): string {
  // URL encode the password in case it contains special characters
  const encodedPassword = encodeURIComponent(connection.password);
  const encodedUsername = encodeURIComponent(connection.username);
  
  // Format: postgresql://user:password@host:port/database
  return `${connection.type}://${encodedUsername}:${encodedPassword}@${connection.host}:${connection.port}/${connection.database}`;
}

/**
 * Resolves all database connection references in a workflow.
 * 
 * For each tool with category="database", resolves the connectionId to a full
 * connection URI with embedded credentials. The resolved URI is stored in the
 * `source` field which the backend expects.
 * 
 * @param workflow - The workflow to resolve connections for
 * @returns A new workflow with resolved connections, or the original if no database tools
 */
export async function resolveWorkflowConnections(
  workflow: WorkflowJSON
): Promise<WorkflowJSON> {
  // Debug: log all tools to see their structure
  console.log('[ConnectionResolver] All tools:', workflow.tools.map((t: Tool) => ({
    id: t.id,
    type: t.type,
    configCategory: t.config?.category,
    configType: t.config?.type,
    connectionId: t.config?.connectionId,
  })));

  // Find all Input tools with database category
  const databaseTools = workflow.tools.filter(
    (tool: Tool) => 
      tool.type === 'Input' && 
      tool.config?.category === 'database' &&
      tool.config?.connectionId
  );

  console.log('[ConnectionResolver] Found database tools:', databaseTools.length);

  if (databaseTools.length === 0) {
    // No database connections to resolve
    return workflow;
  }

  // Check if Electron API is available
  if (!window.electronAPI?.resolveConnection) {
    // Not running in Electron - database connections require Electron for secure credential storage
    console.error('[ConnectionResolver] Electron API not available - database connections require the desktop app');
    throw new Error('Database connections require the desktop app. Please run Sigilweaver as a desktop application to use database features.');
  }

  // Resolve all connections in parallel
  const resolutions = await Promise.all(
    databaseTools.map(async (tool: Tool) => {
      const connectionId = tool.config?.connectionId as string;
      console.log('[ConnectionResolver] Resolving connection:', connectionId);
      try {
        const resolved = await window.electronAPI!.resolveConnection(connectionId);
        console.log('[ConnectionResolver] Resolved:', resolved ? 'success' : 'null');
        return { toolId: tool.id, resolved };
      } catch (error) {
        console.error(`[ConnectionResolver] Failed to resolve connection ${connectionId}:`, error);
        return { toolId: tool.id, resolved: null };
      }
    })
  );

  // Create a map of tool ID to resolved URI
  const resolutionMap = new Map<string, string>();
  for (const { toolId, resolved } of resolutions) {
    if (resolved) {
      const uri = buildConnectionUri(resolved);
      resolutionMap.set(toolId, uri);
    }
  }

  // If no connections were resolved, return original workflow
  if (resolutionMap.size === 0) {
    console.warn('No database connections could be resolved');
    return workflow;
  }

  // Create a new workflow with resolved URIs in the source field
  const resolvedWorkflow: WorkflowJSON = {
    ...workflow,
    tools: workflow.tools.map((tool: Tool) => {
      const resolvedUri = resolutionMap.get(tool.id);
      if (resolvedUri && tool.config) {
        return {
          ...tool,
          config: {
            ...tool.config,
            source: resolvedUri,
          },
        };
      }
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
