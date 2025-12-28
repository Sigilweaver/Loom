/**
 * Database Connection Types
 * 
 * Type definitions for secure credential storage and database connections.
 * Credentials are stored encrypted via Electron's safeStorage API (client)
 * or Fernet encryption (server).
 */

/**
 * Supported database types
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mssql';

/**
 * Who manages the connection credentials
 * - 'client': Credentials stored in Electron (desktop app)
 * - 'hub': Credentials managed by Hub (resolved by Server via Hub validation)
 * - 'server': DEPRECATED - Use 'hub' instead
 */
export type ConnectionOwner = 'client' | 'hub' | 'server';

/**
 * Connection credentials (sensitive - never stored in plaintext)
 */
export interface ConnectionCredentials {
  username: string;
  password: string;
}

/**
 * Non-sensitive connection metadata (safe to display in UI)
 */
export interface ConnectionInfo {
  id: string;
  name: string;
  type: DatabaseType;
  /** Who manages this connection's credentials */
  owner: ConnectionOwner;
  host: string;
  port: number;
  database: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full connection with decrypted credentials (only used when connecting)
 * This is what gets sent to the backend for actual database queries.
 */
export interface ResolvedConnection extends ConnectionInfo {
  username: string;
  password: string;
}

/**
 * Input for creating a new connection
 */
export interface CreateConnectionInput {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/**
 * Input for updating an existing connection
 * Credentials are optional - only provided if user wants to change them
 */
export interface UpdateConnectionInput {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/**
 * Default ports for database types
 */
export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  postgresql: 5432,
  mysql: 3306,
  sqlite: 0, // SQLite doesn't use ports
  mssql: 1433,
};

/**
 * Human-readable names for database types
 */
export const DATABASE_TYPE_NAMES: Record<DatabaseType, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  mssql: 'SQL Server',
};
