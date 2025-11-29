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
          { id: 'output', direction: 'output' }, // No 'multiple' or 'type'
        ],
      },
      {
        id: "output_001",
        type: "Output",
        x: 300,
        y: 100,
        config: {},
        sockets: [
          { id: 'input', direction: 'input' }, // No 'multiple' or 'type'
        ],
      },
      {
        id: "union_001",
        type: "Union",
        x: 200,
        y: 200,
        config: {},
        sockets: [
          { id: 'input', direction: 'input', multiple: true }, // Has 'multiple'
          { id: 'output', direction: 'output' },
        ],
      },
      {
        id: "join_001",
        type: "Join",
        x: 400,
        y: 200,
        config: {},
        sockets: [
          { id: 'input', direction: 'input', type: "L" }, // Has 'type'
          { id: 'input', direction: 'input', type: "R" },
          { id: 'output-false', direction: 'output', type: "J" },
        ],
      },
    ];

    const wires: Wire[] = [
      {
        from: { tool: "input_001", socket: 'output' },
        to: { tool: "output_001", socket: 'input' },
      },
      {
        from: { tool: "input_001", socket: 'output' },
        to: { tool: "union_001", socket: 'input' },
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
    expect(inputTool?.sockets[0]).toEqual({ id: 'output', direction: 'output' });

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
            { id: 'output', direction: 'output', multiple: "yes" }, // Wrong type - string instead of boolean
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
            { id: 'input', direction: 'input', type: 123 }, // Wrong type - number instead of string
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
        sockets: [{ id: 'output', direction: 'output' }],
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
          { id: 'input', direction: 'input' },
          { id: 'output', direction: 'output' },
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
        sockets: [{ id: 'input', direction: 'input' }],
      },
    ];

    const wires: Wire[] = [
      {
        from: { tool: "tool_1729438200001", socket: 'output' },
        to: { tool: "tool_1729438200002", socket: 'input' },
      },
      {
        from: { tool: "tool_1729438200002", socket: 'output' },
        to: { tool: "tool_1729438200003", socket: 'input' },
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

  it("should always include source and destination fields even without _emit", () => {
    // Create tools with source/destination but no _emit map
    const tools: Tool[] = [
      {
        id: "input_001",
        type: "Input",
        x: 100,
        y: 100,
        config: {
          category: "file",
          type: "csv",
          csvMode: "scan",
          source: "/path/to/input.csv",
          // No _emit map - source should still be included
        },
        sockets: [{ id: "output", direction: "output" }],
      },
      {
        id: "output_001",
        type: "Output",
        x: 300,
        y: 100,
        config: {
          category: "file",
          type: "csv",
          destination: "/path/to/output.csv",
          // No _emit map - destination should still be included
        },
        sockets: [{ id: "input", direction: "input" }],
      },
    ];

    const wires: Wire[] = [
      {
        from: { tool: "input_001", socket: "output" },
        to: { tool: "output_001", socket: "input" },
      },
    ];

    const meta: WorkflowMeta = {
      name: "Source/Destination Test",
      description: "Tests that source and destination are always serialized",
      author: "Test Suite",
      workflowId: "test_source_dest",
      created: "2025-11-29T00:00:00.000Z",
    };

    // Export to JSON
    const json = WorkflowSerializer.toJSON(tools, wires, meta);
    const parsed = JSON.parse(json);

    // Verify source is included for Input tool
    const inputTool = parsed.tools.find((t: Tool) => t.id === "input_001");
    expect(inputTool.config.source).toBe("/path/to/input.csv");
    expect(inputTool.config.category).toBe("file");
    expect(inputTool.config.type).toBe("csv");
    expect(inputTool.config.csvMode).toBe("scan");

    // Verify destination is included for Output tool
    const outputTool = parsed.tools.find((t: Tool) => t.id === "output_001");
    expect(outputTool.config.destination).toBe("/path/to/output.csv");

    // Import back and verify
    const imported = WorkflowSerializer.fromJSON(json);
    const importedInput = imported.tools.find((t) => t.id === "input_001");
    const importedOutput = imported.tools.find((t) => t.id === "output_001");

    expect(importedInput?.config.source).toBe("/path/to/input.csv");
    expect(importedOutput?.config.destination).toBe("/path/to/output.csv");
  });

  it("should include source/destination even when _emit explicitly marks them false", () => {
    // This tests that alwaysInclude fields override _emit
    const tools: Tool[] = [
      {
        id: "input_001",
        type: "Input",
        x: 100,
        y: 100,
        config: {
          category: "file",
          type: "csv",
          source: "/path/to/data.csv",
          separator: ",",
          _emit: {
            source: false, // Even with false, should be included
            separator: true,
          },
        },
        sockets: [{ id: "output", direction: "output" }],
      },
    ];

    const meta: WorkflowMeta = {
      name: "Emit Override Test",
      description: "Tests alwaysInclude overrides _emit",
      author: "Test Suite",
      workflowId: "test_emit_override",
      created: "2025-11-29T00:00:00.000Z",
    };

    const json = WorkflowSerializer.toJSON(tools, [], meta);
    const parsed = JSON.parse(json);

    const inputTool = parsed.tools[0];
    // source should be included because it's in alwaysInclude
    expect(inputTool.config.source).toBe("/path/to/data.csv");
    // separator should also be included because _emit.separator is true
    expect(inputTool.config.separator).toBe(",");
    // _emit should not be in serialized output
    expect(inputTool.config._emit).toBeUndefined();
  });
});
