import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tool } from "@domain/workflow/entities/workflow";
import { useValidationStore } from "@state/validationStore";
import { useWorkflowStore } from "@state/workflowStore";
import ProblemsViewer from "../ProblemsViewer";

const setNodes = vi.fn();
const fitView = vi.fn();

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ setNodes, fitView }),
}));

const reader: Tool = {
  id: "in",
  type: "Input",
  x: 0,
  y: 0,
  config: { category: "file", source: "" },
  sockets: [{ id: "output", direction: "output" }],
};

describe("ProblemsViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useValidationStore.getState().dismiss();
    useWorkflowStore.setState({ tools: [], wires: [], selectedTool: null });
  });

  it("offers to validate before validation has run", () => {
    const onValidate = vi.fn();
    render(<ProblemsViewer onValidate={onValidate} />);

    fireEvent.click(screen.getByRole("button", { name: "Validate workflow" }));

    expect(onValidate).toHaveBeenCalledTimes(1);
  });

  it("lists problems and selects the tool when one is clicked", () => {
    useWorkflowStore.setState({ tools: [reader], wires: [] });
    useValidationStore.getState().run();

    render(<ProblemsViewer onValidate={() => {}} />);

    expect(screen.getByRole("status").textContent).toMatch(/found\.$/);
    fireEvent.click(screen.getByRole("button", { name: /Choose a file to read/ }));

    expect(useWorkflowStore.getState().selectedTool?.id).toBe("in");
    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: [{ id: "in" }] }));
  });

  it("shows a ready message when nothing is wrong, and can be dismissed", () => {
    useWorkflowStore.setState({
      tools: [
        { ...reader, config: { category: "file", source: "/a.csv" } },
        {
          id: "out",
          type: "Output",
          x: 0,
          y: 0,
          config: { destination: "/b.csv" },
          sockets: [{ id: "input", direction: "input" }],
        },
      ],
      wires: [{ from: { tool: "in", socket: "output" }, to: { tool: "out", socket: "input" } }],
    });
    useValidationStore.getState().run();

    render(<ProblemsViewer onValidate={() => {}} />);

    expect(screen.getByText("This workflow is ready to run.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(useValidationStore.getState().active).toBe(false);
  });
});
