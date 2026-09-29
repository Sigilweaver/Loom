import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError, buildQuery, isApiError, request, requestBlob, requestVoid } from "./http";

const { expireSession, getAuthToken } = vi.hoisted(() => ({
  expireSession: vi.fn(),
  getAuthToken: vi.fn<() => string | null>(() => "test-token"),
}));

vi.mock("@state/authStore", () => ({ expireSession, getAuthToken }));

function respond(body: unknown, status = 200, statusText = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
      return body;
    },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    blob: async () => new Blob([JSON.stringify(body)]),
  };
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("expected the request to fail");
}

function stubFetch(response: ReturnType<typeof respond>) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("http layer", () => {
  beforeEach(() => {
    expireSession.mockClear();
    getAuthToken.mockReturnValue("test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("request", () => {
    it("sends the bearer token and parses the JSON response", async () => {
      const fetchMock = stubFetch(respond({ ok: true }));

      const result = await request<{ ok: boolean }>("/things");

      expect(result).toEqual({ ok: true });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/api/v1/things");
      expect(init.method).toBe("GET");
      expect(init.headers.Authorization).toBe("Bearer test-token");
    });

    it("omits the token when signed out or when auth is disabled", async () => {
      const fetchMock = stubFetch(respond({}));

      await request("/public", { auth: false });
      getAuthToken.mockReturnValue(null);
      await request("/things");

      expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBeUndefined();
      expect(fetchMock.mock.calls[1]![1].headers.Authorization).toBeUndefined();
    });

    it("serialises JSON bodies with a content type", async () => {
      const fetchMock = stubFetch(respond({}));

      await request("/things", { method: "POST", json: { name: "a" } });

      const [, init] = fetchMock.mock.calls[0]!;
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(init.body).toBe(JSON.stringify({ name: "a" }));
    });

    it("leaves the content type to the browser for FormData bodies", async () => {
      const fetchMock = stubFetch(respond({}));
      const form = new FormData();
      form.append("file", "x");

      await request("/things", { method: "POST", body: form });

      const [, init] = fetchMock.mock.calls[0]!;
      expect(init.headers["Content-Type"]).toBeUndefined();
      expect(init.body).toBe(form);
    });
  });

  describe("errors", () => {
    it("keeps the HTTP status and string detail on the thrown ApiError", async () => {
      stubFetch(respond({ detail: "Workflow not found" }, 404, "Not Found"));

      const error = await failure(request("/workflows/x"));

      expect(isApiError(error)).toBe(true);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.message).toBe("Workflow not found");
      expect(error.detail).toBe("Workflow not found");
      expect(error.isNotFound).toBe(true);
    });

    it("flags forbidden and conflict responses", async () => {
      stubFetch(respond({ detail: "Nope" }, 403, "Forbidden"));
      const forbidden = await failure(request("/x"));
      expect(forbidden.isForbidden).toBe(true);
      expect(expireSession).not.toHaveBeenCalled();

      stubFetch(respond({ detail: "Name already exists" }, 409, "Conflict"));
      const conflict = await failure(request("/x"));
      expect(conflict.isConflict).toBe(true);
      expect(conflict.message).toBe("Name already exists");
    });

    it("maps 422 validation details to per-field errors", async () => {
      stubFetch(
        respond(
          {
            detail: [
              { loc: ["body", "username"], msg: "String should have at least 3 characters", type: "x" },
              { loc: ["body", "password"], msg: "Field required", type: "y" },
            ],
          },
          422,
          "Unprocessable Entity"
        )
      );

      const error = await failure(request("/users", { method: "POST", json: {} }));

      expect(error.isValidation).toBe(true);
      expect(error.fieldErrors).toEqual({
        username: "String should have at least 3 characters",
        password: "Field required",
      });
      expect(error.message).toBe(
        "username: String should have at least 3 characters; password: Field required"
      );
    });

    it("falls back to the status line when the body is not JSON", async () => {
      stubFetch(respond(undefined, 502, "Bad Gateway"));

      const error = await failure(request("/x"));

      expect(error.status).toBe(502);
      expect(error.message).toBe("HTTP 502: Bad Gateway");
    });

    it("reports an unreachable Hub as a status 0 network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      const error = await failure(request("/x"));

      expect(error.isNetworkError).toBe(true);
      expect(error.status).toBe(0);
      expect(error.message).toMatch(/unable to reach the hub/i);
    });

    it("lets aborted requests propagate as aborts", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"))
      );

      const error = await failure(request("/x"));

      expect(error).toBeInstanceOf(DOMException);
      expect(isApiError(error)).toBe(false);
    });
  });

  describe("session expiry", () => {
    it("ends the session on a 401 from an authenticated request", async () => {
      stubFetch(respond({ detail: "Not authenticated" }, 401, "Unauthorized"));

      const error = await failure(request("/workflows"));

      expect(error.isUnauthorized).toBe(true);
      expect(expireSession).toHaveBeenCalledTimes(1);
    });

    it("does not end the session when login itself is rejected", async () => {
      stubFetch(respond({ detail: "Invalid credentials" }, 401, "Unauthorized"));

      const error = await failure(request("/auth/login", {
        method: "POST",
        json: {},
        auth: false,
      }));

      expect(error.message).toBe("Invalid credentials");
      expect(expireSession).not.toHaveBeenCalled();
    });
  });

  describe("other response types", () => {
    it("requestVoid resolves for empty success responses", async () => {
      stubFetch(respond(undefined, 204, "No Content"));
      await expect(requestVoid("/things/1", { method: "DELETE" })).resolves.toBeUndefined();
    });

    it("requestVoid still throws typed errors", async () => {
      stubFetch(respond({ detail: "In use" }, 409, "Conflict"));
      await expect(requestVoid("/things/1", { method: "DELETE" })).rejects.toMatchObject({
        status: 409,
        message: "In use",
      });
    });

    it("requestBlob returns the response body", async () => {
      stubFetch(respond({ a: 1 }));
      const blob = await requestBlob("/download");
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe("buildQuery", () => {
    it("returns an empty string with no usable params", () => {
      expect(buildQuery()).toBe("");
      expect(buildQuery({ a: undefined, b: null, c: "" })).toBe("");
    });

    it("keeps false and zero values but drops empties", () => {
      expect(buildQuery({ enabled: false, page: 0, q: "", tag: "a b" })).toBe(
        "?enabled=false&page=0&tag=a+b"
      );
    });
  });
});
