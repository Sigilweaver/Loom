/** Workflow storage: files, metadata and revision history. */

import { request, requestBlob, requestText, requestVoid } from "./http";

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

export interface WorkflowRevision {
  id: string;
  workflow_id: string;
  revision_number: number;
  parent_revision_id: string | null;
  author: string;
  checksum: string;
  size_bytes: number;
  message: string;
  created_at: string;
}

export interface WorkflowRevisionListResponse {
  revisions: WorkflowRevision[];
  total: number;
}

/** List workflows (auto-filtered by ownership for regular users). */
export function listWorkflows(params?: {
  folder?: string;
  tag?: string;
  search?: string;
  uploadedBy?: string;
}): Promise<WorkflowListResponse> {
  return request("/workflows", {
    query: {
      folder: params?.folder,
      tag: params?.tag,
      search: params?.search,
      uploaded_by: params?.uploadedBy,
    },
  });
}

export function getWorkflow(id: string): Promise<WorkflowMetadata> {
  return request(`/workflows/${id}`);
}

export function getWorkflowContent(id: string): Promise<WorkflowContent> {
  return request(`/workflows/${id}/content`);
}

export function uploadWorkflow(
  file: File,
  folderPath?: string,
  tags?: string[],
  message?: string
): Promise<{ id: string; name: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (folderPath) formData.append("folder_path", folderPath);
  if (tags?.length) formData.append("tags", tags.join(","));
  if (message) formData.append("message", message);
  return request("/workflows", { method: "POST", body: formData });
}

/** Replace a workflow's file; the previous content stays in its history. */
export function replaceWorkflowFile(
  id: string,
  file: File,
  message?: string
): Promise<WorkflowMetadata> {
  const formData = new FormData();
  formData.append("file", file);
  if (message) formData.append("message", message);
  return request(`/workflows/${id}`, { method: "PUT", body: formData });
}

export function updateWorkflowMetadata(
  id: string,
  data: { folder_path?: string; tags?: string[] }
): Promise<WorkflowMetadata> {
  return request(`/workflows/${id}`, { method: "PATCH", json: data });
}

export function deleteWorkflow(id: string): Promise<void> {
  return requestVoid(`/workflows/${id}`, { method: "DELETE" });
}

/** Download the current .swwf file. */
export function downloadWorkflow(id: string): Promise<Blob> {
  return requestBlob(`/workflows/${id}/download`);
}

/** Revision history, newest first. */
export function listWorkflowRevisions(id: string): Promise<WorkflowRevisionListResponse> {
  return request(`/workflows/${id}/revisions`);
}

/** Download the .swwf file of one revision. */
export function downloadWorkflowRevision(id: string, revisionId: string): Promise<Blob> {
  return requestBlob(`/workflows/${id}/revisions/${revisionId}/download`);
}

/** Unified text diff between two revisions of a workflow. */
export function getWorkflowDiff(
  id: string,
  fromRevisionId: string,
  toRevisionId: string
): Promise<string> {
  return requestText(`/workflows/${id}/diff`, {
    query: { from: fromRevisionId, to: toRevisionId },
  });
}

/**
 * Roll back to a prior revision. Non-destructive: the revision's content
 * becomes current and a new revision recording the rollback is appended.
 */
export function rollbackWorkflow(
  id: string,
  revisionId: string,
  message?: string
): Promise<WorkflowMetadata> {
  return request(`/workflows/${id}/revisions/${revisionId}/rollback`, {
    method: "POST",
    json: message ? { message } : {},
  });
}
