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

      // Actions
      setAuth: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      clearAuth: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "sigilweaver-hub-auth",
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
 * Check if the current user has at least the specified role level
 * Role hierarchy: owner > admin > auditor > user
 */
export function hasMinRole(requiredRole: UserRole): boolean {
  const { user } = useAuthStore.getState();
  if (!user) return false;

  const roleLevel: Record<UserRole, number> = {
    owner: 0,
    admin: 1,
    auditor: 2,
    user: 3,
  };

  return roleLevel[user.role] <= roleLevel[requiredRole];
}
