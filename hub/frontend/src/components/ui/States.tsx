import type { ComponentType, ReactNode } from "react";
import clsx from "clsx";
import { Loader2, RefreshCw } from "lucide-react";
import { Alert } from "./Alert";
import { Button } from "./Button";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={clsx("h-5 w-5 animate-spin text-brand-500", className)}
      aria-hidden="true"
    />
  );
}

/** Centered spinner with a status message for screen readers. */
export function LoadingState({
  label = "Loading...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={clsx(
        "flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-subtle",
        className
      )}
    >
      <Spinner className="h-6 w-6" />
      <span>{label}</span>
    </div>
  );
}

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Draw a dashed border, for "pick something" placeholders. */
  dashed?: boolean;
  className?: string;
}

/** What to show when a list has nothing in it: says why and offers the next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  dashed = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        dashed && "rounded-xl border-2 border-dashed border-line-strong",
        className
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
          <Icon className="h-6 w-6 text-ink-faint" />
        </div>
      )}
      <h3 className="text-base font-medium text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** A failed load, with a retry button. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Alert
      tone="danger"
      title={title}
      className={className}
      action={
        onRetry && (
          <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {message}
    </Alert>
  );
}
