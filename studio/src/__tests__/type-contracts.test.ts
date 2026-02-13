/**
 * Type contract tests - validate workflow serialization compatibility.
 *
 * These tests ensure that workflows serialized by the frontend
 * match the expected JSON structure that the backend can parse.
 */

import { describe, expect, test } from "vitest";
import {
  WorkflowSerializer,
  type WorkflowJSON,
} from "../domain/workflow/services/WorkflowSerializer";
import type {
  Tool,
  Wire,
  WorkflowMeta,
} from "../domain/workflow/entities/workflow";
import { DEFAULT_ENGINE } from "../domain/workflow/entities/workflow";
import {
  CommonSockets,
  FilterSockets,
  JoinSockets,
  UnionSockets,
} from "../domain/workflow/constants/socketIds";

describe("Type Contracts", () => {
  const baseMeta: WorkflowMeta = {
    name: "Test",
    description: "Test workflow",
    author: "Test",
    workflowId: "test-123",
    created: "2025-01-01T00:00:00Z",
  };

  describe("Meta Field Contracts", () => {
    test("serialized workflow has required meta fields", () => {
      const tools: Tool[] = [];
      const wires: Wire[] = [];

      const json = WorkflowSerializer.toJSON(tools, wires, baseMeta);
      const parsed: WorkflowJSON = JSON.parse(json);

      // These fields are required by backend Pydantic model
      expect(parsed.meta.name).toBe("Test");
      expect(parsed.meta.description).toBe("Test workflow");
      expect(parsed.meta.author).toBe("Test");
      expect(parsed.meta.workflowId).toBe("test-123");
      expect(parsed.meta.created).toBe("2025-01-01T00:00:00Z");
    });

    test("workflow has version field", () => {
      const json = WorkflowSerializer.toJSON([], [], baseMeta);
      const parsed: WorkflowJSON = JSON.parse(json);

      expect(parsed.version).toBeDefined();
      expect(typeof parsed.version).toBe("string");
    });
  });

  describe("Wire Serialization Contracts", () => {
    test("wire serialization uses from and to fields", () => {
      const tools: Tool[] = [
        {
          id: "a",
          type: "Input",
          x: 0,
          y: 0,
          config: { _emit: { category: true, type: true } },
          sockets: [{ id: CommonSockets.OUTPUT, direction: "output" }],
        },
        {
          id: "b",
          type: "Filter",
          x: 100,
          y: 0,
          config: { _emit: {} },
          sockets: [{ id: CommonSockets.INPUT, direction: "input" }],
        },
      ];
      const wires: Wire[] = [
        {
          from: { tool: "a", socket: CommonSockets.OUTPUT },
          to: { tool: "b", socket: CommonSockets.INPUT },
        },
      ];

      const json = WorkflowSerializer.toJSON(tools, wires, baseMeta);
      const parsed: WorkflowJSON = JSON.parse(json);

      // Backend expects 'from' and 'to' (Pydantic alias handles from_ internally)
      expect(parsed.wires).toHaveLength(1);
      const wire = parsed.wires[0]!;
      expect(wire.from.tool).toBe("a");
      expect(wire.from.socket).toBe("output");
      expect(wire.to.tool).toBe("b");
      expect(wire.to.socket).toBe("input");
    });
  });

  describe("Tool Socket Contracts", () => {
    test("tool sockets serialize with correct structure", () => {
      const tools: Tool[] = [
        {
          id: "filter-1",
          type: "Filter",
          x: 0,
          y: 0,
          config: { expression: "pl.col('a') > 1", _emit: { expression: true } },
          sockets: [
            { id: FilterSockets.INPUT, direction: "input" },
            { id: FilterSockets.OUTPUT_TRUE, direction: "output", type: "T" },
            { id: FilterSockets.OUTPUT_FALSE, direction: "output", type: "F" },
          ],
        },
      ];

      const json = WorkflowSerializer.toJSON(tools, [], baseMeta);
      const parsed: WorkflowJSON = JSON.parse(json);

      // Verify socket structure matches backend expectations
      expect(parsed.tools).toHaveLength(1);
      const sockets = parsed.tools[0]!.sockets;
      expect(sockets).toHaveLength(3);
      expect(sockets[0]!.id).toBe("input");
      expect(sockets[0]!.direction).toBe("input");
      expect(sockets[1]!.id).toBe("output-true");
      expect(sockets[1]!.type).toBe("T");
      expect(sockets[2]!.id).toBe("output-false");
      expect(sockets[2]!.type).toBe("F");
    });

    test("join tool sockets serialize correctly", () => {
      const tools: Tool[] = [
        {
          id: "join-1",
          type: "Join",
          x: 0,
          y: 0,
          config: {
            joinType: "inner",
            leftKeys: [],
            rightKeys: [],
            _emit: { joinType: true },
          },
          sockets: [
            { id: JoinSockets.INPUT_LEFT, direction: "input", type: "L" },
            { id: JoinSockets.INPUT_RIGHT, direction: "input", type: "R" },
            { id: JoinSockets.OUTPUT_LEFT, direction: "output", type: "L" },
            { id: JoinSockets.OUTPUT_MATCH, direction: "output", type: "J" },
            { id: JoinSockets.OUTPUT_RIGHT, direction: "output", type: "R" },
          ],
        },
      ];

      const json = WorkflowSerializer.toJSON(tools, [], baseMeta);
      const parsed: WorkflowJSON = JSON.parse(json);

      expect(parsed.tools).toHaveLength(1);
      const sockets = parsed.tools[0]!.sockets;
      expect(sockets).toHaveLength(5);
      expect(sockets[0]!.id).toBe("input-left");
      expect(sockets[1]!.id).toBe("input-right");
      expect(sockets[2]!.id).toBe("output-left");
      expect(sockets[3]!.id).toBe("output-match");
      expect(sockets[4]!.id).toBe("output-right");
    });

    test("union tool with multiple input socket serializes correctly", () => {
      const tools: Tool[] = [
        {
          id: "union-1",
          type: "Union",
          x: 0,
          y: 0,
          config: { mode: "ByName", _emit: { mode: true } },
          sockets: [
            { id: UnionSockets.INPUT, direction: "input", multiple: true },
            { id: UnionSockets.OUTPUT, direction: "output" },
          ],
        },
      ];

      const json = WorkflowSerializer.toJSON(tools, [], baseMeta);
      const parsed: WorkflowJSON = JSON.parse(json);

      expect(parsed.tools).toHaveLength(1);
      const sockets = parsed.tools[0]!.sockets;
      expect(sockets[0]!.multiple).toBe(true);
      expect(sockets[1]!.multiple).toBeUndefined();
    });
  });

  describe("Socket ID Constants", () => {
    test("CommonSockets match expected values", () => {
      expect(CommonSockets.INPUT).toBe("input");
      expect(CommonSockets.OUTPUT).toBe("output");
    });

    test("FilterSockets match expected values", () => {
      expect(FilterSockets.INPUT).toBe("input");
      expect(FilterSockets.OUTPUT_TRUE).toBe("output-true");
      expect(FilterSockets.OUTPUT_FALSE).toBe("output-false");
    });

    test("JoinSockets match expected values", () => {
      expect(JoinSockets.INPUT_LEFT).toBe("input-left");
      expect(JoinSockets.INPUT_RIGHT).toBe("input-right");
      expect(JoinSockets.OUTPUT_LEFT).toBe("output-left");
      expect(JoinSockets.OUTPUT_MATCH).toBe("output-match");
      expect(JoinSockets.OUTPUT_RIGHT).toBe("output-right");
    });

    test("UnionSockets match expected values", () => {
      expect(UnionSockets.INPUT).toBe("input");
      expect(UnionSockets.OUTPUT).toBe("output");
    });
  });

  describe("Complete Workflow Contracts", () => {
    test("linear workflow serializes correctly", () => {
      const tools: Tool[] = [
        {
          id: "input-1",
          type: "Input",
          x: 0,
          y: 0,
          config: {
            category: "file",
            type: "csv",
            source: "/path/to/file.csv",
            _emit: { source: true },
          },
          sockets: [{ id: CommonSockets.OUTPUT, direction: "output" }],
        },
        {
          id: "filter-1",
          type: "Filter",
          x: 200,
          y: 0,
          config: { expression: "pl.col('a') > 1", _emit: { expression: true } },
          sockets: [
            { id: FilterSockets.INPUT, direction: "input" },
            { id: FilterSockets.OUTPUT_TRUE, direction: "output", type: "T" },
            { id: FilterSockets.OUTPUT_FALSE, direction: "output", type: "F" },
          ],
        },
        {
          id: "output-1",
          type: "Output",
          x: 400,
          y: 0,
          config: {
            type: "csv",
            destination: "/path/to/output.csv",
            _emit: { destination: true },
          },
          sockets: [{ id: CommonSockets.INPUT, direction: "input" }],
        },
      ];
      const wires: Wire[] = [
        {
          from: { tool: "input-1", socket: CommonSockets.OUTPUT },
          to: { tool: "filter-1", socket: FilterSockets.INPUT },
        },
        {
          from: { tool: "filter-1", socket: FilterSockets.OUTPUT_TRUE },
          to: { tool: "output-1", socket: CommonSockets.INPUT },
        },
      ];

      const json = WorkflowSerializer.toJSON(tools, wires, baseMeta);
      const parsed: WorkflowJSON = JSON.parse(json);

      expect(parsed.tools).toHaveLength(3);
      expect(parsed.wires).toHaveLength(2);
      expect(parsed.tools[0]!.type).toBe("Input");
      expect(parsed.tools[1]!.type).toBe("Filter");
      expect(parsed.tools[2]!.type).toBe("Output");
    });
  });

  describe("Engine Field Contracts", () => {
    test("defaultEngine field is accepted in meta", () => {
      const meta: WorkflowMeta = {
        ...baseMeta,
        defaultEngine: DEFAULT_ENGINE,
      };

      const json = WorkflowSerializer.toJSON([], [], meta);
      const parsed: WorkflowJSON = JSON.parse(json);

      expect(parsed.meta.defaultEngine).toBe(DEFAULT_ENGINE);
    });

    test("engine field on tool is preserved when different from default", () => {
      const tools: Tool[] = [
        {
          id: "dbt-1",
          type: "Model",
          engine: "contrib/dbt",
          x: 0,
          y: 0,
          config: {},
          sockets: [{ id: CommonSockets.OUTPUT, direction: "output" }],
        },
      ];

      const json = WorkflowSerializer.toJSON(tools, [], {
        ...baseMeta,
        defaultEngine: DEFAULT_ENGINE,
      });
      const parsed: WorkflowJSON = JSON.parse(json);

      expect(parsed.tools[0]!.engine).toBe("contrib/dbt");
    });

    test("engine field is omitted when matching workflow default", () => {
      const tools: Tool[] = [
        {
          id: "filter-1",
          type: "Filter",
          engine: DEFAULT_ENGINE,
          x: 0,
          y: 0,
          config: { _emit: {} },
          sockets: [{ id: CommonSockets.INPUT, direction: "input" }],
        },
      ];

      const json = WorkflowSerializer.toJSON(tools, [], {
        ...baseMeta,
        defaultEngine: DEFAULT_ENGINE,
      });
      const parsed: WorkflowJSON = JSON.parse(json);

      // Should be omitted since it matches the default
      expect(parsed.tools[0]!.engine).toBeUndefined();
    });

    test("engines block serializes when provided", () => {
      const engines = {
        "contrib/dbt": { project: "analytics", profile: "dev" },
      };

      const json = WorkflowSerializer.toJSON([], [], baseMeta, engines);
      const parsed: WorkflowJSON = JSON.parse(json);

      expect(parsed.engines).toBeDefined();
      expect(parsed.engines!["contrib/dbt"]).toEqual({
        project: "analytics",
        profile: "dev",
      });
    });

    test("workflow without engine fields is still valid (backward compat)", () => {
      // Simulate a v1.0 workflow with no engine fields
      const legacyJson = JSON.stringify({
        version: "1.0",
        meta: baseMeta,
        tools: [],
        wires: [],
      });

      const result = WorkflowSerializer.fromJSON(legacyJson);
      expect(result.tools).toEqual([]);
      expect(result.meta.defaultEngine).toBeUndefined();
      expect(result.engines).toBeUndefined();
    });
  });
});
