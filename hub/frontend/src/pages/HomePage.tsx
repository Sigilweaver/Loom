/**
 * User home: a quick overview of the signed-in user's activity.
 * Stats, recent executions and workflows, and the next scheduled run.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, FileCode2, Play, RefreshCw, TrendingUp } from "lucide-react";
import { useAuthStore } from "@state/authStore";
import { listExecutions, listSchedules, listWorkflows } from "@api";
import { errorMessage } from "@utils/errors";
import { formatDuration, formatRelativeTime } from "@utils/format";
import { ExecutionStatusBadge } from "@components/ExecutionStatus";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  StatCard,
  buttonClasses,
} from "@components/ui";

const REFRESH_MS = 30_000;

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HomePage() {
  const username = useAuthStore((state) => state.user?.username);
  const queryClient = useQueryClient();

  const workflows = useQuery({ queryKey: ["home", "workflows"], queryFn: () => listWorkflows(), refetchInterval: REFRESH_MS });
  const executions = useQuery({
    queryKey: ["home", "executions"],
    queryFn: () => listExecutions({ limit: 100 }),
    refetchInterval: REFRESH_MS,
  });
  const schedules = useQuery({
    queryKey: ["home", "schedules"],
    queryFn: () => listSchedules({ enabled: true, limit: 20 }),
    refetchInterval: REFRESH_MS,
  });

  const queries = [workflows, executions, schedules];
  const loading = queries.some((q) => q.isPending);
  const failed = queries.find((q) => q.isError);
  const refreshing = queries.some((q) => q.isFetching);

  const stats = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = (executions.data?.executions ?? []).filter((e) => new Date(e.queued_at) >= startOfDay);

    const now = Date.now();
    const next = (schedules.data?.schedules ?? [])
      .filter((s) => s.next_trigger_at && new Date(s.next_trigger_at).getTime() > now)
      .sort((a, b) => new Date(a.next_trigger_at!).getTime() - new Date(b.next_trigger_at!).getTime())[0];

    const recentWorkflows = [...(workflows.data?.workflows ?? [])]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);

    return {
      completedToday: today.filter((e) => e.status === "completed").length,
      failedToday: today.filter((e) => e.status === "failed").length,
      todayCount: today.length,
      nextSchedule: next ?? null,
      recentWorkflows,
      recentExecutions: (executions.data?.executions ?? []).slice(0, 5),
    };
  }, [workflows.data, executions.data, schedules.data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["home"] });

  return (
    <Page width="narrow">
      <PageHeader
        title={`${greeting()}${username ? `, ${username}` : ""}`}
        description="Here is what is happening with your workflows."
        actions={
          <Button
            variant="ghost"
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />}
            onClick={refresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
        }
      />

      {failed && (
        <ErrorState
          className="mb-6"
          title="Could not load your overview"
          message={errorMessage(failed.error)}
          onRetry={refresh}
        />
      )}

      {loading && !failed ? (
        <LoadingState />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Workflows"
              value={workflows.data?.total ?? "-"}
              hint="Total stored"
              icon={FileCode2}
              tone="info"
              to="/workflows"
            />
            <StatCard
              label="Executions today"
              value={executions.data ? stats.todayCount : "-"}
              hint={`${stats.completedToday} completed, ${stats.failedToday} failed`}
              icon={Play}
              tone="accent"
              to="/executions"
            />
            <StatCard
              label="Active schedules"
              value={schedules.data?.total ?? "-"}
              hint={
                stats.nextSchedule?.next_trigger_at
                  ? `Next run ${new Date(stats.nextSchedule.next_trigger_at).toLocaleString()}`
                  : "No upcoming runs"
              }
              icon={Calendar}
              tone="warning"
              to="/schedules"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="none">
              <CardHeader
                title="Recent executions"
                icon={<TrendingUp className="h-5 w-5" />}
                actions={
                  <Link to="/executions" className={buttonClasses("ghost", "sm")}>
                    View all
                  </Link>
                }
              />
              {stats.recentExecutions.length === 0 ? (
                <EmptyState
                  icon={Play}
                  title="No executions yet"
                  description="Run a workflow and it will show up here."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {stats.recentExecutions.map((execution) => (
                    <li key={execution.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{execution.workflow_name}</p>
                        <p className="text-xs text-ink-subtle">
                          {execution.server_name} - {formatRelativeTime(execution.queued_at)}
                          {execution.duration_seconds !== null &&
                            ` - ${formatDuration(execution.duration_seconds)}`}
                        </p>
                      </div>
                      <ExecutionStatusBadge status={execution.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="none">
              <CardHeader
                title="Recent workflows"
                icon={<FileCode2 className="h-5 w-5" />}
                actions={
                  <Link to="/workflows" className={buttonClasses("ghost", "sm")}>
                    View all
                  </Link>
                }
              />
              {stats.recentWorkflows.length === 0 ? (
                <EmptyState
                  icon={FileCode2}
                  title="No workflows uploaded"
                  action={
                    <Link to="/workflows" className={buttonClasses("primary")}>
                      Upload your first workflow
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {stats.recentWorkflows.map((workflow) => (
                    <li key={workflow.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{workflow.name}</p>
                        <p className="truncate text-xs text-ink-subtle">
                          {workflow.folder_path || "/"} - {formatRelativeTime(workflow.updated_at)}
                        </p>
                      </div>
                      {workflow.tags.length > 0 && (
                        <Badge>
                          {workflow.tags[0]}
                          {workflow.tags.length > 1 && ` +${workflow.tags.length - 1}`}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {stats.nextSchedule?.next_trigger_at && (
            <Alert
              tone="info"
              className="mt-6"
              title={`Next scheduled run: ${stats.nextSchedule.workflow_name ?? "Unknown workflow"}`}
              action={
                <Link to="/schedules" className={buttonClasses("secondary", "sm")}>
                  <Clock className="h-3.5 w-3.5" />
                  View schedules
                </Link>
              }
            >
              {new Date(stats.nextSchedule.next_trigger_at).toLocaleString()} (
              {stats.nextSchedule.cron_expression})
            </Alert>
          )}
        </>
      )}
    </Page>
  );
}
