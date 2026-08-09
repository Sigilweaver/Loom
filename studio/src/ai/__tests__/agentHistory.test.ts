import type { Tool, WorkflowMeta } from "@domain/workflow/entities/workflow";
import { useHistoryStore } from "@state/historyStore";
import { useWorkflowStore } from "@state/workflowStore";
import { beforeEach, describe, expect, it } from "vitest";
import { beginAgentTurn, commitAgentTurn } from "../agent";

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
    beginAgentTurn();
    useWorkflowStore.getState().addTool(tool("agent-added"));

    commitAgentTurn();
    undo();

    expect(useWorkflowStore.getState().tools.map(({ id }) => id)).toEqual([
      "manual",
    ]);
    expect(useWorkflowStore.getState().workflowMeta).toEqual(meta);
  });

  it("undoes an AI-initiated remove", () => {
    useWorkflowStore.getState().addTool(tool("remove-me"));
    beginAgentTurn();
    useWorkflowStore.getState().removeTool("remove-me");

    commitAgentTurn();
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
    beginAgentTurn();
    useWorkflowStore
      .getState()
      .updateToolConfiguration("manual", { path: "agent.csv" });

    commitAgentTurn();
    undo();

    expect(useWorkflowStore.getState().tools[0]?.config).toEqual(
      originalConfig,
    );
  });

  it("records one undo unit for multiple mutations in a turn", () => {
    beginAgentTurn();
    useWorkflowStore.getState().addTool(tool("first"));
    useWorkflowStore.getState().addTool(tool("second"));
    useWorkflowStore
      .getState()
      .updateToolConfiguration("manual", { path: "agent.csv" });

    // Nothing is recorded mid-turn; the single entry appears on commit.
    expect(useHistoryStore.getState().past).toHaveLength(0);
    commitAgentTurn();
    expect(useHistoryStore.getState().past).toHaveLength(1);

    undo();
    expect(useWorkflowStore.getState().tools.map(({ id }) => id)).toEqual([
      "manual",
    ]);
  });

  it("leaves history untouched when a turn changes nothing", () => {
    // A question-only turn ("explain this pipeline") must not consume an undo
    // step, and crucially must not clear a redo the user still wants.
    const before = useWorkflowStore.getState();
    useHistoryStore
      .getState()
      .pushState(before.tools, before.wires, before.workflowMeta);
    useWorkflowStore.getState().addTool(tool("manual-second"));

    undo();
    expect(useHistoryStore.getState().canRedo()).toBe(true);
    const depthBefore = useHistoryStore.getState().past.length;

    beginAgentTurn();
    commitAgentTurn();

    expect(useHistoryStore.getState().canRedo()).toBe(true);
    expect(useHistoryStore.getState().past.length).toBe(depthBefore);
  });

  it("records a turn that mutated before failing partway", () => {
    beginAgentTurn();
    useWorkflowStore.getState().addTool(tool("agent-partial"));
    // simulates the finally block running after the turn threw
    commitAgentTurn();

    undo();

    expect(useWorkflowStore.getState().tools.map((t) => t.id)).toEqual([
      "manual",
    ]);
  });
});
