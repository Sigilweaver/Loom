import type { ComponentPropsWithRef, ReactNode } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary:
    "border border-line-strong bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink",
  ghost: "text-ink-muted hover:bg-surface-hover hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
};

/** Class names for anything that should look like a button (e.g. a link). */
export function buttonClasses(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string
): string {
  return clsx(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in place of the icon and disables the button. */
  loading?: boolean;
  /** Icon shown before the label. */
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ComponentPropsWithRef<"button">, "aria-label"> {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  tone?: "default" | "danger";
  size?: ButtonSize;
}

/** Icon-only button. Requires a label so it is announced by screen readers. */
export function IconButton({
  label,
  tone = "default",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        tone === "danger"
          ? "text-ink-subtle hover:bg-danger-soft hover:text-danger-ink"
          : "text-ink-subtle hover:bg-surface-hover hover:text-ink",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
