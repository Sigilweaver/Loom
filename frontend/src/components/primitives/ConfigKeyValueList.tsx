import { EmissionMap } from "@domain/workflow/entities/workflow";
import clsx from "clsx";
import React, {
  ChangeEvent,
  ReactNode,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { ConfigField } from "./ConfigField";
import { ConfigValidationMessage } from "./ConfigValidationMessage";
import { usePrimitiveEmission } from "./hooks";

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface ConfigKeyValueListProps {
  value: KeyValuePair[] | undefined;
  onChange: (
    value: KeyValuePair[] | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  defaultValue?: KeyValuePair[];
  disabled?: boolean;
  required?: boolean;
  keyLabel?: string;
  valueLabel?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  allowDuplicateKeys?: boolean;
  allowEmptyKeys?: boolean;
  allowEmptyValues?: boolean;
  minPairs?: number;
  maxPairs?: number;
  className?: string;
}

const EMPTY_ARRAY: readonly KeyValuePair[] = Object.freeze([]);

const generateId = (() => {
  let counter = 0;
  return () => `pair-${Date.now()}-${counter++}`;
})();

interface InternalPair extends KeyValuePair {
  _id: string;
}

const normalizePairs = (
  pairs: KeyValuePair[] | undefined
): KeyValuePair[] | undefined => {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return undefined;
  }
  return pairs;
};

export const ConfigKeyValueList: React.FC<ConfigKeyValueListProps> = ({
  value,
  onChange,
  configKey,
  label = "Key-Value Pairs",
  description,
  inlineMessage,
  defaultValue = EMPTY_ARRAY as KeyValuePair[],
  disabled = false,
  required = false,
  keyLabel = "Key",
  valueLabel = "Value",
  keyPlaceholder = "Enter key...",
  valuePlaceholder = "Enter value...",
  allowDuplicateKeys = false,
  allowEmptyKeys = false,
  allowEmptyValues = true,
  minPairs = 0,
  maxPairs,
  className,
}) => {
  const fieldId = useId();
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const messageId = `${fieldId}-validation`;

  const normalizedValue = useMemo(() => normalizePairs(value), [value]);
  const resolvedDefault = useMemo(
    () =>
      Array.isArray(defaultValue) && defaultValue.length > 0
        ? defaultValue
        : ([] as KeyValuePair[]),
    [defaultValue]
  );

  const { shouldEmit, commit } = usePrimitiveEmission<KeyValuePair[]>({
    configKey,
    value: normalizedValue,
    defaultValue: resolvedDefault,
    onChange,
  });

  // Internal state with IDs for React keys
  const [internalPairs, setInternalPairs] = useState<InternalPair[]>(() => {
    const initial = normalizedValue ?? [];
    return initial.map((pair) => ({ ...pair, _id: generateId() }));
  });

  // Sync internal state when value changes externally
  useMemo(() => {
    const current = normalizedValue ?? [];
    if (current.length !== internalPairs.length) {
      setInternalPairs(current.map((pair) => ({ ...pair, _id: generateId() })));
      return;
    }
    // Check if content changed
    const changed = current.some((pair, i) => {
      const internal = internalPairs[i];
      if (!internal) return true;
      return internal.key !== pair.key || internal.value !== pair.value;
    });
    if (changed) {
      setInternalPairs(current.map((pair) => ({ ...pair, _id: generateId() })));
    }
  }, [normalizedValue, internalPairs]);

  const validatePairs = useCallback(
    (pairs: InternalPair[]): string | null => {
      if (required && pairs.length === 0) {
        return "At least one pair is required.";
      }

      if (minPairs > 0 && pairs.length < minPairs) {
        return `At least ${minPairs} pair${minPairs === 1 ? "" : "s"} required.`;
      }

      if (maxPairs && pairs.length > maxPairs) {
        return `At most ${maxPairs} pair${maxPairs === 1 ? "" : "s"} allowed.`;
      }

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (!pair) continue;
        if (!allowEmptyKeys && pair.key.trim().length === 0) {
          return `Row ${i + 1}: Key cannot be empty.`;
        }
        if (!allowEmptyValues && pair.value.trim().length === 0) {
          return `Row ${i + 1}: Value cannot be empty.`;
        }
      }

      if (!allowDuplicateKeys) {
        const keys = pairs.map((p) => p.key.trim()).filter((k) => k.length > 0);
        const duplicates = keys.filter(
          (key, index) => keys.indexOf(key) !== index
        );
        if (duplicates.length > 0) {
          return `Duplicate key: "${duplicates[0]}"`;
        }
      }

      return null;
    },
    [
      required,
      minPairs,
      maxPairs,
      allowEmptyKeys,
      allowEmptyValues,
      allowDuplicateKeys,
    ]
  );

  const validationMessage = useMemo(
    () => validatePairs(internalPairs),
    [internalPairs, validatePairs]
  );

  const commitPairs = useCallback(
    (pairs: InternalPair[]) => {
      setInternalPairs(pairs);
      const error = validatePairs(pairs);
      if (error) {
        // Don't commit invalid state
        return;
      }
      const normalized = pairs.map(({ key, value }) => ({ key, value }));
      commit(normalized.length > 0 ? normalized : undefined);
    },
    [validatePairs, commit]
  );

  const handleAddPair = useCallback(() => {
    if (disabled) return;
    if (maxPairs && internalPairs.length >= maxPairs) return;

    const newPair: InternalPair = { key: "", value: "", _id: generateId() };
    commitPairs([...internalPairs, newPair]);
  }, [internalPairs, disabled, maxPairs, commitPairs]);

  const handleRemovePair = useCallback(
    (id: string) => {
      if (disabled) return;
      const filtered = internalPairs.filter((pair) => pair._id !== id);
      commitPairs(filtered);
    },
    [internalPairs, disabled, commitPairs]
  );

  const handleUpdatePair = useCallback(
    (id: string, field: "key" | "value", newValue: string) => {
      if (disabled) return;
      const updated = internalPairs.map((pair) =>
        pair._id === id ? { ...pair, [field]: newValue } : pair
      );
      commitPairs(updated);
    },
    [internalPairs, disabled, commitPairs]
  );

  const handleClearAll = useCallback(() => {
    if (disabled) return;
    commitPairs([]);
  }, [disabled, commitPairs]);

  const canAddMore = !maxPairs || internalPairs.length < maxPairs;
  const canRemove = !required || internalPairs.length > minPairs;

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

  return (
    <ConfigField
      label={label}
      labelFor={fieldId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={shouldEmit}
      required={required}
      className={className}
      contentClassName="space-y-3"
    >
      <div className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-theme-text-secondary">
          <div>{keyLabel}</div>
          <div>{valueLabel}</div>
          <div className="w-8" />
        </div>

        {/* Pairs */}
        {internalPairs.length > 0 ? (
          <div className="space-y-2" aria-describedby={describedBy}>
            {internalPairs.map((pair, index) => (
              <div
                key={pair._id}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start"
              >
                <input
                  type="text"
                  value={pair.key}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleUpdatePair(pair._id, "key", e.target.value)
                  }
                  placeholder={keyPlaceholder}
                  disabled={disabled}
                  aria-label={`${keyLabel} ${index + 1}`}
                  className={clsx(
                    "px-2 py-1.5 text-sm border rounded",
                    "border-theme-border-primary bg-theme-surface-elevated",
                    "text-theme-text-primary placeholder-theme-text-tertiary",
                    "focus:outline-none focus:ring-1 focus:ring-theme-border-focus",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                />
                <input
                  type="text"
                  value={pair.value}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleUpdatePair(pair._id, "value", e.target.value)
                  }
                  placeholder={valuePlaceholder}
                  disabled={disabled}
                  aria-label={`${valueLabel} ${index + 1}`}
                  className={clsx(
                    "px-2 py-1.5 text-sm border rounded",
                    "border-theme-border-primary bg-theme-surface-elevated",
                    "text-theme-text-primary placeholder-theme-text-tertiary",
                    "focus:outline-none focus:ring-1 focus:ring-theme-border-focus",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                />
                <button
                  type="button"
                  onClick={() => handleRemovePair(pair._id)}
                  disabled={disabled || !canRemove}
                  aria-label={`Remove pair ${index + 1}`}
                  className={clsx(
                    "w-8 h-8 flex items-center justify-center text-sm rounded",
                    "border border-theme-border-primary",
                    "text-theme-text-secondary hover:text-theme-status-error",
                    "hover:bg-theme-surface-hover transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-theme-text-secondary"
                  )}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-sm text-center text-theme-text-tertiary border border-dashed rounded border-theme-border-primary">
            No pairs added yet
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddPair}
            disabled={disabled || !canAddMore}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded",
              "border border-theme-border-primary",
              "bg-theme-surface-panel text-theme-text-primary",
              "hover:bg-theme-surface-elevated transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            + Add Pair
          </button>
          {internalPairs.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={disabled || !canRemove}
              className={clsx(
                "px-3 py-1.5 text-sm rounded",
                "border border-theme-border-primary",
                "text-theme-text-secondary hover:text-theme-status-error",
                "hover:bg-theme-surface-hover transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Clear All
            </button>
          )}
        </div>

        {maxPairs && (
          <div className="text-xs text-theme-text-tertiary">
            {internalPairs.length} / {maxPairs} pairs
          </div>
        )}
      </div>

      <ConfigValidationMessage
        id={messageId}
        state={validationMessage ? "error" : "info"}
        message={validationMessage}
      />
    </ConfigField>
  );
};
