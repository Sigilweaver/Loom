import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@api";
import { renderWithProviders } from "../test/render";
import { WorkflowsPage } from "./WorkflowsPage";

vi.mock("@api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api")>()),
  listWorkflows: vi.fn(),
}));

function workflow(name: string, extra: Partial<api.WorkflowMetadata> = {}): api.WorkflowMetadata {
  return {
    id: name,
    name,
    description: "",
    author: "",
    workflow_id: name,
    folder_path: "/",
    tags: [],
    checksum: "abc",
    uploaded_by: "ada",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

const listed = (workflows: api.WorkflowMetadata[]) => ({ workflows, total: workflows.length });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("WorkflowsPage", () => {
  it("shows a loading state, then the workflows", async () => {
    vi.mocked(api.listWorkflows).mockResolvedValue(
      listed([workflow("Sales report"), workflow("Churn model")])
    );
    renderWithProviders(<WorkflowsPage />);

    expect(screen.getByText("Loading workflows...")).toBeInTheDocument();
    expect(await screen.findByText("Sales report")).toBeInTheDocument();
    expect(screen.getByText("Churn model")).toBeInTheDocument();
  });

  it("shows an empty state with an upload action when there are none", async () => {
    vi.mocked(api.listWorkflows).mockResolvedValue(listed([]));
    renderWithProviders(<WorkflowsPage />);

    expect(await screen.findByText("No workflows yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /upload workflow/i }).length).toBeGreaterThan(0);
  });

  it("shows the error and retries on request", async () => {
    vi.mocked(api.listWorkflows)
      .mockRejectedValueOnce(new api.ApiError(500, "boom", "boom"))
      .mockResolvedValue(listed([workflow("Recovered")]));
    renderWithProviders(<WorkflowsPage />);

    expect(await screen.findByText("Could not load workflows")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(await screen.findByText("Recovered")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    vi.mocked(api.listWorkflows).mockResolvedValue(
      listed([workflow("Sales report"), workflow("Churn model")])
    );
    renderWithProviders(<WorkflowsPage />);
    await screen.findByText("Sales report");

    await userEvent.type(screen.getByRole("searchbox"), "churn");

    expect(screen.queryByText("Sales report")).not.toBeInTheDocument();
    expect(screen.getByText("Churn model")).toBeInTheDocument();
  });
});
