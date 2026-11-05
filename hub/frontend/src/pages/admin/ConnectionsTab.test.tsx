import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@api";
import { renderWithProviders } from "../../test/render";
import { ConnectionsTab } from "./ConnectionsTab";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listConnections: vi.fn(),
  createConnection: vi.fn(),
  deleteConnection: vi.fn(),
  testConnection: vi.fn(),
}));

function connection(overrides: Partial<api.ConnectionResponse> = {}): api.ConnectionResponse {
  return {
    id: "c1",
    name: "Warehouse",
    type: "database",
    description: null,
    read_only: false,
    status: "healthy",
    last_checked: null,
    last_healthy: null,
    last_error: null,
    created_by: "ada",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    database_config: { db_type: "postgresql", host: "db.local", port: 5432, database: "dw" },
    filesystem_config: null,
    ...overrides,
  };
}

const listed = (connections: api.ConnectionResponse[]) => ({ connections, total: connections.length });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ConnectionsTab", () => {
  it("lists connections with their target and status", async () => {
    vi.mocked(api.listConnections).mockResolvedValue(listed([connection()]));
    renderWithProviders(<ConnectionsTab />);

    expect(await screen.findByText("Warehouse")).toBeInTheDocument();
    expect(screen.getByText("db.local:5432")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("shows an empty state and an error state", async () => {
    vi.mocked(api.listConnections).mockResolvedValueOnce(listed([]));
    const { unmount } = renderWithProviders(<ConnectionsTab />);
    expect(await screen.findByText("No connections yet")).toBeInTheDocument();
    unmount();

    vi.mocked(api.listConnections).mockRejectedValue(new api.ApiError(500, "down", "down"));
    renderWithProviders(<ConnectionsTab />);
    expect(await screen.findByText("Could not load connections")).toBeInTheDocument();
  });

  it("validates the add form before calling the API", async () => {
    vi.mocked(api.listConnections).mockResolvedValue(listed([]));
    renderWithProviders(<ConnectionsTab />);
    await screen.findByText("No connections yet");

    await userEvent.click(screen.getAllByRole("button", { name: "Add connection" })[0]!);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add connection" }));

    expect(await within(dialog).findByText("Name is required")).toBeInTheDocument();
    expect(within(dialog).getByText("Host is required")).toBeInTheDocument();
    expect(api.createConnection).not.toHaveBeenCalled();
  });

  it("creates a filesystem connection", async () => {
    vi.mocked(api.listConnections).mockResolvedValue(listed([]));
    vi.mocked(api.createConnection).mockResolvedValue(
      connection({ name: "Shared", type: "filesystem", database_config: null })
    );
    renderWithProviders(<ConnectionsTab />);
    await screen.findByText("No connections yet");

    await userEvent.click(screen.getAllByRole("button", { name: "Add connection" })[0]!);
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Connection type"), "filesystem");
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Shared");
    await userEvent.type(within(dialog).getByLabelText(/^Path$|^Path\*?$/), "/data");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add connection" }));

    expect(api.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "filesystem", name: "Shared", path: "/data", path_type: "local" })
    );
  });

  it("asks before deleting", async () => {
    vi.mocked(api.listConnections).mockResolvedValue(listed([connection()]));
    vi.mocked(api.deleteConnection).mockResolvedValue(undefined);
    renderWithProviders(<ConnectionsTab />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete Warehouse" }));
    const confirmDialog = await screen.findByRole("dialog");
    expect(api.deleteConnection).not.toHaveBeenCalled();
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Delete connection" }));

    expect(api.deleteConnection).toHaveBeenCalledWith("c1");
  });
});
