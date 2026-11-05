/** Authentication, first-run setup and the signed-in user's profile. */

import type { Schemas } from "./schema";
import { request, requestVoid } from "./http";

export type AuthStatusResponse = Schemas["AuthStatusResponse"];

// The web app always asks for a cookie session; callers do not choose.
export type LoginRequest = Omit<Schemas["LoginRequest"], "session_mode">;

export type UserResponse = Schemas["app__api__v1__routes__auth__UserResponse"];

/** `access_token` is always null for the web app: the session is an HttpOnly cookie. */
export type LoginResponse = Schemas["LoginResponse"];

export type RegisterRequest = Omit<Schemas["RegisterRequest"], "session_mode">;

// Register uses the same response format as login
export type RegisterResponse = LoginResponse;

export type MeResponse = UserResponse;

export type UpdateProfileRequest = Schemas["UpdateProfileRequest"];

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
