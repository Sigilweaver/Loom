/**
 * Admin Dashboard tab
 *
 * Comprehensive system overview for administrators:
 * - System health and status
 * - User, workflow, execution, and schedule statistics
 * - Server status overview
 * - Recent activity and audit trail
 * - Resource utilization trends
 */

import { useState, useEffect } from "react";
import {
  Server,
  FileCode2,
  Play,
  Users,
  Database,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Activity,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  listServers,
  listWorkflows,
  listExecutions,
  listSchedules,
  listUsers,
  listConnections,
  listGroups,
  getHealth,
  type ServerResponse,
  type ExecutionResponse,
} from "@api/client";

interface SystemStats {
  // Counts
  userCount: number;
  workflowCount: number;
  executionCount: number;
  scheduleCount: number;
  connectionCount: number;
  groupCount: number;

  // Server health
  totalServers: number;
  onlineServers: number;
  offlineServers: number;

  // Execution stats (last 24h)
  executions24h: number;
  completed24h: number;
  failed24h: number;
  running: number;
  queued: number;

  // Trends (comparing to previous 24h)
  executionTrend: "up" | "down" | "stable";

  // Recent executions
  recentExecutions: ExecutionResponse[];

  // Server list for health display
  servers: ServerResponse[];

  // Hub version
  hubVersion: string;
}

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
  return `${diffDays}d ago`;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  trend?: "up" | "down" | "stable";
  trendLabel?: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendLabel,
}: StatCardProps) {
  return (
    <div className="bg-surface-raised rounded-lg border border-line p-5">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                  ? "text-red-600"
                  : "text-ink-subtle"
            }`}
          >
            {trend === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
            {trend === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
            {trend === "stable" && <Minus className="h-3.5 w-3.5" />}
            {trendLabel}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-ink">{value}</p>
        <p className="text-sm font-medium text-ink-muted mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-ink-subtle mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function ServerStatusRow({ server }: { server: ServerResponse }) {
  const isOnline = server.status === "online";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={`h-2.5 w-2.5 rounded-full ${
          isOnline ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{server.name}</p>
        <p className="text-xs text-ink-subtle truncate">{server.endpoint_url}</p>
      </div>
      <div className="text-right">
        <p className={`text-xs font-medium ${isOnline ? "text-green-600" : "text-red-600"}`}>
          {isOnline ? "Online" : "Offline"}
        </p>
        {server.last_poll && (
          <p className="text-xs text-ink-faint">{formatRelativeTime(server.last_poll)}</p>
        )}
      </div>
    </div>
  );
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const defaultConfig = { icon: Clock, className: "bg-surface-hover text-ink-muted", label: "Queued" };
  const config: Record<string, { icon: typeof Clock; className: string; label: string }> = {
    queued: defaultConfig,
    running: { icon: Loader2, className: "bg-blue-100 text-blue-600", label: "Running" },
    completed: { icon: CheckCircle2, className: "bg-green-100 text-green-600", label: "Completed" },
    failed: { icon: XCircle, className: "bg-red-100 text-red-600", label: "Failed" },
    cancelled: { icon: AlertCircle, className: "bg-yellow-100 text-yellow-600", label: "Cancelled" },
  };

  const statusConfig = config[status] ?? defaultConfig;
  const Icon = statusConfig.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {statusConfig.label}
    </span>
  );
}

export function DashboardTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [
        serversRes,
        workflowsRes,
        executionsRes,
        schedulesRes,
        usersRes,
        connectionsRes,
        groupsRes,
        healthRes,
      ] = await Promise.all([
        listServers(),
        listWorkflows(),
        listExecutions({ limit: 100 }),
        listSchedules(),
        listUsers(),
        listConnections(),
        listGroups(),
        getHealth(),
      ]);

      // Calculate 24h stats
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const executions24h = executionsRes.executions.filter(
        (e) => new Date(e.queued_at) >= yesterday
      );
      const executionsPrev24h = executionsRes.executions.filter(
        (e) => {
          const date = new Date(e.queued_at);
          return date >= twoDaysAgo && date < yesterday;
        }
      );

      const completed24h = executions24h.filter((e) => e.status === "completed").length;
      const failed24h = executions24h.filter((e) => e.status === "failed").length;
      const running = executionsRes.executions.filter((e) => e.status === "running").length;
      const queued = executionsRes.executions.filter((e) => e.status === "queued").length;

      // Calculate trend
      let executionTrend: "up" | "down" | "stable" = "stable";
      if (executions24h.length > executionsPrev24h.length * 1.1) {
        executionTrend = "up";
      } else if (executions24h.length < executionsPrev24h.length * 0.9) {
        executionTrend = "down";
      }

      const onlineServers = serversRes.servers.filter((s) => s.status === "online").length;

      setStats({
        userCount: usersRes.total,
        workflowCount: workflowsRes.total,
        executionCount: executionsRes.total,
        scheduleCount: schedulesRes.total,
        connectionCount: connectionsRes.total,
        groupCount: groupsRes.total,
        totalServers: serversRes.total,
        onlineServers,
        offlineServers: serversRes.total - onlineServers,
        executions24h: executions24h.length,
        completed24h,
        failed24h,
        running,
        queued,
        executionTrend,
        recentExecutions: executionsRes.executions.slice(0, 8),
        servers: serversRes.servers,
        hubVersion: healthRes.version,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll every 30 seconds
    const interval = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load dashboard</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button
            onClick={() => fetchStats()}
            className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const successRate =
    stats.executions24h > 0
      ? Math.round((stats.completed24h / stats.executions24h) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.userCount}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Workflows"
          value={stats.workflowCount}
          icon={FileCode2}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <StatCard
          title="Connections"
          value={stats.connectionCount}
          icon={Database}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <StatCard
          title="Active Schedules"
          value={stats.scheduleCount}
          icon={Calendar}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
      </div>

      {/* Execution Stats */}
      <div>
        <h3 className="text-sm font-medium text-ink-muted mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Execution Activity (Last 24 Hours)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Executions"
            value={stats.executions24h}
            icon={Play}
            iconColor="text-ink-muted"
            iconBg="bg-surface-hover"
            trend={stats.executionTrend}
            trendLabel="vs prev 24h"
          />
          <StatCard
            title="Completed"
            value={stats.completed24h}
            subtitle={`${successRate}% success rate`}
            icon={CheckCircle2}
            iconColor="text-green-600"
            iconBg="bg-green-100"
          />
          <StatCard
            title="Failed"
            value={stats.failed24h}
            icon={XCircle}
            iconColor="text-red-600"
            iconBg="bg-red-100"
          />
          <StatCard
            title="Running"
            value={stats.running}
            icon={Loader2}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Queued"
            value={stats.queued}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
          />
        </div>
      </div>

      {/* Two column layout for servers and recent executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Health */}
        <div className="bg-surface-raised rounded-lg border border-line">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-ink-subtle" />
              <h3 className="font-medium text-ink">Server Health</h3>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {stats.onlineServers} online
              </span>
              {stats.offlineServers > 0 && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {stats.offlineServers} offline
                </span>
              )}
            </div>
          </div>
          <div className="p-5">
            {stats.servers.length === 0 ? (
              <div className="text-center py-6">
                <Server className="h-10 w-10 text-ink-faint mx-auto mb-2" />
                <p className="text-sm text-ink-subtle">No servers registered</p>
                <p className="text-xs text-ink-faint mt-1">
                  Add servers in the Servers tab to start executing workflows
                </p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {stats.servers.map((server) => (
                  <ServerStatusRow key={server.id} server={server} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Executions */}
        <div className="bg-surface-raised rounded-lg border border-line">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-ink-subtle" />
              <h3 className="font-medium text-ink">Recent Executions</h3>
            </div>
            <span className="text-sm text-ink-subtle">{stats.executionCount} total</span>
          </div>
          <div className="divide-y divide-line">
            {stats.recentExecutions.length === 0 ? (
              <div className="text-center py-8">
                <Play className="h-10 w-10 text-ink-faint mx-auto mb-2" />
                <p className="text-sm text-ink-subtle">No executions yet</p>
              </div>
            ) : (
              stats.recentExecutions.map((execution) => (
                <div key={execution.id} className="px-5 py-3 hover:bg-surface-sunken">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {execution.workflow_name}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {execution.server_name} - {formatRelativeTime(execution.queued_at)}
                        {execution.triggered_by && ` - by ${execution.triggered_by}`}
                      </p>
                    </div>
                    <ExecutionStatusBadge status={execution.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-surface-sunken rounded-lg border border-line p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Loom Hub v{stats.hubVersion}
          </span>
          <span className="text-ink-subtle">
            {stats.groupCount} groups - {stats.connectionCount} connections - {stats.userCount} users
          </span>
        </div>
      </div>
    </div>
  );
}
