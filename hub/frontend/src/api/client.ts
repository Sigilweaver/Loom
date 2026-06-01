/**
 * Hub API client
 */

import { getAuthToken } from "@state/authStore";

const API_BASE = "/api/v1";

export interface ApiError {
  detail: string | { loc: (string | number)[]; msg: string; type: string }[];
}

/**
 * Extract error message from API error response
 */
function extractErrorMessage(error: ApiError, fallback: string): string {
  if (Array.isArray(error.detail)) {
    const messages = error.detail.map(
      (e) => `${e.loc.join(".")}: ${e.msg}`
    ).join("; ");
    return messages || fallback;
  }
  return typeof error.detail === "string" ? error.detail : fallback;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const fallback = `HTTP ${response.status}: ${response.statusText}`;
    const error: ApiError = await response.json().catch(() => ({
      detail: fallback,
    }));
    throw new Error(extractErrorMessage(error, fallback));
  }
  return response.json();
}

/**
 * Get headers for authenticated requests
 */
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Get headers for authenticated JSON requests
 */
function getJsonAuthHeaders(): HeadersInit {
  return {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };
}

// =============================================================================
// Auth
// =============================================================================

export interface AuthStatusResponse {
  initialized: boolean;
  registration_open: boolean;
  user_count: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

// Register uses the same response format as login
export type RegisterResponse = LoginResponse;

export interface MeResponse {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role?: string;
}

// Backend returns UserResponse for created user
export interface CreateUserResponse {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

/**
 * Check if any users exist (for first-run detection)
 */
export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const response = await fetch(`${API_BASE}/auth/status`);
  return handleResponse(response);
}

/**
 * Login with username and password
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Register first user (becomes owner) or register with admin auth
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Logout (invalidate session)
 */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

/**
 * Get current user info
 */
export async function getMe(): Promise<MeResponse> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Create a new user (admin/owner only)
 */
export async function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  const response = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
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
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowContent {
  version: string;
  meta: {
    name: string;
    description: string;
    author: string;
    workflowId: string;
    created: string;
  };
  tools: Array<Record<string, unknown>>;
  wires: Array<Record<string, unknown>>;
}

export interface WorkflowListResponse {
  workflows: WorkflowMetadata[];
  total: number;
}

/**
 * List workflows (auto-filtered by ownership for regular users)
 */
export async function listWorkflows(params?: {
  folder?: string;
  tag?: string;
  search?: string;
  uploadedBy?: string;
}): Promise<WorkflowListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.folder) searchParams.set("folder", params.folder);
  if (params?.tag) searchParams.set("tag", params.tag);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.uploadedBy) searchParams.set("uploaded_by", params.uploadedBy);

  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/workflows${query ? `?${query}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getWorkflow(id: string): Promise<WorkflowMetadata> {
  const response = await fetch(`${API_BASE}/workflows/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getWorkflowContent(id: string): Promise<WorkflowContent> {
  const response = await fetch(`${API_BASE}/workflows/${id}/content`, {
    headers: getAuthHeaders(),
  });
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
    headers: getAuthHeaders(),
    body: formData,
  });
  return handleResponse(response);
}

export async function updateWorkflowMetadata(
  id: string,
  data: { folder_path?: string; tags?: string[] }
): Promise<WorkflowMetadata> {
  const response = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "PATCH",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

export function getWorkflowDownloadUrl(id: string): string {
  return `${API_BASE}/workflows/${id}/download`;
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

export interface ServerTestResponse {
  success: boolean;
  status: string;
  version: string | null;
  message: string | null;
}

/**
 * List servers (auto-filtered by group membership for regular users)
 */
export async function listServers(): Promise<ServerListResponse> {
  const response = await fetch(`${API_BASE}/servers`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function registerServer(data: {
  name: string;
  endpoint_url: string;
  auth_token?: string;
}): Promise<ServerResponse> {
  const response = await fetch(`${API_BASE}/servers`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function testServerConnection(data: {
  name: string;
  endpoint_url: string;
  auth_token?: string;
}): Promise<ServerTestResponse> {
  const response = await fetch(`${API_BASE}/servers/test`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function refreshServer(id: string): Promise<ServerResponse> {
  const response = await fetch(`${API_BASE}/servers/${id}/refresh`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function deleteServer(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/servers/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
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

/**
 * List executions (auto-filtered by ownership for regular users)
 */
export async function listExecutions(params?: {
  workflow_id?: string;
  server_id?: string;
  status?: string;
  triggeredBy?: string;
  limit?: number;
  offset?: number;
}): Promise<ExecutionListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.workflow_id) searchParams.set("workflow_id", params.workflow_id);
  if (params?.server_id) searchParams.set("server_id", params.server_id);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.triggeredBy) searchParams.set("triggered_by", params.triggeredBy);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));

  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/executions${query ? `?${query}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function triggerExecution(data: {
  workflow_id: string;
  server_id?: string;
}): Promise<ExecutionResponse> {
  const response = await fetch(`${API_BASE}/executions`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function getExecution(id: string): Promise<ExecutionResponse> {
  const response = await fetch(`${API_BASE}/executions/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function cancelExecution(id: string): Promise<ExecutionResponse> {
  const response = await fetch(`${API_BASE}/executions/${id}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export interface ExecutionStreamHandlers {
  onUpdate: (execution: ExecutionResponse) => void;
  onError?: (error: unknown) => void;
}

function parseSseFrame(
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
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Execution stream failed: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (; ;) {
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

// Audit
export interface AuditEventResponse {
  id: string;
  timestamp: string;
  event_type: string;
  execution_id: string | null;
  workflow_id: string | null;
  schedule_id: string | null;
  actor_type: string;
  actor_id: string | null;
  actor_identity: string;
  auth_method: string | null;
  client_ip: string | null;
  user_agent: string | null;
  server_id: string | null;
  details: Record<string, unknown>;
  event_hash: string;
  previous_hash: string | null;
}

export interface AuditEventListResponse {
  events: AuditEventResponse[];
  total: number;
}

export interface AuditChainVerifyResponse {
  valid: boolean;
  events_checked: number;
  first_event_id: string | null;
  last_event_id: string | null;
  error: string | null;
}

/**
 * List audit events with filtering (auditor role or higher).
 */
export async function listAuditEvents(params?: {
  execution_id?: string;
  workflow_id?: string;
  actor_id?: string;
  event_type?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}): Promise<AuditEventListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.execution_id) searchParams.set("execution_id", params.execution_id);
  if (params?.workflow_id) searchParams.set("workflow_id", params.workflow_id);
  if (params?.actor_id) searchParams.set("actor_id", params.actor_id);
  if (params?.event_type) searchParams.set("event_type", params.event_type);
  if (params?.from_date) searchParams.set("from_date", params.from_date);
  if (params?.to_date) searchParams.set("to_date", params.to_date);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));

  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/audit/events${query ? `?${query}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Verify the integrity of the audit hash chain (auditor role or higher).
 */
export async function verifyAuditChain(limit?: number): Promise<AuditChainVerifyResponse> {
  const searchParams = new URLSearchParams();
  if (limit) searchParams.set("limit", String(limit));
  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/audit/verify${query ? `?${query}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

// Schedules
export interface ScheduleResponse {
  id: string;
  workflow_id: string;
  workflow_name: string | null;
  cron_expression: string;
  timezone: string;
  target_server_id: string | null;
  target_server_name: string | null;
  enabled: boolean;
  description: string | null;
  start_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  last_triggered_at: string | null;
  next_trigger_at: string | null;
}

export interface ScheduleListResponse {
  schedules: ScheduleResponse[];
  total: number;
}

/**
 * List schedules (auto-filtered by ownership for regular users)
 */
export async function listSchedules(params?: {
  workflow_id?: string;
  enabled?: boolean;
  createdBy?: string;
  limit?: number;
  offset?: number;
}): Promise<ScheduleListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.workflow_id) searchParams.set("workflow_id", params.workflow_id);
  if (params?.enabled !== undefined) searchParams.set("enabled", String(params.enabled));
  if (params?.createdBy) searchParams.set("created_by", params.createdBy);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));

  const query = searchParams.toString();
  const response = await fetch(`${API_BASE}/schedules${query ? `?${query}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getSchedule(id: string): Promise<ScheduleResponse> {
  const response = await fetch(`${API_BASE}/schedules/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function createSchedule(data: {
  workflow_id: string;
  cron_expression: string;
  timezone?: string;
  start_at?: string;
  target_server_id?: string;
  enabled?: boolean;
  description?: string;
}): Promise<ScheduleResponse> {
  const response = await fetch(`${API_BASE}/schedules`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateSchedule(
  id: string,
  data: {
    cron_expression?: string;
    timezone?: string;
    start_at?: string | null;
    target_server_id?: string | null;
    enabled?: boolean;
    description?: string | null;
  }
): Promise<ScheduleResponse> {
  const response = await fetch(`${API_BASE}/schedules/${id}`, {
    method: "PUT",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteSchedule(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/schedules/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

export async function toggleSchedule(
  id: string,
  enabled: boolean
): Promise<ScheduleResponse> {
  const response = await fetch(`${API_BASE}/schedules/${id}/toggle?enabled=${enabled}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function triggerSchedule(id: string): Promise<ExecutionResponse> {
  const response = await fetch(`${API_BASE}/schedules/${id}/trigger`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

// =============================================================================
// Connections (Database + Filesystem)
// =============================================================================

// Base connection types
export type ConnectionType = "database" | "filesystem";
export type DatabaseType = "postgresql" | "mysql" | "sqlite" | "mssql";
export type PathType = "local" | "unc";
export type ConnectionStatus = "healthy" | "unhealthy" | "error" | "unknown";

// Type-specific configs (for response)
export interface DatabaseConfigResponse {
  db_type: DatabaseType;
  host: string;
  port: number;
  database: string;
}

export interface FilesystemConfigResponse {
  path: string;
  path_type: PathType;
}

// Connection response (database or filesystem)
export interface ConnectionResponse {
  id: string;
  name: string;
  type: ConnectionType;
  description: string | null;
  read_only: boolean;
  status: ConnectionStatus;
  last_checked: string | null;
  last_healthy: string | null;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Type-specific configs (only one will be present)
  database_config?: DatabaseConfigResponse;
  filesystem_config?: FilesystemConfigResponse;
}

export interface ConnectionsListResponse {
  connections: ConnectionResponse[];
  total: number;
}

export interface HealthCheckResponse {
  status: string;
  last_checked: string | null;
  last_healthy: string | null;
  last_error: string | null;
}

export interface HealthCheckAllResponse {
  checked: number;
  healthy: number;
  unhealthy: number;
  error: number;
}

// Create connection requests (discriminated by type)
export interface CreateDatabaseConnectionRequest {
  type: "database";
  name: string;
  description?: string;
  read_only?: boolean;
  db_type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface CreateFilesystemConnectionRequest {
  type: "filesystem";
  name: string;
  description?: string;
  read_only?: boolean;
  path: string;
  path_type?: PathType;
}

export type CreateConnectionRequest =
  | CreateDatabaseConnectionRequest
  | CreateFilesystemConnectionRequest;

// Update connection requests (all fields optional, type determines which fields apply)
export interface UpdateDatabaseConnectionRequest {
  type?: "database";
  name?: string;
  description?: string;
  read_only?: boolean;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export interface UpdateFilesystemConnectionRequest {
  type?: "filesystem";
  name?: string;
  description?: string;
  read_only?: boolean;
  path?: string;
  path_type?: PathType;
}

export type UpdateConnectionRequest =
  | UpdateDatabaseConnectionRequest
  | UpdateFilesystemConnectionRequest;

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

export async function listConnections(
  type?: ConnectionType
): Promise<ConnectionsListResponse> {
  const params = type ? `?type=${type}` : "";
  const response = await fetch(`${API_BASE}/connections${params}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getConnection(id: string): Promise<ConnectionResponse> {
  const response = await fetch(`${API_BASE}/connections/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function createConnection(
  data: CreateConnectionRequest
): Promise<ConnectionResponse> {
  const response = await fetch(`${API_BASE}/connections`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateConnection(
  id: string,
  data: UpdateConnectionRequest
): Promise<ConnectionResponse> {
  const response = await fetch(`${API_BASE}/connections/${id}`, {
    method: "PUT",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteConnection(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/connections/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

export async function testConnection(
  id: string
): Promise<ConnectionTestResult> {
  const response = await fetch(`${API_BASE}/connections/${id}/test`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function checkConnectionHealth(
  id: string
): Promise<HealthCheckResponse> {
  const response = await fetch(`${API_BASE}/connections/${id}/check`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function checkAllConnectionsHealth(): Promise<HealthCheckAllResponse> {
  const response = await fetch(`${API_BASE}/connections/check-all`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

// Test database connection before creating (only for database type)
export async function testConnectionPreCreate(data: {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): Promise<ConnectionTestResult> {
  const response = await fetch(`${API_BASE}/connections/test`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

// =============================================================================
// Groups (Access Control)
// =============================================================================

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  member_count: number;
  connection_count: number;
  created_by: string;
  created_at: string;
}

export interface GroupListResponse {
  groups: GroupResponse[];
  total: number;
}

export interface GroupMemberResponse {
  user_id: string;
  username: string;
  role: string;
  joined_at: string;
}

export interface GroupMembersResponse {
  group_id: string;
  group_name: string;
  members: GroupMemberResponse[];
  total: number;
}

export async function listGroups(): Promise<GroupListResponse> {
  const response = await fetch(`${API_BASE}/groups`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function createGroup(data: {
  name: string;
  description?: string;
}): Promise<GroupResponse> {
  const response = await fetch(`${API_BASE}/groups`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function getGroup(id: string): Promise<GroupResponse> {
  const response = await fetch(`${API_BASE}/groups/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function updateGroup(
  id: string,
  data: { name?: string; description?: string }
): Promise<GroupResponse> {
  const response = await fetch(`${API_BASE}/groups/${id}`, {
    method: "PATCH",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteGroup(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/groups/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

export async function listGroupMembers(groupId: string): Promise<GroupMembersResponse> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/members`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function addGroupMember(
  groupId: string,
  userId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/users/${userId}/groups/${groupId}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}/groups/${groupId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

// Group -> Grant Group assignments
export interface GroupGrantGroupResponse {
  grant_group_id: string;
  grant_group_name: string;
  connection_count: number;
  assigned_at: string;
}

export interface GroupGrantGroupsResponse {
  group_id: string;
  group_name: string;
  grant_groups: GroupGrantGroupResponse[];
  total: number;
}

export async function listGroupGrantGroups(groupId: string): Promise<GroupGrantGroupsResponse> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/grant-groups`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function assignGrantGroupToGroup(
  groupId: string,
  grantGroupId: string
): Promise<{ status: string; grant_group_id: string; user_group_id: string }> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/grant-groups/${grantGroupId}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function removeGrantGroupFromGroup(groupId: string, grantGroupId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/grant-groups/${grantGroupId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

// =============================================================================
// Grant Groups (Permission Bundles)
// =============================================================================

export interface GrantGroupSummary {
  id: string;
  name: string;
  description: string;
  connection_count: number;
  user_group_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GrantGroupConnection {
  connection_id: string;
  name: string;
  type: string;
  assigned_at: string;
  assigned_by: string;
}

export interface GrantGroupUserGroup {
  user_group_id: string;
  user_group_name: string;
  description: string;
  member_count: number;
  assigned_at: string;
  assigned_by: string;
}

export interface GrantGroupDetail extends GrantGroupSummary {
  connections: GrantGroupConnection[];
  user_groups: GrantGroupUserGroup[];
}

export interface GrantGroupListResponse {
  grant_groups: GrantGroupSummary[];
  total: number;
}

export async function listGrantGroups(): Promise<GrantGroupListResponse> {
  const response = await fetch(`${API_BASE}/grant-groups`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function createGrantGroup(data: {
  name: string;
  description?: string;
}): Promise<GrantGroupSummary> {
  const response = await fetch(`${API_BASE}/grant-groups`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function getGrantGroup(id: string): Promise<GrantGroupDetail> {
  const response = await fetch(`${API_BASE}/grant-groups/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function updateGrantGroup(
  id: string,
  data: { name?: string; description?: string }
): Promise<GrantGroupSummary> {
  const response = await fetch(`${API_BASE}/grant-groups/${id}`, {
    method: "PATCH",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteGrantGroup(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/grant-groups/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

export async function addConnectionToGrantGroup(
  grantGroupId: string,
  connectionId: string
): Promise<{ status: string; connection_id: string; grant_group_id: string }> {
  const response = await fetch(`${API_BASE}/grant-groups/${grantGroupId}/connections/${connectionId}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function removeConnectionFromGrantGroup(
  grantGroupId: string,
  connectionId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/grant-groups/${grantGroupId}/connections/${connectionId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

// =============================================================================
// Users (Admin management)
// =============================================================================

export interface UserListResponse {
  users: UserResponse[];
  total: number;
}

export async function listUsers(): Promise<UserListResponse> {
  const response = await fetch(`${API_BASE}/users`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getUser(userId: string): Promise<UserResponse> {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function updateUser(
  userId: string,
  data: { username?: string; password?: string; role?: string }
): Promise<UserResponse> {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PATCH",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(extractErrorMessage(error, `HTTP ${response.status}`));
  }
}

// =============================================================================
// Profile (Self-service)
// =============================================================================

export interface UpdateProfileRequest {
  current_password: string;
  username?: string;
  new_password?: string;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<UserResponse> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    method: "PATCH",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}
