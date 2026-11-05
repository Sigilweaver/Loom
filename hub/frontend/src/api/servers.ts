/** Server registry. */

import type { Schemas } from "./schema";
import { request, requestVoid } from "./http";

export type ServerResponse = Schemas["ServerResponse"];

export type ServerListResponse = Schemas["ServerListResponse"];

export type ServerTestResponse = Schemas["ServerTestResponse"];

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
