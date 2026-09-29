/** Audit log (auditor role or higher). */

import { request } from "./http";

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

/** List audit events with filtering. */
export function listAuditEvents(params?: {
  execution_id?: string;
  workflow_id?: string;
  actor_id?: string;
  event_type?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}): Promise<AuditEventListResponse> {
  return request("/audit/events", { query: params });
}

/** Verify the integrity of the audit hash chain. */
export function verifyAuditChain(limit?: number): Promise<AuditChainVerifyResponse> {
  return request("/audit/verify", { query: { limit } });
}
