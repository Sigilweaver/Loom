import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  useToolConfiguration,
  useMultiSocketConfiguration,
} from "../useToolConfiguration";
import type {
  Tool,
  Wire,
  WorkflowMeta,
  ToolConfig,
} from "@domain/workflow/entities/workflow";

// Mock the useMetadata hook
const mockFetchMetadata = vi.fn();
vi.mock("../../api/hooks", () => ({
  useMetadata: () => ({
    columns: [{ name: "col1", dtype: "Int64", nullable: false }],
    loading: false,
    error: null,
    fetchMetadata: mockFetchMetadata,
  }),
}));

// Mock WorkflowSerializer
vi.mock("@domain/workflow/services/WorkflowSerializer", () => ({
  WorkflowSerializer: {
    extractUpstreamSubgraph: vi.fn(() => ({ tools: [], wires: [] })),
    toJSON: vi.fn(() => "{}"),
  },
}));

describe("useToolConfiguration", () => {
  const baseMeta: WorkflowMeta = {
    name: "Test",
    description: "",
    author: "test",
    workflowId: "test-123",
    created: "2025-01-01",
  };

  const baseConfig: ToolConfig = {
    expression: "",
    _emit: {},
  };

  const inputTool: Tool = {
    id: "input-1",
    type: "CsvInput",
    x: 0,
    y: 0,
    config: {},
    sockets: [{ id: "output", direction: "output" }],
  };

  const filterTool: Tool = {
    id: "filter-1",
    type: "Filter",
    x: 100,
    y: 0,
    config: baseConfig,
    sockets: [
      { id: "input", direction: "input" },
      { id: "output-true", direction: "output" },
      { id: "output-false", direction: "output" },
    ],
  };

  const connectedWire: Wire = {
    from: { tool: "input-1", socket: "output" },
    to: { tool: "filter-1", socket: "input" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("detects when socket has input connection", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    expect(result.current.hasInput).toBe(true);
    expect(result.current.connectionKey).toBe("input-1-output");
  });

  test("detects when socket has no input connection", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [], // No wires
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    expect(result.current.hasInput).toBe(false);
    expect(result.current.connectionKey).toBe("");
  });

  test("returns columns from metadata", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    expect(result.current.columns).toEqual([
      { name: "col1", dtype: "Int64", nullable: false },
    ]);
  });

  test("updateField triggers onChange with emission", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    act(() => {
      result.current.updateField("expression", "pl.col('a') > 10");
    });

    expect(onChange).toHaveBeenCalledWith({
      expression: "pl.col('a') > 10",
      _emit: { expression: true },
    });
  });

  test("updateField respects custom emitKey", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    act(() => {
      result.current.updateField("expression", "test", {
        emitKey: "customKey",
      });
    });

    expect(onChange).toHaveBeenCalledWith({
      expression: "test",
      _emit: { customKey: true },
    });
  });

  test("updateField with emit: false does not add to emission map", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    act(() => {
      result.current.updateField("expression", "test", { emit: false });
    });

    expect(onChange).toHaveBeenCalledWith({
      expression: "test",
      _emit: {},
    });
  });

  test("updateFields updates multiple fields at once", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    act(() => {
      result.current.updateFields({
        expression: "test expr",
        mode: "Custom",
      });
    });

    expect(onChange).toHaveBeenCalledWith({
      expression: "test expr",
      mode: "Custom",
      _emit: { expression: true, mode: true },
    });
  });

  test("updateFields with explicit emitKeys only emits specified keys", () => {
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    act(() => {
      result.current.updateFields(
        { expression: "test", mode: "Custom" },
        ["expression"] // Only emit expression
      );
    });

    expect(onChange).toHaveBeenCalledWith({
      expression: "test",
      mode: "Custom",
      _emit: { expression: true },
    });
  });

  test("preserves existing emission map entries", () => {
    const onChange = vi.fn();
    const configWithExisting: ToolConfig = {
      expression: "old",
      mode: "Custom",
      _emit: { mode: true },
    };

    const { result } = renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: configWithExisting,
        onChange,
      })
    );

    act(() => {
      result.current.updateField("expression", "new");
    });

    expect(onChange).toHaveBeenCalledWith({
      expression: "new",
      mode: "Custom",
      _emit: { mode: true, expression: true },
    });
  });

  test("fetches metadata when connection exists", () => {
    const onChange = vi.fn();

    renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [connectedWire],
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    // fetchMetadata should be called once on mount
    expect(mockFetchMetadata).toHaveBeenCalled();
  });

  test("does not fetch metadata when no connection", () => {
    const onChange = vi.fn();

    renderHook(() =>
      useToolConfiguration({
        toolId: "filter-1",
        socketId: "input",
        tools: [inputTool, filterTool],
        wires: [], // No wires
        workflowMeta: baseMeta,
        config: baseConfig,
        onChange,
      })
    );

    // fetchMetadata should not be called when no connection
    expect(mockFetchMetadata).not.toHaveBeenCalled();
  });
});

describe("useMultiSocketConfiguration", () => {
  const baseMeta: WorkflowMeta = {
    name: "Test",
    description: "",
    author: "test",
    workflowId: "test-123",
    created: "2025-01-01",
  };

  const leftInputTool: Tool = {
    id: "left-input",
    type: "CsvInput",
    x: 0,
    y: 0,
    config: {},
    sockets: [{ id: "output", direction: "output" }],
  };

  const rightInputTool: Tool = {
    id: "right-input",
    type: "CsvInput",
    x: 0,
    y: 100,
    config: {},
    sockets: [{ id: "output", direction: "output" }],
  };

  const joinTool: Tool = {
    id: "join-1",
    type: "Join",
    x: 200,
    y: 50,
    config: {},
    sockets: [
      { id: "input-left", direction: "input" },
      { id: "input-right", direction: "input" },
      { id: "output-match", direction: "output" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("tracks multiple socket connections", () => {
    const leftWire: Wire = {
      from: { tool: "left-input", socket: "output" },
      to: { tool: "join-1", socket: "input-left" },
    };
    const rightWire: Wire = {
      from: { tool: "right-input", socket: "output" },
      to: { tool: "join-1", socket: "input-right" },
    };

    const { result } = renderHook(() =>
      useMultiSocketConfiguration({
        toolId: "join-1",
        sockets: [
          { id: "input-left", name: "left" },
          { id: "input-right", name: "right" },
        ],
        tools: [leftInputTool, rightInputTool, joinTool],
        wires: [leftWire, rightWire],
        workflowMeta: baseMeta,
      })
    );

    expect(result.current.left?.hasInput).toBe(true);
    expect(result.current.left?.connectionKey).toBe("left-input-output");
    expect(result.current.right?.hasInput).toBe(true);
    expect(result.current.right?.connectionKey).toBe("right-input-output");
  });

  test("handles partial connections", () => {
    const leftWire: Wire = {
      from: { tool: "left-input", socket: "output" },
      to: { tool: "join-1", socket: "input-left" },
    };

    const { result } = renderHook(() =>
      useMultiSocketConfiguration({
        toolId: "join-1",
        sockets: [
          { id: "input-left", name: "left" },
          { id: "input-right", name: "right" },
        ],
        tools: [leftInputTool, joinTool],
        wires: [leftWire], // Only left connected
        workflowMeta: baseMeta,
      })
    );

    expect(result.current.left?.hasInput).toBe(true);
    expect(result.current.right?.hasInput).toBe(false);
    expect(result.current.right?.connectionKey).toBe("");
  });

  test("provides separate columns for each socket", () => {
    const { result } = renderHook(() =>
      useMultiSocketConfiguration({
        toolId: "join-1",
        sockets: [
          { id: "input-left", name: "left" },
          { id: "input-right", name: "right" },
        ],
        tools: [leftInputTool, rightInputTool, joinTool],
        wires: [],
        workflowMeta: baseMeta,
      })
    );

    // Both should have the mocked columns (from the same mock)
    expect(result.current.left?.columns).toEqual([
      { name: "col1", dtype: "Int64", nullable: false },
    ]);
    expect(result.current.right?.columns).toEqual([
      { name: "col1", dtype: "Int64", nullable: false },
    ]);
  });
});
