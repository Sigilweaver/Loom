import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Check, ChevronDown, LogOut, Moon, Sparkles, Sun, UserCog } from "lucide-react";
import type { ComponentType } from "react";
import { useThemeStore, type Theme } from "@state/themeStore";
import { ROLE_LABELS } from "./navigation";
import type { AuthUser } from "@state/authStore";

const THEMES: { value: Theme; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "sigilweaver", label: "Sigilweaver", icon: Sparkles },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink data-[disabled]:opacity-50";

interface UserMenuProps {
  user: AuthUser | null;
  collapsed?: boolean;
  signingOut: boolean;
  onEditProfile: () => void;
  onSignOut: () => void;
}

/** Account menu at the foot of the sidebar: profile, theme and sign out. */
export function UserMenu({ user, collapsed = false, signingOut, onEditProfile, onSignOut }: UserMenuProps) {
  const { theme, setTheme } = useThemeStore();
  const name = user?.username ?? "Unknown";
  const role = user?.role ? ROLE_LABELS[user.role] : "";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          title={collapsed ? name : undefined}
          className={clsx(
            "group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-hover",
            collapsed && "justify-center"
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-ink">
            {name.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{name}</span>
                <span className="block truncate text-xs text-ink-subtle">{role}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint group-data-[state=open]:rotate-180" />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-[70] w-56 rounded-lg border border-line bg-surface-raised p-1 shadow-lg"
        >
          <DropdownMenu.Label className="px-3 pt-2 pb-1 text-xs font-medium text-ink-subtle">
            Theme
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenu.RadioItem key={value} value={value} className={itemClass}>
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="h-4 w-4 text-accent-ink" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={itemClass} onSelect={onEditProfile}>
            <UserCog className="h-4 w-4" />
            Edit profile
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} disabled={signingOut} onSelect={onSignOut}>
            <LogOut className="h-4 w-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
