import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "../App";
import { useUIStore } from "../state/uiStore";

// Mock the entire App dependencies to see if it can render
// App uses Zustand stores which are automatically mocked in test environment

vi.mock("../data/tools", () => ({
  DEFAULT_FAVORITE_TOOLS: ["Input", "Output"],
  getToolDefinition: vi.fn((type) => ({
    type,
    name: `${type} Tool`,
    icon: "icon",
    category: "connect",
    defaultConfig: { setting: "default" },
    sockets: [
      { id: 1, direction: "output", multiple: false },
      { id: 2, direction: "input", multiple: false },
    ],
  })),
  getToolsByCategory: vi.fn(() => []),
}));

vi.mock("../utils/id", () => ({
  generateUniqueId: vi.fn(() => "generated-id-123"),
}));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-flow-provider">{children}</div>
  ),
}));

// Mock all the components
vi.mock("../components/Canvas", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef } = require("react");
  return {
    default: forwardRef((_props: any, ref: any) => (
      <div data-testid="canvas" ref={ref}>
        Canvas
      </div>
    )),
    CanvasRef: {},
  };
});

vi.mock("../components/workflow/WorkflowViewer", () => ({
  default: () => <div data-testid="workflow-viewer">Workflow Viewer</div>,
}));

const headerActions = vi.hoisted(() => ({
  handleSaveWorkflow: vi.fn(),
  handleSaveAsWorkflow: vi.fn(),
  handleImportWorkflow: vi.fn(),
  handlePreviewWorkflow: vi.fn(),
  handleToggleWorkflowViewer: vi.fn(),
  handleRunWorkflow: vi.fn(),
}));

vi.mock("../components/shell/Header", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef, useImperativeHandle } = require("react");
  return {
    default: forwardRef((_props: any, ref: any) => {
      useImperativeHandle(ref, () => headerActions);
      return <div data-testid="header">Header</div>;
    }),
  };
});

vi.mock("../components/shell/Notification", () => ({
  default: () => <div data-testid="notification">Notification</div>,
}));

vi.mock("../components/LeftPane", () => ({
  default: () => (
    <div data-testid="left-pane">Left Pane</div>
  ),
}));

vi.mock("../contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

describe("App Basic Rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders without crashing", () => {
    render(<App />);
    expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
  });

  test("renders main components", () => {
    render(<App />);

    expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("left-pane")).toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(screen.getByTestId("react-flow-provider")).toBeInTheDocument();
  });
});

describe("App workflow shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("Ctrl+S saves the workflow and blocks the browser save while a field has focus", () => {
    render(<App />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const onBlur = vi.fn();
    input.addEventListener("blur", onBlur);

    const notCancelled = fireEvent.keyDown(input, { key: "s", ctrlKey: true });

    expect(notCancelled).toBe(false);
    expect(onBlur).toHaveBeenCalled();
    expect(headerActions.handleSaveWorkflow).toHaveBeenCalledTimes(1);
    input.remove();
  });

  test("F5 runs the workflow instead of reloading the page", () => {
    render(<App />);
    const notCancelled = fireEvent.keyDown(window, { key: "F5" });
    expect(notCancelled).toBe(false);
    expect(headerActions.handleRunWorkflow).toHaveBeenCalledTimes(1);
  });

  test("plain typing is left alone", () => {
    render(<App />);
    const notCancelled = fireEvent.keyDown(window, { key: "s" });
    expect(notCancelled).toBe(true);
    expect(headerActions.handleSaveWorkflow).not.toHaveBeenCalled();
  });

  test("? opens the shortcut list, but not while typing", () => {
    render(<App />);
    useUIStore.setState({ shortcutsHelpOpen: false });

    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "?" });
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(false);
    input.remove();

    fireEvent.keyDown(window, { key: "?" });
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(true);
  });
});
