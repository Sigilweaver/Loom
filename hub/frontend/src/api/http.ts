/**
 * Shared HTTP layer for the Hub API.
 *
 * Every resource module (auth, workflows, servers, ...) goes through
 * `request` / `requestVoid` / `requestText` / `requestBlob` so that:
 *
 * - the bearer token is attached in exactly one place,
 * - failures surface as a typed `ApiError` that keeps the HTTP status and the
 *   server's error detail (instead of collapsing everything to a bare Error),
 * - an expired or revoked session (HTTP 401 on an authenticated request) ends
 *   the local session, which sends the user back to the login page.
 */

import { getAuthToken, expireSession } from "@state/authStore";

export const API_BASE = "/api/v1";

/** Shape of FastAPI error bodies: a string, or a list of validation errors. */
export interface ApiErrorBody {
  detail?:
    | string
    | { loc?: (string | number)[]; msg?: string; type?: string }[]
    | null;
}

/**
 * Error thrown for every failed Hub API call.
 *
 * `message` is human readable and safe to show to users. `status` is the HTTP
 * status (0 when the Hub could not be reached at all). For validation errors
 * (HTTP 422), `fieldErrors` maps a field name to its message so forms can show
 * the problem next to the offending input.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: ApiErrorBody["detail"];
  readonly fieldErrors: Record<string, string>;

  constructor(
    status: number,
    message: string,
    detail: ApiErrorBody["detail"] = null,
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }

  /** The request never reached the Hub (offline, DNS, refused connection). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isValidation(): boolean {
    return this.status === 422;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function fieldNameFromLoc(loc: (string | number)[] | undefined): string | null {
  if (!loc || loc.length === 0) return null;
  // FastAPI prefixes the location with where the value came from.
  const parts =
    typeof loc[0] === "string" && ["body", "query", "path"].includes(loc[0])
      ? loc.slice(1)
      : loc;
  return parts.length > 0 ? parts.join(".") : null;
}

/** Build an `ApiError` from a failed response. Never throws. */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  const fallback = `HTTP ${response.status}: ${response.statusText}`;
  const body: ApiErrorBody | null = await response.json().catch(() => null);
  const detail = body?.detail ?? null;

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    const messages: string[] = [];
    for (const item of detail) {
      const message = item.msg ?? "Invalid value";
      const field = fieldNameFromLoc(item.loc);
      if (field && !(field in fieldErrors)) fieldErrors[field] = message;
      messages.push(field ? `${field}: ${message}` : message);
    }
    return new ApiError(response.status, messages.join("; ") || fallback, detail, fieldErrors);
  }

  return new ApiError(
    response.status,
    typeof detail === "string" && detail ? detail : fallback,
    detail
  );
}

export type QueryValue = string | number | boolean | null | undefined;

/** Serialise query parameters, skipping empty values. Returns "" or "?a=b". */
export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON request body. */
  json?: unknown;
  /** Raw request body (e.g. FormData); the browser sets the content type. */
  body?: BodyInit;
  query?: Record<string, QueryValue>;
  /**
   * Whether this call carries the session token and, on HTTP 401, ends the
   * session. Login and first-run status checks opt out (default: true).
   */
  auth?: boolean;
  signal?: AbortSignal;
}

/** Headers carrying the session token, for callers that use fetch directly. */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", json, body, query, auth = true, signal } = options;

  const headers: Record<string, string> = auth ? authHeaders() : {};
  let requestBody: BodyInit | undefined = body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(json);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: requestBody,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "Unable to reach the Hub server. Check your connection and try again."
    );
  }

  if (!response.ok) {
    if (response.status === 401 && auth) expireSession();
    throw await errorFromResponse(response);
  }
  return response;
}

/** Perform a request and parse the JSON response. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  return response.json();
}

/** Perform a request whose success response has no body worth reading. */
export async function requestVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options);
}

/** Perform a request and return the response body as text. */
export async function requestText(path: string, options: RequestOptions = {}): Promise<string> {
  const response = await send(path, options);
  return response.text();
}

/** Perform a request and return the response body as a Blob (downloads). */
export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options);
  return response.blob();
}
