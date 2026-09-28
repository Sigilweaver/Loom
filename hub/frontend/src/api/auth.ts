/** Authentication, first-run setup and the signed-in user's profile. */

import { request, requestVoid } from "./http";

export interface AuthStatusResponse {
  initialized: boolean;
  registration_open: boolean;
  user_count: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

// Register uses the same response format as login
export type RegisterResponse = LoginResponse;

export type MeResponse = UserResponse;

export interface UpdateProfileRequest {
  current_password: string;
  username?: string;
  new_password?: string;
}

/** Check if any users exist (for first-run detection). */
export function getAuthStatus(): Promise<AuthStatusResponse> {
  return request("/auth/status", { auth: false });
}

/** Login with username and password. */
export function login(data: LoginRequest): Promise<LoginResponse> {
  return request("/auth/login", { method: "POST", json: data, auth: false });
}

/** Register the first user (becomes owner), or a new user with admin auth. */
export function register(data: RegisterRequest): Promise<RegisterResponse> {
  return request("/auth/register", { method: "POST", json: data });
}

/** Logout (invalidate the session). */
export function logout(): Promise<void> {
  return requestVoid("/auth/logout", { method: "POST" });
}

/** Get the signed-in user. */
export function getMe(): Promise<MeResponse> {
  return request("/auth/me");
}

export function updateProfile(data: UpdateProfileRequest): Promise<UserResponse> {
  return request("/auth/me", { method: "PATCH", json: data });
}
