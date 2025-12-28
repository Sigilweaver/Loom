/**
 * Hub API client
 */

import { getAuthToken } from "@state/authStore";

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
    throw new Error(error.detail);
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
  const response = await fetch(`${API_BASE}/auth/users`, {
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

export interface ServerTestResponse {
  success: boolean;
  status: string;
  version: string | null;
  message: string | null;
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

export async function testServerConnection(data: {
  name: string;
  endpoint_url: string;
  auth_token?: string;
}): Promise<ServerTestResponse> {
  const response = await fetch(`${API_BASE}/servers/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function refreshServer(id: string): Promise<ServerResponse> {
  const response = await fetch(`${API_BASE}/servers/${id}/refresh`, {
    method: "POST",
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

// =============================================================================
// Connections (Database Connections)
// =============================================================================

export type DatabaseType = "postgresql" | "mysql" | "sqlite" | "mssql";

export interface ConnectionResponse {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectionsListResponse {
  connections: ConnectionResponse[];
  total: number;
}

export interface CreateConnectionRequest {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface UpdateConnectionRequest {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

export async function listConnections(): Promise<ConnectionsListResponse> {
  const response = await fetch(`${API_BASE}/connections`, {
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
    throw new Error(error.detail);
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

export interface GroupConnectionResponse {
  connection_id: string;
  name: string;
  type: string;
  assigned_at: string;
}

export interface GroupConnectionsResponse {
  group_id: string;
  group_name: string;
  connections: GroupConnectionResponse[];
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
    throw new Error(error.detail);
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
): Promise<{ status: string; user_id: string; group_id: string }> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/members`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  return handleResponse(response);
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/members/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(error.detail);
  }
}

export async function listGroupConnections(groupId: string): Promise<GroupConnectionsResponse> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/connections`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function addGroupConnection(
  groupId: string,
  connectionId: string
): Promise<{ status: string; connection_id: string; group_id: string }> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/connections`, {
    method: "POST",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify({ connection_id: connectionId }),
  });
  return handleResponse(response);
}

export async function removeGroupConnection(groupId: string, connectionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/groups/${groupId}/connections/${connectionId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(error.detail);
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
  const response = await fetch(`${API_BASE}/auth/users`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getUser(userId: string): Promise<UserResponse> {
  const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function updateUser(
  userId: string,
  data: { username?: string; password?: string; role?: string }
): Promise<UserResponse> {
  const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
    method: "PATCH",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}`,
    }));
    throw new Error(error.detail);
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
