/**
 * Hub API Client
 *
 * Connects to the Sigilweaver Hub for centralized workflow management,
 * server token acquisition, and connection access.
 *
 * Hub is the orchestration layer that:
 * - Authenticates users
 * - Issues server tokens for server operations
 * - Manages server-side connections
 * - Tracks workflow execution history
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('HubAPI');

/**
 * Hub connection configuration
 */
export interface HubConfig {
  /** Hub server URL */
  url: string;
  /** User's session token for Hub authentication */
  sessionToken: string | null;
}

/**
 * Server token response from Hub
 */
export interface ServerToken {
  /** JWT token to send to Server */
  token: string;
  /** Server endpoint URL to send the request to */
  server_endpoint: string;
  /** Seconds until token expires */
  expires_in: number;
}

/**
 * Hub connection types
 */
export type HubConnectionType = 'database' | 'filesystem';
export type HubDatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
export type HubPathType = 'local' | 'unc';
export type HubConnectionStatus = 'healthy' | 'unhealthy' | 'error' | 'unknown';

/**
 * Database-specific config (present when type='database')
 */
export interface HubDatabaseConfig {
  db_type: HubDatabaseType;
  host: string;
  port: number;
  database: string;
}

/**
 * Filesystem-specific config (present when type='filesystem')
 */
export interface HubFilesystemConfig {
  path: string;
  path_type: HubPathType;
}

/**
 * Hub connection info (credential-free metadata)
 */
export interface HubConnectionInfo {
  id: string;
  name: string;
  type: HubConnectionType;
  description: string | null;
  read_only: boolean;
  status: HubConnectionStatus;
  last_checked: string | null;
  last_healthy: string | null;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Type-specific configs (only one will be present)
  database_config?: HubDatabaseConfig;
  filesystem_config?: HubFilesystemConfig;
}

/**
 * Server info from Hub
 */
export interface HubServerInfo {
  id: string;
  name: string;
  endpoint: string;
  healthy: boolean;
  load: number;
}

/**
 * Custom error for Hub API errors
 */
export class HubError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string
  ) {
    super(message);
    this.name = 'HubError';
  }
}

/**
 * Hub API Client
 *
 * Provides methods for interacting with the Hub orchestration platform.
 */
export class HubClient {
  private url: string;
  private sessionToken: string | null;

  constructor(config: HubConfig) {
    this.url = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.sessionToken = config.sessionToken;
  }

  /**
   * Update the session token (e.g., after login or token refresh)
   */
  setSessionToken(token: string | null): void {
    this.sessionToken = token;
  }

  /**
   * Make an authenticated request to Hub
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.url}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    } else {
      console.warn('[HubClient] No session token - request will be unauthenticated:', endpoint);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Use status text if response isn't JSON
        }

        // Handle specific status codes
        if (response.status === 401) {
          logger.warn('Hub session expired or invalid');
        }

        throw new HubError(errorMessage, response.status);
      }

      // Some endpoints may return 204 No Content (e.g., logout).
      if (response.status === 204) {
        return undefined as T;
      }

      // If the response has an empty body, treat it as undefined.
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        return undefined as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HubError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new HubError(`Failed to connect to Hub: ${message}`, 0);
    }
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Login to Hub with username and password
   */
  async login(username: string, password: string): Promise<{ token: string; user: { id: string; username: string; role: string } }> {
    const response = await this.request<{
      access_token: string;
      token_type: string;
      user: { id: string; username: string; role: string };
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    this.sessionToken = response.access_token;

    return {
      token: response.access_token,
      user: response.user,
    };
  }

  /**
   * Logout from Hub
   */
  async logout(): Promise<void> {
    try {
      await this.request('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      this.sessionToken = null;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<{ id: string; username: string; role: string }> {
    return this.request('/api/v1/auth/me');
  }

  // ===========================================================================
  // Capabilities (Server Token Acquisition)
  // ===========================================================================

  /**
   * Request a server token for any operation
   *
   * This is the unified method for getting authorization to interact
   * with a Server. The returned token is opaque - all metadata is stored
   * server-side in Hub.
   *
   * @param serverId - ID of the server to target (optional, Hub picks if not specified)
   * @returns Server token with endpoint and expiration
   */
  async requestToken(serverId?: string): Promise<ServerToken> {
    logger.info('Requesting server token from Hub');

    const body = serverId ? { server_id: serverId } : {};
    const response = await this.request<ServerToken>('/api/v1/capabilities/token', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    logger.info(`Got server token for ${response.server_endpoint}, expires in ${response.expires_in}s`);

    return response;
  }

  /**
   * List connections the current user has access to
   */
  async listConnections(): Promise<HubConnectionInfo[]> {
    const response = await this.request<{ connections: HubConnectionInfo[]; total: number }>('/api/v1/connections');
    return response.connections;
  }

  /**
   * Get a specific connection by ID
   */
  async getConnection(id: string): Promise<HubConnectionInfo> {
    return this.request(`/api/v1/connections/${id}`);
  }

  // ===========================================================================
  // Servers
  // ===========================================================================

  /**
   * List available servers
   */
  async listServers(): Promise<HubServerInfo[]> {
    const response = await this.request<{ servers: HubServerInfo[]; total: number }>('/api/v1/servers');
    return response.servers;
  }

  /**
   * Get a specific server by ID
   */
  async getServer(id: string): Promise<HubServerInfo> {
    return this.request(`/api/v1/servers/${id}`);
  }

  // ===========================================================================
  // Health
  // ===========================================================================

  /**
   * Check if Hub is reachable and healthy
   */
  async healthCheck(): Promise<{ status: string }> {
    return this.request('/api/v1/health');
  }
}

// =============================================================================
// Singleton Management
// =============================================================================

let hubClient: HubClient | null = null;

/**
 * Initialize the Hub client with configuration
 */
export function initHubClient(config: HubConfig): HubClient {
  hubClient = new HubClient(config);
  return hubClient;
}

/**
 * Get the Hub client instance
 * @throws Error if Hub client is not initialized
 */
export function getHubClient(): HubClient {
  if (!hubClient) {
    throw new Error('Hub client not initialized. Call initHubClient first.');
  }
  return hubClient;
}

/**
 * Check if Hub client is initialized
 */
export function hasHubClient(): boolean {
  return hubClient !== null;
}

/**
 * Clear the Hub client (e.g., on logout)
 */
export function clearHubClient(): void {
  hubClient = null;
}
