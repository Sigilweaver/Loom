import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useRuntimeLogStore,
  getRuntimeLogActions,
} from "../runtimeLogStore";

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => `uuid-${Math.random().toString(36).substring(7)}`),
}));

// Mock performance.now for consistent timing tests
const mockNow = vi.spyOn(performance, "now");

// Helper to get log safely with assertion
const getLog = (index: number) => {
  const logs = useRuntimeLogStore.getState().logs;
  const log = logs[index];
  if (!log) throw new Error(`No log at index ${index}`);
  return log;
};

describe("RuntimeLogStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNow.mockReturnValue(0);
    // Reset the store state before each test
    useRuntimeLogStore.setState({ logs: [], logsByTabId: {}, activeTabId: null });
    // Clear pending requests by calling clearLogs which also clears pendingRequests
    useRuntimeLogStore.getState().clearLogs();
  });

  describe("Initial State", () => {
    it("has empty logs array initially", () => {
      const state = useRuntimeLogStore.getState();
      expect(state.logs).toEqual([]);
    });
  });

  describe("logRequest", () => {
    it("creates a request log entry", () => {
      const { logRequest } = useRuntimeLogStore.getState();

      const requestId = logRequest("/api/workflow/execute", "POST");

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(1);
      
      const log = getLog(0);
      expect(log.type).toBe("request");
      expect(log.endpoint).toBe("/api/workflow/execute");
      expect(log.method).toBe("POST");
      expect(log.message).toBe("POST /api/workflow/execute");
      expect(requestId).toBeDefined();
    });

    it("returns unique request ID", () => {
      const { logRequest } = useRuntimeLogStore.getState();

      const id1 = logRequest("/api/test", "GET");
      const id2 = logRequest("/api/test", "GET");

      expect(id1).not.toBe(id2);
    });

    it("includes context when provided", () => {
      const { logRequest } = useRuntimeLogStore.getState();

      logRequest("/api/workflow/execute", "POST", {
        tabId: "tab-1",
        workflowId: "workflow-1",
        toolId: "tool-1",
      });

      const log = getLog(0);
      expect(log.tabId).toBe("tab-1");
      expect(log.workflowId).toBe("workflow-1");
      expect(log.toolId).toBe("tool-1");
    });

    it("sets timestamp", () => {
      const beforeTime = new Date().toISOString();
      const { logRequest } = useRuntimeLogStore.getState();

      logRequest("/api/test", "GET");

      const afterTime = new Date().toISOString();
      const log = getLog(0);

      expect(log.timestamp >= beforeTime).toBe(true);
      expect(log.timestamp <= afterTime).toBe(true);
    });
  });

  describe("logResponse", () => {
    it("logs successful response with duration", () => {
      const { logRequest, logResponse } = useRuntimeLogStore.getState();

      mockNow.mockReturnValueOnce(0).mockReturnValueOnce(150);

      const requestId = logRequest("/api/test", "GET");
      logResponse(requestId, 200, 150);

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(2);

      const responseLog = getLog(1);
      expect(responseLog.type).toBe("response");
      expect(responseLog.status).toBe(200);
      expect(responseLog.duration).toBe(150);
      expect(responseLog.message).toContain("200 OK");
      expect(responseLog.message).toContain("150ms");
    });

    it("correlates response with original request context", () => {
      const { logRequest, logResponse } = useRuntimeLogStore.getState();

      const requestId = logRequest("/api/workflow/execute", "POST", {
        tabId: "tab-1",
        workflowId: "wf-1",
      });
      logResponse(requestId, 200, 100);

      const responseLog = getLog(1);
      expect(responseLog.tabId).toBe("tab-1");
      expect(responseLog.workflowId).toBe("wf-1");
      expect(responseLog.endpoint).toBe("/api/workflow/execute");
    });

    it("keeps an in-flight response with the tab that made the request", () => {
      const store = useRuntimeLogStore.getState();
      store.setActiveTab("tab-1");
      const requestId = store.logRequest("/api/workflow/execute", "POST");

      useRuntimeLogStore.getState().setActiveTab("tab-2");
      store.logResponse(requestId, 200, 100);

      const state = useRuntimeLogStore.getState();
      expect(state.logs).toEqual([]);
      expect(state.logsByTabId["tab-1"]).toHaveLength(2);
      expect(state.logsByTabId["tab-1"]?.[1]?.type).toBe("response");
      expect(state.logsByTabId["tab-2"]).toEqual([]);
    });

    it("ignores response for unknown request ID", () => {
      const { logResponse } = useRuntimeLogStore.getState();

      logResponse("unknown-id", 200, 100);

      const state = useRuntimeLogStore.getState();
      // Should not add any log entry
      expect(state.logs.length).toBe(0);
    });
  });

  describe("logError", () => {
    it("logs error response", () => {
      const { logRequest, logError } = useRuntimeLogStore.getState();

      const requestId = logRequest("/api/test", "POST");
      logError(requestId, "Connection refused", 50, 500);

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(2);

      const errorLog = getLog(1);
      expect(errorLog.type).toBe("error");
      expect(errorLog.status).toBe(500);
      expect(errorLog.duration).toBe(50);
      expect(errorLog.message).toContain("ERROR");
      expect(errorLog.message).toContain("Connection refused");
    });

    it("logs error without status code", () => {
      const { logRequest, logError } = useRuntimeLogStore.getState();

      const requestId = logRequest("/api/test", "GET");
      logError(requestId, "Network timeout", 5000);

      const errorLog = getLog(1);
      expect(errorLog.type).toBe("error");
      expect(errorLog.status).toBeUndefined();
    });

    it("ignores error for unknown request ID", () => {
      const { logError } = useRuntimeLogStore.getState();

      logError("unknown-id", "Error", 100);

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(0);
    });
  });

  describe("logCacheHit", () => {
    it("logs cache hit", () => {
      const { logCacheHit } = useRuntimeLogStore.getState();

      logCacheHit("/api/schema");

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(1);

      const log = getLog(0);
      expect(log.type).toBe("cache-hit");
      expect(log.endpoint).toBe("/api/schema");
      expect(log.method).toBe("CACHE");
      expect(log.cached).toBe(true);
      expect(log.message).toContain("CACHE HIT");
    });

    it("includes context when provided", () => {
      const { logCacheHit } = useRuntimeLogStore.getState();

      logCacheHit("/api/schema", { toolId: "tool-1" });

      const log = getLog(0);
      expect(log.toolId).toBe("tool-1");
    });
  });

  describe("logCacheMiss", () => {
    it("logs cache miss", () => {
      const { logCacheMiss } = useRuntimeLogStore.getState();

      logCacheMiss("/api/schema");

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(1);

      const log = getLog(0);
      expect(log.type).toBe("cache-miss");
      expect(log.cached).toBe(false);
      expect(log.message).toContain("CACHE MISS");
    });
  });

  describe("clearLogs", () => {
    it("removes all logs", () => {
      const { logRequest, logCacheHit, clearLogs } = useRuntimeLogStore.getState();

      logRequest("/api/test1", "GET");
      logRequest("/api/test2", "POST");
      logCacheHit("/api/cached");

      expect(useRuntimeLogStore.getState().logs.length).toBe(3);

      clearLogs();

      expect(useRuntimeLogStore.getState().logs).toEqual([]);
    });

    it("clears pending requests", () => {
      const { logRequest, logResponse, clearLogs } = useRuntimeLogStore.getState();

      const requestId = logRequest("/api/test", "GET");
      clearLogs();

      // This should not create a log since pending requests were cleared
      logResponse(requestId, 200, 100);

      expect(useRuntimeLogStore.getState().logs.length).toBe(0);
    });
  });

  describe("MAX_LOGS Limit", () => {
    it("trims logs to MAX_LOGS (1000) entries", () => {
      const { logRequest } = useRuntimeLogStore.getState();

      // Add 1010 logs (more than MAX_LOGS)
      for (let i = 0; i < 1010; i++) {
        logRequest(`/api/test${i}`, "GET");
      }

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(1000);

      // Should have kept the most recent logs (oldest dropped)
      const firstLog = getLog(0);
      const lastLog = getLog(999);
      expect(firstLog.endpoint).toBe("/api/test10");
      expect(lastLog.endpoint).toBe("/api/test1009");
    });

    it("maintains limit when adding different log types", () => {
      const { logRequest, logCacheHit, logCacheMiss } = useRuntimeLogStore.getState();

      // Fill up with various log types
      for (let i = 0; i < 400; i++) {
        logRequest(`/api/request${i}`, "GET");
        logCacheHit(`/api/cache${i}`);
        logCacheMiss(`/api/miss${i}`);
      }

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(1000);
    });
  });

  describe("getRuntimeLogActions", () => {
    it("returns all action functions", () => {
      const actions = getRuntimeLogActions();

      expect(typeof actions.logRequest).toBe("function");
      expect(typeof actions.logResponse).toBe("function");
      expect(typeof actions.logError).toBe("function");
      expect(typeof actions.logCacheHit).toBe("function");
      expect(typeof actions.logCacheMiss).toBe("function");
    });

    it("actions work correctly outside React components", () => {
      const actions = getRuntimeLogActions();

      const requestId = actions.logRequest("/api/test", "POST");
      actions.logResponse(requestId, 200, 50);

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(2);
    });
  });

  describe("Log Types", () => {
    it("supports all defined log types", () => {
      const { logRequest, logResponse, logError, logCacheHit, logCacheMiss } =
        useRuntimeLogStore.getState();

      const requestId = logRequest("/api/test", "GET");
      logResponse(requestId, 200, 100);

      const requestId2 = logRequest("/api/test2", "POST");
      logError(requestId2, "Error", 50);

      logCacheHit("/api/cached");
      logCacheMiss("/api/uncached");

      const state = useRuntimeLogStore.getState();
      const logTypes = state.logs.map((l) => l.type);

      // Verify we have all types represented
      expect(logTypes).toContain("request");
      expect(logTypes).toContain("response");
      expect(logTypes).toContain("error");
      expect(logTypes).toContain("cache-hit");
      expect(logTypes).toContain("cache-miss");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty endpoint", () => {
      const { logRequest } = useRuntimeLogStore.getState();

      logRequest("", "GET");

      const log = getLog(0);
      expect(log.endpoint).toBe("");
      expect(log.message).toBe("GET ");
    });

    it("handles special characters in endpoint", () => {
      const { logRequest } = useRuntimeLogStore.getState();

      logRequest("/api/test?param=value&other=123", "POST");

      const log = getLog(0);
      expect(log.endpoint).toBe("/api/test?param=value&other=123");
    });

    it("handles empty error message", () => {
      const { logRequest, logError } = useRuntimeLogStore.getState();

      const requestId = logRequest("/api/test", "GET");
      logError(requestId, "", 100);

      const errorLog = getLog(1);
      expect(errorLog.message).toContain("ERROR");
    });

    it("handles rapid-fire logging", () => {
      const { logRequest } = useRuntimeLogStore.getState();

      // Simulate rapid requests
      const ids: string[] = [];
      for (let i = 0; i < 100; i++) {
        ids.push(logRequest(`/api/test${i}`, "GET"));
      }

      const state = useRuntimeLogStore.getState();
      expect(state.logs.length).toBe(100);

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });
});
