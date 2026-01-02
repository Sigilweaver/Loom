import { EmissionMap } from "@domain/workflow/entities/workflow";
import * as SelectPrimitive from "@radix-ui/react-select";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import React, { ReactNode, useCallback, useId, useMemo } from "react";
import { ConfigField } from "./ConfigField";
import { ConfigValidationMessage } from "./ConfigValidationMessage";
import { usePrimitiveEmission } from "./hooks";

export interface ConfigSelectOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** @deprecated Search functionality removed - keywords are ignored */
  keywords?: string[];
}

export interface ConfigSelectProps {
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
  /** @deprecated Search functionality removed - this prop is ignored */
  searchable?: boolean;
  /** @deprecated Search functionality removed - this prop is ignored */
  searchPlaceholder?: string;
  emptyOptionLabel?: string;
  className?: string;
  selectClassName?: string;
  /** @deprecated Search functionality removed - this prop is ignored */
  onSearchChange?: (term: string) => void;
  noOptionsMessage?: ReactNode;
  /** @deprecated Search functionality removed - this prop is ignored */
  searchNoMatchMessage?: ReactNode;
}

// Internal sentinel value for "use default" option (when value is undefined)
const EMPTY_VALUE_SENTINEL = "__CONFIGSELECT_EMPTY__";
// Internal sentinel value for options with empty string values
// Radix UI Select doesn't allow empty string as item value since it's reserved for clearing
const EMPTY_STRING_SENTINEL = "__CONFIGSELECT_EMPTY_STRING__";

// Convert option value for Radix (empty string -> sentinel)
const toRadixValue = (value: string): string =>
  value === "" ? EMPTY_STRING_SENTINEL : value;

// Convert Radix value back to actual value (sentinel -> empty string)
const fromRadixValue = (value: string): string =>
  value === EMPTY_STRING_SENTINEL ? "" : value;

export const ConfigSelect: React.FC<ConfigSelectProps> = ({
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
  emptyOptionLabel = "Use default",
  className,
  noOptionsMessage = "No options available.",
}) => {
  const selectId = useId();
  const descriptionId = description ? `${selectId}-description` : undefined;

  const { shouldEmit, commit } = usePrimitiveEmission<string>({
    configKey,
    value,
    defaultValue,
    onChange,
  });

  // Find the default option for display purposes
  const defaultOption = useMemo(
    () => options.find((option) => option.value === defaultValue) ?? null,
    [options, defaultValue]
  );

  // The value shown in the select (actual value or default)
  const effectiveValue = value ?? defaultOption?.value ?? undefined;

  // Find currently selected option for display
  const selectedOption = useMemo(() => {
    if (effectiveValue === undefined) {
      return null;
    }
    return options.find((option) => option.value === effectiveValue) ?? null;
  }, [options, effectiveValue]);

  // Handle Radix value change - convert sentinels back to actual values
  const handleValueChange = useCallback(
    (newValue: string) => {
      if (newValue === EMPTY_VALUE_SENTINEL) {
        commit(undefined);
      } else {
        commit(fromRadixValue(newValue));
      }
    },
    [commit]
  );

  const hasOptions = options.length > 0;
  const hasInteractiveOptions = hasOptions || (value !== undefined && !required);
  const showEmptyMessage = !hasOptions;

  // For Radix, use sentinel value when value is undefined, and convert empty strings
  const radixValue = effectiveValue === undefined
    ? EMPTY_VALUE_SENTINEL
    : toRadixValue(effectiveValue);

  return (
    <ConfigField
      label={label}
      labelFor={selectId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={shouldEmit}
      required={required}
      className={className}
      contentClassName="space-y-2"
    >
      <SelectPrimitive.Root
        value={radixValue}
        onValueChange={handleValueChange}
        disabled={disabled || !hasInteractiveOptions}
      >
        <SelectPrimitive.Trigger
          id={selectId}
          className={clsx(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2",
            "border-theme-border-primary bg-theme-surface-elevated text-sm",
            "text-theme-text-primary placeholder:text-theme-text-tertiary",
            "focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&>span]:line-clamp-1"
          )}
          aria-describedby={descriptionId}
        >
          <SelectPrimitive.Value placeholder={placeholder}>
            {selectedOption ? (
              <span className="truncate">{selectedOption.label}</span>
            ) : (
              <span className="text-theme-text-tertiary">{placeholder}</span>
            )}
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-theme-text-tertiary" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={clsx(
              "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md",
              "border border-theme-border-primary bg-theme-bg-secondary shadow-lg",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
              "data-[side=top]:slide-in-from-bottom-2"
            )}
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1 text-theme-text-secondary">
              <ChevronDown className="h-4 w-4 rotate-180" />
            </SelectPrimitive.ScrollUpButton>

            <SelectPrimitive.Viewport
              className={clsx(
                "p-1",
                "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
              )}
            >
              {/* Empty/default option when not required */}
              {!required && (
                <SelectPrimitive.Item
                  value={EMPTY_VALUE_SENTINEL}
                  className={clsx(
                    "relative flex w-full cursor-default select-none items-center rounded py-1.5 pl-8 pr-2",
                    "text-sm text-theme-text-secondary outline-none",
                    "focus:bg-theme-bg-hover focus:text-theme-text-primary",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>
                    {emptyOptionLabel}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              )}

              {/* Actual options */}
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value || EMPTY_STRING_SENTINEL}
                  value={toRadixValue(option.value)}
                  disabled={option.disabled ?? false}
                  className={clsx(
                    "relative flex w-full cursor-default select-none items-start rounded py-1.5 pl-8 pr-2",
                    "text-sm text-theme-text-primary outline-none",
                    "focus:bg-theme-bg-hover focus:text-theme-text-primary",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  )}
                >
                  <span className="absolute left-2 top-1.5 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <div className="flex flex-col">
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                    {option.description && (
                      <span className="text-xs text-theme-text-tertiary mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                </SelectPrimitive.Item>
              ))}

              {/* Empty state message */}
              {showEmptyMessage && (
                <div className="px-3 py-4 text-sm text-theme-text-tertiary">
                  {noOptionsMessage}
                </div>
              )}
            </SelectPrimitive.Viewport>

            <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1 text-theme-text-secondary">
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      <ConfigValidationMessage
        id={`${selectId}-validation`}
        state="info"
        message={showEmptyMessage ? noOptionsMessage : null}
      />
    </ConfigField>
  );
};
