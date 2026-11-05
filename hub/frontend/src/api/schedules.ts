/** Workflow schedules. */

import type { Schemas } from "./schema";
import { request, requestVoid } from "./http";
import type { ExecutionResponse } from "./executions";

export type ScheduleResponse = Schemas["ScheduleResponse"];

export type ScheduleListResponse = Schemas["ScheduleListResponse"];

/** List schedules (auto-filtered by ownership for regular users). */
export function listSchedules(params?: {
  workflow_id?: string;
  enabled?: boolean;
  createdBy?: string;
  limit?: number;
  offset?: number;
}): Promise<ScheduleListResponse> {
  return request("/schedules", {
    query: {
      workflow_id: params?.workflow_id,
      enabled: params?.enabled,
      created_by: params?.createdBy,
      limit: params?.limit,
      offset: params?.offset,
    },
  });
}

export function getSchedule(id: string): Promise<ScheduleResponse> {
  return request(`/schedules/${id}`);
}

export function createSchedule(data: {
  workflow_id: string;
  cron_expression: string;
  timezone?: string;
  start_at?: string;
  target_server_id?: string;
  enabled?: boolean;
  description?: string;
}): Promise<ScheduleResponse> {
  return request("/schedules", { method: "POST", json: data });
}

export function updateSchedule(
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
  return request(`/schedules/${id}`, { method: "PUT", json: data });
}

export function deleteSchedule(id: string): Promise<void> {
  return requestVoid(`/schedules/${id}`, { method: "DELETE" });
}

export function toggleSchedule(id: string, enabled: boolean): Promise<ScheduleResponse> {
  return request(`/schedules/${id}/toggle`, { method: "POST", query: { enabled } });
}

export function triggerSchedule(id: string): Promise<ExecutionResponse> {
  return request(`/schedules/${id}/trigger`, { method: "POST" });
}
