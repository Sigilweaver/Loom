import clsx from "clsx";
import React, { PropsWithChildren, ReactNode } from "react";

export interface ConfigFieldProps {
  label?: ReactNode;
  labelFor?: string;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  willEmit?: boolean;
  willEmitMessage?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Shared layout wrapper for configuration primitives.
 * Handles label, helper text, and alignment for the "will emit" indicator
 * so individual primitives can stay focused on their specific inputs.
 */
export const ConfigField: React.FC<PropsWithChildren<ConfigFieldProps>> = ({
  label,
  labelFor,
  description,
  inlineMessage,
  willEmit = false,
  willEmitMessage = "Overrides default in XML",
  className,
  contentClassName,
  children,
}) => {
  return (
    <div className={clsx("space-y-2", className)}>
      {(label || willEmit || inlineMessage) && (
        <div className="flex items-baseline justify-between gap-4">
          {label ? (
            <label
              htmlFor={typeof labelFor === "string" ? labelFor : undefined}
              className="block text-sm font-medium text-theme-text-secondary"
            >
              {label}
            </label>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-xs text-theme-text-disabled">
            {inlineMessage && <span>{inlineMessage}</span>}
            {willEmit && <span>• {willEmitMessage}</span>}
          </div>
        </div>
      )}
      {description && (
        <p className="text-xs text-theme-text-tertiary leading-relaxed">
          {description}
        </p>
      )}
      <div className={clsx("space-y-2", contentClassName)}>{children}</div>
    </div>
  );
};
