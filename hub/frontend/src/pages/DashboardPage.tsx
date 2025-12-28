import { Server, FileCode2, Play, AlertCircle } from "lucide-react";

export function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Servers"
          value="0"
          subtitle="0 online"
          icon={Server}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title="Workflows"
          value="0"
          subtitle="0 scheduled"
          icon={FileCode2}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Executions (24h)"
          value="0"
          subtitle="0 failed"
          icon={Play}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <StatCard
          title="Active Schedules"
          value="0"
          subtitle="Next: --"
          icon={AlertCircle}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Recent Executions
        </h2>
        <div className="text-gray-500 text-sm text-center py-8">
          No recent executions
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
