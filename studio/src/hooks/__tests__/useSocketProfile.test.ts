import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSocketProfile } from "../useSocketProfile";
import { useUIStore } from "../../state/uiStore";
import { useWorkflowStore } from "../../state/workflowStore";
import type { Tool } from "../../domain/workflow/entities/workflow";

// Mock the API module
vi.mock("../../api/execution", () => ({
  profileColumns: vi.fn(),
}));

vi.mock("../../api/connectionResolver", () => ({
  resolveWorkflowConnections: vi.fn((workflow) => Promise.resolve(workflow)),
}));

// Helper to create a valid tool
function createTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "tool1",
    type: "Input",
    x: 0,
    y: 0,
    config: {},
    sockets: [{ id: "output", direction: "output" }],
    ...overrides,
  };
}

describe("useSocketProfile", () => {
  beforeEach(() => {
    // Reset stores
    useUIStore.setState({
      bottomPaneOpen: false,
      activeBottomTab: "preview",
      profileState: null,
    });
    
    useWorkflowStore.setState({
      tools: [],
      wires: [],
      workflowMeta: {
        name: "Test Workflow",
        description: "",
        author: "Test",
        workflowId: "test-123",
        created: new Date().toISOString(),
      },
    });
    
    vi.clearAllMocks();
  });

  it("returns profileSocket function", () => {
    const { result } = renderHook(() => useSocketProfile());
    
    expect(result.current.profileSocket).toBeDefined();
    expect(typeof result.current.profileSocket).toBe("function");
  });

  it("opens bottom pane and switches to profile tab when profiling", async () => {
    const { profileColumns } = await import("../../api/execution");
    (profileColumns as ReturnType<typeof vi.fn>).mockResolvedValue({
      tool_id: "tool1",
      socket_id: "output",
      row_count: 100,
      column_count: 2,
      columns: {
        name: { column: "name", dtype: "String", count: 100 },
        age: { column: "age", dtype: "Int64", count: 100 },
      },
    });

    // Setup a tool
    useWorkflowStore.setState({
      tools: [createTool()],
      wires: [],
    });

    const { result } = renderHook(() => useSocketProfile());

    await act(async () => {
      await result.current.profileSocket("tool1", "output", "output");
    });

    expect(useUIStore.getState().bottomPaneOpen).toBe(true);
    expect(useUIStore.getState().activeBottomTab).toBe("profile");
  });

  it("sets error when input socket has no connection", async () => {
    // Setup a tool without any wires
    useWorkflowStore.setState({
      tools: [createTool({ 
        type: "Filter", 
        sockets: [
          { id: "input", direction: "input" },
          { id: "output-true", direction: "output" },
        ],
      })],
      wires: [],
    });

    const { result } = renderHook(() => useSocketProfile());

    await act(async () => {
      await result.current.profileSocket("tool1", "input", "input");
    });

    const profileState = useUIStore.getState().profileState;
    expect(profileState?.error).toBe("No connection to this input socket");
    expect(profileState?.loading).toBe(false);
  });

  it("sets loading state during profile fetch", async () => {
    const { profileColumns } = await import("../../api/execution");
    
    // Create a promise we can control
    let resolveProfile: (value: unknown) => void;
    const profilePromise = new Promise((resolve) => {
      resolveProfile = resolve;
    });
    (profileColumns as ReturnType<typeof vi.fn>).mockReturnValue(profilePromise);

    useWorkflowStore.setState({
      tools: [createTool()],
      wires: [],
    });

    const { result } = renderHook(() => useSocketProfile());

    // Start profiling (don't await)
    const profilePromiseResult = act(async () => {
      await result.current.profileSocket("tool1", "output", "output");
    });

    // Check loading state is set
    expect(useUIStore.getState().profileState?.loading).toBe(true);

    // Resolve the profile
    resolveProfile!({
      tool_id: "tool1",
      socket_id: "output",
      row_count: 100,
      column_count: 1,
      columns: {},
    });

    await profilePromiseResult;

    // Check loading is cleared
    expect(useUIStore.getState().profileState?.loading).toBe(false);
  });

  it("handles API errors gracefully", async () => {
    const { profileColumns } = await import("../../api/execution");
    (profileColumns as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    useWorkflowStore.setState({
      tools: [createTool()],
      wires: [],
    });

    const { result } = renderHook(() => useSocketProfile());

    await act(async () => {
      await result.current.profileSocket("tool1", "output", "output");
    });

    const profileState = useUIStore.getState().profileState;
    expect(profileState?.error).toBe("Network error");
    expect(profileState?.loading).toBe(false);
    expect(profileState?.profile).toBeNull();
  });
});
