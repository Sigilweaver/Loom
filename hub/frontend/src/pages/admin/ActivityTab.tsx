/**
 * Activity tab for admin panel
 *
 * Shows all workflows, schedules, and executions across all users
 * with filtering by owner.
 */

import { useState, useEffect, useCallback } from "react";
import {
  FileCode2,
  Calendar,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  listWorkflows,
  listSchedules,
  listExecutions,
  listUsers,
  type WorkflowMetadata,
  type ScheduleResponse,
  type ExecutionResponse,
} from "@api/client";

const PAGE_SIZE = 10;

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

type ActivityView = "workflows" | "schedules" | "executions";

interface UserOption {
  username: string;
  role: string;
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const defaultConfig = { icon: Clock, className: "text-gray-500", bg: "bg-gray-100" };
  const config: Record<string, { icon: typeof Clock; className: string; bg: string }> = {
    queued: defaultConfig,
    running: { icon: Loader2, className: "text-blue-500", bg: "bg-blue-100" },
    completed: { icon: CheckCircle2, className: "text-green-500", bg: "bg-green-100" },
    failed: { icon: XCircle, className: "text-red-500", bg: "bg-red-100" },
    cancelled: { icon: AlertCircle, className: "text-yellow-500", bg: "bg-yellow-100" },
  };

  const statusConfig = config[status] ?? defaultConfig;
  const Icon = statusConfig.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg}`}>
      <Icon className={`h-3 w-3 ${statusConfig.className} ${status === "running" ? "animate-spin" : ""}`} />
      {status}
    </span>
  );
}

export function ActivityTab() {
  const [view, setView] = useState<ActivityView>("workflows");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Data
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [workflowsTotal, setWorkflowsTotal] = useState(0);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [schedulesTotal, setSchedulesTotal] = useState(0);
  const [executions, setExecutions] = useState<ExecutionResponse[]>([]);
  const [executionsTotal, setExecutionsTotal] = useState(0);

  // Fetch users for filter dropdown
  useEffect(() => {
    listUsers()
      .then((res) => {
        setUsers(res.users.map((u) => ({ username: u.username, role: u.role })));
      })
      .catch(console.error);
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      if (view === "workflows") {
        const res = await listWorkflows({
          uploadedBy: selectedUser || undefined,
        });
        setWorkflows(res.workflows);
        setWorkflowsTotal(res.total);
      } else if (view === "schedules") {
        const res = await listSchedules({
          createdBy: selectedUser || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setSchedules(res.schedules);
        setSchedulesTotal(res.total);
      } else if (view === "executions") {
        const res = await listExecutions({
          triggeredBy: selectedUser || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setExecutions(res.executions);
        setExecutionsTotal(res.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view, selectedUser, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when changing view or filter
  useEffect(() => {
    setPage(0);
  }, [view, selectedUser]);

  const totalPages = Math.ceil(
    (view === "workflows" ? workflowsTotal : view === "schedules" ? schedulesTotal : executionsTotal) / PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* View selector */}
          <div className="flex p-1 bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => setView("workflows")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === "workflows"
                  ? "bg-brand-100 text-brand-700"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              Workflows
            </button>
            <button
              onClick={() => setView("schedules")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === "schedules"
                  ? "bg-brand-100 text-brand-700"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Schedules
            </button>
            <button
              onClick={() => setView("executions")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === "executions"
                  ? "bg-brand-100 text-brand-700"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Play className="w-4 h-4" />
              Executions
            </button>
          </div>

          {/* User filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.username} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
          <AlertCircle className="flex-shrink-0 w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : (
        <>
          {view === "workflows" && (
            <WorkflowsTable workflows={workflows} />
          )}
          {view === "schedules" && (
            <SchedulesTable schedules={schedules} />
          )}
          {view === "executions" && (
            <ExecutionsTable executions={executions} />
          )}

          {/* Pagination for schedules and executions */}
          {(view === "schedules" || view === "executions") && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WorkflowsTable({ workflows }: { workflows: WorkflowMetadata[] }) {
  if (workflows.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-gray-200 rounded-lg">
        <FileCode2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No workflows found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Workflow
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Owner
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Folder
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {workflows.map((w) => (
            <tr key={w.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <FileCode2 className="flex-shrink-0 w-5 h-5 text-brand-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.name}</p>
                    {w.description && (
                      <p className="max-w-xs text-xs text-gray-500 truncate">{w.description}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{w.uploaded_by}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">{w.folder_path}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{formatRelativeTime(w.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchedulesTable({ schedules }: { schedules: ScheduleResponse[] }) {
  if (schedules.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-gray-200 rounded-lg">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No schedules found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Workflow
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Owner
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Schedule
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Next Run
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {schedules.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Calendar className="flex-shrink-0 w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.workflow_name || "Unknown"}</p>
                    {s.description && (
                      <p className="max-w-xs text-xs text-gray-500 truncate">{s.description}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{s.created_by || "-"}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <code className="px-2 py-1 text-xs bg-gray-100 rounded">{s.cron_expression}</code>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  s.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {s.enabled ? "Active" : "Disabled"}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {s.next_trigger_at ? formatRelativeTime(s.next_trigger_at) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExecutionsTable({ executions }: { executions: ExecutionResponse[] }) {
  if (executions.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-gray-200 rounded-lg">
        <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No executions found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Workflow
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Triggered By
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Server
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Started
            </th>
            <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {executions.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Play className="flex-shrink-0 w-5 h-5 text-blue-500" />
                  <p className="text-sm font-medium text-gray-900">{e.workflow_name}</p>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{e.triggered_by || "-"}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">{e.server_name}</td>
              <td className="px-6 py-4">
                <ExecutionStatusBadge status={e.status} />
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {formatRelativeTime(e.queued_at)}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {e.duration_seconds !== null ? `${e.duration_seconds.toFixed(1)}s` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
