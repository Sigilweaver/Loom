/**
 * Schedules: cron-based automatic workflow runs.
 */

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Clock, Pause, Pencil, Play, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  listServers,
  listWorkflows,
  toggleSchedule,
  triggerSchedule,
  updateSchedule,
  type ScheduleResponse,
} from "@api";
import { errorMessage } from "@utils/errors";
import { formatRelativeTime, formatTimeUntil } from "@utils/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Page,
  PageHeader,
  Pagination,
  useConfirm,
  useToast,
} from "@components/ui";
import { ScheduleDialog, type ScheduleFormData } from "./schedules/ScheduleDialog";

const PAGE_SIZE = 20;

export function SchedulesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const [page, setPage] = useState(0);
  // undefined: dialog closed, null: creating, otherwise the schedule being edited
  const [editing, setEditing] = useState<ScheduleResponse | null | undefined>(undefined);

  const schedules = useQuery({
    queryKey: ["schedules", page],
    queryFn: () => listSchedules({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const workflows = useQuery({ queryKey: ["schedules", "workflows"], queryFn: () => listWorkflows() });
  // Users without group assignments have no servers, which is fine.
  const servers = useQuery({ queryKey: ["schedules", "servers"], queryFn: () => listServers(), retry: false });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["schedules"] });

  const save = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      if (editing) {
        // Empty values are sent as null so they actually clear the stored setting.
        await updateSchedule(editing.id, {
          cron_expression: data.cron_expression,
          timezone: data.timezone,
          start_at: data.start_at || null,
          target_server_id: data.target_server_id || null,
          enabled: data.enabled,
          description: data.description || null,
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
    },
    onSuccess: async () => {
      toast.success(editing ? "Schedule updated." : "Schedule created.");
      await refresh();
    },
  });

  const handleDelete = async (schedule: ScheduleResponse) => {
    const ok = await confirm({
      title: "Delete schedule?",
      message: `The schedule for "${schedule.workflow_name ?? "this workflow"}" will stop running. This cannot be undone.`,
      confirmLabel: "Delete schedule",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteSchedule(schedule.id);
      toast.success("Schedule deleted.");
      await refresh();
    } catch (err) {
      toast.error(err, "Failed to delete schedule");
    }
  };

  const handleToggle = async (schedule: ScheduleResponse) => {
    try {
      await toggleSchedule(schedule.id, !schedule.enabled);
      await refresh();
    } catch (err) {
      toast.error(err, "Failed to update schedule");
    }
  };

  const handleRunNow = async (schedule: ScheduleResponse) => {
    try {
      await triggerSchedule(schedule.id);
      toast.success(`Started "${schedule.workflow_name ?? "workflow"}". See Executions for progress.`);
    } catch (err) {
      toast.error(err, "Failed to start the workflow");
    }
  };

  const rows = schedules.data?.schedules ?? [];

  return (
    <Page>
      <PageHeader
        title="Schedules"
        description="Run workflows automatically on a repeating schedule."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw className={`h-4 w-4 ${schedules.isFetching ? "animate-spin" : ""}`} />}
              onClick={() => void schedules.refetch()}
              disabled={schedules.isFetching}
            >
              Refresh
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>
              Create schedule
            </Button>
          </>
        }
      />

      {schedules.isPending ? (
        <LoadingState label="Loading schedules..." />
      ) : schedules.isError && !schedules.data ? (
        <ErrorState
          title="Could not load schedules"
          message={errorMessage(schedules.error)}
          onRetry={() => void schedules.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No schedules yet"
          description="Create a schedule to run a workflow automatically."
          className="rounded-xl border border-line bg-surface-raised"
          action={
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>
              Create schedule
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-4">
            {rows.map((schedule) => (
              <li key={schedule.id}>
                <Card className={schedule.enabled ? "" : "opacity-70"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-medium text-ink">
                          {schedule.workflow_name ?? "Unknown workflow"}
                        </h2>
                        <Badge tone={schedule.enabled ? "success" : "neutral"}>
                          {schedule.enabled ? "Active" : "Paused"}
                        </Badge>
                      </div>

                      {schedule.description && (
                        <p className="mb-3 text-sm text-ink-muted">{schedule.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs">
                            {schedule.cron_expression}
                          </code>
                          <span className="text-ink-subtle">({schedule.timezone})</span>
                        </span>
                        {schedule.target_server_name && (
                          <span className="flex items-center gap-1.5">
                            <Server className="h-4 w-4" aria-hidden="true" />
                            {schedule.target_server_name}
                          </span>
                        )}
                        {schedule.next_trigger_at && schedule.enabled && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            Next {formatTimeUntil(schedule.next_trigger_at)}
                          </span>
                        )}
                        {schedule.last_triggered_at && (
                          <span className="text-ink-subtle">
                            Last run {formatRelativeTime(schedule.last_triggered_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <IconButton label="Run now" onClick={() => void handleRunNow(schedule)}>
                        <Play className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label={schedule.enabled ? "Pause schedule" : "Enable schedule"}
                        onClick={() => void handleToggle(schedule)}
                      >
                        {schedule.enabled ? <Pause className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </IconButton>
                      <IconButton label="Edit schedule" onClick={() => setEditing(schedule)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Delete schedule" tone="danger" onClick={() => void handleDelete(schedule)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Pagination page={page} pageSize={PAGE_SIZE} total={schedules.data?.total ?? 0} onPageChange={setPage} noun="schedules" />
        </>
      )}

      {editing !== undefined && (
        <ScheduleDialog
          schedule={editing}
          workflows={workflows.data?.workflows ?? []}
          servers={servers.data?.servers ?? []}
          onClose={() => setEditing(undefined)}
          onSave={(data) => save.mutateAsync(data)}
        />
      )}
    </Page>
  );
}
