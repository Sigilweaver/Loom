import {
  Tool,
  ToolConfig,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { describe, expect, it } from "vitest";
import { WorkflowSerializer } from "../WorkflowSerializer";

// Helper function to create a test tool
const createTestTool = (
  id: string = "tool_001",
  type: string = "csv"
): Tool => ({
  id,
  type,
  x: 100,
  y: 200,
  config: { filePath: "/test/data.csv" } as ToolConfig,
  sockets: [{ id: 'output', direction: 'output', multiple: true }],
});

// Helper function to create a test wire
const createTestWire = (
  fromTool: string = "tool_001",
  fromSocket: string = "output",
  toTool: string = "tool_002",
  toSocket: string = "input"
): Wire => ({
  from: { tool: fromTool, socket: fromSocket },
  to: { tool: toTool, socket: toSocket },
});

// Helper function to create test metadata
const createTestMeta = (name: string = "Test Workflow"): WorkflowMeta => ({
  name,
  description: "Test workflow description",
  author: "Test Author",
  workflowId: "test-workflow-id",
  created: "2025-10-19T10:00:00.000Z",
});

describe("WorkflowSerializer", () => {
  describe("toJSON", () => {
    it("should serialize empty workflow to JSON", () => {
      const json = WorkflowSerializer.toJSON([], [], createTestMeta());
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe("2.0");
      expect(parsed.tools).toEqual([]);
      expect(parsed.wires).toEqual([]);
      expect(parsed.meta.name).toBe("Test Workflow");
    });

    it("should serialize workflow with tools to JSON", () => {
      const tool = createTestTool();
      const json = WorkflowSerializer.toJSON([tool], [], createTestMeta());
      const parsed = JSON.parse(json);

      expect(parsed.tools).toHaveLength(1);
      expect(parsed.tools[0].id).toBe("tool_001");
      expect(parsed.tools[0].type).toBe("csv");
      expect(parsed.tools[0].x).toBe(100);
      expect(parsed.tools[0].y).toBe(200);
    });

    it("should serialize workflow with wires to JSON", () => {
      const tool1 = createTestTool("tool_001");
      const tool2 = createTestTool("tool_002");
      const wire = createTestWire('tool_001', 'output', 'tool_002', 'input');

      const json = WorkflowSerializer.toJSON(
        [tool1, tool2],
        [wire],
        createTestMeta()
      );
      const parsed = JSON.parse(json);

      expect(parsed.wires).toHaveLength(1);
      expect(parsed.wires[0].from.tool).toBe("tool_001");
      expect(parsed.wires[0].from.socket).toBe("output");
      expect(parsed.wires[0].to.tool).toBe("tool_002");
      expect(parsed.wires[0].to.socket).toBe("input");
    });

    it("should serialize complex workflow correctly", () => {
      const tools = [
        createTestTool("tool_001", "csv"),
        createTestTool("tool_002", "join"),
        createTestTool("tool_003", "filter"),
      ];
      const wires = [
        createTestWire('tool_001', 'output', 'tool_002', 'input'),
        createTestWire("tool_002", 'output', 'tool_003', 'input'),
      ];
      const meta = createTestMeta("Complex Workflow");

      const json = WorkflowSerializer.toJSON(tools, wires, meta);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe("2.0");
      expect(parsed.tools).toHaveLength(3);
      expect(parsed.wires).toHaveLength(2);
      expect(parsed.meta.name).toBe("Complex Workflow");
    });

    it("should produce pretty-printed JSON with 2-space indentation", () => {
      const json = WorkflowSerializer.toJSON([], [], createTestMeta());

      // Check for proper indentation
      expect(json).toContain('\n  "version"');
      expect(json).toContain('\n  "meta"');
      expect(json).toContain('\n  "tools"');
      expect(json).toContain('\n  "wires"');
    });
  });

  describe("fromJSON", () => {
    it("should deserialize empty workflow from JSON", () => {
      const json = WorkflowSerializer.toJSON([], [], createTestMeta());
      const { tools, wires, meta } = WorkflowSerializer.fromJSON(json);

      expect(tools).toEqual([]);
      expect(wires).toEqual([]);
      expect(meta.name).toBe("Test Workflow");
    });

    it("should deserialize workflow with tools from JSON", () => {
      const tool = createTestTool();
      const json = WorkflowSerializer.toJSON([tool], [], createTestMeta());
      const { tools } = WorkflowSerializer.fromJSON(json);

      expect(tools).toHaveLength(1);
      expect(tools[0]?.id).toBe("tool_001");
      expect(tools[0]?.type).toBe("csv");
      expect(tools[0]?.x).toBe(100);
      expect(tools[0]?.y).toBe(200);
    });

    it("should deserialize workflow with wires from JSON", () => {
      const tool1 = createTestTool("tool_001");
      const tool2 = createTestTool("tool_002");
      const wire = createTestWire('tool_001', 'output', 'tool_002', 'input');

      const json = WorkflowSerializer.toJSON(
        [tool1, tool2],
        [wire],
        createTestMeta()
      );
      const { wires } = WorkflowSerializer.fromJSON(json);

      expect(wires).toHaveLength(1);
      expect(wires[0]?.from.tool).toBe("tool_001");
      expect(wires[0]?.to.tool).toBe("tool_002");
    });

    it("should throw error for invalid JSON", () => {
      expect(() => {
        WorkflowSerializer.fromJSON("{ invalid json }");
      }).toThrow("Invalid JSON");
    });

    it("should throw error for missing required fields", () => {
      expect(() => {
        WorkflowSerializer.fromJSON("{}");
      }).toThrow("Workflow validation failed");
    });
  });

  describe("round-trip serialization", () => {
    it("should preserve data through round-trip", () => {
      const tools = [
        createTestTool("tool_001", "csv"),
        createTestTool("tool_002", "join"),
      ];
      const wires = [createTestWire('tool_001', 'output', 'tool_002', 'input')];
      const meta = createTestMeta("Round Trip Test");

      // Serialize
      const json = WorkflowSerializer.toJSON(tools, wires, meta);

      // Deserialize
      const {
        tools: parsedTools,
        wires: parsedWires,
        meta: parsedMeta,
      } = WorkflowSerializer.fromJSON(json);

      // Verify data is preserved
      expect(parsedTools).toEqual(tools);
      expect(parsedWires).toEqual(wires);
      expect(parsedMeta).toEqual(meta);
    });

    it("should preserve complex tool configurations", () => {
      const tool: Tool = {
        id: "tool_complex",
        type: "join",
        x: 300,
        y: 400,
        config: {
          joinType: "inner",
          joinKeys: ["id", "customer_id"],
          options: {
            caseSensitive: false,
            nullHandling: "drop",
          },
        } as ToolConfig,
        sockets: [
          { id: 'input', direction: 'input', multiple: false },
          { id: 'input', direction: 'input', multiple: false },
          { id: 'output-false', direction: 'output', multiple: true },
        ],
      };

      const json = WorkflowSerializer.toJSON([tool], [], createTestMeta());
      const { tools } = WorkflowSerializer.fromJSON(json);

      expect(tools[0]).toEqual(tool);
    });
  });

  describe("validate", () => {
    it("should validate correct workflow structure", () => {
      const data = {
        version: "2.0",
        meta: createTestMeta(),
        tools: [createTestTool()],
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should reject non-object data", () => {
      const result = WorkflowSerializer.validate("not an object");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Data must be an object");
    });

    it("should reject missing version field", () => {
      const data = {
        meta: createTestMeta(),
        tools: [],
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: version");
    });

    it("should reject missing meta field", () => {
      const data = {
        version: "2.0",
        tools: [],
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: meta");
    });

    it("should reject meta without name", () => {
      const data = {
        version: "2.0",
        meta: {
          description: "Test",
          author: "Test",
          workflowId: "test-id",
          created: "2025-10-19T10:00:00.000Z",
        },
        tools: [],
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: meta.name");
    });

    it("should reject meta without workflowId", () => {
      const data = {
        version: "2.0",
        meta: {
          name: "Test",
          description: "Test",
          author: "Test",
          created: "2025-10-19T10:00:00.000Z",
        },
        tools: [],
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Missing required field: meta.workflowId"
      );
    });

    it("should reject tools that are not an array", () => {
      const data = {
        version: "2.0",
        meta: createTestMeta(),
        tools: "not an array",
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "tools" must be an array');
    });

    it("should reject tool missing required fields", () => {
      const data = {
        version: "2.0",
        meta: createTestMeta(),
        tools: [{ id: "tool_001" }], // Missing type, x, y, config, sockets
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Tool at index 0 missing required field: type"
      );
      expect(result.errors).toContain(
        'Tool at index 0 field "x" must be a number'
      );
      expect(result.errors).toContain(
        'Tool at index 0 field "y" must be a number'
      );
    });

    it("should reject wire missing required fields", () => {
      const data = {
        version: "2.0",
        meta: createTestMeta(),
        tools: [],
        wires: [{ from: { tool: "tool_001", socket: 'output' } }], // Missing 'to'
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Wire at index 0 missing required field: to"
      );
    });

    it("should reject socket with invalid direction", () => {
      const data = {
        version: "2.0",
        meta: createTestMeta(),
        tools: [
          {
            id: "tool_001",
            type: "csv",
            x: 100,
            y: 200,
            config: {},
            sockets: [
              { id: 'output', direction: "invalid", multiple: true }, // Invalid direction
            ],
          },
        ],
        wires: [],
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain("direction");
    });

    it("should collect multiple validation errors", () => {
      const data = {
        version: "2.0",
        // Missing meta
        tools: "not an array", // Invalid type
        wires: {}, // Invalid type
      };

      const result = WorkflowSerializer.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(1);
    });
  });

  describe("createEmpty", () => {
    it("should create empty workflow with default name", () => {
      const json = WorkflowSerializer.createEmpty();
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe("2.0");
      expect(parsed.meta.name).toBe("New Workflow");
      expect(parsed.tools).toEqual([]);
      expect(parsed.wires).toEqual([]);
    });

    it("should create empty workflow with custom name", () => {
      const json = WorkflowSerializer.createEmpty("My Custom Workflow");
      const parsed = JSON.parse(json);

      expect(parsed.meta.name).toBe("My Custom Workflow");
    });

    it("should create valid workflow that passes validation", () => {
      const json = WorkflowSerializer.createEmpty();

      // Should not throw
      expect(() => {
        WorkflowSerializer.fromJSON(json);
      }).not.toThrow();
    });
  });

  describe("isJSON", () => {
    it("should detect JSON content starting with {", () => {
      expect(WorkflowSerializer.isJSON('{"version": "2.0"}')).toBe(true);
    });

    it("should detect JSON content starting with [ ", () => {
      expect(WorkflowSerializer.isJSON("[1, 2, 3]")).toBe(true);
    });

    it("should detect JSON with leading whitespace", () => {
      expect(WorkflowSerializer.isJSON('  \n  {"version": "2.0"}')).toBe(true);
    });

    it("should reject non-JSON content", () => {
      expect(WorkflowSerializer.isJSON("<workflow>")).toBe(false);
    });

    it("should reject plain text", () => {
      expect(WorkflowSerializer.isJSON("not json")).toBe(false);
    });
  });

  describe("getVersion", () => {
    it("should extract version from valid JSON", () => {
      const json = WorkflowSerializer.toJSON([], [], createTestMeta());
      const version = WorkflowSerializer.getVersion(json);

      expect(version).toBe("2.0");
    });

    it("should return null for invalid JSON", () => {
      const version = WorkflowSerializer.getVersion("{ invalid }");
      expect(version).toBeNull();
    });

    it("should return null for JSON without version", () => {
      const version = WorkflowSerializer.getVersion('{"meta": {}}');
      expect(version).toBeNull();
    });
  });

  describe("extractUpstreamSubgraph", () => {
    it("should return only the target tool when it has no upstream dependencies", () => {
      const tool = createTestTool("tool_001");
      
      const { tools, wires } = WorkflowSerializer.extractUpstreamSubgraph(
        [tool],
        [],
        "tool_001"
      );

      expect(tools).toHaveLength(1);
      expect(tools[0]!.id).toBe("tool_001");
      expect(wires).toHaveLength(0);
    });

    it("should return target tool and its upstream dependency", () => {
      const tool1 = createTestTool("tool_001");
      const tool2 = createTestTool("tool_002");
      const wire = createTestWire("tool_001", "output", "tool_002", "input");

      const { tools, wires } = WorkflowSerializer.extractUpstreamSubgraph(
        [tool1, tool2],
        [wire],
        "tool_002"
      );

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.id).sort()).toEqual(["tool_001", "tool_002"]);
      expect(wires).toHaveLength(1);
    });

    it("should not include downstream tools", () => {
      // Linear chain: tool_001 -> tool_002 -> tool_003
      const tool1 = createTestTool("tool_001");
      const tool2 = createTestTool("tool_002");
      const tool3 = createTestTool("tool_003");
      const wire1 = createTestWire("tool_001", "output", "tool_002", "input");
      const wire2 = createTestWire("tool_002", "output", "tool_003", "input");

      // Get subgraph for tool_002 (should NOT include tool_003)
      const { tools, wires } = WorkflowSerializer.extractUpstreamSubgraph(
        [tool1, tool2, tool3],
        [wire1, wire2],
        "tool_002"
      );

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.id).sort()).toEqual(["tool_001", "tool_002"]);
      expect(wires).toHaveLength(1);
      expect(wires[0]!.from.tool).toBe("tool_001");
      expect(wires[0]!.to.tool).toBe("tool_002");
    });

    it("should handle multi-level upstream dependencies", () => {
      // Chain: tool_001 -> tool_002 -> tool_003 -> tool_004
      const tool1 = createTestTool("tool_001");
      const tool2 = createTestTool("tool_002");
      const tool3 = createTestTool("tool_003");
      const tool4 = createTestTool("tool_004");
      const wire1 = createTestWire("tool_001", "output", "tool_002", "input");
      const wire2 = createTestWire("tool_002", "output", "tool_003", "input");
      const wire3 = createTestWire("tool_003", "output", "tool_004", "input");

      // Get subgraph for tool_003 (should include tool_001, tool_002, tool_003)
      const { tools, wires } = WorkflowSerializer.extractUpstreamSubgraph(
        [tool1, tool2, tool3, tool4],
        [wire1, wire2, wire3],
        "tool_003"
      );

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.id).sort()).toEqual(["tool_001", "tool_002", "tool_003"]);
      expect(wires).toHaveLength(2);
    });

    it("should handle tools with multiple inputs (Join/Union)", () => {
      // Diamond pattern: tool_001 and tool_002 both feed into tool_003
      const tool1 = createTestTool("tool_001");
      const tool2 = createTestTool("tool_002");
      const tool3 = createTestTool("tool_003");
      const wire1 = createTestWire("tool_001", "output", "tool_003", "left");
      const wire2 = createTestWire("tool_002", "output", "tool_003", "right");

      const { tools, wires } = WorkflowSerializer.extractUpstreamSubgraph(
        [tool1, tool2, tool3],
        [wire1, wire2],
        "tool_003"
      );

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.id).sort()).toEqual(["tool_001", "tool_002", "tool_003"]);
      expect(wires).toHaveLength(2);
    });

    it("should handle branching workflows correctly", () => {
      // Branching: tool_001 feeds into both tool_002 and tool_003
      const tool1 = createTestTool("tool_001");
      const tool2 = createTestTool("tool_002");
      const tool3 = createTestTool("tool_003");
      const wire1 = createTestWire("tool_001", "output", "tool_002", "input");
      const wire2 = createTestWire("tool_001", "output", "tool_003", "input");

      // Get subgraph for tool_002 (should NOT include tool_003)
      const { tools, wires } = WorkflowSerializer.extractUpstreamSubgraph(
        [tool1, tool2, tool3],
        [wire1, wire2],
        "tool_002"
      );

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.id).sort()).toEqual(["tool_001", "tool_002"]);
      expect(wires).toHaveLength(1);
      expect(wires[0]!.to.tool).toBe("tool_002");
    });

    it("should return empty result for non-existent tool", () => {
      const tool = createTestTool("tool_001");

      const { tools, wires } = WorkflowSerializer.extractUpstreamSubgraph(
        [tool],
        [],
        "non_existent"
      );

      expect(tools).toHaveLength(0);
      expect(wires).toHaveLength(0);
    });
  });
});
