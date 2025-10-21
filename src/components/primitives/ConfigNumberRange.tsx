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

export interface ConfigNumberRangeValue {
  start?: number;
  end?: number;
}

export interface ConfigNumberRangeProps {
  value: ConfigNumberRangeValue | undefined;
  onChange: (
    value: ConfigNumberRangeValue | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  defaultValue?: ConfigNumberRangeValue;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  integerOnly?: boolean;
  allowPartial?: boolean;
  clampToBounds?: boolean;
  validationMode?: "change" | "blur";
  debounceMs?: number;
  startLabel?: ReactNode;
  endLabel?: ReactNode;
  startPlaceholder?: string;
  endPlaceholder?: string;
  layout?: "inline" | "stacked";
  inputClassName?: string;
  onValidationChange?: (state: {
    valid: boolean;
    message: string | null;
  }) => void;
  customValidator?: (
    range: ConfigNumberRangeValue
  ) => string | null | undefined;
}

interface DraftRangeInput {
  start: string;
  end: string;
}

interface RangeValidationResult {
  valid: boolean;
  message: string | null;
  normalized: ConfigNumberRangeValue;
}

const EMPTY_RANGE: ConfigNumberRangeValue = Object.freeze({});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const createRange = (start?: number, end?: number): ConfigNumberRangeValue => {
  const range: ConfigNumberRangeValue = {};
  if (start !== undefined) {
    range.start = start;
  }
  if (end !== undefined) {
    range.end = end;
  }
  return Object.keys(range).length === 0 ? EMPTY_RANGE : range;
};

const normalizeRange = (
  range: ConfigNumberRangeValue | undefined
): ConfigNumberRangeValue => {
  if (!range) {
    return EMPTY_RANGE;
  }

  const start = isFiniteNumber(range.start) ? range.start : undefined;
  const end = isFiniteNumber(range.end) ? range.end : undefined;

  if (start === undefined && end === undefined) {
    return EMPTY_RANGE;
  }

  if (start === range.start && end === range.end) {
    return range;
  }

  return createRange(start, end);
};

const rangesEqual = (
  a: ConfigNumberRangeValue | undefined,
  b: ConfigNumberRangeValue | undefined
): boolean => {
  if (a === b) {
    return true;
  }

  const normalizedA = normalizeRange(a);
  const normalizedB = normalizeRange(b);

  return (
    normalizedA.start === normalizedB.start &&
    normalizedA.end === normalizedB.end
  );
};

const formatNumberInput = (value: number | undefined): string =>
  value === undefined ? "" : `${value}`;

const buildDescribedBy = (
  descriptionId: string | undefined,
  messageId: string | undefined,
  message: string | null
): string | undefined => {
  const ids: string[] = [];
  if (descriptionId) {
    ids.push(descriptionId);
  }
  if (message && messageId) {
    ids.push(messageId);
  }
  return ids.length > 0 ? ids.join(" ") : undefined;
};

export const ConfigNumberRange: React.FC<ConfigNumberRangeProps> = ({
  value,
  onChange,
  configKey,
  label = "Number range",
  description,
  inlineMessage,
  defaultValue,
  disabled = false,
  required = false,
  min,
  max,
  step,
  integerOnly = false,
  allowPartial = true,
  clampToBounds = false,
  validationMode = "change",
  debounceMs = 150,
  startLabel = "Start",
  endLabel = "End",
  startPlaceholder = "Start",
  endPlaceholder = "End",
  layout = "inline",
  inputClassName,
  onValidationChange,
  customValidator,
}) => {
  const fieldId = useId();
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const messageId = `${fieldId}-validation`;
  const startInputId = `${fieldId}-start`;
  const endInputId = `${fieldId}-end`;

  const resolvedDefault = useMemo(
    () => normalizeRange(defaultValue),
    [defaultValue]
  );

  const emissionValue = useMemo(
    () => (value ? normalizeRange(value) : undefined),
    [value]
  );

  const { shouldEmit, commit } = usePrimitiveEmission<ConfigNumberRangeValue>({
    configKey,
    value: emissionValue,
    defaultValue: resolvedDefault,
    onChange,
  });

  const [startDraft, setStartDraft] = useState<string>(() =>
    formatNumberInput(emissionValue?.start)
  );
  const [endDraft, setEndDraft] = useState<string>(() =>
    formatNumberInput(emissionValue?.end)
  );
  const [hasBlurred, setHasBlurred] = useState(false);

  const notifyValidationChange = useCallback(
    (result: RangeValidationResult) => {
      onValidationChange?.({
        valid: result.valid,
        message: result.message,
      });
    },
    [onValidationChange]
  );

  const evaluateRange = useCallback(
    ({ start, end }: DraftRangeInput): RangeValidationResult => {
      const parseNumeric = (raw: string) => {
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
          return { value: undefined, error: null } as const;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
          return { value: undefined, error: "Enter a valid number." } as const;
        }
        if (integerOnly && !Number.isInteger(parsed)) {
          return {
            value: undefined,
            error: "Enter an integer value.",
          } as const;
        }
        return { value: parsed, error: null } as const;
      };

      const startResult = parseNumeric(start);
      if (startResult.error) {
        return {
          valid: false,
          message: startResult.error,
          normalized: EMPTY_RANGE,
        };
      }

      const endResult = parseNumeric(end);
      if (endResult.error) {
        return {
          valid: false,
          message: endResult.error,
          normalized: EMPTY_RANGE,
        };
      }

      let normalizedStart = startResult.value;
      let normalizedEnd = endResult.value;

      const clamp = (
        input: number | undefined,
        limit: number,
        isMin: boolean
      ) => {
        if (input === undefined) return undefined;
        if (isMin ? input >= limit : input <= limit) {
          return input;
        }
        return clampToBounds ? limit : undefined;
      };

      if (normalizedStart !== undefined && min !== undefined) {
        const next = clamp(normalizedStart, min, true);
        if (next === undefined) {
          return {
            valid: false,
            message: `Start must be at least ${min}.`,
            normalized: EMPTY_RANGE,
          };
        }
        normalizedStart = next;
      }

      if (normalizedEnd !== undefined && min !== undefined) {
        const next = clamp(normalizedEnd, min, true);
        if (next === undefined) {
          return {
            valid: false,
            message: `End must be at least ${min}.`,
            normalized: EMPTY_RANGE,
          };
        }
        normalizedEnd = next;
      }

      if (normalizedStart !== undefined && max !== undefined) {
        const next = clamp(normalizedStart, max, false);
        if (next === undefined) {
          return {
            valid: false,
            message: `Start must be at most ${max}.`,
            normalized: EMPTY_RANGE,
          };
        }
        normalizedStart = next;
      }

      if (normalizedEnd !== undefined && max !== undefined) {
        const next = clamp(normalizedEnd, max, false);
        if (next === undefined) {
          return {
            valid: false,
            message: `End must be at most ${max}.`,
            normalized: EMPTY_RANGE,
          };
        }
        normalizedEnd = next;
      }

      const normalized = createRange(normalizedStart, normalizedEnd);

      const hasStart = normalizedStart !== undefined;
      const hasEnd = normalizedEnd !== undefined;

      if (required && (!hasStart || !hasEnd)) {
        return {
          valid: false,
          message: "Provide both start and end values.",
          normalized,
        };
      }

      if (!allowPartial && ((hasStart && !hasEnd) || (!hasStart && hasEnd))) {
        return {
          valid: false,
          message: "Provide both start and end values.",
          normalized,
        };
      }

      if (hasStart && hasEnd && normalizedStart! > normalizedEnd!) {
        return {
          valid: false,
          message: "Start must be less than or equal to end.",
          normalized,
        };
      }

      if (customValidator) {
        const message = customValidator(normalized);
        if (message) {
          return {
            valid: false,
            message,
            normalized,
          };
        }
      }

      return {
        valid: true,
        message: null,
        normalized,
      };
    },
    [
      allowPartial,
      clampToBounds,
      customValidator,
      integerOnly,
      max,
      min,
      required,
    ]
  );

  const initialValidation = useMemo(
    () =>
      evaluateRange({
        start: formatNumberInput(emissionValue?.start),
        end: formatNumberInput(emissionValue?.end),
      }),
    [emissionValue, evaluateRange]
  );

  const {
    state: validationState,
    validate,
    validateImmediate,
    reset,
  } = useValidation<DraftRangeInput, RangeValidationResult>({
    validator: evaluateRange,
    initialResult: initialValidation,
    debounceMs: validationMode === "change" ? debounceMs : 0,
    onValidationChange: notifyValidationChange,
  });

  const lastCommittedRef = useRef<ConfigNumberRangeValue | undefined>(
    emissionValue
  );

  useEffect(() => {
    lastCommittedRef.current = emissionValue;
  }, [emissionValue]);

  useEffect(() => {
    const nextStart = formatNumberInput(emissionValue?.start);
    const nextEnd = formatNumberInput(emissionValue?.end);
    setStartDraft(nextStart);
    setEndDraft(nextEnd);
    reset(
      evaluateRange({
        start: nextStart,
        end: nextEnd,
      })
    );
    setHasBlurred(false);
  }, [emissionValue, evaluateRange, reset]);

  useEffect(() => {
    if (!validationState.valid) {
      return;
    }

    const normalized = normalizeRange(validationState.normalized);
    const candidate =
      normalized.start === undefined && normalized.end === undefined
        ? undefined
        : normalized;

    if (rangesEqual(lastCommittedRef.current, candidate)) {
      return;
    }

    commit(candidate);
    lastCommittedRef.current = candidate;
  }, [validationState, commit]);

  const handleStartChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setStartDraft(nextValue);
      validate({ start: nextValue, end: endDraft });
    },
    [endDraft, validate]
  );

  const handleEndChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setEndDraft(nextValue);
      validate({ start: startDraft, end: nextValue });
    },
    [startDraft, validate]
  );

  const handleStartBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setHasBlurred(true);
      validateImmediate({ start: event.target.value, end: endDraft });
    },
    [endDraft, validateImmediate]
  );

  const handleEndBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setHasBlurred(true);
      validateImmediate({ start: startDraft, end: event.target.value });
    },
    [startDraft, validateImmediate]
  );

  const validationMessage =
    validationMode === "blur" && !hasBlurred ? null : validationState.message;

  const describedBy = buildDescribedBy(
    descriptionId,
    messageId,
    validationMessage
  );

  const containerClasses =
    layout === "inline"
      ? "flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4"
      : "flex flex-col gap-3";

  const fieldClasses = layout === "inline" ? "flex-1" : "flex flex-col gap-2";

  const baseInputClasses =
    "w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm " +
    "bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary " +
    "focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const resolvedStep: number | "any" = step ?? (integerOnly ? 1 : "any");
  const inputMode = integerOnly ? "numeric" : "decimal";

  return (
    <ConfigField
      label={label}
      labelFor={startInputId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={shouldEmit}
      required={required}
    >
      <div className={containerClasses}>
        <div className={clsx("flex flex-col gap-1", fieldClasses)}>
          <label
            htmlFor={startInputId}
            className="text-xs font-medium text-theme-text-secondary"
          >
            {startLabel}
          </label>
          <input
            id={startInputId}
            type="number"
            value={startDraft}
            onChange={handleStartChange}
            onBlur={handleStartBlur}
            placeholder={startPlaceholder}
            disabled={disabled}
            min={min}
            max={max}
            step={resolvedStep}
            inputMode={inputMode}
            aria-describedby={describedBy}
            aria-invalid={validationMessage ? true : undefined}
            className={clsx(baseInputClasses, inputClassName)}
          />
        </div>

        <div className={clsx("flex flex-col gap-1", fieldClasses)}>
          <label
            htmlFor={endInputId}
            className="text-xs font-medium text-theme-text-secondary"
          >
            {endLabel}
          </label>
          <input
            id={endInputId}
            type="number"
            value={endDraft}
            onChange={handleEndChange}
            onBlur={handleEndBlur}
            placeholder={endPlaceholder}
            disabled={disabled}
            min={min}
            max={max}
            step={resolvedStep}
            inputMode={inputMode}
            aria-describedby={describedBy}
            aria-invalid={validationMessage ? true : undefined}
            className={clsx(baseInputClasses, inputClassName)}
          />
        </div>
      </div>

      <ConfigValidationMessage
        id={messageId}
        state={validationMessage ? "error" : "info"}
        message={validationMessage}
      />
    </ConfigField>
  );
};
