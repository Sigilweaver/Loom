import type { ComponentType } from "react";
import { Eye, Shield, ShieldCheck, User } from "lucide-react";
import type { UserRole } from "@state/authStore";
import { Badge, type Tone } from "@components/ui";

interface RoleMeta {
  label: string;
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
  /** What the role can do, shown when choosing a role. */
  description: string;
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  owner: {
    label: "Owner",
    tone: "accent",
    icon: ShieldCheck,
    description: "Full control of the Hub. There is only one owner.",
  },
  admin: {
    label: "Admin",
    tone: "info",
    icon: Shield,
    description: "Manages servers, connections, groups and non-admin users.",
  },
  auditor: {
    label: "Auditor",
    tone: "warning",
    icon: Eye,
    description: "Read-only access to the admin pages and the audit log.",
  },
  user: {
    label: "User",
    tone: "neutral",
    icon: User,
    description: "Uploads, schedules and runs their own workflows.",
  },
};

export function roleMeta(role: string): RoleMeta {
  return ROLE_META[role as UserRole] ?? ROLE_META.user;
}

export function RoleBadge({ role }: { role: string }) {
  const { label, tone, icon: Icon } = roleMeta(role);
  return (
    <Badge tone={tone} icon={<Icon className="h-3 w-3" />}>
      {label}
    </Badge>
  );
}
