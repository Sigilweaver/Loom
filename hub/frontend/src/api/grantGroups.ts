/** Grant groups: permission bundles that link user groups to connections. */

import { request, requestVoid } from "./http";

export interface GrantGroupSummary {
  id: string;
  name: string;
  description: string;
  connection_count: number;
  user_group_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

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

export interface GrantGroupDetail extends GrantGroupSummary {
  connections: GrantGroupConnection[];
  user_groups: GrantGroupUserGroup[];
}

export interface GrantGroupListResponse {
  grant_groups: GrantGroupSummary[];
  total: number;
}

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
