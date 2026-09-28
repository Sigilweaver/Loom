import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { toneClasses, type Tone } from "./Badge";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  /** Extra content in the top-right corner, e.g. a trend indicator. */
  aside?: ReactNode;
  /** Makes the whole card a link. */
  to?: string;
}

/** Headline number with an icon tile. Used on both dashboards. */
export function StatCard({ label, value, hint, icon: Icon, tone = "accent", aside, to }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={clsx("rounded-lg border p-2.5", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        {aside}
        {to && <ArrowRight className="h-4 w-4 text-ink-faint" aria-hidden="true" />}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-ink tabular-nums">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-ink-muted">{label}</p>
        {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
      </div>
    </>
  );

  const classes = "block rounded-xl border border-line bg-surface-raised p-5 text-left";
  return to ? (
    <Link
      to={to}
      className={clsx(classes, "transition-colors hover:border-accent-line hover:bg-surface-hover/50")}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
