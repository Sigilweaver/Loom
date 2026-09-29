/**
 * Credential-injecting proxy to the bundled server.
 *
 * When the shell itself launched the server (Full build), client-owned
 * database credentials never enter the renderer. The renderer sends request
 * bodies containing `loom-connection://<id>` references; this module swaps
 * them for real connection URIs, adds the session token, forwards the request
 * to the loopback server, and redacts any credential that comes back.
 *
 * The forwarding target is fixed (`127.0.0.1:<BACKEND_PORT>`), never taken
 * from renderer-writable settings, so a compromised page cannot redirect
 * credentials to a host of its choosing.
 */

import {
  CONNECTION_REF_PREFIX,
  redactSecrets,
  substituteConnectionRefs,
  type ResolvedRef,
} from "../src/platform/connectionUri";

export const BACKEND_PORT = 25811;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const MAX_BODY_BYTES = 64 * 1024 * 1024;

export interface ProxyRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
}

export interface ProxyDeps {
  /** Session token for the bundled server. */
  token: string;
  /** Resolve a stored connection id to its URI and secrets. */
  resolve: (id: string) => ResolvedRef | null;
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Validate a renderer-supplied URL and map it onto the fixed loopback origin.
 * Returns null unless it targets the bundled server's `/api/` on its port.
 */
export function toBackendUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:") return null;
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return null;
  if (parsed.port !== String(BACKEND_PORT)) return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.pathname.startsWith("/api/")) return null;
  return `http://127.0.0.1:${BACKEND_PORT}${parsed.pathname}${parsed.search}`;
}

/** Whether a body carries any connection reference worth proxying. */
export function hasConnectionRefs(body: string | undefined): boolean {
  return typeof body === "string" && body.includes(CONNECTION_REF_PREFIX);
}

export async function proxyBackendRequest(
  request: ProxyRequest,
  deps: ProxyDeps
): Promise<ProxyResponse> {
  const target = toBackendUrl(request.url);
  if (!target) {
    throw new Error("Credential proxy only forwards to the bundled server");
  }
  const method = (request.method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Unsupported method: ${method}`);
  }
  if (request.body !== undefined && typeof request.body !== "string") {
    throw new Error("Request body must be a string");
  }
  if (request.body && Buffer.byteLength(request.body, "utf8") > MAX_BODY_BYTES) {
    throw new Error("Request body is too large");
  }

  const substituted = request.body
    ? substituteConnectionRefs(request.body, deps.resolve)
    : { body: undefined, secrets: [] as string[], replaced: 0 };

  // Only content negotiation headers pass through; auth is always ours.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${deps.token}`,
  };
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    const lower = name.toLowerCase();
    if (lower === "accept" || lower === "content-type") {
      headers[lower === "accept" ? "Accept" : "Content-Type"] = value;
    }
  }

  const doFetch = deps.fetchImpl ?? ((url, init) => fetch(url, init));
  const response = await doFetch(target, {
    method,
    headers,
    ...(substituted.body !== undefined && method !== "GET"
      ? { body: substituted.body }
      : {}),
  });

  const text = await response.text();
  const responseHeaders: Array<[string, string]> = [];
  response.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    // The body is re-materialised as text, so transport headers are stale.
    if (lower === "content-length" || lower === "content-encoding" || lower === "transfer-encoding") {
      return;
    }
    responseHeaders.push([name, redactSecrets(value, substituted.secrets)]);
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: redactSecrets(text, substituted.secrets),
  };
}
