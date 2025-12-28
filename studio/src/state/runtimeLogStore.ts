/**
 * runtimeLogStore - Application-wide runtime/network logging
 *
 * Tracks all API requests, responses, cache hits, and errors across the entire
 * application session. This is separate from workflow execution logs which are
 * per-run and workflow-specific.
 *
 * Features:
 * - Logs all network activity regardless of active tab
 * - Tracks request timing (duration)
 * - Correlates requests to workflows/tabs when context is provided
 * - Auto-limits to MAX_LOGS entries (oldest dropped)
 * - Can optionally forward to execution store for active tab
 */

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

/**
 * Types of runtime log entries
 */
export type RuntimeLogType =
  | "request"      // Outgoing API request
  | "response"     // Successful response received
  | "error"        // Request failed or error response
  | "cache-hit"    // Returned from cache (no network request)
  | "cache-miss";  // Not in cache, will fetch

/**
 * Runtime log entry
 */
export interface RuntimeLog {
  id: string;
  timestamp: string;
  type: RuntimeLogType;
  endpoint: string;
  method: string;
  duration?: number | undefined;      // Response time in ms
  status?: number | undefined;        // HTTP status code
  workflowId?: string | undefined;    // Which workflow this was for
  tabId?: string | undefined;         // Which tab initiated it
  toolId?: string | undefined;        // If tool-specific request
  message: string;                    // Human-readable summary
  cached?: boolean | undefined;       // Whether this was a cache hit
}

/**
 * Request context passed through API calls
 */
export interface RequestContext {
  tabId?: string | undefined;
  workflowId?: string | undefined;
  toolId?: string | undefined;
}

/**
 * Maximum number of log entries to keep
 */
const MAX_LOGS = 1000;

interface RuntimeLogState {
  logs: RuntimeLog[];
  
  // Actions
  logRequest: (endpoint: string, method: string, context?: RequestContext) => string;
  logResponse: (requestId: string, status: number, duration: number) => void;
  logError: (requestId: string, error: string, duration: number, status?: number) => void;
  logCacheHit: (endpoint: string, context?: RequestContext) => void;
  logCacheMiss: (endpoint: string, context?: RequestContext) => void;
  clearLogs: () => void;
}

// Track pending requests for timing
const pendingRequests = new Map<string, { endpoint: string; method: string; startTime: number; context?: RequestContext | undefined }>();

export const useRuntimeLogStore = create<RuntimeLogState>((set) => ({
  logs: [],

  /**
   * Log an outgoing request. Returns request ID for correlation.
   */
  logRequest: (endpoint: string, method: string, context?: RequestContext) => {
    const id = uuidv4();
    const startTime = performance.now();
    
    // Store for timing when response comes back
    pendingRequests.set(id, { endpoint, method, startTime, context });

    const log: RuntimeLog = {
      id,
      timestamp: new Date().toISOString(),
      type: "request",
      endpoint,
      method,
      workflowId: context?.workflowId,
      tabId: context?.tabId,
      toolId: context?.toolId,
      message: `${method} ${endpoint}`,
    };

    set((state) => ({
      logs: [...state.logs, log].slice(-MAX_LOGS),
    }));

    return id;
  },

  /**
   * Log a successful response
   */
  logResponse: (requestId: string, status: number, duration: number) => {
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    
    pendingRequests.delete(requestId);

    const log: RuntimeLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: "response",
      endpoint: pending.endpoint,
      method: pending.method,
      status,
      duration: Math.round(duration),
      workflowId: pending.context?.workflowId,
      tabId: pending.context?.tabId,
      toolId: pending.context?.toolId,
      message: `${status} OK ${pending.endpoint} (${Math.round(duration)}ms)`,
    };

    set((state) => ({
      logs: [...state.logs, log].slice(-MAX_LOGS),
    }));
  },

  /**
   * Log an error response
   */
  logError: (requestId: string, error: string, duration: number, status?: number) => {
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    
    pendingRequests.delete(requestId);

    const log: RuntimeLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: "error",
      endpoint: pending.endpoint,
      method: pending.method,
      status,
      duration: Math.round(duration),
      workflowId: pending.context?.workflowId,
      tabId: pending.context?.tabId,
      toolId: pending.context?.toolId,
      message: `ERROR ${pending.endpoint}: ${error}`,
    };

    set((state) => ({
      logs: [...state.logs, log].slice(-MAX_LOGS),
    }));
  },

  /**
   * Log a cache hit (no network request made)
   */
  logCacheHit: (endpoint: string, context?: RequestContext) => {
    const log: RuntimeLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: "cache-hit",
      endpoint,
      method: "CACHE",
      workflowId: context?.workflowId,
      tabId: context?.tabId,
      toolId: context?.toolId,
      message: `CACHE HIT ${endpoint}`,
      cached: true,
    };

    set((state) => ({
      logs: [...state.logs, log].slice(-MAX_LOGS),
    }));
  },

  /**
   * Log a cache miss (will make network request)
   */
  logCacheMiss: (endpoint: string, context?: RequestContext) => {
    const log: RuntimeLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: "cache-miss",
      endpoint,
      method: "CACHE",
      workflowId: context?.workflowId,
      tabId: context?.tabId,
      toolId: context?.toolId,
      message: `CACHE MISS ${endpoint}`,
      cached: false,
    };

    set((state) => ({
      logs: [...state.logs, log].slice(-MAX_LOGS),
    }));
  },

  /**
   * Clear all logs
   */
  clearLogs: () => {
    pendingRequests.clear();
    set({ logs: [] });
  },
}));

/**
 * Helper to get runtime log store actions without subscribing to state
 * Use this in non-React contexts (like backend.ts)
 */
export const getRuntimeLogActions = () => ({
  logRequest: useRuntimeLogStore.getState().logRequest,
  logResponse: useRuntimeLogStore.getState().logResponse,
  logError: useRuntimeLogStore.getState().logError,
  logCacheHit: useRuntimeLogStore.getState().logCacheHit,
  logCacheMiss: useRuntimeLogStore.getState().logCacheMiss,
});
