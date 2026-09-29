/** Data connections (database and filesystem). */

import { request, requestVoid } from "./http";

export type ConnectionType = "database" | "filesystem";
export type DatabaseType = "postgresql" | "mysql" | "sqlite" | "mssql";
export type PathType = "local" | "unc";
export type ConnectionStatus = "healthy" | "unhealthy" | "error" | "unknown";

// Type-specific configs (for response)
export interface DatabaseConfigResponse {
  db_type: DatabaseType;
  host: string;
  port: number;
  database: string;
}

export interface FilesystemConfigResponse {
  path: string;
  path_type: PathType;
}

// Connection response (database or filesystem)
export interface ConnectionResponse {
  id: string;
  name: string;
  type: ConnectionType;
  description: string | null;
  read_only: boolean;
  status: ConnectionStatus;
  last_checked: string | null;
  last_healthy: string | null;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Type-specific configs (only one will be present)
  database_config?: DatabaseConfigResponse;
  filesystem_config?: FilesystemConfigResponse;
}

export interface ConnectionsListResponse {
  connections: ConnectionResponse[];
  total: number;
}

export interface HealthCheckResponse {
  status: string;
  last_checked: string | null;
  last_healthy: string | null;
  last_error: string | null;
}

export interface HealthCheckAllResponse {
  checked: number;
  healthy: number;
  unhealthy: number;
  error: number;
}

// Create connection requests (discriminated by type)
export interface CreateDatabaseConnectionRequest {
  type: "database";
  name: string;
  description?: string;
  read_only?: boolean;
  db_type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface CreateFilesystemConnectionRequest {
  type: "filesystem";
  name: string;
  description?: string;
  read_only?: boolean;
  path: string;
  path_type?: PathType;
}

export type CreateConnectionRequest =
  | CreateDatabaseConnectionRequest
  | CreateFilesystemConnectionRequest;

// Update connection requests (all fields optional, type determines which fields apply)
export interface UpdateDatabaseConnectionRequest {
  type?: "database";
  name?: string;
  description?: string;
  read_only?: boolean;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export interface UpdateFilesystemConnectionRequest {
  type?: "filesystem";
  name?: string;
  description?: string;
  read_only?: boolean;
  path?: string;
  path_type?: PathType;
}

export type UpdateConnectionRequest =
  | UpdateDatabaseConnectionRequest
  | UpdateFilesystemConnectionRequest;

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

export function listConnections(type?: ConnectionType): Promise<ConnectionsListResponse> {
  return request("/connections", { query: { type } });
}

export function getConnection(id: string): Promise<ConnectionResponse> {
  return request(`/connections/${id}`);
}

export function createConnection(data: CreateConnectionRequest): Promise<ConnectionResponse> {
  return request("/connections", { method: "POST", json: data });
}

export function updateConnection(
  id: string,
  data: UpdateConnectionRequest
): Promise<ConnectionResponse> {
  return request(`/connections/${id}`, { method: "PUT", json: data });
}

export function deleteConnection(id: string): Promise<void> {
  return requestVoid(`/connections/${id}`, { method: "DELETE" });
}

export function testConnection(id: string): Promise<ConnectionTestResult> {
  return request(`/connections/${id}/test`, { method: "POST" });
}

export function checkConnectionHealth(id: string): Promise<HealthCheckResponse> {
  return request(`/connections/${id}/check`, { method: "POST" });
}

export function checkAllConnectionsHealth(): Promise<HealthCheckAllResponse> {
  return request("/connections/check-all", { method: "POST" });
}

/** Test a database connection before creating it (database type only). */
export function testConnectionPreCreate(data: {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): Promise<ConnectionTestResult> {
  return request("/connections/test", { method: "POST", json: data });
}
