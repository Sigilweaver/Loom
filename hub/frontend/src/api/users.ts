/** User administration (admin/owner only). */

import type { Schemas } from "./schema";
import { request, requestVoid } from "./http";

export type CreateUserRequest = Schemas["CreateUserRequest"];

// Same shape as the signed-in user's UserResponse in auth.ts, from the users routes.
type UserResponse = Schemas["app__api__v1__routes__users__UserResponse"];

export type CreateUserResponse = UserResponse;

export type UserListResponse = Schemas["UserListResponse"];

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
  data: Schemas["UpdateUserRequest"]
): Promise<UserResponse> {
  return request(`/users/${userId}`, { method: "PATCH", json: data });
}

export function deleteUser(userId: string): Promise<void> {
  return requestVoid(`/users/${userId}`, { method: "DELETE" });
}
