import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@contexts/ThemeContext";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import SocketTabs from "../SocketTabs";
import { Tool, Wire } from "@domain/workflow/entities/workflow";

// Mock useSocketPreview hook
const mockPreviewSocket = vi.fn();
vi.mock("@hooks/useSocketPreview", () => ({
  useSocketPreview: () => ({ previewSocket: mockPreviewSocket }),
}));

// Helper to create test tools
const createTool = (id: string, type: string): Tool => ({
  id,
  type,
  x: 0,
  y: 0,
  config: {},
  sockets: [], // Sockets come from TOOL_DEFINITIONS
});

// Helper to create test wires
const createWire = (
  fromTool: string,
  fromSocket: string,
  toTool: string,
  toSocket: string
): Wire => ({
  from: { tool: fromTool, socket: fromSocket },
  to: { tool: toTool, socket: toSocket },
});

const renderSocketTabs = () => {
  return render(
    <ThemeProvider>
      <SocketTabs />
    </ThemeProvider>
  );
};

describe("SocketTabs", () => {
  beforeEach(() => {
    // Reset stores
    useUIStore.setState({ previewState: null });
    useWorkflowStore.setState({
      tools: [],
      wires: [],
      selectedTool: null,
    });
    mockPreviewSocket.mockClear();
  });

  describe("empty states", () => {
    it("shows placeholder when no tool is selected", () => {
      renderSocketTabs();
      expect(screen.getByText(/Select a socket to preview/i)).toBeInTheDocument();
    });
  });

  describe("Input tool (output only)", () => {
    it("shows only Output tab for Input tool", () => {
      const inputTool = createTool("input1", "Input");
      useWorkflowStore.setState({
        tools: [inputTool],
        selectedTool: inputTool,
      });

      renderSocketTabs();

      // Should show Outputs section with single Output
      expect(screen.getByText("Outputs")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Output" })).toBeInTheDocument();

      // Should NOT show Inputs section
      expect(screen.queryByText("Inputs")).not.toBeInTheDocument();
    });
  });

  describe("Output tool (input only)", () => {
    it("shows Input tab only when connected", () => {
      const inputTool = createTool("input1", "Input");
      const outputTool = createTool("output1", "Output");
      const wire = createWire('input1', 'output', 'output1', 'input');

      useWorkflowStore.setState({
        tools: [inputTool, outputTool],
        wires: [wire],
        selectedTool: outputTool,
      });

      renderSocketTabs();

      // Should show Inputs section with connected Input
      expect(screen.getByText("Inputs")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Input" })).toBeInTheDocument();

      // Should NOT show Outputs section (Output tool has no outputs)
      expect(screen.queryByText("Outputs")).not.toBeInTheDocument();
    });

    it("hides disconnected inputs", () => {
      const outputTool = createTool("output1", "Output");
      // No wires - input is disconnected

      useWorkflowStore.setState({
        tools: [outputTool],
        wires: [],
        selectedTool: outputTool,
      });

      renderSocketTabs();

      // Should not show any tabs (no connected inputs, no outputs)
      expect(screen.queryByText("Inputs")).not.toBeInTheDocument();
      expect(screen.queryByText("Outputs")).not.toBeInTheDocument();
    });
  });

  describe("Filter tool (True/False outputs)", () => {
    it("shows Input and True/False outputs", () => {
      const inputTool = createTool("input1", "Input");
      const filterTool = createTool("filter1", "Filter");
      const wire = createWire('input1', 'output', 'filter1', 'input');

      useWorkflowStore.setState({
        tools: [inputTool, filterTool],
        wires: [wire],
        selectedTool: filterTool,
      });

      renderSocketTabs();

      // Should show connected Input
      expect(screen.getByText("Inputs")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Input" })).toBeInTheDocument();

      // Should show True and False outputs
      expect(screen.getByText("Outputs")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "True" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "False" })).toBeInTheDocument();
    });
  });

  describe("Join tool (multiple inputs and outputs)", () => {
    it("shows Left In/Right In and Left Out/Join Out/Right Out", () => {
      const input1 = createTool("input1", "Input");
      const input2 = createTool("input2", "Input");
      const joinTool = createTool("join1", "Join");
      const wireLeft = createWire('input1', 'output', 'join1', 'input-left'); // Left input
      const wireRight = createWire('input2', 'output', 'join1', 'input-right'); // Right input

      useWorkflowStore.setState({
        tools: [input1, input2, joinTool],
        wires: [wireLeft, wireRight],
        selectedTool: joinTool,
      });

      renderSocketTabs();

      // Should show both connected inputs
      expect(screen.getByRole("button", { name: "Left In" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Right In" })).toBeInTheDocument();

      // Should show all outputs
      expect(screen.getByRole("button", { name: "Left Out" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Join Out" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Right Out" })).toBeInTheDocument();
    });

    it("only shows connected inputs for Join", () => {
      const input1 = createTool("input1", "Input");
      const joinTool = createTool("join1", "Join");
      const wireLeft = createWire('input1', 'output', 'join1', 'input-left'); // Only left connected

      useWorkflowStore.setState({
        tools: [input1, joinTool],
        wires: [wireLeft],
        selectedTool: joinTool,
      });

      renderSocketTabs();

      // Should show only Left In (connected)
      expect(screen.getByRole("button", { name: "Left In" })).toBeInTheDocument();
      // Right In should NOT be shown (not connected)
      expect(screen.queryByRole("button", { name: "Right In" })).not.toBeInTheDocument();
    });
  });

  describe("tab selection", () => {
    it("highlights selected tab based on previewState", () => {
      const filterTool = createTool("filter1", "Filter");
      const inputTool = createTool("input1", "Input");
      const wire = createWire('input1', 'output', 'filter1', 'input');

      useWorkflowStore.setState({
        tools: [inputTool, filterTool],
        wires: [wire],
        selectedTool: filterTool,
      });

      // Set preview state to True output (socket output-true)
      useUIStore.setState({
        previewState: {
          toolId: "filter1",
          socketId: 'output-true',
          socketDirection: "output",
          data: [],
          schema: [],
          loading: false,
          error: null,
        },
      });

      renderSocketTabs();

      const trueButton = screen.getByRole("button", { name: "True" });
      const falseButton = screen.getByRole("button", { name: "False" });

      // True should have accent styling (selected)
      expect(trueButton.className).toContain("accent");
      // False should not have accent styling
      expect(falseButton.className).not.toContain("accent");
    });
  });

  describe("tab click behavior", () => {
    it("calls previewSocket when clicking a tab", async () => {
      const user = userEvent.setup();
      const filterTool = createTool("filter1", "Filter");
      const inputTool = createTool("input1", "Input");
      const wire = createWire('input1', 'output', 'filter1', 'input');

      useWorkflowStore.setState({
        tools: [inputTool, filterTool],
        wires: [wire],
        selectedTool: filterTool,
      });

      renderSocketTabs();

      const trueButton = screen.getByRole("button", { name: "True" });
      await user.click(trueButton);

      expect(mockPreviewSocket).toHaveBeenCalledWith("filter1", 'output-true', "output");
    });

    it("disables tabs while loading", () => {
      const filterTool = createTool("filter1", "Filter");
      const inputTool = createTool("input1", "Input");
      const wire = createWire('input1', 'output', 'filter1', 'input');

      useWorkflowStore.setState({
        tools: [inputTool, filterTool],
        wires: [wire],
        selectedTool: filterTool,
      });

      useUIStore.setState({
        previewState: {
          toolId: "filter1",
          socketId: 'output',
          socketDirection: "output",
          data: [],
          schema: [],
          loading: true,
          error: null,
        },
      });

      renderSocketTabs();

      const trueButton = screen.getByRole("button", { name: "True" });
      expect(trueButton).toBeDisabled();
    });
  });

  describe("tool priority", () => {
    it("prefers selectedTool over previewState.toolId", () => {
      const inputTool = createTool("input1", "Input");
      const filterTool = createTool("filter1", "Filter");
      const wire = createWire('input1', 'output', 'filter1', 'input');

      useWorkflowStore.setState({
        tools: [inputTool, filterTool],
        wires: [wire],
        selectedTool: filterTool, // User selected Filter
      });

      // Preview state still points to Input tool (stale)
      useUIStore.setState({
        previewState: {
          toolId: "input1",
          socketId: 'input',
          socketDirection: "output",
          data: [],
          schema: [],
          loading: false,
          error: null,
        },
      });

      renderSocketTabs();

      // Should show Filter's sockets, not Input's
      expect(screen.getByRole("button", { name: "True" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "False" })).toBeInTheDocument();
    });
  });
});
