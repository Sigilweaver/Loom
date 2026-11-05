import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import * as api from "@api";
import { renderWithProviders } from "../test/render";
import { SchedulesPage } from "./SchedulesPage";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listSchedules: vi.fn(),
  listWorkflows: vi.fn(),
  listServers: vi.fn(),
}));

function schedule(id: string, extra: Partial<api.ScheduleResponse> = {}): api.ScheduleResponse {
  return {
    id,
    workflow_id: "wf",
    workflow_name: `Nightly ${id}`,
    cron_expression: "0 2 * * *",
    timezone: "UTC",
    target_server_id: null,
    target_server_name: null,
    enabled: true,
    description: null,
    start_at: null,
    created_by: "ada",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    last_triggered_at: null,
    next_trigger_at: "2026-01-02T02:00:00Z",
    ...extra,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listWorkflows).mockResolvedValue({ workflows: [], total: 0 });
  vi.mocked(api.listServers).mockResolvedValue({ servers: [], total: 0 });
});

describe("SchedulesPage", () => {
  it("lists schedules", async () => {
    vi.mocked(api.listSchedules).mockResolvedValue({
      schedules: [schedule("a"), schedule("b")],
      total: 2,
    });
    renderWithProviders(<SchedulesPage />);

    expect(screen.getByText("Loading schedules...")).toBeInTheDocument();
    expect(await screen.findByText("Nightly a")).toBeInTheDocument();
    expect(screen.getByText("Nightly b")).toBeInTheDocument();
  });

  it("shows an empty state with a create action", async () => {
    vi.mocked(api.listSchedules).mockResolvedValue({ schedules: [], total: 0 });
    renderWithProviders(<SchedulesPage />);

    expect(await screen.findByText("No schedules yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /create schedule/i }).length).toBeGreaterThan(0);
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(api.listSchedules).mockRejectedValue(new api.ApiError(500, "down", "down"));
    renderWithProviders(<SchedulesPage />);

    expect(await screen.findByText("Could not load schedules")).toBeInTheDocument();
  });
});
