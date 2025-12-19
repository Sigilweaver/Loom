/**
 * Server Connections API
 * 
 * Client for fetching server-managed database connections from the backend.
 * Server connections have owner='server' and credentials stored on the backend.
 */

import type { ConnectionInfo, DatabaseType } from '../types/connections';
import { createLogger } from '../utils/logger';

const logger = createLogger('ServerConnections');

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * Session token for backend authentication.
 */
let sessionToken: string | null = null;

/**
 * Initialize the session token (call once on app startup).
 */
export async function initializeServerConnectionsAuth(): Promise<void> {
  // Try Electron IPC first (desktop mode)
  if (window.electronAPI?.getSessionToken) {
    sessionToken = await window.electronAPI.getSessionToken();
    if (sessionToken) {
      return;
    }
  }
  
  // Fallback to localStorage (browser mode)
  const storedToken = localStorage.getItem('sigilweaver-api-token');
  if (storedToken) {
    sessionToken = storedToken;
  }
}

/**
 * Set the session token manually.
 */
export function setServerConnectionsToken(token: string | null): void {
  sessionToken = token;
}

/**
 * Server connection store status
 */
export interface ConnectionStoreStatus {
  enabled: boolean;
  connectionCount: number;
}

/**
 * Get the status of the server connection store.
 */
export async function getConnectionStoreStatus(): Promise<ConnectionStoreStatus> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(`${API_BASE}/connections/status`, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to get connection store status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch all server-managed connections.
 * 
 * Returns connections with owner='server'. These connections have
 * credentials managed by the backend - client should not try to
 * resolve them locally.
 */
export async function listServerConnections(): Promise<ConnectionInfo[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(`${API_BASE}/connections/`, { headers });
  
  if (!response.ok) {
    if (response.status === 503) {
      // Server connections not enabled - return empty list
      logger.info('Server connection store not enabled');
      return [];
    }
    throw new Error(`Failed to list server connections: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Ensure all connections have owner='server'
  return data.map((conn: ConnectionInfo) => ({
    ...conn,
    owner: 'server' as const,
  }));
}

/**
 * Fetch server connections filtered by database type.
 */
export async function listServerConnectionsByType(type: DatabaseType): Promise<ConnectionInfo[]> {
  const all = await listServerConnections();
  return all.filter(c => c.type === type);
}

/**
 * Check if a connection ID belongs to a server-managed connection.
 */
export async function isServerConnection(connectionId: string): Promise<boolean> {
  const serverConnections = await listServerConnections();
  return serverConnections.some(c => c.id === connectionId);
}
