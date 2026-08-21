/**
 * Executions page for Hub
 *
 * Lists workflow execution history with filtering and status tracking.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  StopCircle,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import {
  listExecutions,
  listWorkflows,
  listServers,
  cancelExecution,
  streamExecutions,
  type ExecutionResponse,
  type WorkflowMetadata,
  type ServerResponse,
} from "@api/client";

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

type ExecutionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    ExecutionStatus,
    { icon: typeof Clock; className: string; label: string }
  > = {
    queued: {
      icon: Clock,
      className: "bg-surface-hover text-ink-muted",
      label: "Queued",
    },
    running: {
      icon: Loader2,
      className: "bg-blue-100 text-blue-700",
      label: "Running",
    },
    completed: {
      icon: CheckCircle2,
      className: "bg-green-100 text-green-700",
      label: "Completed",
    },
    failed: {
      icon: XCircle,
      className: "bg-red-100 text-red-700",
      label: "Failed",
    },
    cancelled: {
      icon: StopCircle,
      className: "bg-yellow-100 text-yellow-700",
      label: "Cancelled",
    },
  };

  const config = statusConfig[status as ExecutionStatus] || statusConfig.queued;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${config.className}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
}

function TriggerTypeBadge({ type }: { type: string }) {
  const config: Record<string, { className: string; label: string }> = {
    manual: { className: "bg-purple-100 text-purple-700", label: "Manual" },
    scheduled: { className: "bg-blue-100 text-blue-700", label: "Scheduled" },
    api: { className: "bg-surface-hover text-ink-muted", label: "API" },
  };

  const c = config[type] ?? { className: "bg-surface-hover text-ink-muted", label: type };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}

const PAGE_SIZE = 20;

export function ExecutionsPage() {
  const [executions, setExecutions] = useState<ExecutionResponse[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [page, setPage] = useState(0);

  // Auto-refresh for running executions
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Error modal state
  const [viewingError, setViewingError] = useState<ExecutionResponse | null>(null);

  const fetchExecutions = useCallback(async () => {
    try {
      const result = await listExecutions({
        workflow_id: selectedWorkflow || undefined,
        server_id: selectedServer || undefined,
        status: selectedStatus || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setExecutions(result.executions);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load executions");
    }
  }, [selectedWorkflow, selectedServer, selectedStatus, page]);

  const fetchFilters = useCallback(async () => {
    // Fetch workflows and servers independently
    try {
      const workflowsRes = await listWorkflows();
      setWorkflows(workflowsRes.workflows);
    } catch (err) {
      console.error("Failed to load workflows:", err);
    }

    try {
      const serversRes = await listServers();
      setServers(serversRes.servers);
    } catch {
      // Users with no group assignments will have no servers - that's OK
      console.debug("No servers available for user");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchExecutions(), fetchFilters()]);
      setLoading(false);
    };
    load();
  }, [fetchExecutions, fetchFilters]);

  // Live updates via Server-Sent Events (replaces polling). Updates matching
  // rows in place for instant feedback and reconciles the list on changes so
  // filters, ordering, and new executions stay correct.
  useEffect(() => {
    if (!autoRefresh) return;

    let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReconcile = () => {
      if (reconcileTimer) return;
      reconcileTimer = setTimeout(() => {
        reconcileTimer = null;
        fetchExecutions();
      }, 400);
    };

    const unsubscribe = streamExecutions({
      onUpdate: (execution) => {
        setExecutions((prev) => {
          const idx = prev.findIndex((e) => e.id === execution.id);
          if (idx === -1) {
            // Not currently shown; reconcile to apply filters/pagination.
            scheduleReconcile();
            return prev;
          }
          const next = [...prev];
          next[idx] = execution;
          return next;
        });
        // Status transitions can affect filtered views and ordering.
        scheduleReconcile();
      },
      onError: () => {
        // Fall back to a refresh so the list does not go stale on disconnect.
        scheduleReconcile();
      },
    });

    return () => {
      unsubscribe();
      if (reconcileTimer) clearTimeout(reconcileTimer);
    };
  }, [autoRefresh, fetchExecutions]);

  const handleCancel = async (execution: ExecutionResponse) => {
    try {
      await cancelExecution(execution.id);
      await fetchExecutions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel execution");
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && executions.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-ink">Executions</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-line-strong text-brand-600 focus:ring-brand-500"
            />
            Live updates
          </label>
          <button
            onClick={fetchExecutions}
            className="flex items-center gap-2 px-3 py-2 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={selectedWorkflow}
          onChange={(e) => {
            setSelectedWorkflow(e.target.value);
            setPage(0);
          }}
          className="px-4 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="">All workflows</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          value={selectedServer}
          onChange={(e) => {
            setSelectedServer(e.target.value);
            setPage(0);
          }}
          className="px-4 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="">All servers</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(0);
          }}
          className="px-4 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {executions.length === 0 ? (
        <div className="bg-surface-raised rounded-lg border border-line p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-surface-hover rounded-full flex items-center justify-center mb-4">
            <Play className="h-8 w-8 text-ink-faint" />
          </div>
          <h3 className="text-lg font-medium text-ink mb-2">
            No executions found
          </h3>
          <p className="text-ink-subtle">
            {selectedWorkflow || selectedServer || selectedStatus
              ? "Try adjusting your filters"
              : "Executions will appear here when you run workflows"}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-surface-raised rounded-lg border border-line overflow-hidden">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-surface-sunken">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Workflow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Server
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface-raised divide-y divide-line">
                {executions.map((execution) => (
                  <tr key={execution.id} className="hover:bg-surface-sunken">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-ink">
                        {execution.workflow_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-ink-muted">
                        {execution.server_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={execution.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <TriggerTypeBadge type={execution.trigger_type} />
                        {execution.triggered_by && (
                          <span className="text-xs text-ink-subtle">
                            by {execution.triggered_by}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-ink-muted">
                        {execution.started_at
                          ? formatRelativeTime(execution.started_at)
                          : formatRelativeTime(execution.queued_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-ink-muted">
                        {formatDuration(execution.duration_seconds)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {(execution.status === "running" ||
                        execution.status === "queued") && (
                          <button
                            onClick={() => handleCancel(execution)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      {execution.status === "failed" && execution.error_message && (
                        <button
                          onClick={() => setViewingError(execution)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          View error
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error Modal */}
          {viewingError && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-surface-raised rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-ink">
                        Execution Failed
                      </h2>
                      <p className="text-sm text-ink-subtle">
                        {viewingError.workflow_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingError(null)}
                    className="p-2 text-ink-faint hover:text-ink-muted rounded-lg hover:bg-surface-hover"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 overflow-auto flex-1">
                  <div className="space-y-4">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-ink-subtle">Server:</span>{" "}
                        <span className="font-medium">{viewingError.server_name}</span>
                      </div>
                      <div>
                        <span className="text-ink-subtle">Trigger:</span>{" "}
                        <span className="font-medium">
                          {viewingError.trigger_type}
                          {viewingError.triggered_by && ` by ${viewingError.triggered_by}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-subtle">Started:</span>{" "}
                        <span className="font-medium">
                          {viewingError.started_at
                            ? new Date(viewingError.started_at).toLocaleString()
                            : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-subtle">Duration:</span>{" "}
                        <span className="font-medium">
                          {formatDuration(viewingError.duration_seconds)}
                        </span>
                      </div>
                    </div>

                    {/* Error Message */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-ink-faint" />
                        <span className="text-sm font-medium text-ink-muted">Error Details</span>
                      </div>
                      <pre className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 whitespace-pre-wrap overflow-auto max-h-[300px] font-mono">
                        {viewingError.error_message}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 border-t">
                  <button
                    onClick={() => {
                      if (viewingError.error_message) {
                        navigator.clipboard.writeText(viewingError.error_message);
                      }
                    }}
                    className="px-4 py-2 text-ink-muted hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    Copy Error
                  </button>
                  <button
                    onClick={() => setViewingError(null)}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-ink-subtle">
                Showing {page * PAGE_SIZE + 1} -{" "}
                {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-ink-muted">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
