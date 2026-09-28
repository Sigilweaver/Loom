import type { ComponentPropsWithRef } from "react";
import clsx from "clsx";

/**
 * Bordered table that scrolls horizontally instead of breaking the page
 * layout on narrow screens.
 */
export function Table({ className, children, ...rest }: ComponentPropsWithRef<"table">) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface-raised">
      <table className={clsx("min-w-full text-sm", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...rest }: ComponentPropsWithRef<"thead">) {
  return <thead className={clsx("border-b border-line", className)} {...rest} />;
}

export function TBody({ className, ...rest }: ComponentPropsWithRef<"tbody">) {
  return <tbody className={clsx("divide-y divide-line", className)} {...rest} />;
}

export function Th({ className, scope = "col", ...rest }: ComponentPropsWithRef<"th">) {
  return (
    <th
      scope={scope}
      className={clsx(
        "px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-ink-subtle uppercase",
        className
      )}
      {...rest}
    />
  );
}

export interface TrProps extends ComponentPropsWithRef<"tr"> {
  /** Dim the row, e.g. for disabled items. */
  muted?: boolean;
}

export function Tr({ className, muted, ...rest }: TrProps) {
  return (
    <tr
      className={clsx("transition-colors hover:bg-surface-hover/60", muted && "opacity-60", className)}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: ComponentPropsWithRef<"td">) {
  return <td className={clsx("px-4 py-3 align-middle text-ink-muted", className)} {...rest} />;
}
