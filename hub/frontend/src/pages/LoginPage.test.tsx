import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuthStore } from "@state/authStore";
import * as api from "@api";
import { renderWithProviders } from "../test/render";
import { LoginPage } from "./LoginPage";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  getAuthStatus: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

const status = (initialized: boolean) => ({
  initialized,
  registration_open: !initialized,
  user_count: initialized ? 1 : 0,
});

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.getState().clearAuth();
});

describe("LoginPage", () => {
  it("signs in and stores the session", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue(status(true));
    vi.mocked(api.login).mockResolvedValue({
      access_token: "tok",
      token_type: "bearer",
      user: { id: "1", username: "ada", role: "user", created_at: "2026-01-01T00:00:00Z" },
    });
    renderWithProviders(<LoginPage />, { route: "/login" });

    await userEvent.type(await screen.findByLabelText("Username"), "ada");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
    expect(api.login).toHaveBeenCalledWith({ username: "ada", password: "hunter2hunter2" });
    expect(useAuthStore.getState().user?.username).toBe("ada");
  });

  it("shows the server's message when sign-in fails", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue(status(true));
    vi.mocked(api.login).mockRejectedValue(new api.ApiError(401, "Invalid credentials"));
    renderWithProviders(<LoginPage />, { route: "/login" });

    await userEvent.type(await screen.findByLabelText("Username"), "ada");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("shows validation errors next to the field they belong to", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue(status(true));
    vi.mocked(api.login).mockRejectedValue(
      new api.ApiError(422, "username: too short", null, { username: "too short" })
    );
    renderWithProviders(<LoginPage />, { route: "/login" });

    await userEvent.type(await screen.findByLabelText("Username"), "abc");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("too short")).toBeInTheDocument();
  });

  it("offers owner setup on a fresh instance and checks the passwords match", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue(status(false));
    renderWithProviders(<LoginPage />, { route: "/login" });

    await userEvent.type(await screen.findByLabelText("Username"), "owner");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different123");
    await userEvent.click(screen.getByRole("button", { name: "Create owner account" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it("explains an expired session", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue(status(true));
    useAuthStore.setState({ sessionExpired: true, isLoading: false });
    renderWithProviders(<LoginPage />, { route: "/login" });

    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
  });

  it("falls back to sign-in when the status check fails", async () => {
    vi.mocked(api.getAuthStatus).mockRejectedValue(new api.ApiError(0, "offline"));
    renderWithProviders(<LoginPage />, { route: "/login" });

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
