/**
 * Admin dashboard: system health at a glance. Counts, the last 24 hours of
 * executions, server health and the most recent runs.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  FileCode2,
  Loader2,
  Minus,
  Play,
  RefreshCw,
  Server,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  getHealth,
  listConnections,
  listExecutions,
  listGroups,
  listSchedules,
  listServers,
  listUsers,
  listWorkflows,
} from "@api";
import { errorMessage } from "@utils/errors";
import { formatRelativeTime } from "@utils/format";
import { ExecutionStatusBadge } from "@components/ExecutionStatus";
import { ServerStatusBadge } from "@components/ServerStatus";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  StatCard,
} from "@components/ui";

type Trend = "up" | "down" | "stable";

const DAY_MS = 24 * 60 * 60 * 1000;

async function loadDashboard() {
  const [servers, workflows, executions, schedules, users, connections, groups, health] = await Promise.all([
    listServers(),
    listWorkflows(),
    listExecutions({ limit: 100 }),
    listSchedules({ enabled: true, limit: 1 }),
    listUsers(),
    listConnections(),
    listGroups(),
    getHealth(),
  ]);

  const now = Date.now();
  const inWindow = (iso: string, from: number, to: number) => {
    const at = new Date(iso).getTime();
    return at >= from && at < to;
  };
  const last24h = executions.executions.filter((e) => inWindow(e.queued_at, now - DAY_MS, Infinity));
  const previous24h = executions.executions.filter((e) => inWindow(e.queued_at, now - 2 * DAY_MS, now - DAY_MS));

  let trend: Trend = "stable";
  if (last24h.length > previous24h.length * 1.1) trend = "up";
  else if (last24h.length < previous24h.length * 0.9) trend = "down";

  const online = servers.servers.filter((s) => s.status === "online").length;

  return {
    counts: {
      users: users.total,
      workflows: workflows.total,
      connections: connections.total,
      groups: groups.total,
      activeSchedules: schedules.total,
      executions: executions.total,
    },
    day: {
      total: last24h.length,
      completed: last24h.filter((e) => e.status === "completed").length,
      failed: last24h.filter((e) => e.status === "failed").length,
      trend,
    },
    running: executions.executions.filter((e) => e.status === "running").length,
    queued: executions.executions.filter((e) => e.status === "queued").length,
    servers: servers.servers,
    onlineServers: online,
    offlineServers: servers.total - online,
    recent: executions.executions.slice(0, 8),
    hubVersion: health.version,
  };
}

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, stable: Minus } as const;
const TREND_CLASS = { up: "text-success-ink", down: "text-danger-ink", stable: "text-ink-subtle" } as const;

function TrendLabel({ trend }: { trend: Trend }) {
  const Icon = TREND_ICON[trend];
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${TREND_CLASS[trend]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      vs previous 24h
    </span>
  );
}

export function DashboardTab() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: loadDashboard,
    refetchInterval: 30_000,
  });

  const data = dashboard.data;
  const successRate = data && data.day.total > 0 ? Math.round((data.day.completed / data.day.total) * 100) : 100;

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        description="How the Hub is doing right now."
        actions={
          <Button
            variant="ghost"
            icon={<RefreshCw className={`h-4 w-4 ${dashboard.isFetching ? "animate-spin" : ""}`} />}
            disabled={dashboard.isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })}
          >
            Refresh
          </Button>
        }
      />

      {dashboard.isPending ? (
        <LoadingState label="Loading dashboard..." />
      ) : dashboard.isError ? (
        <ErrorState
          title="Could not load the dashboard"
          message={errorMessage(dashboard.error)}
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Users" value={data.counts.users} icon={Users} tone="info" to="/admin/users" />
              <StatCard label="Workflows" value={data.counts.workflows} icon={FileCode2} tone="accent" to="/admin/activity" />
              <StatCard label="Connections" value={data.counts.connections} icon={Database} tone="warning" to="/admin/connections" />
              <StatCard label="Active schedules" value={data.counts.activeSchedules} icon={Calendar} tone="success" to="/admin/activity" />
            </div>

            <section aria-labelledby="exec-activity">
              <h2 id="exec-activity" className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Execution activity, last 24 hours
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  label="Total executions"
                  value={data.day.total}
                  icon={Play}
                  tone="neutral"
                  aside={<TrendLabel trend={data.day.trend} />}
                />
                <StatCard
                  label="Completed"
                  value={data.day.completed}
                  hint={`${successRate}% success rate`}
                  icon={CheckCircle2}
                  tone="success"
                />
                <StatCard label="Failed" value={data.day.failed} icon={XCircle} tone="danger" />
                <StatCard label="Running" value={data.running} icon={Loader2} tone="info" />
                <StatCard label="Queued" value={data.queued} icon={Clock} tone="warning" />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card padding="none">
                <CardHeader
                  title="Server health"
                  icon={<Server className="h-5 w-5" />}
                  actions={
                    <span className="text-sm text-ink-subtle">
                      {data.onlineServers} online
                      {data.offlineServers > 0 && `, ${data.offlineServers} offline`}
                    </span>
                  }
                />
                {data.servers.length === 0 ? (
                  <EmptyState
                    icon={Server}
                    title="No servers registered"
                    description="Add a server on the Servers page to start running workflows."
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.servers.map((server) => (
                      <li key={server.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{server.name}</p>
                          <p className="truncate text-xs text-ink-subtle">{server.endpoint_url}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <ServerStatusBadge status={server.status} />
                          {server.last_poll && (
                            <span className="text-xs text-ink-faint">{formatRelativeTime(server.last_poll)}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card padding="none">
                <CardHeader
                  title="Recent executions"
                  icon={<TrendingUp className="h-5 w-5" />}
                  actions={<span className="text-sm text-ink-subtle">{data.counts.executions} total</span>}
                />
                {data.recent.length === 0 ? (
                  <EmptyState icon={Play} title="No executions yet" />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.recent.map((execution) => (
                      <li key={execution.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{execution.workflow_name}</p>
                          <p className="truncate text-xs text-ink-subtle">
                            {execution.server_name} - {formatRelativeTime(execution.queued_at)}
                            {execution.triggered_by && ` - by ${execution.triggered_by}`}
                          </p>
                        </div>
                        <ExecutionStatusBadge status={execution.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <p className="flex flex-wrap justify-between gap-2 rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-subtle">
              <span>Loom Hub v{data.hubVersion}</span>
              <span>
                {data.counts.groups} groups - {data.counts.connections} connections - {data.counts.users} users
              </span>
            </p>
          </div>
        )
      )}
    </Page>
  );
}
