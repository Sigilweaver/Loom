import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_AUTH_STORAGE_KEY,
  expireSession,
  removeLegacyAuthStorage,
  restoreSession,
  useAuthStore,
} from "./authStore";

const owner = { id: "u1", username: "owner", role: "owner" };

function reset() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    sessionExpired: false,
  });
}

describe("cookie-backed auth store", () => {
  beforeEach(reset);
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("holds no session token", () => {
    useAuthStore.getState().setAuth({ id: "u1", username: "owner", role: "owner" });
    expect(useAuthStore.getState()).not.toHaveProperty("token");
    expect(JSON.stringify(localStorage)).not.toContain("owner");
  });

  it("restores the signed-in user from the Hub after a refresh", async () => {
    await restoreSession(async () => owner);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.user).toEqual({ id: "u1", username: "owner", role: "owner" });
  });

  it("treats a 401 as signed out without reporting an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
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
    await restoreSession(async () => {
      throw Object.assign(new Error("Unable to reach the Hub"), { status: 0 });
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("marks the session expired only when someone was signed in", () => {
    expireSession();
    expect(useAuthStore.getState().sessionExpired).toBe(false);

    useAuthStore.getState().setAuth({ id: "u1", username: "owner", role: "owner" });
    expireSession();
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      user: null,
      sessionExpired: true,
    });
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
