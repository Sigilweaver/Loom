import { XMLEmissionMap } from "@domain/workflow/entities/workflow";
import React, { ReactNode, useId } from "react";
import { ConfigField } from "./ConfigField";
import { calculateShouldEmit, usePrimitiveEmission } from "./hooks";

export interface ConfigBooleanProps {
  value: boolean | string | undefined; // Allow undefined for "not set" state
  onChange: (
    value: boolean | undefined,
    emitPatch: XMLEmissionMap,
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
 * Utility function to check if a boolean value should be emitted in XML
 * (only emit when different from default)
 */
export const shouldEmitBoolean = (
  value: boolean | string | undefined,
  defaultValue: boolean = false
): boolean => {
  const normalized = value === undefined ? undefined : getBooleanForXML(value);
  return calculateShouldEmit(normalized, defaultValue);
};

/**
 * Utility function to get the boolean value for XML emission
 */
export const getBooleanForXML = (
  value: boolean | string | undefined
): boolean => {
  return typeof value === "string" ? value === "true" : Boolean(value);
};

/**
 * Simple boolean checkbox primitive with no business logic
 * Tracks value vs defaultValue for XML emission logic
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
    value === undefined ? undefined : getBooleanForXML(value);

  const { shouldEmit, commit } = usePrimitiveEmission<boolean>({
    configKey,
    value: normalizedValue,
    defaultValue,
    onChange,
  });

  const inputId = useId();
  const descriptionId = description ? `${inputId}-description` : undefined;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    commit(newValue);
  };

  // Get the effective boolean value for display (use default if undefined)
  const effectiveValue =
    normalizedValue === undefined ? defaultValue : normalizedValue;

  // Check if this value would be emitted in XML
  const willEmitInXML = shouldEmit;

  return (
    <ConfigField
      label={label}
      labelFor={inputId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={willEmitInXML}
      required={required}
      contentClassName="flex items-center gap-3"
    >
      <input
        type="checkbox"
        id={inputId}
        checked={effectiveValue}
        onChange={handleChange}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="h-4 w-4 text-theme-interactive-accent rounded border-theme-border-primary focus:ring-1 focus:ring-theme-border-focus focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </ConfigField>
  );
};
