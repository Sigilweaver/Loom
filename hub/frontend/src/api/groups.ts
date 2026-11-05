/** User groups (access control) and their membership. */

import type { Schemas } from "./schema";
import { request, requestVoid } from "./http";

export type GroupResponse = Schemas["GroupResponse"];

export type GroupListResponse = Schemas["GroupListResponse"];

export type GroupMemberResponse = Schemas["GroupMemberResponse"];

export type GroupMembersResponse = Schemas["GroupMembersResponse"];

export type GroupGrantGroupResponse = Schemas["GroupGrantGroupResponse"];

export type GroupGrantGroupsResponse = Schemas["GroupGrantGroupsResponse"];

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
