import { EmissionMap } from "@domain/workflow/entities/workflow";
import React, { ReactNode, useId } from "react";
import { ConfigField } from "./ConfigField";
import { calculateShouldEmit, usePrimitiveEmission } from "./hooks";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import clsx from "clsx";

export interface ConfigBooleanProps {
  value: boolean | string | undefined; // Allow undefined for "not set" state
  onChange: (
    value: boolean | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  label?: string;
  description?: string;
  defaultValue?: boolean;
  disabled?: boolean;
  inlineMessage?: ReactNode;
  required?: boolean;
}

/**
 * Utility function to check if a boolean value should be serialized
 * (only serialize when different from default)
 */
export const shouldEmitBoolean = (
  value: boolean | string | undefined,
  defaultValue: boolean = false
): boolean => {
  const normalized =
    value === undefined ? undefined : getBooleanForSerialization(value);
  return calculateShouldEmit(normalized, defaultValue);
};

/**
 * Utility function to get the boolean value for serialization
 */
export const getBooleanForSerialization = (
  value: boolean | string | undefined
): boolean => {
  return typeof value === "string" ? value === "true" : Boolean(value);
};

/**
 * Simple boolean checkbox primitive with no business logic
 * Tracks value vs defaultValue for emission logic
 *
 * @example
 * // Simple checkbox
 * <ConfigBoolean
 *   value={hasHeader}
 *   onChange={(value, emitPatch) => updateConfig(value, emitPatch)}
 *   configKey="options.hasHeader"
 *   label="Has Header Row"
 * />
 *
 * // With default value tracking
 * <ConfigBoolean
 *   value={skipRows}
 *   onChange={(value, emitPatch) => updateConfig(value, emitPatch)}
 *   configKey="options.skip_rows"
 *   label="Skip Initial Rows"
 *   defaultValue={false}
 *   description="Skip the first row when reading"
 * />
 */
export const ConfigBoolean: React.FC<ConfigBooleanProps> = ({
  value,
  onChange,
  configKey,
  label = "Enable Option",
  description,
  defaultValue = false,
  disabled = false,
  inlineMessage,
  required = false,
}) => {
  const normalizedValue =
    value === undefined ? undefined : getBooleanForSerialization(value);

  const { shouldEmit, commit } = usePrimitiveEmission<boolean>({
    configKey,
    value: normalizedValue,
    defaultValue,
    onChange,
  });

  const inputId = useId();
  const descriptionId = description ? `${inputId}-description` : undefined;

  const handleCheckedChange = (checked: boolean | "indeterminate") => {
    // Radix can return "indeterminate", but we only handle boolean
    if (typeof checked === "boolean") {
      commit(checked);
    }
  };

  // Get the effective boolean value for display (use default if undefined)
  const effectiveValue =
    normalizedValue === undefined ? defaultValue : normalizedValue;

  // Check if this value would be serialized
  const willEmit = shouldEmit;

  return (
    <ConfigField
      label={label}
      labelFor={inputId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={willEmit}
      required={required}
      contentClassName="flex items-center gap-3"
    >
      <CheckboxPrimitive.Root
        id={inputId}
        checked={effectiveValue}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        aria-describedby={descriptionId}
        className={clsx(
          "h-4 w-4 shrink-0 rounded border",
          "border-theme-border-primary bg-theme-bg-input",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-theme-border-focus",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=checked]:bg-theme-interactive-accent data-[state=checked]:border-theme-interactive-accent"
        )}
      >
        <CheckboxPrimitive.Indicator
          className="flex items-center justify-center text-theme-text-on-accent"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </ConfigField>
  );
};
