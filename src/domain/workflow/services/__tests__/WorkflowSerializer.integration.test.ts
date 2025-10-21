import { Tool, Wire, WorkflowMeta } from "@domain/workflow/entities/workflow";
import { describe, expect, it } from "vitest";
import { WorkflowSerializer } from "../WorkflowSerializer";

describe("WorkflowSerializer - Import/Export Integration", () => {
  it("should handle tools with optional socket fields (multiple, type)", () => {
    // Create tools with various socket configurations
    const tools: Tool[] = [
      {
        id: "input_001",
        type: "Input",
        x: 100,
        y: 100,
        config: {},
        sockets: [
          { id: 0, direction: "output" }, // No 'multiple' or 'type'
        ],
      },
      {
        id: "output_001",
        type: "Output",
        x: 300,
        y: 100,
        config: {},
        sockets: [
          { id: 0, direction: "input" }, // No 'multiple' or 'type'
        ],
      },
      {
        id: "union_001",
        type: "Union",
        x: 200,
        y: 200,
        config: {},
        sockets: [
          { id: 0, direction: "input", multiple: true }, // Has 'multiple'
          { id: 1, direction: "output" },
        ],
      },
      {
        id: "join_001",
        type: "Join",
        x: 400,
        y: 200,
        config: {},
        sockets: [
          { id: 0, direction: "input", type: "L" }, // Has 'type'
          { id: 1, direction: "input", type: "R" },
          { id: 2, direction: "output", type: "J" },
        ],
      },
    ];

    const wires: Wire[] = [
      {
        from: { tool: "input_001", socket: 0 },
        to: { tool: "output_001", socket: 0 },
      },
      {
        from: { tool: "input_001", socket: 0 },
        to: { tool: "union_001", socket: 0 },
      },
    ];

    const meta: WorkflowMeta = {
      name: "Socket Test Workflow",
      description: "Tests optional socket fields",
      author: "Test Suite",
      workflowId: "test_001",
      created: "2025-10-20T00:00:00.000Z",
    };

    // Export to JSON
    const json = WorkflowSerializer.toJSON(tools, wires, meta);

    // Verify it's valid JSON
    expect(() => JSON.parse(json)).not.toThrow();

    // Import back
    const imported = WorkflowSerializer.fromJSON(json);

    // Verify all tools imported correctly
    expect(imported.tools).toHaveLength(4);
    expect(imported.wires).toHaveLength(2);
    expect(imported.meta.name).toBe("Socket Test Workflow");

    // Verify socket structures preserved
    const inputTool = imported.tools.find((t) => t.id === "input_001");
    expect(inputTool?.sockets[0]).toEqual({ id: 0, direction: "output" });

    const unionTool = imported.tools.find((t) => t.id === "union_001");
    expect(unionTool?.sockets[0]).toEqual({
      id: 0,
      direction: "input",
      multiple: true,
    });

    const joinTool = imported.tools.find((t) => t.id === "join_001");
    expect(joinTool?.sockets[0]).toEqual({
      id: 0,
      direction: "input",
      type: "L",
    });
  });

  it("should validate and reject sockets with wrong types for optional fields", () => {
    const invalidWorkflow = {
      version: "2.0",
      meta: {
        name: "Invalid",
        workflowId: "test",
        description: "",
        author: "",
        created: "2025-10-20T00:00:00.000Z",
      },
      tools: [
        {
          id: "tool_001",
          type: "Input",
          x: 0,
          y: 0,
          config: {},
          sockets: [
            { id: 0, direction: "output", multiple: "yes" }, // Wrong type - string instead of boolean
          ],
        },
      ],
      wires: [],
    };

    const json = JSON.stringify(invalidWorkflow);
    expect(() => WorkflowSerializer.fromJSON(json)).toThrow(
      /must be a boolean if present/
    );
  });

  it("should validate and reject sockets with wrong type for 'type' field", () => {
    const invalidWorkflow = {
      version: "2.0",
      meta: {
        name: "Invalid",
        workflowId: "test",
        description: "",
        author: "",
        created: "2025-10-20T00:00:00.000Z",
      },
      tools: [
        {
          id: "tool_001",
          type: "Join",
          x: 0,
          y: 0,
          config: {},
          sockets: [
            { id: 0, direction: "input", type: 123 }, // Wrong type - number instead of string
          ],
        },
      ],
      wires: [],
    };

    const json = JSON.stringify(invalidWorkflow);
    expect(() => WorkflowSerializer.fromJSON(json)).toThrow(
      /must be a string if present/
    );
  });

  it("should handle real-world export/import scenario", () => {
    // Simulate a real workflow created by the app
    const tools: Tool[] = [
      {
        id: "tool_1729438200001",
        type: "Input",
        x: 150,
        y: 200,
        config: {
          category: "file",
          type: "csv",
          filePath: "/data/input.csv",
        },
        sockets: [{ id: 0, direction: "output" }],
      },
      {
        id: "tool_1729438200002",
        type: "Filter",
        x: 350,
        y: 200,
        config: {
          condition: "value > 100",
        },
        sockets: [
          { id: 0, direction: "input" },
          { id: 1, direction: "output" },
        ],
      },
      {
        id: "tool_1729438200003",
        type: "Output",
        x: 550,
        y: 200,
        config: {
          filePath: "/data/output.csv",
        },
        sockets: [{ id: 0, direction: "input" }],
      },
    ];

    const wires: Wire[] = [
      {
        from: { tool: "tool_1729438200001", socket: 0 },
        to: { tool: "tool_1729438200002", socket: 0 },
      },
      {
        from: { tool: "tool_1729438200002", socket: 1 },
        to: { tool: "tool_1729438200003", socket: 0 },
      },
    ];

    const meta: WorkflowMeta = {
      name: "Data Processing Pipeline",
      description: "Filters CSV data based on value threshold",
      author: "Test User",
      workflowId: "wf_1729438200000",
      created: "2025-10-20T14:10:00.000Z",
    };

    // Export
    const json = WorkflowSerializer.toJSON(tools, wires, meta);

    // Verify pretty-printed
    expect(json).toContain("\n");
    expect(json).toContain("  ");

    // Import
    const {
      tools: importedTools,
      wires: importedWires,
      meta: importedMeta,
    } = WorkflowSerializer.fromJSON(json);

    // Verify complete round-trip
    expect(importedTools).toEqual(tools);
    expect(importedWires).toEqual(wires);
    expect(importedMeta).toEqual(meta);
  });
});
