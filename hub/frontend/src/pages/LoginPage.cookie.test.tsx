import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "@state/authStore";

const api = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  readCsrfToken: vi.fn<() => string | null>(),
}));

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  ...api,
}));

import { COOKIE_REJECTED_MESSAGE, LoginPage } from "./LoginPage";

const response = {
  access_token: null,
  token_type: "cookie",
  user: { id: "u1", username: "owner", role: "owner", created_at: "" },
};

async function signIn() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <LoginPage />
    </MemoryRouter>
  );
  const username = await screen.findByLabelText(/username/i);
  fireEvent.change(username, { target: { value: "owner" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage with cookie sessions", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, sessionExpired: false });
    api.getAuthStatus.mockResolvedValue({ initialized: true, registration_open: false, user_count: 1 });
    api.login.mockResolvedValue(response);
  });

  afterEach(() => vi.clearAllMocks());

  it("signs in when the browser kept the session cookies", async () => {
    api.readCsrfToken.mockReturnValue("csrf-abc");
    await signIn();
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
    expect(useAuthStore.getState().user?.username).toBe("owner");
  });

  it("explains a rejected cookie instead of pretending to be signed in", async () => {
    api.readCsrfToken.mockReturnValue(null);
    await signIn();
    expect(await screen.findByText(COOKIE_REJECTED_MESSAGE)).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
