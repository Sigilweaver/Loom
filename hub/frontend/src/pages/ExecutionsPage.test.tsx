import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import * as api from "@api";
import { renderWithProviders } from "../test/render";
import { ExecutionsPage } from "./ExecutionsPage";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listExecutions: vi.fn(),
  listWorkflows: vi.fn(),
  listServers: vi.fn(),
  streamExecutions: vi.fn(() => () => {}),
  cancelExecution: vi.fn(),
}));

function execution(id: string, extra: Partial<api.ExecutionResponse> = {}): api.ExecutionResponse {
  return {
    id,
    workflow_id: "wf",
    workflow_name: `Workflow ${id}`,
    server_id: "srv",
    server_name: "Server A",
    trigger_type: "manual",
    triggered_by: "ada",
    status: "completed",
    queued_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:01Z",
    completed_at: "2026-01-01T00:00:05Z",
    success: true,
    error_message: null,
    duration_seconds: 4,
    ...extra,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.streamExecutions).mockReturnValue(() => {});
  vi.mocked(api.listWorkflows).mockResolvedValue({ workflows: [], total: 0 });
  vi.mocked(api.listServers).mockResolvedValue({ servers: [], total: 0 });
});

describe("ExecutionsPage", () => {
  it("lists executions and subscribes to live updates", async () => {
    vi.mocked(api.listExecutions).mockResolvedValue({
      executions: [execution("1"), execution("2", { status: "failed", success: false })],
      total: 2,
    });
    renderWithProviders(<ExecutionsPage />);

    expect(screen.getByText("Loading executions...")).toBeInTheDocument();
    expect(await screen.findByText("Workflow 1")).toBeInTheDocument();
    expect(screen.getByText("Workflow 2")).toBeInTheDocument();
    expect(api.streamExecutions).toHaveBeenCalled();
  });

  it("shows an empty state", async () => {
    vi.mocked(api.listExecutions).mockResolvedValue({ executions: [], total: 0 });
    renderWithProviders(<ExecutionsPage />);

    expect(await screen.findByText("No executions found")).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(api.listExecutions).mockRejectedValue(new api.ApiError(500, "down", "down"));
    renderWithProviders(<ExecutionsPage />);

    expect(await screen.findByText("Could not load executions")).toBeInTheDocument();
  });
});
