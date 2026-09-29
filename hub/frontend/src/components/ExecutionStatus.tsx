import type { ComponentType } from "react";
import { CheckCircle2, Clock, Loader2, StopCircle, XCircle } from "lucide-react";
import { Badge, type Tone } from "@components/ui";

export type ExecutionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

interface StatusConfig {
  label: string;
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
}

export const EXECUTION_STATUS: Record<ExecutionStatus, StatusConfig> = {
  queued: { label: "Queued", tone: "neutral", icon: Clock },
  running: { label: "Running", tone: "info", icon: Loader2 },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  failed: { label: "Failed", tone: "danger", icon: XCircle },
  cancelled: { label: "Cancelled", tone: "warning", icon: StopCircle },
};

export function executionStatusConfig(status: string): StatusConfig {
  return EXECUTION_STATUS[status as ExecutionStatus] ?? EXECUTION_STATUS.queued;
}

/** Status pill for an execution: icon, label and color. */
export function ExecutionStatusBadge({ status }: { status: string }) {
  const { label, tone, icon: Icon } = executionStatusConfig(status);
  return (
    <Badge tone={tone} icon={<Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />}>
      {label}
    </Badge>
  );
}

const TRIGGERS: Record<string, { label: string; tone: Tone }> = {
  manual: { label: "Manual", tone: "accent" },
  scheduled: { label: "Scheduled", tone: "info" },
  api: { label: "API", tone: "neutral" },
};

/** How an execution was started: manual, scheduled or via the API. */
export function TriggerBadge({ type }: { type: string }) {
  const { label, tone } = TRIGGERS[type] ?? { label: type, tone: "neutral" as Tone };
  return <Badge tone={tone}>{label}</Badge>;
}
