/** Grant groups: permission bundles that link user groups to connections. */

import type { Schemas } from "./schema";
import { request, requestVoid } from "./http";

export type GrantGroupSummary = Schemas["GrantGroupSummary"];

export interface GrantGroupConnection {
  connection_id: string;
  name: string;
  type: string;
  assigned_at: string;
  assigned_by: string;
}

export interface GrantGroupUserGroup {
  user_group_id: string;
  user_group_name: string;
  description: string;
  member_count: number;
  assigned_at: string;
  assigned_by: string;
}

export type GrantGroupDetail = Schemas["GrantGroupDetail"];

export type GrantGroupListResponse = Schemas["GrantGroupListResponse"];

export function listGrantGroups(): Promise<GrantGroupListResponse> {
  return request("/grant-groups");
}

export function createGrantGroup(data: {
  name: string;
  description?: string;
}): Promise<GrantGroupSummary> {
  return request("/grant-groups", { method: "POST", json: data });
}

export function getGrantGroup(id: string): Promise<GrantGroupDetail> {
  return request(`/grant-groups/${id}`);
}

export function updateGrantGroup(
  id: string,
  data: { name?: string; description?: string }
): Promise<GrantGroupSummary> {
  return request(`/grant-groups/${id}`, { method: "PATCH", json: data });
}

export function deleteGrantGroup(id: string): Promise<void> {
  return requestVoid(`/grant-groups/${id}`, { method: "DELETE" });
}

export function addConnectionToGrantGroup(
  grantGroupId: string,
  connectionId: string
): Promise<{ status: string; connection_id: string; grant_group_id: string }> {
  return request(`/grant-groups/${grantGroupId}/connections/${connectionId}`, {
    method: "POST",
  });
}

export function removeConnectionFromGrantGroup(
  grantGroupId: string,
  connectionId: string
): Promise<void> {
  return requestVoid(`/grant-groups/${grantGroupId}/connections/${connectionId}`, {
    method: "DELETE",
  });
}
