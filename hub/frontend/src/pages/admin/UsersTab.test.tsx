import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@api";
import { useAuthStore, type UserRole } from "@state/authStore";
import { renderWithProviders } from "../../test/render";
import { UsersTab, canManageRole } from "./UsersTab";
import { assignableRoles } from "./users/UserDialog";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

function user(id: string, username: string, role: UserRole): api.UserResponse {
  return { id, username, role, created_at: "2026-01-01T00:00:00Z" };
}

const OWNER = user("o", "olivia", "owner");
const ADMIN = user("a", "adam", "admin");
const BOB = user("b", "bob", "user");

function signInAs(u: api.UserResponse) {
  useAuthStore.getState().setAuth("tok", { id: u.id, username: u.username, role: u.role as UserRole });
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.getState().clearAuth();
});

describe("canManageRole and assignableRoles", () => {
  it("lets owners manage everyone but owners", () => {
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("owner", "user")).toBe(true);
    expect(canManageRole("owner", "owner")).toBe(false);
  });

  it("lets admins manage auditors and users only", () => {
    expect(canManageRole("admin", "user")).toBe(true);
    expect(canManageRole("admin", "auditor")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("auditor", "user")).toBe(false);
  });

  it("only owners can hand out the admin role", () => {
    expect(assignableRoles("owner")).toContain("admin");
    expect(assignableRoles("admin")).not.toContain("admin");
  });
});

describe("UsersTab", () => {
  it("lists users and only offers actions on accounts the viewer may manage", async () => {
    signInAs(ADMIN);
    vi.mocked(api.listUsers).mockResolvedValue({ users: [OWNER, ADMIN, BOB], total: 3 });
    renderWithProviders(<UsersTab />);

    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(screen.getByText("3 accounts on this Hub.")).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit bob" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit olivia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit adam" })).not.toBeInTheDocument();
  });

  it("hides the create button from auditors", async () => {
    signInAs(user("x", "ivy", "auditor"));
    vi.mocked(api.listUsers).mockResolvedValue({ users: [BOB], total: 1 });
    renderWithProviders(<UsersTab />);

    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create user" })).not.toBeInTheDocument();
  });

  it("shows an error state when the list cannot be loaded", async () => {
    signInAs(OWNER);
    vi.mocked(api.listUsers).mockRejectedValue(new api.ApiError(500, "down", "down"));
    renderWithProviders(<UsersTab />);

    expect(await screen.findByText("Could not load users")).toBeInTheDocument();
  });

  it("creates a user", async () => {
    signInAs(OWNER);
    vi.mocked(api.listUsers).mockResolvedValue({ users: [OWNER], total: 1 });
    vi.mocked(api.createUser).mockResolvedValue({ ...BOB });
    renderWithProviders(<UsersTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^Username/), "bob");
    await userEvent.type(within(dialog).getByLabelText(/^Password/), "longenough1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith({ username: "bob", password: "longenough1", role: "user" })
    );
    expect(await screen.findByText("User created.")).toBeInTheDocument();
  });

  it("shows a taken username on the username field", async () => {
    signInAs(OWNER);
    vi.mocked(api.listUsers).mockResolvedValue({ users: [OWNER], total: 1 });
    vi.mocked(api.createUser).mockRejectedValue(new api.ApiError(409, "Username already exists", "Username already exists"));
    renderWithProviders(<UsersTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^Username/), "bob");
    await userEvent.type(within(dialog).getByLabelText(/^Password/), "longenough1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    expect(await within(dialog).findByText("Username already exists")).toBeInTheDocument();
  });

  it("sends only the changed fields when editing", async () => {
    signInAs(OWNER);
    vi.mocked(api.listUsers).mockResolvedValue({ users: [OWNER, BOB], total: 2 });
    vi.mocked(api.updateUser).mockResolvedValue({ ...BOB, role: "auditor" });
    renderWithProviders(<UsersTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit bob" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Role/), "auditor");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith("b", { role: "auditor" }));
  });

  it("asks before deleting and reports a failure", async () => {
    signInAs(OWNER);
    vi.mocked(api.listUsers).mockResolvedValue({ users: [OWNER, BOB], total: 2 });
    vi.mocked(api.deleteUser).mockRejectedValue(new api.ApiError(403, "Forbidden", "Not allowed"));
    renderWithProviders(<UsersTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete bob" }));
    const confirmDialog = await screen.findByRole("dialog");
    expect(api.deleteUser).not.toHaveBeenCalled();
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Delete user" }));

    expect(api.deleteUser).toHaveBeenCalledWith("b");
    expect(await screen.findByText(/You do not have permission to do this/)).toBeInTheDocument();
  });
});
