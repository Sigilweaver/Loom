import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@api";
import { useAuthStore, type UserRole } from "@state/authStore";
import { renderWithProviders } from "../../test/render";
import { ServersTab } from "./ServersTab";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listServers: vi.fn(),
  registerServer: vi.fn(),
  testServerConnection: vi.fn(),
  refreshServer: vi.fn(),
  deleteServer: vi.fn(),
}));

function server(overrides: Partial<api.ServerResponse> = {}): api.ServerResponse {
  return {
    id: "s1",
    name: "Worker 1",
    endpoint_url: "http://worker-1:25811",
    status: "online",
    version: "0.13.0",
    last_poll: null,
    last_healthy: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function signInAs(role: UserRole) {
  useAuthStore.getState().setAuth({ id: "me", username: "me", role });
}

async function openAddDialog() {
  await userEvent.click((await screen.findAllByRole("button", { name: "Add server" }))[0]!);
  return screen.findByRole("dialog");
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.getState().clearAuth();
});

describe("ServersTab", () => {
  it("lists servers with their status and version", async () => {
    signInAs("admin");
    vi.mocked(api.listServers).mockResolvedValue({ servers: [server()], total: 1 });
    renderWithProviders(<ServersTab />);

    expect(await screen.findByText("Worker 1")).toBeInTheDocument();
    expect(screen.getByText("http://worker-1:25811")).toBeInTheDocument();
    expect(screen.getByText("0.13.0")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("is read-only for auditors", async () => {
    signInAs("auditor");
    vi.mocked(api.listServers).mockResolvedValue({ servers: [server()], total: 1 });
    renderWithProviders(<ServersTab />);

    expect(await screen.findByText("Worker 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add server" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Worker 1" })).not.toBeInTheDocument();
  });

  it("shows empty and error states", async () => {
    signInAs("admin");
    vi.mocked(api.listServers).mockResolvedValueOnce({ servers: [], total: 0 });
    const { unmount } = renderWithProviders(<ServersTab />);
    expect(await screen.findByText("No servers registered")).toBeInTheDocument();
    unmount();

    vi.mocked(api.listServers).mockRejectedValue(new api.ApiError(500, "down", "down"));
    renderWithProviders(<ServersTab />);
    expect(await screen.findByText("Could not load servers")).toBeInTheDocument();
  });

  it("tests a connection before adding a server", async () => {
    signInAs("admin");
    vi.mocked(api.listServers).mockResolvedValue({ servers: [], total: 0 });
    vi.mocked(api.testServerConnection).mockResolvedValue({
      success: true,
      status: "online",
      version: "0.13.0",
      message: null,
    });
    vi.mocked(api.registerServer).mockResolvedValue(server());
    renderWithProviders(<ServersTab />);

    const dialog = await openAddDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Worker 1");
    await userEvent.type(within(dialog).getByLabelText(/^Endpoint URL/), "http://worker-1:25811");
    await userEvent.click(within(dialog).getByRole("button", { name: "Test connection" }));
    expect(await within(dialog).findByText("Connected. Server version 0.13.0.")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Add server" }));
    await waitFor(() =>
      expect(api.registerServer).toHaveBeenCalledWith({
        name: "Worker 1",
        endpoint_url: "http://worker-1:25811",
        auth_token: undefined,
      })
    );
    expect(await screen.findByText("Server added.")).toBeInTheDocument();
  });

  it("puts validation errors next to their fields", async () => {
    signInAs("admin");
    vi.mocked(api.listServers).mockResolvedValue({ servers: [], total: 0 });
    vi.mocked(api.registerServer).mockRejectedValue(
      new api.ApiError(422, "endpoint_url: Endpoint is not allowed", null, {
        endpoint_url: "Endpoint is not allowed",
      })
    );
    renderWithProviders(<ServersTab />);

    const dialog = await openAddDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Worker 1");
    await userEvent.type(within(dialog).getByLabelText(/^Endpoint URL/), "http://169.254.169.254");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add server" }));

    expect(await within(dialog).findByText("Endpoint is not allowed")).toBeInTheDocument();
  });

  it("reports a failed status check", async () => {
    signInAs("admin");
    vi.mocked(api.listServers).mockResolvedValue({ servers: [server()], total: 1 });
    vi.mocked(api.refreshServer).mockRejectedValue(new api.ApiError(0, "Unable to reach the Hub server."));
    renderWithProviders(<ServersTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Check status of Worker 1" }));
    expect(await screen.findByText(/Unable to reach the Hub server/)).toBeInTheDocument();
  });
});
