/** Audit log (auditor role or higher). */

import type { Schemas } from "./schema";
import { request } from "./http";

export type AuditEventResponse = Schemas["AuditEventResponse"];

export type AuditEventListResponse = Schemas["AuditEventListResponse"];

export type AuditChainVerifyResponse = Schemas["AuditChainVerifyResponse"];

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
