import { describe, expect, it } from "vitest";
import { buildWorkflowSystemPrompt } from "../prompts/system";
import { buildExpressionPrompt } from "../prompts/expression";
import type { Tool, Wire, WorkflowMeta, FieldValue, EmissionMap } from "@domain/workflow/entities/workflow";

describe("system prompt", () => {
  it("should include empty canvas notice when no tools", () => {
    const prompt = buildWorkflowSystemPrompt([], [], makeMetadata());
    expect(prompt).toContain("Canvas is empty");
  });

  it("should list tools on the canvas", () => {
    const tools: Tool[] = [
      makeTool("t1", "Input", { category: "file", type: "csv", source: "/data/test.csv" }),
      makeTool("t2", "Filter", { expression: "pl.col('Age') > 18" }),
    ];
    const wires: Wire[] = [
      { from: { tool: "t1", socket: "Output" }, to: { tool: "t2", socket: "Input" } },
    ];

    const prompt = buildWorkflowSystemPrompt(tools, wires, makeMetadata());
    expect(prompt).toContain("Input");
    expect(prompt).toContain("Filter");
    expect(prompt).toContain("2 tool(s)");
    expect(prompt).toContain("1 wire(s)");
  });

  it("should include workflow name", () => {
    const meta = makeMetadata("Test Workflow");
    const prompt = buildWorkflowSystemPrompt([], [], meta);
    expect(prompt).toContain("Test Workflow");
  });

  it("should list available tool types", () => {
    const prompt = buildWorkflowSystemPrompt([], [], makeMetadata());
    expect(prompt).toContain("Input:");
    expect(prompt).toContain("Filter:");
    expect(prompt).toContain("Formula:");
    expect(prompt).toContain("Sort:");
  });

  it("should include rules and guidelines", () => {
    const prompt = buildWorkflowSystemPrompt([], [], makeMetadata());
    expect(prompt).toContain("Always check column metadata");
    expect(prompt).toContain("Build reproducible pipelines");
  });
});

describe("expression prompt", () => {
  it("should include column metadata", () => {
    const columns = [
      { name: "Age", dtype: "Int64", nullable: false },
      { name: "Name", dtype: "String", nullable: true },
    ];
    const prompt = buildExpressionPrompt(columns, "filter by age", "Filter");
    expect(prompt).toContain("Age (Int64)");
    expect(prompt).toContain("Name (String, nullable)");
  });

  it("should include tool type context", () => {
    const prompt = buildExpressionPrompt([], "test", "Filter");
    expect(prompt).toContain("Filter");
    expect(prompt).toContain("boolean");
  });

  it("should include user request", () => {
    const prompt = buildExpressionPrompt([], "keep rows where age > 18", "Filter");
    expect(prompt).toContain("keep rows where age > 18");
  });

  it("should include Polars functions when provided", () => {
    const prompt = buildExpressionPrompt([], "test", "Formula", ["mean", "std", "sum"]);
    expect(prompt).toContain("mean");
    expect(prompt).toContain("sum");
  });

  it("should work for Formula tool type", () => {
    const prompt = buildExpressionPrompt([], "calculate total", "Formula");
    expect(prompt).toContain("Formula");
    expect(prompt).toContain("new column");
  });
});

// Helpers
function makeMetadata(name = "Test Workflow"): WorkflowMeta {
  return {
    name,
    description: "Test",
    author: "Test",
    workflowId: "test-wf-id",
    created: new Date().toISOString(),
  };
}

function makeTool(id: string, type: string, config: Record<string, FieldValue | EmissionMap | undefined> = {}): Tool {
  return {
    id,
    type,
    x: 0,
    y: 0,
    config,
    sockets: [
      { id: "Input", direction: "input" },
      { id: "Output", direction: "output" },
    ],
  };
}
