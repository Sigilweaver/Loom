import type { ReactNode } from "react";
import clsx from "clsx";

export type Tone = "neutral" | "accent" | "success" | "danger" | "warning" | "info";

export const toneClasses: Record<Tone, string> = {
  neutral: "border-line bg-surface-hover text-ink-muted",
  accent: "border-accent-line bg-accent-soft text-accent-ink",
  success: "border-success-line bg-success-soft text-success-ink",
  danger: "border-danger-line bg-danger-soft text-danger-ink",
  warning: "border-warning-line bg-warning-soft text-warning-ink",
  info: "border-info-line bg-info-soft text-info-ink",
};

export interface BadgeProps {
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  title?: string;
  children: ReactNode;
}

/** Small status or category pill. Color is never the only signal: pass an icon or clear text. */
export function Badge({ tone = "neutral", icon, className, title, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
