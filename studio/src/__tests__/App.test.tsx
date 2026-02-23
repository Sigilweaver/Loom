import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "../App";

// Mock the entire App dependencies to see if it can render
// App uses Zustand stores which are automatically mocked in test environment

vi.mock("../data/tools", () => ({
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { forwardRef } = require("react");
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

vi.mock("../components/shell/Header", () => ({
  default: () => <div data-testid="header">Header</div>,
}));

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
