/**
 * User home dashboard
 *
 * Provides a quick overview of the user's activity and system status:
 * - Quick stats (workflows, executions, schedules)
 * - Recent executions
 * - Recent workflows
 * - Quick actions
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  FileCode2,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@state/authStore";
import {
  listWorkflows,
  listExecutions,
  listSchedules,
  listServers,
  type WorkflowMetadata,
  type ExecutionResponse,
  type ScheduleResponse,
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

interface QuickStats {
  workflowCount: number;
  executionCount: number;
  completedToday: number;
  failedToday: number;
  activeSchedules: number;
  onlineServers: number;
  totalServers: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, onClick }: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-5 text-left ${onClick ? "hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer" : ""
        }`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        {onClick && (
          <ArrowRight className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600 mt-0.5">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>
    </Wrapper>
  );
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const defaultConfig = { icon: Clock, className: "text-gray-500" };
  const config: Record<string, { icon: typeof Clock; className: string }> = {
    queued: defaultConfig,
    running: { icon: Loader2, className: "text-blue-500" },
    completed: { icon: CheckCircle2, className: "text-green-500" },
    failed: { icon: XCircle, className: "text-red-500" },
    cancelled: { icon: AlertCircle, className: "text-yellow-500" },
  };

  const statusConfig = config[status] ?? defaultConfig;
  const Icon = statusConfig.icon;
  return (
    <Icon className={`h-4 w-4 ${statusConfig.className} ${status === "running" ? "animate-spin" : ""}`} />
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<QuickStats>({
    workflowCount: 0,
    executionCount: 0,
    completedToday: 0,
    failedToday: 0,
    activeSchedules: 0,
    onlineServers: 0,
    totalServers: 0,
  });
  const [recentExecutions, setRecentExecutions] = useState<ExecutionResponse[]>([]);
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowMetadata[]>([]);
  const [nextSchedule, setNextSchedule] = useState<ScheduleResponse | null>(null);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [workflowsRes, executionsRes, schedulesRes, serversRes] = await Promise.all([
        listWorkflows(),
        listExecutions({ limit: 10 }),
        listSchedules({ enabled: true, limit: 20 }),
        listServers(),
      ]);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayExecutions = executionsRes.executions.filter(
        (e) => new Date(e.queued_at) >= today
      );
      const completedToday = todayExecutions.filter((e) => e.status === "completed").length;
      const failedToday = todayExecutions.filter((e) => e.status === "failed").length;

      const onlineServers = serversRes.servers.filter((s) => s.status === "online").length;

      // Find next scheduled execution
      const now = new Date();
      const upcoming = schedulesRes.schedules
        .filter((s) => s.next_trigger_at && new Date(s.next_trigger_at) > now)
        .sort((a, b) => new Date(a.next_trigger_at!).getTime() - new Date(b.next_trigger_at!).getTime());

      setStats({
        workflowCount: workflowsRes.total,
        executionCount: executionsRes.total,
        completedToday,
        failedToday,
        activeSchedules: schedulesRes.total,
        onlineServers,
        totalServers: serversRes.total,
      });
      setRecentExecutions(executionsRes.executions.slice(0, 5));
      // Sort workflows by updated_at descending (most recently accessed first)
      const sortedWorkflows = [...workflowsRes.workflows].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setRecentWorkflows(sortedWorkflows.slice(0, 5));
      setNextSchedule(upcoming[0] || null);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchDashboardData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-8 mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-100">
            <Home className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {greeting}, {user?.username}
            </h1>
            <p className="text-sm text-gray-500">Here's what's happening with your workflows</p>
          </div>
        </div>
        <button
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 transition-colors rounded-lg hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Workflows"
          value={stats.workflowCount}
          subtitle="Total stored"
          icon={FileCode2}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          onClick={() => navigate("/workflows")}
        />
        <StatCard
          title="Executions Today"
          value={stats.completedToday + stats.failedToday}
          subtitle={`${stats.completedToday} completed, ${stats.failedToday} failed`}
          icon={Play}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
          onClick={() => navigate("/executions")}
        />
        <StatCard
          title="Active Schedules"
          value={stats.activeSchedules}
          subtitle={nextSchedule ? `Next: ${formatRelativeTime(nextSchedule.next_trigger_at!)}` : "No upcoming"}
          icon={Calendar}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
          onClick={() => navigate("/schedules")}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Executions */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500" />
              <h2 className="font-medium text-gray-900">Recent Executions</h2>
            </div>
            <button
              onClick={() => navigate("/executions")}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentExecutions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Play className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No executions yet</p>
                <p className="mt-1 text-xs text-gray-400">Run a workflow to see it here</p>
              </div>
            ) : (
              recentExecutions.map((execution) => (
                <div key={execution.id} className="px-5 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <ExecutionStatusBadge status={execution.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {execution.workflow_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {execution.server_name} - {formatRelativeTime(execution.queued_at)}
                      </p>
                    </div>
                    {execution.duration_seconds !== null && (
                      <span className="text-xs text-gray-400">
                        {execution.duration_seconds.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Workflows */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-gray-500" />
              <h2 className="font-medium text-gray-900">Recent Workflows</h2>
            </div>
            <button
              onClick={() => navigate("/workflows")}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentWorkflows.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <FileCode2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No workflows uploaded</p>
                <button
                  onClick={() => navigate("/workflows")}
                  className="mt-1 text-xs text-brand-600 hover:text-brand-700"
                >
                  Upload your first workflow
                </button>
              </div>
            ) : (
              recentWorkflows.map((workflow) => (
                <div key={workflow.id} className="px-5 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-gray-100">
                      <FileCode2 className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {workflow.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {workflow.folder_path || "/"} - {formatRelativeTime(workflow.updated_at)}
                      </p>
                    </div>
                    {workflow.tags.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {workflow.tags[0]}
                        {workflow.tags.length > 1 && ` +${workflow.tags.length - 1}`}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Next Scheduled Execution */}
      {nextSchedule && (
        <div className="p-4 mt-6 border rounded-lg bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Next scheduled execution: {nextSchedule.workflow_name}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {nextSchedule.next_trigger_at
                  ? new Date(nextSchedule.next_trigger_at).toLocaleString()
                  : "Unknown"} ({nextSchedule.cron_expression})
              </p>
            </div>
            <button
              onClick={() => navigate("/schedules")}
              className="text-sm font-medium text-amber-700 hover:text-amber-800"
            >
              View schedules
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
