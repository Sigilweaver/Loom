/**
 * Hub API client
 */

const API_BASE = "/api";

export interface ApiError {
  detail: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.detail);
  }
  return response.json();
}

// Health
export async function getHealth(): Promise<{ status: string; version: string }> {
  const response = await fetch(`${API_BASE}/health`);
  return handleResponse(response);
}

// Workflows
export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  workflow_id: string;
  folder_path: string;
  tags: string[];
  checksum: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowMetadata[];
  total: number;
}

export async function listWorkflows(params?: {
  folder?: string;
  tag?: string;
  search?: string;
}): Promise<WorkflowListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.folder) searchParams.set("folder", params.folder);
  if (params?.tag) searchParams.set("tag", params.tag);
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/workflows${query ? `?${query}` : ""}`);
  return handleResponse(response);
}

export async function uploadWorkflow(
  file: File,
  folderPath?: string,
  tags?: string[]
): Promise<{ id: string; name: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (folderPath) formData.append("folder_path", folderPath);
  if (tags?.length) formData.append("tags", tags.join(","));

  const response = await fetch(`${API_BASE}/workflows`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(response);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(error.detail);
  }
}

// Servers
export interface ServerResponse {
  id: string;
  name: string;
  endpoint_url: string;
  status: string;
  version: string | null;
  last_poll: string | null;
  last_healthy: string | null;
  created_at: string;
}

export interface ServerListResponse {
  servers: ServerResponse[];
  total: number;
}

export async function listServers(): Promise<ServerListResponse> {
  const response = await fetch(`${API_BASE}/servers`);
  return handleResponse(response);
}

export async function registerServer(data: {
  name: string;
  endpoint_url: string;
  auth_token?: string;
}): Promise<ServerResponse> {
  const response = await fetch(`${API_BASE}/servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteServer(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/servers/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(error.detail);
  }
}

// Executions
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

export async function listExecutions(params?: {
  workflow_id?: string;
  server_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ExecutionListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.workflow_id) searchParams.set("workflow_id", params.workflow_id);
  if (params?.server_id) searchParams.set("server_id", params.server_id);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));

  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/executions${query ? `?${query}` : ""}`);
  return handleResponse(response);
}

export async function triggerExecution(data: {
  workflow_id: string;
  server_id?: string;
}): Promise<ExecutionResponse> {
  const response = await fetch(`${API_BASE}/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

// Schedules
export interface ScheduleResponse {
  id: string;
  workflow_id: string;
  workflow_name: string;
  cron_expression: string;
  timezone: string;
  target_server_id: string | null;
  target_server_name: string | null;
  timeout_seconds: number;
  enabled: boolean;
  created_by: string;
  created_at: string;
  last_triggered_at: string | null;
  next_trigger_at: string | null;
}

export interface ScheduleListResponse {
  schedules: ScheduleResponse[];
  total: number;
}

export async function listSchedules(params?: {
  workflow_id?: string;
  enabled?: boolean;
}): Promise<ScheduleListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.workflow_id) searchParams.set("workflow_id", params.workflow_id);
  if (params?.enabled !== undefined) searchParams.set("enabled", String(params.enabled));

  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/schedules${query ? `?${query}` : ""}`);
  return handleResponse(response);
}

export async function createSchedule(data: {
  workflow_id: string;
  cron_expression: string;
  timezone?: string;
  target_server_id?: string;
  timeout_seconds?: number;
  enabled?: boolean;
}): Promise<ScheduleResponse> {
  const response = await fetch(`${API_BASE}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteSchedule(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/schedules/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(error.detail);
  }
}
