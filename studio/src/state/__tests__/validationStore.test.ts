import { beforeEach, describe, expect, it } from "vitest";
import type { Tool } from "../../domain/workflow/entities/workflow";
import { runWorkflowValidation, useValidationStore } from "../validationStore";
import { useUIStore } from "../uiStore";
import { useWorkflowStore } from "../workflowStore";

const reader: Tool = {
  id: "in",
  type: "Input",
  x: 0,
  y: 0,
  config: { category: "file", source: "" },
  sockets: [{ id: "output", direction: "output" }],
};

const writer: Tool = {
  id: "out",
  type: "Output",
  x: 0,
  y: 0,
  config: { destination: "/tmp/out.csv" },
  sockets: [{ id: "input", direction: "input" }],
};

describe("validationStore", () => {
  beforeEach(() => {
    useValidationStore.getState().dismiss();
    useWorkflowStore.setState({ tools: [], wires: [], selectedTool: null });
    useUIStore.setState({ bottomPaneOpen: false, activeBottomTab: "preview" });
  });

  it("starts inactive with no issues", () => {
    const state = useValidationStore.getState();
    expect(state.active).toBe(false);
    expect(state.issues).toEqual([]);
  });

  it("run activates results and groups issues by tool", () => {
    useWorkflowStore.setState({ tools: [reader, writer], wires: [] });

    const summary = useValidationStore.getState().run();

    const state = useValidationStore.getState();
    expect(state.active).toBe(true);
    expect(summary.errors).toBeGreaterThan(0);
    expect(state.issuesByTool["in"]?.some((i) => i.message === "Choose a file to read.")).toBe(true);
    expect(state.issuesByTool["out"]?.some((i) => i.message === "The input is not connected.")).toBe(true);
    // Labels use the friendly tool names shown in the palette
    expect(state.issuesByTool["in"]?.[0]?.toolLabel).toBe("Read");
  });

  it("refresh re-validates only while active", () => {
    useWorkflowStore.setState({ tools: [reader, writer], wires: [] });

    useValidationStore.getState().refresh();
    expect(useValidationStore.getState().issues).toEqual([]);

    useValidationStore.getState().run();
    const before = useValidationStore.getState().issues.length;

    useWorkflowStore.setState({
      tools: [{ ...reader, config: { category: "file", source: "/data/a.csv" } }, writer],
      wires: [{ from: { tool: "in", socket: "output" }, to: { tool: "out", socket: "input" } }],
    });
    useValidationStore.getState().refresh();

    expect(useValidationStore.getState().issues.length).toBeLessThan(before);
    expect(useValidationStore.getState().issues).toEqual([]);
  });

  it("dismiss clears results", () => {
    useWorkflowStore.setState({ tools: [reader], wires: [] });
    useValidationStore.getState().run();

    useValidationStore.getState().dismiss();

    const state = useValidationStore.getState();
    expect(state.active).toBe(false);
    expect(state.issues).toEqual([]);
    expect(state.issuesByTool).toEqual({});
  });

  describe("runWorkflowValidation", () => {
    it("opens the Problems tab and reports problems", () => {
      useWorkflowStore.setState({ tools: [reader], wires: [] });

      runWorkflowValidation();

      const ui = useUIStore.getState();
      expect(ui.bottomPaneOpen).toBe(true);
      expect(ui.activeBottomTab).toBe("problems");
      expect(ui.notification.isVisible).toBe(true);
      expect(ui.notification.type).toBe("error");
      expect(ui.notification.message).toMatch(/^Found \d+ errors?/);
    });

    it("reports success for a clean workflow", () => {
      useWorkflowStore.setState({
        tools: [{ ...reader, config: { category: "file", source: "/data/a.csv" } }, writer],
        wires: [{ from: { tool: "in", socket: "output" }, to: { tool: "out", socket: "input" } }],
      });

      const summary = runWorkflowValidation();

      expect(summary).toEqual({ errors: 0, warnings: 0 });
      expect(useUIStore.getState().notification.type).toBe("success");
    });
  });
});
