/** User groups (access control) and their membership. */

import { request, requestVoid } from "./http";

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  member_count: number;
  connection_count: number;
  created_by: string;
  created_at: string;
}

export interface GroupListResponse {
  groups: GroupResponse[];
  total: number;
}

export interface GroupMemberResponse {
  user_id: string;
  username: string;
  role: string;
  joined_at: string;
}

export interface GroupMembersResponse {
  group_id: string;
  group_name: string;
  members: GroupMemberResponse[];
  total: number;
}

export interface GroupGrantGroupResponse {
  grant_group_id: string;
  grant_group_name: string;
  connection_count: number;
  assigned_at: string;
}

export interface GroupGrantGroupsResponse {
  group_id: string;
  group_name: string;
  grant_groups: GroupGrantGroupResponse[];
  total: number;
}

export function listGroups(): Promise<GroupListResponse> {
  return request("/groups");
}

export function createGroup(data: {
  name: string;
  description?: string;
}): Promise<GroupResponse> {
  return request("/groups", { method: "POST", json: data });
}

export function getGroup(id: string): Promise<GroupResponse> {
  return request(`/groups/${id}`);
}

export function updateGroup(
  id: string,
  data: { name?: string; description?: string }
): Promise<GroupResponse> {
  return request(`/groups/${id}`, { method: "PATCH", json: data });
}

export function deleteGroup(id: string): Promise<void> {
  return requestVoid(`/groups/${id}`, { method: "DELETE" });
}

export function listGroupMembers(groupId: string): Promise<GroupMembersResponse> {
  return request(`/groups/${groupId}/members`);
}

export function addGroupMember(groupId: string, userId: string): Promise<{ message: string }> {
  return request(`/users/${userId}/groups/${groupId}`, { method: "POST" });
}

export function removeGroupMember(groupId: string, userId: string): Promise<void> {
  return requestVoid(`/users/${userId}/groups/${groupId}`, { method: "DELETE" });
}

// Group -> Grant Group assignments

export function listGroupGrantGroups(groupId: string): Promise<GroupGrantGroupsResponse> {
  return request(`/groups/${groupId}/grant-groups`);
}

export function assignGrantGroupToGroup(
  groupId: string,
  grantGroupId: string
): Promise<{ status: string; grant_group_id: string; user_group_id: string }> {
  return request(`/groups/${groupId}/grant-groups/${grantGroupId}`, { method: "POST" });
}

export function removeGrantGroupFromGroup(groupId: string, grantGroupId: string): Promise<void> {
  return requestVoid(`/groups/${groupId}/grant-groups/${grantGroupId}`, { method: "DELETE" });
}
