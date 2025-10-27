import { create } from "zustand";
import { WorkflowExecuteResponse } from "../api/backend";

export interface ExecutionLog {
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
  toolId?: string;
}

interface ExecutionState {
  // Execution status
  isExecuting: boolean;
  currentToolId: string | null;
  
  // Execution results
  result: WorkflowExecuteResponse | null;
  error: string | null;
  
  // Logs
  logs: ExecutionLog[];
  
  // Actions
  startExecution: () => void;
  finishExecution: (result: WorkflowExecuteResponse) => void;
  failExecution: (error: string) => void;
  clearExecution: () => void;
  addLog: (log: Omit<ExecutionLog, "timestamp">) => void;
  clearLogs: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  // Initial state
  isExecuting: false,
  currentToolId: null,
  result: null,
  error: null,
  logs: [],

  // Start execution
  startExecution: () => set({
    isExecuting: true,
    result: null,
    error: null,
  }),

  // Finish execution successfully
  finishExecution: (result) => set({
    isExecuting: false,
    result,
    error: null,
  }),

  // Finish execution with error
  failExecution: (error) => set({
    isExecuting: false,
    result: null,
    error,
  }),

  // Clear execution state
  clearExecution: () => set({
    isExecuting: false,
    currentToolId: null,
    result: null,
    error: null,
  }),

  // Add a log entry
  addLog: (log) => set((state) => ({
    logs: [
      ...state.logs,
      {
        ...log,
        timestamp: new Date().toISOString(),
      },
    ],
  })),

  // Clear all logs
  clearLogs: () => set({ logs: [] }),
}));
