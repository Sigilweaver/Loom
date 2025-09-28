import { XMLEmissionMap } from "@domain/workflow/entities/workflow";
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

export type ConfigTextVariant = "text" | "textarea" | "char";

export type ConfigTextPresetOption =
  | string
  | {
      label: string;
      value: string;
      hint?: string;
    };

export interface ConfigTextValidation {
  pattern?: string | RegExp;
  flags?: string;
  message?: string;
  /**
   * Whether an empty string should be considered valid.
   * Defaults to true.
   */
  allowEmpty?: boolean;
  /**
   * When to surface validation feedback. Validation still runs on change so we
   * can block invalid values from emitting, but errors display after blur if requested.
   */
  mode?: "change" | "blur";
  /** Optional debounce window in milliseconds for change-mode validation. */
  debounceMs?: number;
  /**
   * Optional custom validator that can return an error message.
   */
  custom?: (normalizedValue: string, displayValue: string) => string | null;
}

export interface ConfigTextProps {
  value: string | undefined;
  onChange: (
    value: string | undefined,
    emitPatch: XMLEmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Trim leading/trailing whitespace before emitting (ignored in char mode). */
  trim?: boolean;
  /**
   * Provide a custom normalization function before validation/emission.
   * Overrides the built-in char normalization when supplied.
   */
  normalize?: (input: string) => string;
  /**
   * Map the stored value to the string shown in the input. Useful for char mode
   * to render escape sequences.
   */
  formatDisplay?: (value: string | undefined) => string;
  variant?: ConfigTextVariant;
  rows?: number;
  presetOptions?: ConfigTextPresetOption[];
  autoComplete?: string;
  spellCheck?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  inputClassName?: string;
  textAreaClassName?: string;
  validation?: ConfigTextValidation;
  /**
   * Whether an empty string should emit as an override instead of clearing the value.
   * Defaults to false (empty string removes the value and falls back to default).
   */
  emitEmptyString?: boolean;
  onValidationChange?: (state: {
    valid: boolean;
    message: string | null;
  }) => void;
}

interface ValidationOutcome {
  valid: boolean;
  message: string | null;
  normalized: string;
}

const DEFAULT_CHAR_PRESETS: ConfigTextPresetOption[] = [
  { label: "Comma (,) ", value: "," },
  { label: "Tab (\\t)", value: "\\t" },
  { label: "Pipe (|)", value: "|" },
  { label: "Space (␠)", value: " " },
  { label: "Semicolon (;)", value: ";" },
];

const encodeCharForDisplay = (value: string | undefined): string => {
  if (!value) {
    return value ?? "";
  }

  switch (value) {
    case "\n":
      return "\\n";
    case "\t":
      return "\\t";
    case "\r":
      return "\\r";
    case "\0":
      return "\\0";
    case "\\":
      return "\\\\";
    case '"':
      return '\\"';
    case "'":
      return "\\'";
    default:
      return value;
  }
};

const decodeCharFromDisplay = (value: string): string => {
  if (value.length === 0) {
    return "";
  }

  if (value.length === 1) {
    return value;
  }

  if (value[0] === "\\") {
    const sequence = value.slice(1);
    switch (sequence) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "0":
        return "\0";
      case "\\":
        return "\\";
      case '"':
        return '"';
      case "'":
        return "'";
      default:
        return sequence.charAt(0) ?? "";
    }
  }

  return value.charAt(0);
};

export const ConfigText: React.FC<ConfigTextProps> = ({
  value,
  onChange,
  configKey,
  label = "Text",
  description,
  inlineMessage,
  placeholder = "Enter text...",
  defaultValue = "",
  disabled = false,
  required = false,
  minLength,
  maxLength,
  trim = false,
  normalize,
  formatDisplay,
  variant = "text",
  rows = 3,
  presetOptions,
  autoComplete = "off",
  spellCheck = false,
  inputMode,
  inputClassName,
  textAreaClassName,
  validation,
  emitEmptyString = false,
  onValidationChange,
}) => {
  const inputId = useId();
  const messageId = `${inputId}-validation`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const isTextarea = variant === "textarea";
  const isChar = variant === "char";

  const resolvedPresetOptions = useMemo(() => {
    const base = presetOptions ?? (isChar ? DEFAULT_CHAR_PRESETS : []);
    return base.map((option) =>
      typeof option === "string" ? { label: option, value: option } : option
    );
  }, [presetOptions, isChar]);

  const compiledPattern = useMemo(() => {
    if (!validation?.pattern) {
      return null;
    }

    try {
      if (validation.pattern instanceof RegExp) {
        const flags = validation.pattern.flags.replace(/g|y/g, "");
        return new RegExp(validation.pattern.source, flags);
      }
      return new RegExp(validation.pattern, validation.flags ?? "");
    } catch (error) {
      console.error("Invalid validation pattern provided to ConfigText", error);
      return null;
    }
  }, [validation?.pattern, validation?.flags]);

  const allowEmpty = validation?.allowEmpty ?? true;

  const applyNormalization = useCallback(
    (input: string): string => {
      let next = input;

      if (normalize) {
        next = normalize(next);
      } else if (isChar) {
        next = decodeCharFromDisplay(next);
      }

      if (trim && !isChar) {
        next = next.trim();
      }

      return next;
    },
    [normalize, isChar, trim]
  );

  const formatDisplayValue = useCallback(
    (current: string | undefined): string => {
      if (formatDisplay) {
        return formatDisplay(current);
      }
      if (isChar) {
        return encodeCharForDisplay(current);
      }
      return current ?? "";
    },
    [formatDisplay, isChar]
  );

  const [draftValue, setDraftValue] = useState<string>(() =>
    formatDisplayValue(value)
  );
  const [hasBlurred, setHasBlurred] = useState(false);

  const evaluateValidation = useCallback(
    (display: string): ValidationOutcome => {
      const normalized = applyNormalization(display);
      const length = normalized.length;
      let message: string | null = null;

      if (required && length === 0) {
        message = "This field is required.";
      }

      if (message === null && !allowEmpty && length === 0) {
        message = "Value cannot be empty.";
      }

      if (
        message === null &&
        minLength != null &&
        length > 0 &&
        length < minLength
      ) {
        message = `Must be at least ${minLength} character${minLength === 1 ? "" : "s"}.`;
      }

      if (message === null && maxLength != null && length > maxLength) {
        message = `Must be at most ${maxLength} character${maxLength === 1 ? "" : "s"}.`;
      }

      if (message === null && isChar && length > 1) {
        message = "Enter a single character.";
      }

      if (message === null && compiledPattern && (length > 0 || !allowEmpty)) {
        compiledPattern.lastIndex = 0;
        if (!compiledPattern.test(normalized)) {
          message =
            validation?.message ?? "Value does not match the required pattern.";
        }
      }

      if (message === null && validation?.custom) {
        const customMessage = validation.custom(normalized, display);
        if (typeof customMessage === "string" && customMessage.length > 0) {
          message = customMessage;
        }
      }

      return {
        valid: message === null,
        message,
        normalized,
      };
    },
    [
      allowEmpty,
      applyNormalization,
      compiledPattern,
      isChar,
      maxLength,
      minLength,
      required,
      validation,
    ]
  );

  const initialOutcome = useMemo(
    () => evaluateValidation(formatDisplayValue(value)),
    [evaluateValidation, formatDisplayValue, value]
  );

  const notifyValidationChange = useCallback(
    (result: ValidationOutcome) => {
      if (onValidationChange) {
        onValidationChange({
          valid: result.valid,
          message: result.message,
        });
      }
    },
    [onValidationChange]
  );

  const {
    state: validationState,
    validate,
    validateImmediate,
    reset,
  } = useValidation<string, ValidationOutcome>({
    validator: evaluateValidation,
    initialResult: initialOutcome,
    debounceMs: validation?.debounceMs ?? 0,
    onValidationChange: notifyValidationChange,
  });

  const { shouldEmit, commit } = usePrimitiveEmission<string>({
    configKey,
    value,
    defaultValue,
    onChange,
  });

  const lastCommittedRef = useRef<string | undefined>(value);

  useEffect(() => {
    lastCommittedRef.current = value;
  }, [value]);

  useEffect(() => {
    const formatted = formatDisplayValue(value);
    setDraftValue(formatted);
    const nextOutcome = evaluateValidation(formatted);
    reset(nextOutcome);
    setHasBlurred(false);
  }, [value, formatDisplayValue, evaluateValidation, reset]);

  useEffect(() => {
    const normalized = validationState.normalized;
    const candidate =
      normalized === "" && !emitEmptyString ? undefined : normalized;

    if (candidate === lastCommittedRef.current) {
      return;
    }

    commit(candidate);
    lastCommittedRef.current = candidate;
  }, [validationState, emitEmptyString, commit]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextDisplayValue = event.target.value;
      setDraftValue(nextDisplayValue);
      validate(nextDisplayValue);
    },
    [validate]
  );

  const handleBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setHasBlurred(true);
      validateImmediate(event.target.value);
    },
    [validateImmediate]
  );

  const handlePresetSelect = useCallback(
    (optionValue: string) => {
      setDraftValue(optionValue);
      validateImmediate(optionValue);
    },
    [validateImmediate]
  );

  const validationMessage =
    validation && validation.mode === "blur" && !hasBlurred
      ? null
      : validationState.message;

  const describedBy = useMemo(() => {
    const ids = [] as string[];
    if (descriptionId) {
      ids.push(descriptionId);
    }
    if (validationMessage) {
      ids.push(messageId);
    }
    return ids.length > 0 ? ids.join(" ") : undefined;
  }, [descriptionId, validationMessage, messageId]);

  const baseInputClasses =
    "w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm " +
    "bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary " +
    "focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const resolvedInputMode = inputMode ?? (isChar ? "text" : undefined);
  const maxLengthAttr = !isTextarea
    ? (maxLength ?? (isChar ? 2 : undefined))
    : undefined;

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
      {isTextarea ? (
        <textarea
          id={inputId}
          value={draftValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={clsx(baseInputClasses, "resize-y", textAreaClassName)}
          aria-invalid={validationMessage ? true : undefined}
          aria-describedby={describedBy}
          spellCheck={spellCheck}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={draftValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
          inputMode={resolvedInputMode}
          maxLength={maxLengthAttr}
          className={clsx(baseInputClasses, inputClassName)}
          aria-invalid={validationMessage ? true : undefined}
          aria-describedby={describedBy}
        />
      )}

      {resolvedPresetOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resolvedPresetOptions.map((option) => (
            <button
              key={`${option.label}-${option.value}`}
              type="button"
              className="px-2 py-1 text-xs border border-theme-border-primary rounded bg-theme-surface-panel hover:bg-theme-surface-elevated transition-colors"
              onClick={() => handlePresetSelect(option.value)}
              disabled={disabled}
            >
              <span className="font-medium text-theme-text-primary">
                {option.label}
              </span>
              {option.hint && (
                <span className="ml-1 text-theme-text-tertiary">
                  {option.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <ConfigValidationMessage
        id={messageId}
        state={validationMessage ? "error" : "info"}
        message={validationMessage}
      />
    </ConfigField>
  );
};
