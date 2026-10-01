/**
 * Authentication state management using Zustand
 *
 * Handles:
 * - User session state
 * - Token storage (localStorage)
 * - Login/logout actions
 * - Auth state persistence across refreshes
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole = "owner" | "admin" | "auditor" | "user";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

interface AuthState {
  // State
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True after the Hub rejected our token (expired or revoked session). */
  sessionExpired: boolean;

  // Actions
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true, // Start loading until we check stored auth
      sessionExpired: false,

      // Actions
      setAuth: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          sessionExpired: false,
        }),

      clearAuth: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          sessionExpired: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "sigilweaver-loom-hub-auth",
      storage: createJSONStorage(() => localStorage),
      // Only persist token and user, not loading state
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, set loading to false
        if (state) {
          state.setLoading(false);
        }
      },
    }
  )
);

/**
 * Get the auth token for API requests
 */
export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}

/**
 * End the local session because the Hub rejected our token (HTTP 401).
 * Route guards react to the store change and send the user to the login page,
 * which explains why. Does nothing when nobody is signed in.
 */
export function expireSession(): void {
  const { token } = useAuthStore.getState();
  if (!token) return;
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    sessionExpired: true,
  });
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
