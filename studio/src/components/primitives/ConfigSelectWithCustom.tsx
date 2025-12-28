import { EmissionMap } from "@domain/workflow/entities/workflow";
import React, { ReactNode, useCallback, useState } from "react";
import { ConfigField } from "./ConfigField";
import { ConfigSelect, ConfigSelectOption } from "./ConfigSelect";
import { ConfigText } from "./ConfigText";
import { usePrimitiveEmission } from "./hooks";

export interface ConfigSelectWithCustomProps {
  value: string | undefined;
  onChange: (
    value: string | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  options: ConfigSelectOption[];
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  customOptionLabel?: string;
  customOptionValue?: string;
  customInputPlaceholder?: string;
  customInputMaxLength?: number;
  className?: string;
}

/**
 * A select dropdown with predefined options plus a "Custom" option
 * that reveals a text input when selected.
 */
export const ConfigSelectWithCustom: React.FC<ConfigSelectWithCustomProps> = ({
  value,
  onChange,
  configKey,
  options,
  label = "Select option",
  description,
  inlineMessage,
  defaultValue = "",
  disabled = false,
  required = false,
  placeholder = "Choose an option",
  customOptionLabel = "Custom",
  customOptionValue = "__CUSTOM__",
  customInputPlaceholder = "Enter custom value",
  customInputMaxLength,
  className,
}) => {
  const { shouldEmit, commit } = usePrimitiveEmission<string>({
    configKey,
    value,
    defaultValue,
    onChange,
  });

  // Check if current value is custom (not in predefined options)
  const isCustomValue = useCallback(
    (val: string | undefined): boolean => {
      if (val === undefined || val === defaultValue) {
        return false;
      }
      return !options.some((opt) => opt.value === val);
    },
    [options, defaultValue]
  );

  const [isCustomMode, setIsCustomMode] = useState(() => isCustomValue(value));
  const [customInputValue, setCustomInputValue] = useState<string>(
    isCustomValue(value) ? value! : ""
  );

  // Augmented options with custom option
  const augmentedOptions: ConfigSelectOption[] = [
    ...options,
    {
      value: customOptionValue,
      label: customOptionLabel,
      description: "Enter a custom value",
    },
  ];

  const handleSelectChange = useCallback(
    (
      selectedValue: string | undefined,
      _emitPatch: EmissionMap,
      _shouldEmitSelect: boolean
    ) => {
      if (selectedValue === customOptionValue) {
        // Switch to custom mode
        setIsCustomMode(true);
        setCustomInputValue("");
        // Don't emit yet - wait for user to enter custom value
      } else {
        // Normal option selected
        setIsCustomMode(false);
        commit(selectedValue);
      }
    },
    [customOptionValue, commit]
  );

  const handleCustomInputChange = useCallback(
    (
      inputValue: string | undefined,
      _emitPatch: EmissionMap,
      _shouldEmitInput: boolean
    ) => {
      setCustomInputValue(inputValue || "");
      commit(inputValue);
    },
    [commit]
  );

  // Display value for the select
  const displayValue = isCustomMode ? customOptionValue : value;

  return (
    <ConfigField
      label={label}
      description={description}
      inlineMessage={inlineMessage}
      willEmit={shouldEmit}
      required={required}
      className={className}
      contentClassName="space-y-2"
    >
      <ConfigSelect
        value={displayValue}
        onChange={handleSelectChange}
        configKey={`${configKey}_select`}
        options={augmentedOptions}
        label=""
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
      />

      {isCustomMode && (
        <ConfigText
          value={customInputValue}
          onChange={handleCustomInputChange}
          configKey={`${configKey}_custom`}
          label=""
          placeholder={customInputPlaceholder}
          {...(customInputMaxLength !== undefined && {
            maxLength: customInputMaxLength,
          })}
          disabled={disabled}
          defaultValue=""
        />
      )}
    </ConfigField>
  );
};
