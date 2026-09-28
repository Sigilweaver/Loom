import type { ReactNode } from "react";
import clsx from "clsx";

export interface PageProps {
  children: ReactNode;
  className?: string;
}

/** Standard page container: consistent padding at every screen size. */
export function Page({ children, className }: PageProps) {
  return <div className={clsx("mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8", className)}>{children}</div>;
}

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Buttons and filters aligned to the right (wrapping below on narrow screens). */
  actions?: ReactNode;
  className?: string;
}

/** Page title (the page's single h1), optional description and actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={clsx(
        "mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
