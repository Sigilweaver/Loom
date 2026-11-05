import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@api";
import { renderWithProviders } from "../../test/render";
import { GroupsTab } from "./GroupsTab";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  listGroupMembers: vi.fn(),
  listGroupGrantGroups: vi.fn(),
  listUsers: vi.fn(),
  listGrantGroups: vi.fn(),
  addGroupMember: vi.fn(),
  removeGroupMember: vi.fn(),
}));

const ANALYSTS: api.GroupResponse = {
  id: "g1",
  name: "Analysts",
  description: "Finance analysts",
  member_count: 1,
  grant_group_count: 0,
  created_by: "olivia",
  created_at: "2026-01-01T00:00:00Z",
};

function member(id: string, username: string, role = "user"): api.GroupMemberResponse {
  return { user_id: id, username, role, joined_at: "2026-01-01T00:00:00Z" };
}

function user(id: string, username: string, role: string): api.UserResponse {
  return { id, username, role, created_at: "2026-01-01T00:00:00Z" };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listGroupMembers).mockResolvedValue({
    group_id: "g1",
    group_name: "Analysts",
    members: [member("u1", "bob")],
    total: 1,
  });
  vi.mocked(api.listGroupGrantGroups).mockResolvedValue({
    group_id: "g1",
    group_name: "Analysts",
    grant_groups: [],
    total: 0,
  });
});

async function selectAnalysts() {
  await userEvent.click(await screen.findByRole("button", { name: /Analysts/ }));
}

describe("GroupsTab", () => {
  it("shows an empty list and a placeholder for the detail pane", async () => {
    vi.mocked(api.listGroups).mockResolvedValue({ groups: [], total: 0 });
    renderWithProviders(<GroupsTab />);

    expect(await screen.findByText("No groups yet")).toBeInTheDocument();
    expect(screen.getByText("Select a group")).toBeInTheDocument();
  });

  it("shows an error state when groups cannot be loaded", async () => {
    vi.mocked(api.listGroups).mockRejectedValue(new api.ApiError(500, "down", "down"));
    renderWithProviders(<GroupsTab />);

    expect(await screen.findByText("Could not load groups")).toBeInTheDocument();
  });

  it("creates a group and selects it", async () => {
    vi.mocked(api.listGroups)
      .mockResolvedValueOnce({ groups: [], total: 0 })
      .mockResolvedValue({ groups: [ANALYSTS], total: 1 });
    vi.mocked(api.createGroup).mockResolvedValue(ANALYSTS);
    renderWithProviders(<GroupsTab />);

    await userEvent.click(await screen.findByRole("button", { name: "New group" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Analysts");
    await userEvent.click(within(dialog).getByRole("button", { name: /create/i }));

    await waitFor(() => expect(api.createGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "Analysts" })));
    expect(await screen.findByText("Group created.")).toBeInTheDocument();
    expect(await screen.findByText("bob")).toBeInTheDocument();
  });

  it("lists members of the selected group", async () => {
    vi.mocked(api.listGroups).mockResolvedValue({ groups: [ANALYSTS], total: 1 });
    renderWithProviders(<GroupsTab />);

    await selectAnalysts();
    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(api.listGroupMembers).toHaveBeenCalledWith("g1");
  });

  it("offers only regular users who are not members yet", async () => {
    vi.mocked(api.listGroups).mockResolvedValue({ groups: [ANALYSTS], total: 1 });
    vi.mocked(api.listUsers).mockResolvedValue({
      users: [user("u1", "bob", "user"), user("u2", "carol", "user"), user("u3", "adam", "admin")],
      total: 3,
    });
    vi.mocked(api.addGroupMember).mockResolvedValue({ message: "ok" });
    renderWithProviders(<GroupsTab />);

    await selectAnalysts();
    await userEvent.click(await screen.findByRole("button", { name: "Add member" }));
    const picker = await screen.findByRole("dialog");
    expect(await within(picker).findByRole("button", { name: "Add carol" })).toBeInTheDocument();
    expect(within(picker).queryByRole("button", { name: "Add bob" })).not.toBeInTheDocument();
    expect(within(picker).queryByRole("button", { name: "Add adam" })).not.toBeInTheDocument();

    await userEvent.click(within(picker).getByRole("button", { name: "Add carol" }));
    await waitFor(() => expect(api.addGroupMember).toHaveBeenCalledWith("g1", "u2"));
  });

  it("asks before removing a member", async () => {
    vi.mocked(api.listGroups).mockResolvedValue({ groups: [ANALYSTS], total: 1 });
    vi.mocked(api.removeGroupMember).mockResolvedValue(undefined);
    renderWithProviders(<GroupsTab />);

    await selectAnalysts();
    await userEvent.click(await screen.findByRole("button", { name: "Remove bob from group" }));
    const confirmDialog = await screen.findByRole("dialog");
    expect(api.removeGroupMember).not.toHaveBeenCalled();
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Remove member" }));

    await waitFor(() => expect(api.removeGroupMember).toHaveBeenCalledWith("g1", "u1"));
  });
});
