import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_AUTH_STORAGE_KEY,
  expireSession,
  hasMinRole,
  removeLegacyAuthStorage,
  restoreSession,
  roleAtLeast,
  useAuthStore,
  type AuthUser,
} from "./authStore";

const user: AuthUser = { id: "u1", username: "ada", role: "admin" };

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

describe("authStore", () => {
  it("setAuth signs the user in and clears loading and expiry flags", () => {
    useAuthStore.setState({ sessionExpired: true, isLoading: true });
    useAuthStore.getState().setAuth(user);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.isLoading).toBe(false);
    expect(state.sessionExpired).toBe(false);
    // The session token lives only in the HttpOnly cookie.
    expect(state).not.toHaveProperty("token");
  });

  it("clearAuth signs the user out", () => {
    useAuthStore.getState().setAuth(user);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.sessionExpired).toBe(false);
  });

  it("expireSession ends the session and flags it as expired", () => {
    useAuthStore.getState().setAuth(user);
    expireSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.sessionExpired).toBe(true);
  });

  it("expireSession does nothing when nobody is signed in", () => {
    expireSession();
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  it("keeps nothing in browser storage", () => {
    useAuthStore.getState().setAuth(user);
    expect(JSON.stringify(localStorage)).not.toContain("ada");
  });
});

describe("restoreSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("restores the signed-in user from the Hub after a refresh", async () => {
    useAuthStore.setState({ isLoading: true });
    await restoreSession(async () => user);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.user).toEqual(user);
  });

  it("treats a 401 as signed out without reporting an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    useAuthStore.setState({ isLoading: true });
    await restoreSession(async () => {
      throw Object.assign(new Error("Not authenticated"), { status: 401 });
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.sessionExpired).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("reports other failures and stays signed out", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    useAuthStore.setState({ isLoading: true });
    await restoreSession(async () => {
      throw Object.assign(new Error("Unable to reach the Hub"), { status: 0 });
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("removes a token left in localStorage by an earlier version", () => {
    localStorage.setItem(
      LEGACY_AUTH_STORAGE_KEY,
      JSON.stringify({ state: { token: "old-token" }, version: 0 })
    );
    removeLegacyAuthStorage();
    expect(localStorage.getItem(LEGACY_AUTH_STORAGE_KEY)).toBeNull();
  });
});

describe("roles", () => {
  it("orders owner > admin > auditor > user", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
    expect(roleAtLeast("auditor", "admin")).toBe(false);
    expect(roleAtLeast("user", "auditor")).toBe(false);
    expect(roleAtLeast("user", "user")).toBe(true);
  });

  it("denies everything when there is no role", () => {
    expect(roleAtLeast(undefined, "user")).toBe(false);
  });

  it("hasMinRole reads the signed-in user", () => {
    expect(hasMinRole("user")).toBe(false);
    useAuthStore.getState().setAuth(user);
    expect(hasMinRole("admin")).toBe(true);
    expect(hasMinRole("owner")).toBe(false);
  });
});
