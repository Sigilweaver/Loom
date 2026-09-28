import type { ReactNode } from "react";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { toneClasses, type Tone } from "./Badge";

export type AlertTone = Exclude<Tone, "neutral" | "accent">;

const icons = {
  danger: AlertCircle,
  warning: TriangleAlert,
  success: CheckCircle2,
  info: Info,
} as const;

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Trailing action, e.g. a retry button. */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Inline message box. Errors are announced to screen readers immediately. */
export function Alert({
  tone = "danger",
  title,
  children,
  action,
  onDismiss,
  className,
}: AlertProps) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        toneClasses[tone],
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5", "break-words")}>{children}</div>}
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
