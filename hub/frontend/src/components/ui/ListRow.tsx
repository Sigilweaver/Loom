import type { ComponentType, ReactNode } from "react";
import clsx from "clsx";
import { toneClasses, type Tone } from "./Badge";

export interface ListRowProps {
  /** Icon in a tinted tile. Ignored when `avatar` is given. */
  icon?: ComponentType<{ className?: string }>;
  iconTone?: Tone;
  /** Text shown inside a round avatar, e.g. a username's initial. */
  avatar?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Trailing button(s). */
  action?: ReactNode;
  className?: string;
}

/** A row in a simple list: leading icon or avatar, two lines of text, and an action. */
export function ListRow({ icon: Icon, iconTone = "accent", avatar, title, subtitle, action, className }: ListRowProps) {
  return (
    <div className={clsx("flex items-center gap-3 rounded-lg bg-surface-sunken p-3", className)}>
      {avatar ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-ink">
          {avatar.charAt(0).toUpperCase()}
        </span>
      ) : (
        Icon && (
          <span className={clsx("shrink-0 rounded-lg border p-2", toneClasses[iconTone])}>
            <Icon className="h-4 w-4" />
          </span>
        )
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        {subtitle && <div className="text-xs text-ink-subtle">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
