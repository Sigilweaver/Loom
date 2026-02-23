import { describe, expect, it } from "vitest";
import { compileSpec, type SimplifiedSpec } from "../compiler";

describe("compileSpec", () => {
  it("should compile a simple linear workflow", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "load", type: "Input", config: { category: "file", type: "csv", source: "/data/test.csv" } },
        { id: "filter", type: "Filter", config: { expression: "pl.col('Age') > 18" } },
        { id: "save", type: "Output", config: { type: "csv", path: "/data/output.csv" } },
      ],
      connections: [
        { from: "load", to: "filter" },
        { from: "filter", to: "save" },
      ],
      name: "Test Workflow",
    };

    const result = compileSpec(spec);

    expect(result.success).toBe(true);
    expect(result.tools).toHaveLength(3);
    expect(result.wires).toHaveLength(2);
    expect(result.meta?.name).toBe("Test Workflow");
  });

  it("should assign UUIDs to all tools", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "a", type: "Input" },
        { id: "b", type: "Filter" },
      ],
      connections: [{ from: "a", to: "b" }],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);

    // Each tool should have a unique UUID
    const ids = result.tools!.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
    // UUIDs should not be the simple IDs
    expect(ids[0]).not.toBe("a");
    expect(ids[1]).not.toBe("b");
  });

  it("should inject sockets from tool definitions", () => {
    const spec: SimplifiedSpec = {
      steps: [{ id: "f", type: "Filter" }],
      connections: [],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);
    expect(result.tools![0]!.sockets.length).toBeGreaterThan(0);
  });

  it("should resolve connections to proper wire format", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "a", type: "Input" },
        { id: "b", type: "Filter" },
      ],
      connections: [{ from: "a", to: "b" }],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);

    const wire = result.wires![0]!;
    expect(wire.from.tool).toBe(result.tools![0]!.id);
    expect(wire.to.tool).toBe(result.tools![1]!.id);
    expect(wire.from.socket).toBeTruthy();
    expect(wire.to.socket).toBeTruthy();
  });

  it("should auto-layout tools with positions", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "a", type: "Input" },
        { id: "b", type: "Filter" },
        { id: "c", type: "Output" },
      ],
      connections: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);

    // Tools should not all be at (0,0)
    const positions = result.tools!.map((t) => ({ x: t.x, y: t.y }));
    const allZero = positions.every((p) => p.x === 0 && p.y === 0);
    expect(allZero).toBe(false);
  });

  it("should merge config with defaults", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "f", type: "Filter", config: { expression: "pl.col('x') > 5" } },
      ],
      connections: [],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);
    expect(result.tools![0]!.config.expression).toBe("pl.col('x') > 5");
  });

  it("should fail for unknown tool types", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "x", type: "NonexistentTool" },
      ],
      connections: [],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("NonexistentTool"))).toBe(true);
  });

  it("should fail for duplicate step IDs", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "a", type: "Input" },
        { id: "a", type: "Filter" },
      ],
      connections: [],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.includes("Duplicate"))).toBe(true);
  });

  it("should fail for connections referencing unknown steps", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "a", type: "Input" },
      ],
      connections: [{ from: "a", to: "nonexistent" }],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.includes("nonexistent"))).toBe(true);
  });

  it("should handle a Join with explicit socket names", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "left", type: "Input" },
        { id: "right", type: "Input" },
        { id: "join", type: "Join", config: { joinType: "inner", leftKey: "id", rightKey: "id" } },
      ],
      connections: [
        { from: "left", to: "join", toSocket: "Left" },
        { from: "right", to: "join", toSocket: "Right" },
      ],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);
    expect(result.wires).toHaveLength(2);
    expect(result.wires![0]!.to.socket).toBe("Left");
    expect(result.wires![1]!.to.socket).toBe("Right");
  });

  it("should set workflow metadata with custom author", () => {
    const spec: SimplifiedSpec = {
      steps: [{ id: "a", type: "Input" }],
      connections: [],
      name: "My Workflow",
      description: "Test description",
    };

    const result = compileSpec(spec, "TestUser");
    expect(result.success).toBe(true);
    expect(result.meta!.name).toBe("My Workflow");
    expect(result.meta!.description).toBe("Test description");
    expect(result.meta!.author).toBe("TestUser");
  });

  it("should use default metadata when not provided", () => {
    const spec: SimplifiedSpec = {
      steps: [{ id: "a", type: "Input" }],
      connections: [],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);
    expect(result.meta!.name).toBe("AI-Generated Workflow");
    expect(result.meta!.workflowId).toBeTruthy();
  });

  it("should handle empty spec", () => {
    const spec: SimplifiedSpec = {
      steps: [],
      connections: [],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);
    expect(result.tools).toHaveLength(0);
    expect(result.wires).toHaveLength(0);
  });

  it("should propagate agent-provided comments to compiled tools", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "load", type: "Input", config: { category: "file", type: "csv", source: "/data/test.csv" }, comment: "Load raw sales data" },
        { id: "filter", type: "Filter", config: { expression: "pl.col('age') > 18" }, comment: "Keep adult customers" },
      ],
      connections: [{ from: "load", to: "filter" }],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);
    expect(result.tools![0]!.comment).toBe("Load raw sales data");
    expect(result.tools![1]!.comment).toBe("Keep adult customers");
  });

  it("should auto-generate comments when agent does not provide them", () => {
    const spec: SimplifiedSpec = {
      steps: [
        { id: "load", type: "Input", config: { category: "file", type: "csv", source: "/data/test.csv" } },
      ],
      connections: [],
    };

    const result = compileSpec(spec);
    expect(result.success).toBe(true);
    // Should have an auto-generated comment from the comment generator
    expect(result.tools![0]!.comment).toBeTruthy();
  });
});
