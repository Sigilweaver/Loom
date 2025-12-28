import { EmissionMap } from "@domain/workflow/entities/workflow";
import clsx from "clsx";
import React, {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfigField } from "./ConfigField";
import { ConfigValidationMessage } from "./ConfigValidationMessage";
import { usePrimitiveEmission, useValidation } from "./hooks";

export interface ConfigNumberProps {
  value: number | undefined;
  onChange: (
    value: number | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  placeholder?: string;
  defaultValue?: number;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  integerOnly?: boolean;
  clampToBounds?: boolean;
  validationMode?: "change" | "blur";
  debounceMs?: number;
  unit?: string;
  unitPosition?: "before" | "after";
  inputClassName?: string;
  onValidationChange?: (state: {
    valid: boolean;
    message: string | null;
  }) => void;
  customValidator?: (value: number) => string | null | undefined;
}

interface NumberValidationResult {
  valid: boolean;
  message: string | null;
  normalized: number | undefined;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const formatNumberInput = (value: number | undefined): string =>
  value === undefined ? "" : `${value}`;

export const ConfigNumber: React.FC<ConfigNumberProps> = ({
  value,
  onChange,
  configKey,
  label = "Number",
  description,
  inlineMessage,
  placeholder = "Enter number...",
  defaultValue,
  disabled = false,
  required = false,
  min,
  max,
  step,
  integerOnly = false,
  clampToBounds = false,
  validationMode = "change",
  debounceMs = 150,
  unit,
  unitPosition = "after",
  inputClassName,
  onValidationChange,
  customValidator,
}) => {
  const inputId = useId();
  const descriptionId = description ? `${inputId}-description` : undefined;
  const messageId = `${inputId}-validation`;

  const emissionValue = useMemo(
    () => (isFiniteNumber(value) ? value : undefined),
    [value]
  );

  const resolvedDefault = useMemo(
    () => (isFiniteNumber(defaultValue) ? defaultValue : 0),
    [defaultValue]
  );

  const { shouldEmit, commit } = usePrimitiveEmission<number>({
    configKey,
    value: emissionValue,
    defaultValue: resolvedDefault,
    onChange,
  });

  const [draftValue, setDraftValue] = useState<string>(() =>
    formatNumberInput(emissionValue)
  );
  const [hasBlurred, setHasBlurred] = useState(false);

  const notifyValidationChange = useCallback(
    (result: NumberValidationResult) => {
      onValidationChange?.({
        valid: result.valid,
        message: result.message,
      });
    },
    [onValidationChange]
  );

  const evaluateNumber = useCallback(
    (input: string): NumberValidationResult => {
      const trimmed = input.trim();

      if (trimmed.length === 0) {
        if (required) {
          return {
            valid: false,
            message: "This field is required.",
            normalized: undefined,
          };
        }
        return {
          valid: true,
          message: null,
          normalized: undefined,
        };
      }

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return {
          valid: false,
          message: "Enter a valid number.",
          normalized: undefined,
        };
      }

      if (integerOnly && !Number.isInteger(parsed)) {
        return {
          valid: false,
          message: "Enter an integer value.",
          normalized: undefined,
        };
      }

      let normalized = parsed;

      // Apply min/max bounds
      if (min !== undefined && normalized < min) {
        if (clampToBounds) {
          normalized = min;
        } else {
          return {
            valid: false,
            message: `Value must be at least ${min}.`,
            normalized: undefined,
          };
        }
      }

      if (max !== undefined && normalized > max) {
        if (clampToBounds) {
          normalized = max;
        } else {
          return {
            valid: false,
            message: `Value must be at most ${max}.`,
            normalized: undefined,
          };
        }
      }

      // Custom validation
      if (customValidator) {
        const message = customValidator(normalized);
        if (message) {
          return {
            valid: false,
            message,
            normalized: undefined,
          };
        }
      }

      return {
        valid: true,
        message: null,
        normalized,
      };
    },
    [clampToBounds, customValidator, integerOnly, max, min, required]
  );

  const initialValidation = useMemo(
    () => evaluateNumber(formatNumberInput(emissionValue)),
    [emissionValue, evaluateNumber]
  );

  const {
    state: validationState,
    validate,
    validateImmediate,
    reset,
  } = useValidation<string, NumberValidationResult>({
    validator: evaluateNumber,
    initialResult: initialValidation,
    debounceMs: validationMode === "change" ? debounceMs : 0,
    onValidationChange: notifyValidationChange,
  });

  const lastCommittedRef = useRef<number | undefined>(emissionValue);

  useEffect(() => {
    lastCommittedRef.current = emissionValue;
  }, [emissionValue]);

  useEffect(() => {
    const formatted = formatNumberInput(emissionValue);
    setDraftValue(formatted);
    reset(evaluateNumber(formatted));
    setHasBlurred(false);
  }, [emissionValue, evaluateNumber, reset]);

  useEffect(() => {
    if (!validationState.valid) {
      return;
    }

    const candidate = validationState.normalized;

    if (lastCommittedRef.current === candidate) {
      return;
    }

    commit(candidate);
    lastCommittedRef.current = candidate;
  }, [validationState, commit]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setDraftValue(nextValue);
      validate(nextValue);
    },
    [validate]
  );

  const handleBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setHasBlurred(true);
      validateImmediate(event.target.value);
    },
    [validateImmediate]
  );

  const validationMessage =
    validationMode === "blur" && !hasBlurred ? null : validationState.message;

  const describedBy = useMemo(() => {
    const ids: string[] = [];
    if (descriptionId) {
      ids.push(descriptionId);
    }
    if (validationMessage) {
      ids.push(messageId);
    }
    return ids.length > 0 ? ids.join(" ") : undefined;
  }, [descriptionId, validationMessage, messageId]);

  const baseInputClasses =
    "px-3 py-2 border border-theme-border-primary rounded-md text-sm " +
    "bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary " +
    "focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const resolvedStep: number | "any" = step ?? (integerOnly ? 1 : "any");
  const inputMode = integerOnly ? "numeric" : "decimal";

  const inputElement = (
    <input
      id={inputId}
      type="number"
      value={draftValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={resolvedStep}
      inputMode={inputMode}
      aria-describedby={describedBy}
      aria-invalid={validationMessage ? true : undefined}
      className={clsx(
        baseInputClasses,
        unit ? "flex-1" : "w-full",
        inputClassName
      )}
    />
  );

  return (
    <ConfigField
      label={label}
      labelFor={inputId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={shouldEmit}
      required={required}
    >
      {unit ? (
        <div className="flex items-center gap-2">
          {unitPosition === "before" && (
            <span className="text-sm text-theme-text-secondary">{unit}</span>
          )}
          {inputElement}
          {unitPosition === "after" && (
            <span className="text-sm text-theme-text-secondary">{unit}</span>
          )}
        </div>
      ) : (
        inputElement
      )}

      <ConfigValidationMessage
        id={messageId}
        state={validationMessage ? "error" : "info"}
        message={validationMessage}
      />
    </ConfigField>
  );
};
