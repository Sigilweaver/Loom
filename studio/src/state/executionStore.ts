import { create } from "zustand";
import { WorkflowExecuteResponse } from "../api/backend";

export interface ExecutionLog {
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
  toolId?: string;
}

interface ExecutionState {
  executions: Record<string, ExecutionTabState>;
  activeTabId: string | null;
  // Execution status
  isExecuting: boolean;
  currentToolId: string | null;
  
  // Execution results
  result: WorkflowExecuteResponse | null;
  error: string | null;
  
  // Logs
  logs: ExecutionLog[];
  
  // Actions
  setActiveTab: (tabId: string | null) => void;
  removeTab: (tabId: string) => void;
  startExecution: (tabId?: string) => void;
  finishExecution: (result: WorkflowExecuteResponse, tabId?: string) => void;
  failExecution: (error: string, tabId?: string) => void;
  clearExecution: (tabId?: string) => void;
  addLog: (log: Omit<ExecutionLog, "timestamp">, tabId?: string) => void;
  clearLogs: (tabId?: string) => void;
}

export interface ExecutionTabState {
  isExecuting: boolean;
  currentToolId: string | null;
  result: WorkflowExecuteResponse | null;
  error: string | null;
  logs: ExecutionLog[];
}

const emptyExecution = (): ExecutionTabState => ({
  isExecuting: false,
  currentToolId: null,
  result: null,
  error: null,
  logs: [],
});

export const useExecutionStore = create<ExecutionState>((set) => ({
  executions: {},
  activeTabId: null,
  // Initial state
  isExecuting: false,
  currentToolId: null,
  result: null,
  error: null,
  logs: [],

  setActiveTab: (tabId) => set((state) => {
    const execution = tabId ? (state.executions[tabId] ?? emptyExecution()) : emptyExecution();
    return {
      activeTabId: tabId,
      ...(tabId ? { executions: { ...state.executions, [tabId]: execution } } : {}),
      ...execution,
    };
  }),

  removeTab: (tabId) => set((state) => {
    const { [tabId]: _removed, ...executions } = state.executions;
    return { executions };
  }),

  // Start execution
  startExecution: (tabId) => set((state) => updateTab(state, tabId, {
    isExecuting: true, result: null, error: null,
  })),

  // Finish execution successfully
  finishExecution: (result, tabId) => set((state) => updateTab(state, tabId, {
    isExecuting: false, result, error: null,
  })),

  // Finish execution with error
  failExecution: (error, tabId) => set((state) => updateTab(state, tabId, {
    isExecuting: false, result: null, error,
  })),

  // Clear execution state
  clearExecution: (tabId) => set((state) => updateTab(state, tabId, {
    isExecuting: false, currentToolId: null, result: null, error: null,
  })),

  // Add a log entry
  addLog: (log, tabId) => set((state) => {
    const id = tabId ?? state.activeTabId ?? "__default__";
    const current = getCurrentExecution(state, id);
    return updateTab(state, id, {
      logs: [
        ...current.logs,
        {
          ...log,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }),

  // Clear all logs
  clearLogs: (tabId) => set((state) => updateTab(state, tabId, { logs: [] })),
}));

function updateTab(
  state: ExecutionState,
  tabId: string | undefined,
  update: Partial<ExecutionTabState>,
): Partial<ExecutionState> {
  const id = tabId ?? state.activeTabId ?? "__default__";
  const execution = { ...getCurrentExecution(state, id), ...update };
  return {
    executions: { ...state.executions, [id]: execution },
    ...(id === state.activeTabId || (!state.activeTabId && id === "__default__") ? execution : {}),
  };
}

function getCurrentExecution(state: ExecutionState, tabId: string): ExecutionTabState {
  if (tabId === state.activeTabId || (!state.activeTabId && tabId === "__default__")) {
    return {
      isExecuting: state.isExecuting,
      currentToolId: state.currentToolId,
      result: state.result,
      error: state.error,
      logs: state.logs,
    };
  }
  return state.executions[tabId] ?? emptyExecution();
}
