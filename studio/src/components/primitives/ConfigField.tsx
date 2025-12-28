import clsx from "clsx";
import React, { PropsWithChildren, ReactNode } from "react";

export interface ConfigFieldProps {
  label?: ReactNode | undefined;
  labelFor?: string | undefined;
  description?: ReactNode | undefined;
  descriptionId?: string | undefined;
  inlineMessage?: ReactNode | undefined;
  willEmit?: boolean | undefined;
  willEmitMessage?: ReactNode | undefined;
  required?: boolean | undefined;
  hideLabel?: boolean | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
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
  descriptionId,
  inlineMessage,
  willEmit = false,
  willEmitMessage = "Overrides default",
  required = false,
  hideLabel = false,
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
              className={clsx(
                "block text-sm font-medium text-theme-text-secondary",
                hideLabel && "sr-only"
              )}
            >
              <span>{label}</span>
              {required && (
                <span className="ml-1 text-theme-status-error" aria-hidden>
                  *
                </span>
              )}
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
        <p
          id={descriptionId}
          className="text-xs text-theme-text-tertiary leading-relaxed"
        >
          {description}
        </p>
      )}
      <div className={clsx("space-y-2", contentClassName)}>{children}</div>
    </div>
  );
};
