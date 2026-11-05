import { beforeEach, describe, expect, it } from "vitest";
import {
  expireSession,
  getAuthToken,
  hasMinRole,
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
    useAuthStore.getState().setAuth("tok", user);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.isLoading).toBe(false);
    expect(state.sessionExpired).toBe(false);
    expect(getAuthToken()).toBe("tok");
  });

  it("clearAuth signs the user out", () => {
    useAuthStore.getState().setAuth("tok", user);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(getAuthToken()).toBeNull();
    expect(state.sessionExpired).toBe(false);
  });

  it("expireSession ends the session and flags it as expired", () => {
    useAuthStore.getState().setAuth("tok", user);
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

  it("persists the session so a refresh keeps it", async () => {
    useAuthStore.getState().setAuth("tok", user);
    await useAuthStore.persist.rehydrate();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.isLoading).toBe(false);
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
    useAuthStore.getState().setAuth("tok", user);
    expect(hasMinRole("admin")).toBe(true);
    expect(hasMinRole("owner")).toBe(false);
  });
});
