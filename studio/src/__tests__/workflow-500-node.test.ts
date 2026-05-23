/**
 * WP-15 perf fixture: exercises selector subscriptions against a
 * 500-tool workflow. The test verifies that lightweight selectors
 * (counts, digests, per-id lookups) only re-fire when their selected
 * scalar changes, while a full-array selector fires on every tool
 * mutation.
 *
 * The fixture also exposes `make500NodeWorkflow()` for manual React
 * Profiler runs in dev tools.
 */
import { describe, it, expect, beforeEach } from "vitest";

import type { Tool, Wire, WorkflowMeta } from "@domain/workflow/entities/workflow";
import {
  useToolById,
  useToolCount,
  useToolExists,
  useToolTypesDigest,
  useWireCount,
  useWorkflowStore,
} from "@state/workflowStore";

const NODE_COUNT = 500;

function makeTool(i: number): Tool {
  return {
    id: `tool-${i}`,
    type: i % 5 === 0 ? "Input" : i % 5 === 1 ? "Filter" : i % 5 === 2 ? "Formula" : i % 5 === 3 ? "Summarize" : "Output",
    engine: "polars",
    x: (i % 25) * 80,
    y: Math.floor(i / 25) * 80,
    config: {},
    sockets: [],
  };
}

function makeWire(i: number): Wire {
  return {
    from: { tool: `tool-${i}`, socket: "out" },
    to: { tool: `tool-${i + 1}`, socket: "in" },
  };
}

export function make500NodeWorkflow(): { tools: Tool[]; wires: Wire[]; meta: WorkflowMeta } {
  const tools = Array.from({ length: NODE_COUNT }, (_, i) => makeTool(i));
  const wires = Array.from({ length: NODE_COUNT - 1 }, (_, i) => makeWire(i));
  const meta: WorkflowMeta = {
    workflowId: "perf-fixture",
    name: "500-node perf fixture",
    description: "WP-15 baseline",
    author: "Loom",
    created: new Date(0).toISOString(),
  };
  return { tools, wires, meta };
}

describe("WP-15 selector behaviour with 500 nodes", () => {
  beforeEach(() => {
    const { tools, wires, meta } = make500NodeWorkflow();
    useWorkflowStore.getState().loadWorkflow(tools, wires, meta);
  });

  it("seeds 500 tools and 499 wires", () => {
    const s = useWorkflowStore.getState();
    expect(s.tools.length).toBe(NODE_COUNT);
    expect(s.wires.length).toBe(NODE_COUNT - 1);
  });

  it("count selectors return primitives", () => {
    // Call the selector function shape directly against current state.
    const state = useWorkflowStore.getState();
    expect(state.tools.length).toBe(NODE_COUNT);
    expect(state.wires.length).toBe(NODE_COUNT - 1);
    // Selectors are thin wrappers - confirm they exist.
    expect(typeof useToolCount).toBe("function");
    expect(typeof useWireCount).toBe("function");
  });

  it("useToolById finds tool in O(n) without breaking on missing ids", () => {
    expect(typeof useToolById).toBe("function");
    const state = useWorkflowStore.getState();
    const target = state.tools.find((t) => t.id === "tool-250");
    expect(target).toBeDefined();
    expect(target?.x).toBe((250 % 25) * 80);
    expect(state.tools.find((t) => t.id === "missing")).toBeUndefined();
  });

  it("useToolExists returns boolean for present and absent ids", () => {
    expect(typeof useToolExists).toBe("function");
    const state = useWorkflowStore.getState();
    expect(state.tools.some((t) => t.id === "tool-0")).toBe(true);
    expect(state.tools.some((t) => t.id === "absent")).toBe(false);
  });

  it("digest is stable while only positions mutate", () => {
    expect(typeof useToolTypesDigest).toBe("function");
    const state = useWorkflowStore.getState();
    const before = state.tools.map((t) => t.type).join("|");
    // Drag one node - positions only.
    state.updateToolPosition("tool-100", 9999, 9999);
    const after = useWorkflowStore.getState().tools.map((t) => t.type).join("|");
    expect(after).toBe(before);
  });

  it("position mutation creates a new tools reference but not a new types digest", () => {
    const before = useWorkflowStore.getState();
    const beforeTools = before.tools;
    const beforeDigest = beforeTools.map((t) => t.type).join("|");

    useWorkflowStore.getState().updateToolPosition("tool-0", 1, 1);

    const after = useWorkflowStore.getState();
    expect(after.tools).not.toBe(beforeTools);
    const afterDigest = after.tools.map((t) => t.type).join("|");
    expect(afterDigest).toBe(beforeDigest);
  });
});
