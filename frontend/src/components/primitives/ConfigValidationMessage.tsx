import clsx from "clsx";
import React, { ReactNode } from "react";

type ValidationState = "error" | "warning" | "success" | "info";

export interface ConfigValidationMessageProps {
  state?: ValidationState;
  message?: ReactNode;
  className?: string;
  id?: string;
}

const STATE_STYLES: Record<ValidationState, string> = {
  error: "text-theme-form-error-text",
  warning: "text-yellow-500",
  success: "text-theme-form-success-text",
  info: "text-theme-text-tertiary",
};

/**
 * Consistent presentation for validation feedback under config primitives.
 */
export const ConfigValidationMessage: React.FC<
  ConfigValidationMessageProps
> = ({ state = "info", message, className, id }) => {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      role={state === "error" ? "alert" : undefined}
      className={clsx(
        "text-xs leading-relaxed",
        STATE_STYLES[state],
        className
      )}
    >
      {message}
    </p>
  );
};
