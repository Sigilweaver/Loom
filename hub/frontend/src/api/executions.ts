/** Workflow executions, including the live event stream. */

import { API_BASE, authHeaders, errorFromResponse, request } from "./http";
import { expireSession } from "@state/authStore";

export interface ExecutionResponse {
  id: string;
  workflow_id: string;
  workflow_name: string;
  server_id: string;
  server_name: string;
  trigger_type: string;
  triggered_by: string | null;
  status: string;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  success: boolean | null;
  error_message: string | null;
  duration_seconds: number | null;
}

export interface ExecutionListResponse {
  executions: ExecutionResponse[];
  total: number;
}

/** List executions (auto-filtered by ownership for regular users). */
export function listExecutions(params?: {
  workflow_id?: string;
  server_id?: string;
  status?: string;
  triggeredBy?: string;
  limit?: number;
  offset?: number;
}): Promise<ExecutionListResponse> {
  return request("/executions", {
    query: {
      workflow_id: params?.workflow_id,
      server_id: params?.server_id,
      status: params?.status,
      triggered_by: params?.triggeredBy,
      limit: params?.limit,
      offset: params?.offset,
    },
  });
}

export function triggerExecution(data: {
  workflow_id: string;
  server_id?: string;
}): Promise<ExecutionResponse> {
  return request("/executions", { method: "POST", json: data });
}

export function getExecution(id: string): Promise<ExecutionResponse> {
  return request(`/executions/${id}`);
}

export function cancelExecution(id: string): Promise<ExecutionResponse> {
  return request(`/executions/${id}/cancel`, { method: "POST" });
}

export interface ExecutionStreamHandlers {
  onUpdate: (execution: ExecutionResponse) => void;
  onError?: (error: unknown) => void;
}

export function parseSseFrame(
  frame: string
): { event: string | null; data: string } | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // heartbeat / comment
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * Subscribe to the live execution event stream (Server-Sent Events).
 *
 * Uses fetch + ReadableStream rather than the browser EventSource API because
 * the Hub authenticates via a Bearer header, which EventSource cannot set.
 * Returns a function that cancels the subscription.
 */
export function streamExecutions(handlers: ExecutionStreamHandlers): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch(`${API_BASE}/executions/stream`, {
        headers: authHeaders(),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        if (response.status === 401) expireSession();
        throw response.ok
          ? new Error("Execution stream returned no body")
          : await errorFromResponse(response);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const parsed = parseSseFrame(frame);
          if (parsed?.event === "update" && parsed.data) {
            try {
              handlers.onUpdate(JSON.parse(parsed.data) as ExecutionResponse);
            } catch {
              // Ignore malformed frames.
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        handlers.onError?.(error);
      }
    }
  })();

  return () => controller.abort();
}
