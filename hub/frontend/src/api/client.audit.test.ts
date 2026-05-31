import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listAuditEvents, verifyAuditChain } from "./client";

vi.mock("@state/authStore", () => ({
  getAuthToken: () => "test-token",
}));

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("audit API client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listAuditEvents", () => {
    it("requests the events endpoint with no query string when no params given", async () => {
      const fetchMock = mockFetchOnce({ events: [], total: 0 });

      const result = await listAuditEvents();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v1/audit/events");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer test-token"
      );
      expect(result).toEqual({ events: [], total: 0 });
    });

    it("serializes filters and pagination into the query string", async () => {
      const fetchMock = mockFetchOnce({ events: [], total: 0 });

      await listAuditEvents({
        event_type: "execution.requested",
        from_date: "2024-01-01T00:00:00.000Z",
        to_date: "2024-01-02T00:00:00.000Z",
        page: 2,
        page_size: 25,
      });

      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url, "http://localhost");
      expect(parsed.pathname).toBe("/api/v1/audit/events");
      expect(parsed.searchParams.get("event_type")).toBe("execution.requested");
      expect(parsed.searchParams.get("from_date")).toBe("2024-01-01T00:00:00.000Z");
      expect(parsed.searchParams.get("to_date")).toBe("2024-01-02T00:00:00.000Z");
      expect(parsed.searchParams.get("page")).toBe("2");
      expect(parsed.searchParams.get("page_size")).toBe("25");
    });

    it("throws with the API error detail on non-ok responses", async () => {
      mockFetchOnce({ detail: "forbidden" }, false, 403);

      await expect(listAuditEvents()).rejects.toThrow("forbidden");
    });
  });

  describe("verifyAuditChain", () => {
    it("calls the verify endpoint without a limit by default", async () => {
      const fetchMock = mockFetchOnce({
        valid: true,
        events_checked: 3,
        first_event_id: "a",
        last_event_id: "c",
        error: null,
      });

      const result = await verifyAuditChain();

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v1/audit/verify");
      expect(result.valid).toBe(true);
      expect(result.events_checked).toBe(3);
    });

    it("includes the limit query parameter when provided", async () => {
      const fetchMock = mockFetchOnce({
        valid: false,
        events_checked: 10,
        first_event_id: null,
        last_event_id: null,
        error: "chain broken at event 5",
      });

      const result = await verifyAuditChain(500);

      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url, "http://localhost");
      expect(parsed.pathname).toBe("/api/v1/audit/verify");
      expect(parsed.searchParams.get("limit")).toBe("500");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("chain broken at event 5");
    });
  });
});
