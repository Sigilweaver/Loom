import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuthStore, type UserRole } from "@state/authStore";
import { ProtectedRoute, RoleBasedRedirect, UserRoute } from "./ProtectedRoute";

function signIn(role: UserRole) {
  useAuthStore.getState().setAuth("tok", { id: "1", username: "u", role });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/" element={<RoleBasedRedirect />} />
        <Route path="/home" element={<div>user home</div>} />
        <Route path="/admin" element={<div>admin home</div>} />
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div>secret</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-only"
          element={
            <ProtectedRoute minRole="admin">
              <div>admin only</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-area"
          element={
            <UserRoute>
              <div>user area</div>
            </UserRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

describe("route guards", () => {
  it("shows a loading state while the stored session is checked", () => {
    useAuthStore.setState({ isLoading: true });
    renderAt("/secret");
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("sends signed-out visitors to the login page", () => {
    renderAt("/secret");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("lets signed-in users through", () => {
    signIn("user");
    renderAt("/secret");
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("redirects users below the minimum role to their home", () => {
    signIn("user");
    renderAt("/admin-only");
    expect(screen.getByText("user home")).toBeInTheDocument();
  });

  it("admits users at or above the minimum role", () => {
    signIn("owner");
    renderAt("/admin-only");
    expect(screen.getByText("admin only")).toBeInTheDocument();
  });

  it("keeps admins and auditors out of the regular-user area", () => {
    signIn("auditor");
    renderAt("/user-area");
    expect(screen.getByText("admin home")).toBeInTheDocument();
  });

  it("lets regular users into the user area", () => {
    signIn("user");
    renderAt("/user-area");
    expect(screen.getByText("user area")).toBeInTheDocument();
  });

  it("routes the landing page by role", () => {
    signIn("admin");
    const { unmount } = renderAt("/");
    expect(screen.getByText("admin home")).toBeInTheDocument();
    unmount();
    signIn("user");
    renderAt("/");
    expect(screen.getByText("user home")).toBeInTheDocument();
  });
});
