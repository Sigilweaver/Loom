import type { Tool, WorkflowMeta } from "@domain/workflow/entities/workflow";
import { useHistoryStore } from "@state/historyStore";
import { useWorkflowStore } from "@state/workflowStore";
import { beforeEach, describe, expect, it } from "vitest";
import { recordAgentTurnSnapshot } from "../agent";

const meta: WorkflowMeta = {
  name: "Manual workflow",
  description: "Created before the agent turn",
  author: "Tester",
  workflowId: "workflow-78",
  created: "2026-08-09T00:00:00.000Z",
};

function tool(id: string, config: Tool["config"] = {}): Tool {
  return {
    id,
    type: "Input",
    x: 0,
    y: 0,
    sockets: [{ id: "output", direction: "output" }],
    config,
  };
}

function undo(): void {
  const snapshot = useHistoryStore.getState().undo();
  expect(snapshot).not.toBeNull();
  useWorkflowStore
    .getState()
    .loadWorkflow(snapshot!.tools, snapshot!.wires, snapshot!.meta);
}

describe("agent turn history", () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
    useWorkflowStore.getState().loadWorkflow([tool("manual")], [], meta);
  });

  it("undoes an AI-initiated add without discarding unrelated manual work", () => {
    recordAgentTurnSnapshot();
    useWorkflowStore.getState().addTool(tool("agent-added"));

    undo();

    expect(useWorkflowStore.getState().tools.map(({ id }) => id)).toEqual([
      "manual",
    ]);
    expect(useWorkflowStore.getState().workflowMeta).toEqual(meta);
  });

  it("undoes an AI-initiated remove", () => {
    useWorkflowStore.getState().addTool(tool("remove-me"));
    recordAgentTurnSnapshot();
    useWorkflowStore.getState().removeTool("remove-me");

    undo();

    expect(useWorkflowStore.getState().tools.map(({ id }) => id)).toEqual([
      "manual",
      "remove-me",
    ]);
  });

  it("undoes an AI-initiated configuration change", () => {
    const originalConfig = { path: "manual.csv" };
    useWorkflowStore
      .getState()
      .updateToolConfiguration("manual", originalConfig);
    recordAgentTurnSnapshot();
    useWorkflowStore
      .getState()
      .updateToolConfiguration("manual", { path: "agent.csv" });

    undo();

    expect(useWorkflowStore.getState().tools[0]?.config).toEqual(
      originalConfig,
    );
  });

  it("records one undo unit for multiple mutations in a turn", () => {
    recordAgentTurnSnapshot();
    useWorkflowStore.getState().addTool(tool("first"));
    useWorkflowStore.getState().addTool(tool("second"));
    useWorkflowStore
      .getState()
      .updateToolConfiguration("manual", { path: "agent.csv" });

    expect(useHistoryStore.getState().past).toHaveLength(1);
    undo();
    expect(useWorkflowStore.getState().tools.map(({ id }) => id)).toEqual([
      "manual",
    ]);
  });
});
