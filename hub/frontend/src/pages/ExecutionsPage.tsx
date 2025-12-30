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
  listMyExecutions,
  listMyWorkflows,
  listServers,
  cancelExecution,
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
      className: "bg-gray-100 text-gray-700",
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
    api: { className: "bg-gray-100 text-gray-700", label: "API" },
  };

  const c = config[type] ?? { className: "bg-gray-100 text-gray-600", label: type };
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
      const result = await listMyExecutions({
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
    try {
      const [workflowsRes, serversRes] = await Promise.all([
        listMyWorkflows(),
        listServers(),
      ]);
      setWorkflows(workflowsRes.workflows);
      setServers(serversRes.servers);
    } catch (err) {
      console.error("Failed to load filter options:", err);
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

  // Auto-refresh when there are running executions
  useEffect(() => {
    if (!autoRefresh) return;

    const hasRunning = executions.some(
      (e) => e.status === "running" || e.status === "queued"
    );
    if (!hasRunning) return;

    const interval = setInterval(fetchExecutions, 3000);
    return () => clearInterval(interval);
  }, [executions, autoRefresh, fetchExecutions]);

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
        <h1 className="text-2xl font-semibold text-gray-900">Executions</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchExecutions}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Play className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No executions found
          </h3>
          <p className="text-gray-500">
            {selectedWorkflow || selectedServer || selectedStatus
              ? "Try adjusting your filters"
              : "Executions will appear here when you run workflows"}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workflow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Server
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {executions.map((execution) => (
                  <tr key={execution.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {execution.workflow_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
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
                          <span className="text-xs text-gray-500">
                            by {execution.triggered_by}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {execution.started_at
                          ? formatRelativeTime(execution.started_at)
                          : formatRelativeTime(execution.queued_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
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
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Execution Failed
                      </h2>
                      <p className="text-sm text-gray-500">
                        {viewingError.workflow_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingError(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 overflow-auto flex-1">
                  <div className="space-y-4">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Server:</span>{" "}
                        <span className="font-medium">{viewingError.server_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Trigger:</span>{" "}
                        <span className="font-medium">
                          {viewingError.trigger_type}
                          {viewingError.triggered_by && ` by ${viewingError.triggered_by}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Started:</span>{" "}
                        <span className="font-medium">
                          {viewingError.started_at
                            ? new Date(viewingError.started_at).toLocaleString()
                            : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>{" "}
                        <span className="font-medium">
                          {formatDuration(viewingError.duration_seconds)}
                        </span>
                      </div>
                    </div>

                    {/* Error Message */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Error Details</span>
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
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
              <div className="text-sm text-gray-500">
                Showing {page * PAGE_SIZE + 1} -{" "}
                {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
