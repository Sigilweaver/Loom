import type { ComponentPropsWithRef, ReactNode } from "react";
import clsx from "clsx";

export interface CardProps extends ComponentPropsWithRef<"div"> {
  /** Inner padding. Use "none" when the card holds a table or list. */
  padding?: "none" | "sm" | "md";
  /** Lifts the card on hover; for clickable cards. */
  interactive?: boolean;
}

const paddings = { none: "", sm: "p-3", md: "p-5" } as const;

export function Card({
  padding = "md",
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-line bg-surface-raised",
        paddings[padding],
        interactive && "transition-shadow hover:shadow-md",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  /** Small supporting text after the title, e.g. a count. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Title row for a card, separated from the body by a divider. */
export function CardHeader({ title, icon, meta, actions, className }: CardHeaderProps) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 border-b border-line px-5 py-3.5",
        className
      )}
    >
      <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-ink">
        {icon && <span className="shrink-0 text-ink-subtle">{icon}</span>}
        <span className="truncate">{title}</span>
        {meta && <span className="text-sm font-normal text-ink-subtle">{meta}</span>}
      </h2>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
