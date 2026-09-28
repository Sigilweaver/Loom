import { describe, expect, it, vi } from "vitest";
import { buildConnectionUri, secretsFor, type ResolvedRef } from "../src/platform/connectionUri";
import { BACKEND_PORT, hasConnectionRefs, proxyBackendRequest, toBackendUrl } from "./backendProxy";

const CONNECTION = {
  type: "postgresql" as const,
  host: "db.internal",
  port: 5432,
  database: "sales",
  username: "loom",
  password: "p@ss/w0rd!",
};

const resolve = (id: string): ResolvedRef | null =>
  id === "abc-123"
    ? { uri: buildConnectionUri(CONNECTION), secrets: secretsFor(CONNECTION) }
    : null;

function fakeFetch(respond: (url: string, init: RequestInit) => Response) {
  return vi.fn(async (url: string, init: RequestInit) => respond(url, init));
}

describe("toBackendUrl", () => {
  it("maps loopback aliases to the fixed origin", () => {
    const expected = `http://127.0.0.1:${BACKEND_PORT}/api/workflow/execute`;
    expect(toBackendUrl(`http://localhost:${BACKEND_PORT}/api/workflow/execute`)).toBe(expected);
    expect(toBackendUrl(`http://127.0.0.1:${BACKEND_PORT}/api/workflow/execute`)).toBe(expected);
    expect(toBackendUrl(`http://[::1]:${BACKEND_PORT}/api/workflow/execute`)).toBe(expected);
  });

  it("keeps the query string", () => {
    expect(toBackendUrl(`http://localhost:${BACKEND_PORT}/api/x?a=1`)).toContain("?a=1");
  });

  it("refuses other hosts, ports, schemes and paths", () => {
    expect(toBackendUrl("http://evil.example.com:25811/api/x")).toBeNull();
    expect(toBackendUrl("http://localhost:8080/api/x")).toBeNull();
    expect(toBackendUrl("https://localhost:25811/api/x")).toBeNull();
    expect(toBackendUrl("http://localhost:25811/other")).toBeNull();
    expect(toBackendUrl("http://user:pw@localhost:25811/api/x")).toBeNull();
    expect(toBackendUrl("http://localhost:25811.evil.com/api/x")).toBeNull();
    expect(toBackendUrl("not a url")).toBeNull();
  });
});

describe("hasConnectionRefs", () => {
  it("detects references in string bodies only", () => {
    expect(hasConnectionRefs('{"source":"loom-connection://abc"}')).toBe(true);
    expect(hasConnectionRefs('{"source":"x"}')).toBe(false);
    expect(hasConnectionRefs(undefined)).toBe(false);
  });
});

describe("proxyBackendRequest", () => {
  const url = `http://localhost:${BACKEND_PORT}/api/datasource/schema`;

  it("injects credentials server-side and adds the session token", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fetchImpl = fakeFetch((u, init) => {
      seen.url = u;
      seen.init = init;
      return new Response('{"tables":[]}', { status: 200, headers: { "content-type": "application/json" } });
    });

    const res = await proxyBackendRequest(
      {
        url,
        method: "POST",
        headers: { Authorization: "Bearer renderer-token", "Content-Type": "application/json" },
        body: JSON.stringify({ source: "loom-connection://abc-123", sourceType: "postgresql" }),
      },
      { token: "shell-token", resolve, fetchImpl }
    );

    expect(res.status).toBe(200);
    expect(res.body).toBe('{"tables":[]}');
    expect(seen.url).toBe(`http://127.0.0.1:${BACKEND_PORT}/api/datasource/schema`);
    const sent = JSON.parse(seen.init?.body as string);
    expect(sent.source).toBe(buildConnectionUri(CONNECTION));
    expect((seen.init?.headers as Record<string, string>).Authorization).toBe("Bearer shell-token");
  });

  it("redacts credentials that the server echoes back", async () => {
    const uri = buildConnectionUri(CONNECTION);
    const fetchImpl = fakeFetch(
      () =>
        new Response(JSON.stringify({ detail: `could not connect to ${uri}; password p@ss/w0rd! rejected` }), {
          status: 400,
          headers: { "x-debug": uri },
        })
    );
    const res = await proxyBackendRequest(
      { url, method: "POST", body: JSON.stringify({ source: "loom-connection://abc-123" }) },
      { token: "t", resolve, fetchImpl }
    );
    expect(res.status).toBe(400);
    expect(res.body).not.toContain("p@ss/w0rd!");
    expect(res.body).not.toContain(encodeURIComponent("p@ss/w0rd!"));
    expect(res.body).toContain("[redacted]");
    expect(res.headers.find(([k]) => k === "x-debug")?.[1]).toBe("[redacted]");
  });

  it("does not expand references outside the allowed fields", async () => {
    let sentBody = "";
    const fetchImpl = fakeFetch((_u, init) => {
      sentBody = init.body as string;
      return new Response("{}", { status: 200 });
    });
    await proxyBackendRequest(
      {
        url,
        method: "POST",
        body: JSON.stringify({ source: "x", note: "loom-connection://abc-123", config: { path: "loom-connection://abc-123" } }),
      },
      { token: "t", resolve, fetchImpl }
    );
    expect(sentBody).not.toContain("p%40ss");
    expect(sentBody).toContain("loom-connection://abc-123");
  });

  it("refuses to forward anywhere but the bundled server", async () => {
    const fetchImpl = fakeFetch(() => new Response("{}"));
    await expect(
      proxyBackendRequest(
        { url: "http://evil.example.com:25811/api/x", method: "POST", body: "{}" },
        { token: "t", resolve, fetchImpl }
      )
    ).rejects.toThrow(/bundled server/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses unsupported methods and non-string bodies", async () => {
    const fetchImpl = fakeFetch(() => new Response("{}"));
    await expect(
      proxyBackendRequest({ url, method: "TRACE" }, { token: "t", resolve, fetchImpl })
    ).rejects.toThrow(/method/);
    await expect(
      proxyBackendRequest(
        { url, method: "POST", body: { a: 1 } as unknown as string },
        { token: "t", resolve, fetchImpl }
      )
    ).rejects.toThrow(/string/);
  });

  it("drops stale transport headers from the response", async () => {
    const fetchImpl = fakeFetch(
      () => new Response("hello", { status: 200, headers: { "content-length": "5", "x-keep": "1" } })
    );
    const res = await proxyBackendRequest({ url, method: "GET" }, { token: "t", resolve, fetchImpl });
    const names = res.headers.map(([k]) => k);
    expect(names).toContain("x-keep");
    expect(names).not.toContain("content-length");
  });
});
