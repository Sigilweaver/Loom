import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Tool, Wire } from "../../domain/workflow/entities/workflow";
import type { ClipboardData } from "../clipboardStore";
import { useClipboardStore } from "../clipboardStore";
import { useWorkflowStore } from "../workflowStore";

// Mock the id generator for predictable IDs
vi.mock("@utils/id", () => ({
  generateUniqueId: vi.fn((existing: Set<string>) => {
    // Generate sequential IDs for testing
    let id = `new_tool_${existing.size + 1}`;
    while (existing.has(id)) {
      id = `new_tool_${existing.size + Math.random()}`;
    }
    return id;
  }),
}));

describe("clipboardStore", () => {
  beforeEach(() => {
    // Reset clipboard store
    useClipboardStore.setState({
      clipboard: null,
    });

    // Reset workflow store with sample data
    useWorkflowStore.setState({
      tools: [],
      wires: [],
      edges: [],
      workflowMeta: {
        name: "Test Workflow",
        description: "Test",
        author: "Test",
        workflowId: "test-id",
        created: new Date().toISOString(),
      },
      selectedTool: null,
    });

    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    test("should have null clipboard initially", () => {
      const state = useClipboardStore.getState();
      expect(state.clipboard).toBeNull();
    });
  });

  describe("setClipboard", () => {
    test("should set clipboard data", () => {
      const clipboardData: ClipboardData = {
        tools: [{ id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] }],
        wires: [],
        minX: 100,
        minY: 200,
      };

      useClipboardStore.getState().setClipboard(clipboardData);

      const state = useClipboardStore.getState();
      expect(state.clipboard).toEqual(clipboardData);
    });

    test("should allow setting clipboard to null", () => {
      const clipboardData: ClipboardData = {
        tools: [{ id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] }],
        wires: [],
        minX: 100,
        minY: 200,
      };

      useClipboardStore.getState().setClipboard(clipboardData);
      expect(useClipboardStore.getState().clipboard).not.toBeNull();

      useClipboardStore.getState().setClipboard(null);
      expect(useClipboardStore.getState().clipboard).toBeNull();
    });
  });

  describe("clearClipboard", () => {
    test("should clear clipboard", () => {
      const clipboardData: ClipboardData = {
        tools: [{ id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] }],
        wires: [],
        minX: 100,
        minY: 200,
      };

      useClipboardStore.getState().setClipboard(clipboardData);

      expect(useClipboardStore.getState().clipboard).not.toBeNull();

      useClipboardStore.getState().clearClipboard();

      const state = useClipboardStore.getState();
      expect(state.clipboard).toBeNull();
    });
  });

  describe("copyTools", () => {
    test("should copy a single tool", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: { filename: "test.csv" },
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });

      useClipboardStore.getState().copyTools(["tool1"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).not.toBeNull();
      expect(clipboard?.tools).toHaveLength(1);
      expect(clipboard?.tools[0]).toEqual({
        id: "tool1",
        type: "Input",
        x: 100,
        y: 200,
        config: { filename: "test.csv" },
        sockets: [{ id: 'output', direction: 'output', multiple: false }],
      });
      expect(clipboard?.minX).toBe(100);
      expect(clipboard?.minY).toBe(200);
    });

    test("should copy multiple tools", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [],
        },
        {
          id: "tool2",
          type: "Filter",
          x: 300,
          y: 400,
          config: {},
          sockets: [],
        },
        {
          id: "tool3",
          type: "Output",
          x: 500,
          y: 150,
          config: {},
          sockets: [],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });

      useClipboardStore.getState().copyTools(["tool1", "tool2", "tool3"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).not.toBeNull();
      expect(clipboard?.tools).toHaveLength(3);
      expect(clipboard?.minX).toBe(100); // Minimum X
      expect(clipboard?.minY).toBe(150); // Minimum Y
    });

    test("should copy tools with internal wires", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
        {
          id: "tool2",
          type: "Filter",
          x: 300,
          y: 200,
          config: {},
          sockets: [
            { id: 'input', direction: 'input', multiple: false },
            { id: 'output-false', direction: 'output', multiple: false },
          ],
        },
      ];

      const wires: Wire[] = [
        {
          from: { tool: "tool1", socket: 'output' },
          to: { tool: "tool2", socket: 'input' },
        },
      ];

      useWorkflowStore.setState({ tools, wires });

      useClipboardStore.getState().copyTools(["tool1", "tool2"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).not.toBeNull();
      expect(clipboard?.wires).toHaveLength(1);
      expect(clipboard?.wires[0]).toEqual({
        from: { tool: "tool1", socket: 'output' },
        to: { tool: "tool2", socket: 'input' },
      });
    });

    test("should not copy external wires (one endpoint outside selection)", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
        {
          id: "tool2",
          type: "Filter",
          x: 300,
          y: 200,
          config: {},
          sockets: [
            { id: 'input', direction: 'input', multiple: false },
            { id: 'output-false', direction: 'output', multiple: false },
          ],
        },
        {
          id: "tool3",
          type: "Output",
          x: 500,
          y: 200,
          config: {},
          sockets: [{ id: 'input', direction: 'input', multiple: false }],
        },
      ];

      const wires: Wire[] = [
        {
          from: { tool: "tool1", socket: 'output' },
          to: { tool: "tool2", socket: 'input' },
        },
        {
          from: { tool: "tool2", socket: 'output-false' },
          to: { tool: "tool3", socket: 'input' }, // External wire (tool3 not selected)
        },
      ];

      useWorkflowStore.setState({ tools, wires });

      // Only copy tool1 and tool2
      useClipboardStore.getState().copyTools(["tool1", "tool2"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).not.toBeNull();
      expect(clipboard?.tools).toHaveLength(2);
      expect(clipboard?.wires).toHaveLength(1); // Only internal wire
      expect(clipboard?.wires[0]).toEqual({
        from: { tool: "tool1", socket: 'output' },
        to: { tool: "tool2", socket: 'input' },
      });
    });

    test("should handle empty selection (no tools)", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });

      useClipboardStore.getState().copyTools([]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).toBeNull();
    });

    test("should handle non-existent tool IDs gracefully", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });

      useClipboardStore.getState().copyTools(["nonexistent"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).toBeNull();
    });

    test("should preserve tool types and positions", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 150,
          y: 250,
          config: {},
          sockets: [],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });

      useClipboardStore.getState().copyTools(["tool1"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard?.tools[0]).toMatchObject({
        id: "tool1",
        type: "Input",
        x: 150,
        y: 250,
      });
    });

    test("should calculate correct bounding box with multiple tools", () => {
      const tools: Tool[] = [
        { id: "tool1", type: "Input", x: 300, y: 500, config: {}, sockets: [] },
        {
          id: "tool2",
          type: "Filter",
          x: 100,
          y: 200,
          config: {},
          sockets: [],
        },
        {
          id: "tool3",
          type: "Output",
          x: 200,
          y: 150,
          config: {},
          sockets: [],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });

      useClipboardStore.getState().copyTools(["tool1", "tool2", "tool3"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard?.minX).toBe(100); // tool2
      expect(clipboard?.minY).toBe(150); // tool3
    });
  });

  describe("pasteToolsAt", () => {
    test("should paste tools at specified position", () => {
      // Setup: Copy a tool first
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: { filename: "test.csv" },
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1"]);

      // Mock batchAddToolsAndWires
      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      // Paste at new position
      const newToolIds = useClipboardStore
        .getState()
        .pasteToolsAt({ x: 300, y: 400 });

      expect(newToolIds).toHaveLength(1);
      expect(batchAddSpy).toHaveBeenCalledTimes(1);

      const [pastedTools] = batchAddSpy.mock.calls[0];
      expect(pastedTools).toHaveLength(1);
      expect(pastedTools[0].x).toBe(300); // New X position
      expect(pastedTools[0].y).toBe(400); // New Y position
      expect(pastedTools[0].type).toBe("Input");
    });

    test("should generate new unique IDs for pasted tools", () => {
      const tools: Tool[] = [
        { id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1"]);

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      useClipboardStore.getState().pasteToolsAt({ x: 300, y: 400 });

      const [pastedTools] = batchAddSpy.mock.calls[0];
      expect(pastedTools[0].id).not.toBe("tool1"); // Should have new ID
      expect(pastedTools[0].id).toBeTruthy();
    });

    test("should offset positions correctly from bounding box", () => {
      const tools: Tool[] = [
        { id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] },
        {
          id: "tool2",
          type: "Filter",
          x: 300,
          y: 400,
          config: {},
          sockets: [],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1", "tool2"]);

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      // Paste at anchor (500, 600)
      // Original minX=100, minY=200
      // Offset: 500-100=400, 600-200=400
      useClipboardStore.getState().pasteToolsAt({ x: 500, y: 600 });

      const [pastedTools] = batchAddSpy.mock.calls[0];
      expect(pastedTools[0].x).toBe(500); // 100 + 400
      expect(pastedTools[0].y).toBe(600); // 200 + 400
      expect(pastedTools[1].x).toBe(700); // 300 + 400
      expect(pastedTools[1].y).toBe(800); // 400 + 400
    });

    test("should remap wire endpoints to new tool IDs", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
        {
          id: "tool2",
          type: "Filter",
          x: 300,
          y: 200,
          config: {},
          sockets: [{ id: 'input', direction: 'input', multiple: false }],
        },
      ];

      const wires: Wire[] = [
        {
          from: { tool: "tool1", socket: 'output' },
          to: { tool: "tool2", socket: 'input' },
        },
      ];

      useWorkflowStore.setState({ tools, wires });
      useClipboardStore.getState().copyTools(["tool1", "tool2"]);

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      useClipboardStore.getState().pasteToolsAt({ x: 500, y: 600 });

      const [pastedTools, pastedWires] = batchAddSpy.mock.calls[0];

      // Check that wire references new tool IDs
      expect(pastedWires).toHaveLength(1);
      expect(pastedWires[0].from.tool).not.toBe("tool1");
      expect(pastedWires[0].to.tool).not.toBe("tool2");
      expect(pastedWires[0].from.tool).toBe(pastedTools[0].id);
      expect(pastedWires[0].to.tool).toBe(pastedTools[1].id);
      expect(pastedWires[0].from.socket).toBe('output'); // Socket unchanged
      expect(pastedWires[0].to.socket).toBe('input'); // Socket unchanged
    });

    test("should preserve tool configurations from original", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: { filename: "data.csv", delimiter: ";", header: true },
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1"]);

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      useClipboardStore.getState().pasteToolsAt({ x: 300, y: 400 });

      const [pastedTools] = batchAddSpy.mock.calls[0];
      expect(pastedTools[0].config).toEqual({
        filename: "data.csv",
        delimiter: ";",
        header: true,
      });
    });

    test("should preserve sockets from original tools", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Join",
          x: 100,
          y: 200,
          config: {},
          sockets: [
            { id: 'input-left', direction: 'input', multiple: false },
            { id: 'input-right', direction: "input", multiple: false },
            { id: 'output-left', direction: "output", type: "L", multiple: false },
            { id: 'output-right', direction: "output", type: "R", multiple: false },
          ],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1"]);

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      useClipboardStore.getState().pasteToolsAt({ x: 300, y: 400 });

      const [pastedTools] = batchAddSpy.mock.calls[0];
      expect(pastedTools[0].sockets).toEqual([
        { id: 'input-left', direction: 'input', multiple: false },
        { id: 'input-right', direction: "input", multiple: false },
        { id: 'output-left', direction: "output", type: "L", multiple: false },
        { id: 'output-right', direction: "output", type: "R", multiple: false },
      ]);
    });

    test("should return empty array when no clipboard data", () => {
      const newToolIds = useClipboardStore
        .getState()
        .pasteToolsAt({ x: 300, y: 400 });

      expect(newToolIds).toEqual([]);
    });

    test("should handle paste when clipboard is null", () => {
      useClipboardStore.setState({ clipboard: null });

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      const newToolIds = useClipboardStore
        .getState()
        .pasteToolsAt({ x: 300, y: 400 });

      expect(newToolIds).toEqual([]);
      expect(batchAddSpy).not.toHaveBeenCalled();
    });

    test("should prevent ID collisions with existing tools", () => {
      // Setup: Existing tools in workflow
      const existingTools: Tool[] = [
        {
          id: "new_tool_1",
          type: "Input",
          x: 0,
          y: 0,
          config: {},
          sockets: [],
        },
      ];

      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Filter",
          x: 100,
          y: 200,
          config: {},
          sockets: [],
        },
      ];

      useWorkflowStore.setState({
        tools: [...existingTools, ...tools],
        wires: [],
      });
      useClipboardStore.getState().copyTools(["tool1"]);

      // Update store with existing tools before paste
      useWorkflowStore.setState({ tools: existingTools, wires: [] });

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      useClipboardStore.getState().pasteToolsAt({ x: 300, y: 400 });

      const [pastedTools] = batchAddSpy.mock.calls[0];
      // Should generate new_tool_2 (not new_tool_1 which exists)
      expect(pastedTools[0].id).not.toBe("new_tool_1");
    });

    test("should handle multiple paste operations with incrementing IDs", () => {
      const tools: Tool[] = [
        { id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1"]);

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      // First paste
      const ids1 = useClipboardStore
        .getState()
        .pasteToolsAt({ x: 300, y: 400 });
      expect(ids1).toHaveLength(1);

      // Second paste (simulate by updating existing tools)
      const [firstPastedTools] = batchAddSpy.mock.calls[0];
      useWorkflowStore.setState({
        tools: [...tools, ...firstPastedTools],
        wires: [],
      });

      // Second paste
      const ids2 = useClipboardStore
        .getState()
        .pasteToolsAt({ x: 500, y: 600 });
      expect(ids2).toHaveLength(1);
      expect(ids1[0]).not.toBe(ids2[0]); // Different IDs
    });

    test("should preserve config and sockets when original tools have been deleted", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: { filename: "test.csv" },
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1"]);

      // Delete original tool
      useWorkflowStore.setState({ tools: [], wires: [] });

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      // Paste should still work with full config preserved
      const newToolIds = useClipboardStore
        .getState()
        .pasteToolsAt({ x: 300, y: 400 });

      expect(newToolIds).toHaveLength(1);
      expect(batchAddSpy).toHaveBeenCalled();

      const [pastedTools] = batchAddSpy.mock.calls[0];
      // Should preserve original config and sockets from clipboard
      expect(pastedTools[0]).toMatchObject({
        type: "Input",
        x: 300,
        y: 400,
        config: { filename: "test.csv" },
        sockets: [{ id: 'output', direction: 'output', multiple: false }],
      });
    });

    test("should skip wires with unmapped tool IDs", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
      ];

      // Create clipboard with wire referencing non-existent tool
      const clipboardData: ClipboardData = {
        tools: [{ id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [{ id: 'output', direction: 'output', multiple: false }] }],
        wires: [
          {
            from: { tool: "tool1", socket: 'output' },
            to: { tool: "nonexistent", socket: 'input' },
          },
        ],
        minX: 100,
        minY: 200,
      };

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.setState({ clipboard: clipboardData });

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      useClipboardStore.getState().pasteToolsAt({ x: 300, y: 400 });

      const [, pastedWires] = batchAddSpy.mock.calls[0];
      // Wire should be filtered out (no mapping for 'nonexistent')
      expect(pastedWires).toHaveLength(0);
    });
  });

  describe("Selector Hooks", () => {
    test("useClipboard should return clipboard data", () => {
      const clipboardData: ClipboardData = {
        tools: [{ id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] }],
        wires: [],
        minX: 100,
        minY: 200,
      };

      useClipboardStore.setState({ clipboard: clipboardData });

      // Test using getState instead of hooks (hooks can't be called in tests directly)
      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).toEqual(clipboardData);
    });

    test("useClipboard should return null when empty", () => {
      useClipboardStore.setState({ clipboard: null });

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard).toBeNull();
    });

    test("useHasClipboard should return false when clipboard is null", () => {
      useClipboardStore.setState({ clipboard: null });

      const hasClipboard = useClipboardStore.getState().clipboard !== null;
      expect(hasClipboard).toBe(false);
    });

    test("useHasClipboard should return true when clipboard has data", () => {
      const clipboardData: ClipboardData = {
        tools: [{ id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] }],
        wires: [],
        minX: 100,
        minY: 200,
      };

      useClipboardStore.setState({ clipboard: clipboardData });

      const hasClipboard = useClipboardStore.getState().clipboard !== null;
      expect(hasClipboard).toBe(true);
    });
  });

  describe("Integration with workflowStore", () => {
    test("should read tools from workflowStore when copying", () => {
      const tools: Tool[] = [
        { id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] },
      ];

      useWorkflowStore.setState({ tools, wires: [] });

      useClipboardStore.getState().copyTools(["tool1"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard?.tools).toHaveLength(1);
      expect(clipboard?.tools[0]?.id).toBe("tool1");
    });

    test("should read wires from workflowStore when copying", () => {
      const tools: Tool[] = [
        {
          id: "tool1",
          type: "Input",
          x: 100,
          y: 200,
          config: {},
          sockets: [{ id: 'output', direction: 'output', multiple: false }],
        },
        {
          id: "tool2",
          type: "Filter",
          x: 300,
          y: 200,
          config: {},
          sockets: [{ id: 'input', direction: 'input', multiple: false }],
        },
      ];

      const wires: Wire[] = [
        {
          from: { tool: "tool1", socket: 'output' },
          to: { tool: "tool2", socket: 'input' },
        },
      ];

      useWorkflowStore.setState({ tools, wires });

      useClipboardStore.getState().copyTools(["tool1", "tool2"]);

      const clipboard = useClipboardStore.getState().clipboard;
      expect(clipboard?.wires).toHaveLength(1);
      expect(clipboard?.wires[0]?.from.tool).toBe("tool1");
    });

    test("should call batchAddToolsAndWires on paste", () => {
      const tools: Tool[] = [
        { id: "tool1", type: "Input", x: 100, y: 200, config: {}, sockets: [] },
      ];

      useWorkflowStore.setState({ tools, wires: [] });
      useClipboardStore.getState().copyTools(["tool1"]);

      const batchAddSpy = vi.fn();
      useWorkflowStore.setState({
        ...useWorkflowStore.getState(),
        batchAddToolsAndWires: batchAddSpy,
      });

      useClipboardStore.getState().pasteToolsAt({ x: 300, y: 400 });

      expect(batchAddSpy).toHaveBeenCalledTimes(1);
      expect(batchAddSpy.mock.calls[0][0]).toHaveLength(1); // 1 tool
      expect(batchAddSpy.mock.calls[0][1]).toHaveLength(0); // 0 wires
    });
  });
});
