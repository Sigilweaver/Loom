/** User administration (admin/owner only). */

import { request, requestVoid } from "./http";
import type { UserResponse } from "./auth";

export interface CreateUserRequest {
  username: string;
  password: string;
  role?: string;
}

export type CreateUserResponse = UserResponse;

export interface UserListResponse {
  users: UserResponse[];
  total: number;
}

export function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  return request("/users", { method: "POST", json: data });
}

export function listUsers(): Promise<UserListResponse> {
  return request("/users");
}

export function getUser(userId: string): Promise<UserResponse> {
  return request(`/users/${userId}`);
}

export function updateUser(
  userId: string,
  data: { username?: string; password?: string; role?: string }
): Promise<UserResponse> {
  return request(`/users/${userId}`, { method: "PATCH", json: data });
}

export function deleteUser(userId: string): Promise<void> {
  return requestVoid(`/users/${userId}`, { method: "DELETE" });
}
