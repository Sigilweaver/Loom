import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import * as api from "@api";
import { renderWithProviders } from "../../test/render";
import { DashboardTab } from "./DashboardTab";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listServers: vi.fn(),
  listWorkflows: vi.fn(),
  listExecutions: vi.fn(),
  listSchedules: vi.fn(),
  listUsers: vi.fn(),
  listConnections: vi.fn(),
  listGroups: vi.fn(),
  getHealth: vi.fn(),
}));

const HOUR_MS = 60 * 60 * 1000;

function execution(id: string, hoursAgo: number, status: string): api.ExecutionResponse {
  const at = new Date(Date.now() - hoursAgo * HOUR_MS).toISOString();
  return {
    id,
    workflow_id: "wf",
    workflow_name: `Workflow ${id}`,
    server_id: "srv",
    server_name: "Server A",
    trigger_type: "manual",
    triggered_by: "ada",
    schedule_id: null,
    status,
    queued_at: at,
    started_at: at,
    completed_at: status === "running" ? null : at,
    success: status === "completed",
    error_message: null,
    duration_seconds: 1,
  };
}

function mockHub(executions: api.ExecutionResponse[], total = executions.length) {
  vi.mocked(api.listServers).mockResolvedValue({ servers: [], total: 0 });
  vi.mocked(api.listWorkflows).mockResolvedValue({ workflows: [], total: 0 });
  vi.mocked(api.listExecutions).mockResolvedValue({ executions, total });
  vi.mocked(api.listSchedules).mockResolvedValue({ schedules: [], total: 0 });
  vi.mocked(api.listUsers).mockResolvedValue({ users: [], total: 1 });
  vi.mocked(api.listConnections).mockResolvedValue({ connections: [], total: 0 });
  vi.mocked(api.listGroups).mockResolvedValue({ groups: [], total: 0 });
  vi.mocked(api.getHealth).mockResolvedValue({ status: "ok", version: "1.2.3" });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DashboardTab", () => {
  it("shows no success rate before anything has finished", async () => {
    mockHub([execution("a", 1, "running")]);
    renderWithProviders(<DashboardTab />);

    expect(await screen.findByText("Total executions")).toBeInTheDocument();
    expect(screen.queryByText(/success rate/)).not.toBeInTheDocument();
    expect(screen.getByText("0 in the previous 24h")).toBeInTheDocument();
  });

  it("computes the success rate from finished runs only", async () => {
    mockHub([
      execution("a", 1, "completed"),
      execution("b", 2, "completed"),
      execution("c", 3, "completed"),
      execution("d", 4, "failed"),
      execution("e", 5, "running"),
      execution("f", 30, "completed"),
    ]);
    renderWithProviders(<DashboardTab />);

    expect(await screen.findByText("75% success rate")).toBeInTheDocument();
    expect(screen.getByText("1 in the previous 24h")).toBeInTheDocument();
  });

  it("marks the 24-hour count as a lower bound when the fetch was capped", async () => {
    mockHub([execution("a", 1, "completed"), execution("b", 2, "completed")], 500);
    renderWithProviders(<DashboardTab />);

    expect(await screen.findByText("2+")).toBeInTheDocument();
    expect(screen.getByText("Counted from the latest 100 runs")).toBeInTheDocument();
  });

  it("shows an error state when the Hub cannot be reached", async () => {
    mockHub([]);
    vi.mocked(api.listUsers).mockRejectedValue(new api.ApiError(0, "Unable to reach the Hub server."));
    renderWithProviders(<DashboardTab />);

    expect(await screen.findByText("Could not load the dashboard")).toBeInTheDocument();
  });
});
