import { Tool, ToolConfig, Wire } from "@domain/workflow/entities/workflow";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkflowStore } from "../workflowStore";

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

// Helper function to create a test tool with both input and output sockets
const createTestToolWithSockets = (
  id: string = "tool_002",
  type: string = "join"
): Tool => ({
  id,
  type,
  x: 300,
  y: 200,
  config: {} as ToolConfig,
  sockets: [
    { id: 'input', direction: 'input', multiple: false },
    { id: 'input-right', direction: 'input', multiple: false },
    { id: 'output', direction: 'output', multiple: true },
  ],
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

describe("workflowStore CRUD operations", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWorkflowStore.getState().clear();
  });

  describe("Tool CRUD operations", () => {
    describe("addTool", () => {
      it("should add a tool to the store", () => {
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);

        const tools = useWorkflowStore.getState().tools;
        expect(tools).toHaveLength(1);
        expect(tools[0]).toEqual(tool);
      });

      it("should add multiple tools", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestTool("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        const tools = useWorkflowStore.getState().tools;
        expect(tools).toHaveLength(2);
        expect(tools).toContainEqual(tool1);
        expect(tools).toContainEqual(tool2);
      });

    });

    describe("removeTool", () => {
      it("should remove a tool from the store", () => {
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);

        useWorkflowStore.getState().removeTool("tool_001");

        const tools = useWorkflowStore.getState().tools;
        expect(tools).toHaveLength(0);
      });

      it("should remove inbound and outbound wires", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");
        const tool3 = createTestToolWithSockets("tool_003");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);
        useWorkflowStore.getState().addTool(tool3);

        const inboundWire = createTestWire('tool_001', 'output', 'tool_002', 'input');
        const outboundWire = createTestWire('tool_002', 'output', 'tool_003', 'input');
        useWorkflowStore.getState().addWire(inboundWire);
        useWorkflowStore.getState().addWire(outboundWire);

        expect(useWorkflowStore.getState().wires).toHaveLength(2);

        useWorkflowStore.getState().removeTool("tool_002");

        expect(useWorkflowStore.getState().wires).toHaveLength(0);
      });

      it("should clear selection if removing selected tool", () => {
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);
        useWorkflowStore.getState().setSelectedTool(tool);

        expect(useWorkflowStore.getState().selectedTool).toEqual(tool);

        useWorkflowStore.getState().removeTool("tool_001");

        expect(useWorkflowStore.getState().selectedTool).toBeNull();
      });

      it("should not affect other tools when removing one", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestTool("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        useWorkflowStore.getState().removeTool("tool_001");

        const tools = useWorkflowStore.getState().tools;
        expect(tools).toHaveLength(1);
        expect(tools[0]).toEqual(tool2);
      });
    });

    describe("updateTool", () => {
      it("should update tool properties", () => {
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);

        useWorkflowStore.getState().updateTool("tool_001", { x: 500, y: 600 });

        const updatedTool = useWorkflowStore.getState().tools[0];
        expect(updatedTool).toBeDefined();
        expect(updatedTool!.x).toBe(500);
        expect(updatedTool!.y).toBe(600);
      });

      it("should not affect other tools when updating one", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestTool("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        useWorkflowStore.getState().updateTool("tool_001", { x: 500 });

        expect(useWorkflowStore.getState().tools[0]?.x).toBe(500);
        expect(useWorkflowStore.getState().tools[1]?.x).toBe(100); // Unchanged
      });
    });

    describe("updateToolPosition", () => {
      it("should update tool position", () => {
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);

        useWorkflowStore.getState().updateToolPosition("tool_001", 400, 500);

        const updatedTool = useWorkflowStore.getState().tools[0];
        expect(updatedTool).toBeDefined();
        expect(updatedTool!.x).toBe(400);
        expect(updatedTool!.y).toBe(500);
      });
    });

    describe("updateToolConfiguration", () => {
      it("should update tool configuration", () => {
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);

        const newConfig: ToolConfig = { filePath: "/new/path/data.csv" };
        useWorkflowStore
          .getState()
          .updateToolConfiguration("tool_001", newConfig);

        const updatedTool = useWorkflowStore.getState().tools[0];
        expect(updatedTool).toBeDefined();
        expect(updatedTool!.config).toEqual(newConfig);
      });
    });

    describe("batchUpdateToolPositions", () => {
      it("should update multiple tool positions at once", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestTool("tool_002");
        const tool3 = createTestTool("tool_003");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);
        useWorkflowStore.getState().addTool(tool3);

        useWorkflowStore.getState().batchUpdateToolPositions([
          { id: "tool_001", x: 100, y: 100 },
          { id: "tool_002", x: 200, y: 200 },
        ]);

        const tools = useWorkflowStore.getState().tools;
        expect(tools[0]?.x).toBe(100);
        expect(tools[0]?.y).toBe(100);
        expect(tools[1]?.x).toBe(200);
        expect(tools[1]?.y).toBe(200);
        expect(tools[2]?.x).toBe(100); // Unchanged
        expect(tools[2]?.y).toBe(200); // Unchanged
      });
    });
  });

  describe("Wire CRUD operations", () => {
    describe("addWire", () => {
      it("should add a valid wire", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        const wire = createTestWire('tool_001', 'output', 'tool_002', 'input');
        const result = useWorkflowStore.getState().addWire(wire);

        expect(result.success).toBe(true);
        expect(useWorkflowStore.getState().wires).toHaveLength(1);
        expect(useWorkflowStore.getState().wires[0]).toEqual(wire);
      });

      it("should reject wire with non-existent tool", () => {
        const tool1 = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool1);

        const wire = createTestWire('tool_001', 'output', 'tool_999', 'input');
        const result = useWorkflowStore.getState().addWire(wire);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Tool not found");
        expect(useWorkflowStore.getState().wires).toHaveLength(0);
      });

      it("should reject wire with non-existent socket", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        const wire = createTestWire('tool_001', 'output', "tool_002", 'invalid-socket'); // Socket doesn't exist
        const result = useWorkflowStore.getState().addWire(wire);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Socket not found");
      });

      it("should reject wire connecting output to output", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestTool("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        const wire = createTestWire('tool_001', 'output', 'tool_002', 'output'); // Both are outputs
        const result = useWorkflowStore.getState().addWire(wire);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Target must be an input socket");
      });

      it("should reject wire to already connected non-multiple input", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestTool("tool_002", "csv");
        const tool3 = createTestToolWithSockets("tool_003");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);
        useWorkflowStore.getState().addTool(tool3);

        // First wire should succeed
        const wire1 = createTestWire('tool_001', 'output', 'tool_003', 'input');
        const result1 = useWorkflowStore.getState().addWire(wire1);
        expect(result1.success).toBe(true);

        // Second wire to same input should fail
        const wire2 = createTestWire('tool_002', 'output', 'tool_003', 'input');
        const result2 = useWorkflowStore.getState().addWire(wire2);
        expect(result2.success).toBe(false);
        expect(result2.error).toBe("Input already connected");
      });

    });

    describe("removeWire", () => {
      it("should remove a wire", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        const wire = createTestWire('tool_001', 'output', 'tool_002', 'input');
        useWorkflowStore.getState().addWire(wire);

        expect(useWorkflowStore.getState().wires).toHaveLength(1);

        useWorkflowStore.getState().removeWire(wire.from, wire.to);

        expect(useWorkflowStore.getState().wires).toHaveLength(0);
      });

    });

    describe("removeWiresByTool", () => {
      it("should remove all wires connected to a tool", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");
        const tool3 = createTestToolWithSockets("tool_003");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);
        useWorkflowStore.getState().addTool(tool3);

        const wire1 = createTestWire('tool_001', 'output', 'tool_002', 'input');
        const wire2 = createTestWire('tool_001', 'output', 'tool_003', 'input');
        const wire3 = createTestWire("tool_002", "output", "tool_003", "input-right");

        useWorkflowStore.getState().addWire(wire1);
        useWorkflowStore.getState().addWire(wire2);
        useWorkflowStore.getState().addWire(wire3);

        expect(useWorkflowStore.getState().wires).toHaveLength(3);

        useWorkflowStore.getState().removeWiresByTool("tool_001");

        const remainingWires = useWorkflowStore.getState().wires;
        expect(remainingWires).toHaveLength(1);
        expect(remainingWires[0]).toEqual(wire3);
      });
    });

    describe("validateWire", () => {
      it("should validate a correct wire", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        const wire = createTestWire('tool_001', 'output', 'tool_002', 'input');
        const result = useWorkflowStore.getState().validateWire(wire);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should invalidate wire with missing tool", () => {
        const wire = createTestWire("tool_999", 'output', 'tool_002', 'input');
        const result = useWorkflowStore.getState().validateWire(wire);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Tool not found");
      });

      it("should invalidate wire with missing socket", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");

        useWorkflowStore.getState().addTool(tool1);
        useWorkflowStore.getState().addTool(tool2);

        const wire = createTestWire("tool_001", 'invalid-socket', 'tool_002', 'input');
        const result = useWorkflowStore.getState().validateWire(wire);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Socket not found");
      });
    });
  });

  describe("Batch operations", () => {
    describe("batchAddToolsAndWires", () => {
      it("should add multiple tools and wires at once", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");
        const wire = createTestWire('tool_001', 'output', 'tool_002', 'input');

        useWorkflowStore
          .getState()
          .batchAddToolsAndWires([tool1, tool2], [wire]);

        expect(useWorkflowStore.getState().tools).toHaveLength(2);
        expect(useWorkflowStore.getState().wires).toHaveLength(1);
      });
    });
  });

  describe("Lifecycle operations", () => {
    describe("newWorkflow", () => {
      it("should reset to empty workflow with default metadata", () => {
        // Add some data
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);

        useWorkflowStore.getState().newWorkflow();

        const state = useWorkflowStore.getState();
        expect(state.tools).toHaveLength(0);
        expect(state.wires).toHaveLength(0);
        expect(state.selectedTool).toBeNull();
        expect(state.workflowMeta.name).toBe("New Workflow");
      });

      it("should accept custom metadata", () => {
        useWorkflowStore
          .getState()
          .newWorkflow({ name: "Custom Workflow", author: "Test Author" });

        const meta = useWorkflowStore.getState().workflowMeta;
        expect(meta.name).toBe("Custom Workflow");
        expect(meta.author).toBe("Test Author");
      });
    });

    describe("loadWorkflow", () => {
      it("should load workflow data", () => {
        const tool1 = createTestTool("tool_001");
        const tool2 = createTestToolWithSockets("tool_002");
        const wire = createTestWire('tool_001', 'output', 'tool_002', 'input');
        const meta = {
          name: "Loaded Workflow",
          description: "Test",
          author: "Test",
          workflowId: "test-id",
          created: new Date().toISOString(),
        };

        useWorkflowStore.getState().loadWorkflow([tool1, tool2], [wire], meta);

        const state = useWorkflowStore.getState();
        expect(state.tools).toHaveLength(2);
        expect(state.wires).toHaveLength(1);
        expect(state.workflowMeta.name).toBe("Loaded Workflow");
        expect(state.selectedTool).toBeNull();
      });
    });

    describe("clear", () => {
      it("should clear all workflow data", () => {
        const tool = createTestTool("tool_001");
        useWorkflowStore.getState().addTool(tool);

        useWorkflowStore.getState().clear();

        const state = useWorkflowStore.getState();
        expect(state.tools).toHaveLength(0);
        expect(state.wires).toHaveLength(0);
        expect(state.selectedTool).toBeNull();
      });
    });
  });
});
