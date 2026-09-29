import type { ComponentType } from "react";
import {
  Activity,
  Clock,
  Database,
  FileCode2,
  Home,
  LayoutDashboard,
  Package,
  Play,
  Server,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";
import type { UserRole } from "@state/authStore";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Match the path exactly (for parent routes like /admin). */
  end?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

const userSections: NavSection[] = [
  {
    items: [
      { to: "/home", label: "Home", icon: Home },
      { to: "/workflows", label: "Workflows", icon: FileCode2 },
      { to: "/executions", label: "Executions", icon: Play },
      { to: "/schedules", label: "Schedules", icon: Clock },
    ],
  },
];

const adminSections: NavSection[] = [
  {
    label: "Monitor",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/admin/activity", label: "Activity", icon: Activity },
      { to: "/admin/audit", label: "Audit Log", icon: ShieldCheck },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { to: "/admin/servers", label: "Servers", icon: Server },
      { to: "/admin/connections", label: "Connections", icon: Database },
    ],
  },
  {
    label: "Access",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/groups", label: "User Groups", icon: UsersRound },
      { to: "/admin/grant-groups", label: "Grant Groups", icon: Package },
    ],
  },
  {
    items: [{ to: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

export const ADMIN_ROLES: readonly UserRole[] = ["owner", "admin", "auditor"];

export function isAdminRole(role: UserRole | undefined): boolean {
  return role !== undefined && ADMIN_ROLES.includes(role);
}

/** Navigation for a role: admins, owners and auditors get the admin area, everyone else the user area. */
export function navigationFor(role: UserRole | undefined): NavSection[] {
  return isAdminRole(role) ? adminSections : userSections;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  auditor: "Auditor",
  user: "User",
};
