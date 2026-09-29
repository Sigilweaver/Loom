/** Server registry. */

import { request, requestVoid } from "./http";

export interface ServerResponse {
  id: string;
  name: string;
  endpoint_url: string;
  status: string;
  version: string | null;
  last_poll: string | null;
  last_healthy: string | null;
  created_at: string;
}

export interface ServerListResponse {
  servers: ServerResponse[];
  total: number;
}

export interface ServerTestResponse {
  success: boolean;
  status: string;
  version: string | null;
  message: string | null;
}

interface ServerInput {
  name: string;
  endpoint_url: string;
  auth_token?: string;
}

/** List servers (auto-filtered by group membership for regular users). */
export function listServers(): Promise<ServerListResponse> {
  return request("/servers");
}

export function registerServer(data: ServerInput): Promise<ServerResponse> {
  return request("/servers", { method: "POST", json: data });
}

export function testServerConnection(data: ServerInput): Promise<ServerTestResponse> {
  return request("/servers/test", { method: "POST", json: data });
}

export function refreshServer(id: string): Promise<ServerResponse> {
  return request(`/servers/${id}/refresh`, { method: "POST" });
}

export function deleteServer(id: string): Promise<void> {
  return requestVoid(`/servers/${id}`, { method: "DELETE" });
}
