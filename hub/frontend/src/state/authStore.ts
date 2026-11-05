/**
 * Authentication state management using Zustand
 *
 * The session token never reaches JavaScript: the Hub keeps it in an HttpOnly
 * cookie (see hub/backend/app/domain/auth/cookies.py). This store only holds
 * who is signed in, and finds that out on page load by asking the Hub
 * (`restoreSession`). Nothing here is persisted to browser storage.
 *
 * Handles:
 * - User session state
 * - Login/logout state changes
 * - Restoring the session after a page refresh
 */

import { create } from "zustand";

export type UserRole = "owner" | "admin" | "auditor" | "user";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

interface AuthState {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the first session check has finished. */
  isLoading: boolean;
  /** True after the Hub rejected our session (expired or revoked). */
  sessionExpired: boolean;

  // Actions
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Where earlier versions persisted the session token in localStorage. Removed
 * on load so an old token does not linger in script-readable storage.
 */
export const LEGACY_AUTH_STORAGE_KEY = "sigilweaver-loom-hub-auth";

export const useAuthStore = create<AuthState>()((set) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start loading until the session check finishes
  sessionExpired: false,

  // Actions
  setAuth: (user) =>
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
      sessionExpired: false,
    }),

  clearAuth: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionExpired: false,
    }),

  setLoading: (loading) => set({ isLoading: loading }),
}));

/**
 * End the local session because the Hub rejected it (HTTP 401).
 * Route guards react to the store change and send the user to the login page,
 * which explains why. Does nothing when nobody is signed in.
 */
export function expireSession(): void {
  if (!useAuthStore.getState().isAuthenticated) return;
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    sessionExpired: true,
  });
}

/** Remove the session token that older versions stored in localStorage. */
export function removeLegacyAuthStorage(): void {
  try {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch (error) {
    // Storage can be blocked (privacy mode, sandboxed frames). Nothing was
    // stored there in that case, so there is nothing to clean up.
    console.warn("Could not clear the legacy Hub session from localStorage", error);
  }
}

/**
 * Ask the Hub who is signed in (the session cookie is sent automatically),
 * and update the store. `fetchMe` resolves to the user, or rejects; a 401
 * means "not signed in". Other failures also leave the user signed out, since
 * nothing can be shown without a session, and are reported to the console.
 */
export async function restoreSession(
  fetchMe: () => Promise<{ id: string; username: string; role: string }>
): Promise<void> {
  try {
    const me = await fetchMe();
    useAuthStore
      .getState()
      .setAuth({ id: me.id, username: me.username, role: me.role as UserRole });
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status !== 401) {
      console.error("Could not restore the Hub session", error);
    }
    useAuthStore.getState().clearAuth();
  }
}

/** Lower number = more privileged. Role hierarchy: owner > admin > auditor > user. */
const ROLE_LEVEL: Record<UserRole, number> = {
  owner: 0,
  admin: 1,
  auditor: 2,
  user: 3,
};

/** Does this role have at least the privileges of `required`? */
export function roleAtLeast(role: UserRole | undefined, required: UserRole): boolean {
  return role !== undefined && ROLE_LEVEL[role] <= ROLE_LEVEL[required];
}

/** Check whether the signed-in user has at least the given role (non-reactive; for route guards). */
export function hasMinRole(requiredRole: UserRole): boolean {
  return roleAtLeast(useAuthStore.getState().user?.role, requiredRole);
}

/** Reactive version of `hasMinRole`, for hiding controls the user is not allowed to use. */
export function useHasMinRole(requiredRole: UserRole): boolean {
  return useAuthStore((state) => roleAtLeast(state.user?.role, requiredRole));
}
