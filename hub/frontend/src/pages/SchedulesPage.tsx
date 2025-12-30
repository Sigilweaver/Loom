/**
 * Schedules page for Hub
 *
 * Manages cron-based workflow schedules.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Clock,
  Loader2,
  AlertCircle,
  Trash2,
  Play,
  Pause,
  Edit2,
  X,
  Check,
  RefreshCw,
  Calendar,
  Server,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DateTimePicker } from "@components/DateTimePicker";
import { ScheduleBuilder } from "@components/ScheduleBuilder";
import {
  listMySchedules,
  listMyWorkflows,
  listServers,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  triggerSchedule,
  type ScheduleResponse,
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

function formatNextRun(isoString: string | null): string {
  if (!isoString) return "Not scheduled";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) return "Overdue";

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays < 7) return `in ${diffDays}d`;
  return date.toLocaleDateString();
}

interface ScheduleFormData {
  workflow_id: string;
  cron_expression: string;
  timezone: string;
  start_at: string;
  target_server_id: string;
  enabled: boolean;
  description: string;
}

const DEFAULT_FORM_DATA: ScheduleFormData = {
  workflow_id: "",
  cron_expression: "0 * * * *",
  timezone: "UTC",
  start_at: "",
  target_server_id: "",
  enabled: true,
  description: "",
};

interface ScheduleModalProps {
  schedule: ScheduleResponse | null;
  workflows: WorkflowMetadata[];
  servers: ServerResponse[];
  onClose: () => void;
  onSave: (data: ScheduleFormData) => Promise<void>;
}

function ScheduleModal({
  schedule,
  workflows,
  servers,
  onClose,
  onSave,
}: ScheduleModalProps) {
  const [formData, setFormData] = useState<ScheduleFormData>(
    schedule
      ? {
          workflow_id: schedule.workflow_id,
          cron_expression: schedule.cron_expression,
          timezone: schedule.timezone,
          start_at: schedule.start_at || "",
          target_server_id: schedule.target_server_id || "",
          enabled: schedule.enabled,
          description: schedule.description || "",
        }
      : DEFAULT_FORM_DATA
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {schedule ? "Edit Schedule" : "Create Schedule"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Workflow */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow *
            </label>
            <select
              value={formData.workflow_id}
              onChange={(e) =>
                setFormData({ ...formData, workflow_id: e.target.value })
              }
              required
              disabled={!!schedule}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select a workflow</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Builder */}
          <div>
            <ScheduleBuilder
              value={formData.cron_expression}
              onChange={(value) =>
                setFormData({ ...formData, cron_expression: value })
              }
            />
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) =>
                setFormData({ ...formData, timezone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Chicago">America/Chicago (CST/CDT)</option>
              <option value="America/Denver">America/Denver (MST/MDT)</option>
              <option value="America/Los_Angeles">
                America/Los_Angeles (PST/PDT)
              </option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>

          {/* Start At (delayed start) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start At (Optional)
            </label>
            <DateTimePicker
              value={formData.start_at}
              onChange={(value) => setFormData({ ...formData, start_at: value })}
              placeholder="Select start date and time"
            />
            <p className="mt-1 text-xs text-gray-500">
              Schedule won't trigger before this time. Leave empty to start immediately.
            </p>
          </div>

          {/* Target Server */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Server
            </label>
            <select
              value={formData.target_server_id}
              onChange={(e) =>
                setFormData({ ...formData, target_server_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">Auto-select (round-robin)</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
              placeholder="Optional description for this schedule"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) =>
                setFormData({ ...formData, enabled: e.target.checked })
              }
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700">
              Enable schedule immediately
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.workflow_id}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {schedule ? "Save Changes" : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleResponse | null>(
    null
  );

  // Confirm delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const result = await listMySchedules({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setSchedules(result.schedules);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedules");
    }
  }, [page]);

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
      await Promise.all([fetchSchedules(), fetchFilters()]);
      setLoading(false);
    };
    load();
  }, [fetchSchedules, fetchFilters]);

  const handleCreate = () => {
    setEditingSchedule(null);
    setShowModal(true);
  };

  const handleEdit = (schedule: ScheduleResponse) => {
    setEditingSchedule(schedule);
    setShowModal(true);
  };

  const handleSave = async (data: ScheduleFormData) => {
    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, {
        cron_expression: data.cron_expression,
        timezone: data.timezone,
        start_at: data.start_at || undefined,
        target_server_id: data.target_server_id || undefined,
        enabled: data.enabled,
        description: data.description || undefined,
      });
    } else {
      await createSchedule({
        workflow_id: data.workflow_id,
        cron_expression: data.cron_expression,
        timezone: data.timezone,
        start_at: data.start_at || undefined,
        target_server_id: data.target_server_id || undefined,
        enabled: data.enabled,
        description: data.description || undefined,
      });
    }
    await fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule(id);
      setDeletingId(null);
      await fetchSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete schedule");
    }
  };

  const handleToggle = async (schedule: ScheduleResponse) => {
    try {
      await toggleSchedule(schedule.id, !schedule.enabled);
      await fetchSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle schedule");
    }
  };

  const handleTrigger = async (schedule: ScheduleResponse) => {
    try {
      await triggerSchedule(schedule.id);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to trigger schedule"
      );
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && schedules.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Schedules</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSchedules}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Schedule
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No schedules yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create a schedule to run workflows automatically
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Schedule
          </button>
        </div>
      ) : (
        <>
          {/* Schedule Cards */}
          <div className="grid gap-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`bg-white rounded-lg border p-4 ${
                  schedule.enabled
                    ? "border-gray-200"
                    : "border-gray-200 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {schedule.workflow_name || "Unknown Workflow"}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          schedule.enabled
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {schedule.enabled ? "Active" : "Paused"}
                      </span>
                    </div>

                    {schedule.description && (
                      <p className="text-sm text-gray-600 mb-3">
                        {schedule.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                          {schedule.cron_expression}
                        </code>
                        <span className="text-gray-400">({schedule.timezone})</span>
                      </div>

                      {schedule.target_server_name && (
                        <div className="flex items-center gap-1.5">
                          <Server className="h-4 w-4" />
                          {schedule.target_server_name}
                        </div>
                      )}

                      {schedule.next_trigger_at && schedule.enabled && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          Next: {formatNextRun(schedule.next_trigger_at)}
                        </div>
                      )}

                      {schedule.last_triggered_at && (
                        <div className="text-gray-400">
                          Last run: {formatRelativeTime(schedule.last_triggered_at)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleTrigger(schedule)}
                      title="Run now"
                      className="p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Play className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleToggle(schedule)}
                      title={schedule.enabled ? "Pause" : "Enable"}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {schedule.enabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleEdit(schedule)}
                      title="Edit"
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    {deletingId === schedule.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(schedule.id)}
                        title="Delete"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

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

      {/* Create/Edit Modal */}
      {showModal && (
        <ScheduleModal
          schedule={editingSchedule}
          workflows={workflows}
          servers={servers}
          onClose={() => {
            setShowModal(false);
            setEditingSchedule(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
