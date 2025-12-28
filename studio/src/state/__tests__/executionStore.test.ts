import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExecutionStore, ExecutionLog } from "../executionStore";
import { WorkflowExecuteResponse } from "../../api/backend";

describe("ExecutionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the store state before each test
    useExecutionStore.setState({
      isExecuting: false,
      currentToolId: null,
      result: null,
      error: null,
      logs: [],
    });
  });

  describe("Initial State", () => {
    it("has correct default state", () => {
      const state = useExecutionStore.getState();

      expect(state.isExecuting).toBe(false);
      expect(state.currentToolId).toBeNull();
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
      expect(state.logs).toEqual([]);
    });
  });

  describe("startExecution", () => {
    it("sets isExecuting to true", () => {
      useExecutionStore.getState().startExecution();
      const state = useExecutionStore.getState();

      expect(state.isExecuting).toBe(true);
    });

    it("clears previous result and error when starting", () => {
      // Set up prior state
      useExecutionStore.setState({
        result: { outputs: {} } as WorkflowExecuteResponse,
        error: "Previous error",
      });

      useExecutionStore.getState().startExecution();
      const state = useExecutionStore.getState();

      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });

    it("does not clear logs when starting execution", () => {
      // Add a log first
      useExecutionStore.getState().addLog({
        level: "info",
        message: "Previous log",
      });

      useExecutionStore.getState().startExecution();
      const state = useExecutionStore.getState();

      // Logs should persist across executions - users may want to see history
      expect(state.logs.length).toBe(1);
    });
  });

  describe("finishExecution", () => {
    it("sets isExecuting to false and stores result", () => {
      const mockResult: WorkflowExecuteResponse = {
        tool_id: "tool1",
        outputs: {
          tool1: {
            data_schema: { columns: [] },
            data: [],
          },
        },
      };

      useExecutionStore.getState().startExecution();
      useExecutionStore.getState().finishExecution(mockResult);
      const state = useExecutionStore.getState();

      expect(state.isExecuting).toBe(false);
      expect(state.result).toEqual(mockResult);
      expect(state.error).toBeNull();
    });

    it("clears any previous error when finishing successfully", () => {
      useExecutionStore.setState({ error: "Old error" });

      const mockResult: WorkflowExecuteResponse = { tool_id: "tool1", outputs: {} };
      useExecutionStore.getState().finishExecution(mockResult);
      const state = useExecutionStore.getState();

      expect(state.error).toBeNull();
    });
  });

  describe("failExecution", () => {
    it("sets isExecuting to false and stores error", () => {
      useExecutionStore.getState().startExecution();
      useExecutionStore.getState().failExecution("Something went wrong");
      const state = useExecutionStore.getState();

      expect(state.isExecuting).toBe(false);
      expect(state.error).toBe("Something went wrong");
      expect(state.result).toBeNull();
    });

    it("clears any previous result when failing", () => {
      useExecutionStore.setState({
        result: { outputs: {} } as WorkflowExecuteResponse,
      });

      useExecutionStore.getState().failExecution("Error occurred");
      const state = useExecutionStore.getState();

      expect(state.result).toBeNull();
    });
  });

  describe("clearExecution", () => {
    it("resets all execution state", () => {
      // Set up complex state
      useExecutionStore.setState({
        isExecuting: true,
        currentToolId: "tool1",
        result: { outputs: {} } as WorkflowExecuteResponse,
        error: "Some error",
      });

      useExecutionStore.getState().clearExecution();
      const state = useExecutionStore.getState();

      expect(state.isExecuting).toBe(false);
      expect(state.currentToolId).toBeNull();
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });

    it("does not clear logs", () => {
      useExecutionStore.getState().addLog({
        level: "info",
        message: "Test log",
      });

      useExecutionStore.getState().clearExecution();
      const state = useExecutionStore.getState();

      // clearExecution should not affect logs - they have separate lifecycle
      expect(state.logs.length).toBe(1);
    });
  });

  describe("addLog", () => {
    it("adds a log entry with timestamp", () => {
      const beforeTime = new Date().toISOString();

      useExecutionStore.getState().addLog({
        level: "info",
        message: "Test message",
      });

      const afterTime = new Date().toISOString();
      const state = useExecutionStore.getState();

      expect(state.logs.length).toBe(1);
      const log = state.logs[0];
      expect(log).toBeDefined();
      expect(log!.level).toBe("info");
      expect(log!.message).toBe("Test message");
      expect(log!.timestamp).toBeDefined();
      // Timestamp should be between before and after
      expect(log!.timestamp >= beforeTime).toBe(true);
      expect(log!.timestamp <= afterTime).toBe(true);
    });

    it("preserves existing logs when adding new ones", () => {
      useExecutionStore.getState().addLog({
        level: "info",
        message: "First",
      });
      useExecutionStore.getState().addLog({
        level: "success",
        message: "Second",
      });
      useExecutionStore.getState().addLog({
        level: "error",
        message: "Third",
      });

      const state = useExecutionStore.getState();

      expect(state.logs.length).toBe(3);
      expect(state.logs[0]!.message).toBe("First");
      expect(state.logs[1]!.message).toBe("Second");
      expect(state.logs[2]!.message).toBe("Third");
    });

    it("includes optional toolId when provided", () => {
      useExecutionStore.getState().addLog({
        level: "info",
        message: "Tool-specific message",
        toolId: "tool-123",
      });

      const state = useExecutionStore.getState();

      expect(state.logs[0]!.toolId).toBe("tool-123");
    });

    it("supports all log levels", () => {
      const levels: ExecutionLog["level"][] = ["info", "success", "error", "warning"];

      levels.forEach((level) => {
        useExecutionStore.getState().addLog({
          level,
          message: `${level} message`,
        });
      });

      const state = useExecutionStore.getState();

      expect(state.logs.length).toBe(4);
      expect(state.logs.map((l) => l.level)).toEqual(levels);
    });
  });

  describe("clearLogs", () => {
    it("removes all logs", () => {
      // Add several logs
      useExecutionStore.getState().addLog({ level: "info", message: "1" });
      useExecutionStore.getState().addLog({ level: "info", message: "2" });
      useExecutionStore.getState().addLog({ level: "info", message: "3" });

      expect(useExecutionStore.getState().logs.length).toBe(3);

      useExecutionStore.getState().clearLogs();

      expect(useExecutionStore.getState().logs).toEqual([]);
    });

    it("does not affect execution state", () => {
      useExecutionStore.setState({
        isExecuting: true,
        result: { outputs: {} } as WorkflowExecuteResponse,
        error: "Error",
      });

      useExecutionStore.getState().addLog({ level: "info", message: "Log" });
      useExecutionStore.getState().clearLogs();

      const state = useExecutionStore.getState();

      expect(state.isExecuting).toBe(true);
      expect(state.result).toBeDefined();
      expect(state.error).toBe("Error");
    });
  });

  describe("Execution Lifecycle", () => {
    it("supports complete success workflow", () => {
      const { startExecution, addLog, finishExecution } = useExecutionStore.getState();

      // Start
      startExecution();
      expect(useExecutionStore.getState().isExecuting).toBe(true);

      // Log progress
      addLog({ level: "info", message: "Starting workflow" });
      addLog({ level: "info", message: "Processing tool1", toolId: "tool1" });
      addLog({ level: "success", message: "Workflow complete" });

      // Finish
      const result: WorkflowExecuteResponse = { tool_id: "tool1", outputs: { tool1: { data_schema: { columns: [] }, data: [] } } };
      finishExecution(result);

      const state = useExecutionStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.result).toEqual(result);
      expect(state.error).toBeNull();
      expect(state.logs.length).toBe(3);
    });

    it("supports complete failure workflow", () => {
      const { startExecution, addLog, failExecution } = useExecutionStore.getState();

      startExecution();
      addLog({ level: "info", message: "Starting workflow" });
      addLog({ level: "error", message: "Tool failed", toolId: "tool1" });
      failExecution("Tool1 failed: invalid expression");

      const state = useExecutionStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.result).toBeNull();
      expect(state.error).toBe("Tool1 failed: invalid expression");
      expect(state.logs.length).toBe(2);
    });

    it("handles multiple executions correctly", () => {
      const { startExecution, finishExecution, failExecution } =
        useExecutionStore.getState();

      // First execution - success
      startExecution();
      finishExecution({ tool_id: "tool1", outputs: { tool1: { data_schema: { columns: [] }, data: [] } } });

      // Second execution - failure
      startExecution();
      // Previous result should be cleared
      expect(useExecutionStore.getState().result).toBeNull();
      failExecution("Second run failed");

      // Verify second run's error is stored
      expect(useExecutionStore.getState().error).toBe("Second run failed");

      // Third execution - success again
      startExecution();
      expect(useExecutionStore.getState().error).toBeNull();
      finishExecution({ tool_id: "tool1", outputs: {} });

      expect(useExecutionStore.getState().result).toEqual({ tool_id: "tool1", outputs: {} });
    });
  });

  describe("Edge Cases", () => {
    it("handles finishing without starting", () => {
      // This shouldn't crash, though it's not the expected flow
      const result: WorkflowExecuteResponse = { tool_id: "tool1", outputs: {} };
      useExecutionStore.getState().finishExecution(result);

      const state = useExecutionStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.result).toEqual(result);
    });

    it("handles failing without starting", () => {
      useExecutionStore.getState().failExecution("Error without start");

      const state = useExecutionStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.error).toBe("Error without start");
    });

    it("handles empty error message", () => {
      useExecutionStore.getState().failExecution("");

      const state = useExecutionStore.getState();
      expect(state.error).toBe("");
    });

    it("handles empty log message", () => {
      useExecutionStore.getState().addLog({ level: "info", message: "" });

      const state = useExecutionStore.getState();
      expect(state.logs[0]!.message).toBe("");
    });
  });
});
