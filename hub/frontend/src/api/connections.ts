/** Data connections (database and filesystem). */

import type { Schemas } from "./schema";
import { request, requestVoid } from "./http";

export type ConnectionType = Schemas["ConnectionType"];
export type DatabaseType = Schemas["DatabaseType"];
export type PathType = Schemas["PathType"];
// The Hub declares `status` as a plain string; these are the values it emits.
export type ConnectionStatus = "healthy" | "unhealthy" | "error" | "unknown";

// Type-specific configs (for response)
// The Hub declares the enum-like response fields as plain strings; narrow them
// here to the enums it validates on the way in.
export type DatabaseConfigResponse = Omit<Schemas["DatabaseConfigResponse"], "db_type"> & {
  db_type: DatabaseType;
};

export type FilesystemConfigResponse = Omit<Schemas["FilesystemConfigResponse"], "path_type"> & {
  path_type: PathType;
};

// Connection response (database or filesystem)
export type ConnectionResponse = Omit<
  Schemas["ConnectionResponse"],
  "type" | "status" | "database_config" | "filesystem_config"
> & {
  type: ConnectionType;
  status: ConnectionStatus;
  database_config?: DatabaseConfigResponse | null;
  filesystem_config?: FilesystemConfigResponse | null;
};

export type ConnectionsListResponse = Omit<Schemas["ConnectionListResponse"], "connections"> & {
  connections: ConnectionResponse[];
};

export type HealthCheckResponse = Schemas["HealthCheckResponse"];

export type HealthCheckAllResponse = Schemas["HealthCheckAllResponse"];

// Create connection requests (discriminated by type)
export type CreateDatabaseConnectionRequest = Schemas["CreateDatabaseConnectionInput"];

export type CreateFilesystemConnectionRequest = Schemas["CreateFilesystemConnectionInput"];

export type CreateConnectionRequest =
  | CreateDatabaseConnectionRequest
  | CreateFilesystemConnectionRequest;

// Update connection requests (all fields optional, type determines which fields apply)
export type UpdateDatabaseConnectionRequest = Schemas["UpdateDatabaseConnectionInput"];

export type UpdateFilesystemConnectionRequest = Schemas["UpdateFilesystemConnectionInput"];

export type UpdateConnectionRequest =
  | UpdateDatabaseConnectionRequest
  | UpdateFilesystemConnectionRequest;

export type ConnectionTestResult = Schemas["TestConnectionResponse"];

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
