import { AlertCircle, CheckCircle2, Database, FolderOpen, XCircle } from "lucide-react";
import type { ConnectionStatus, ConnectionType, DatabaseType, PathType } from "@api";
import { formatRelativeTime } from "@utils/format";
import { Badge, type Tone } from "@components/ui";
import { CONNECTION_TYPES, DATABASE_TYPES, PATH_TYPES } from "./options";

export function ConnectionTypeBadge({ type }: { type: ConnectionType }) {
  const option = CONNECTION_TYPES.find((t) => t.value === type) ?? CONNECTION_TYPES[0]!;
  const Icon = option.icon;
  return (
    <Badge tone={type === "filesystem" ? "warning" : "info"} icon={<Icon className="h-3 w-3" />}>
      {option.label}
    </Badge>
  );
}

export function DatabaseTypeBadge({ type }: { type: DatabaseType }) {
  return <Badge>{DATABASE_TYPES.find((t) => t.value === type)?.label ?? type}</Badge>;
}

export function PathTypeBadge({ type }: { type: PathType }) {
  return <Badge>{type === "unc" ? "UNC" : PATH_TYPES.find((t) => t.value === type)?.label ?? type}</Badge>;
}

const HEALTH: Record<ConnectionStatus, { tone: Tone; label: string; icon: typeof AlertCircle }> = {
  healthy: { tone: "success", label: "Healthy", icon: CheckCircle2 },
  unhealthy: { tone: "danger", label: "Unhealthy", icon: XCircle },
  error: { tone: "danger", label: "Error", icon: XCircle },
  unknown: { tone: "neutral", label: "Unknown", icon: AlertCircle },
};

/** Last known health of a connection, with when it was checked and why it failed. */
export function HealthStatusBadge({
  status,
  lastChecked,
  lastError,
}: {
  status: ConnectionStatus;
  lastChecked: string | null;
  lastError: string | null;
}) {
  const { tone, label, icon: Icon } = HEALTH[status] ?? HEALTH.unknown;
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={tone} icon={<Icon className="h-3 w-3" />}>
        {label}
      </Badge>
      {lastChecked && (
        <span className="text-xs text-ink-subtle">Checked {formatRelativeTime(lastChecked)}</span>
      )}
      {lastError && status !== "healthy" && (
        <span className="max-w-[200px] truncate text-xs text-danger-ink" title={lastError}>
          {lastError}
        </span>
      )}
    </div>
  );
}

export function ConnectionTypeIcon({ type }: { type: ConnectionType }) {
  const Icon = type === "database" ? Database : FolderOpen;
  return <Icon className="h-5 w-5" />;
}
