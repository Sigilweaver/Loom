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
  /** Always null for the web app: the session is an HttpOnly cookie. */
  access_token: string | null;
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

/**
 * Login with username and password. The Hub answers with an HttpOnly session
 * cookie (and a CSRF cookie); no token is returned to script.
 */
export function login(data: LoginRequest): Promise<LoginResponse> {
  return request("/auth/login", {
    method: "POST",
    json: { ...data, session_mode: "cookie" },
    auth: false,
  });
}

/**
 * Register the first user (becomes owner), who is then signed in with a
 * session cookie. Called with admin auth it creates another user without
 * signing anyone in.
 */
export function register(data: RegisterRequest): Promise<RegisterResponse> {
  return request("/auth/register", { method: "POST", json: { ...data, session_mode: "cookie" } });
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
