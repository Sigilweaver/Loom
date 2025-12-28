import { useCallback, useEffect, useRef, useState } from "react";

export interface ValidationResult {
  valid: boolean;
  message: string | null;
}

export interface UseValidationOptions<T, R extends ValidationResult> {
  validator: (value: T) => R;
  initialResult: R;
  debounceMs?: number;
  onValidationChange?: (result: R) => void;
}

export interface UseValidationResult<T, R extends ValidationResult> {
  state: R;
  validate: (value: T) => void;
  validateImmediate: (value: T) => R;
  reset: (result: R) => void;
  cancel: () => void;
}

/**
 * Debounce-aware validation helper that centralises result state and change notifications.
 */
export function useValidation<T, R extends ValidationResult>({
  validator,
  initialResult,
  debounceMs = 0,
  onValidationChange,
}: UseValidationOptions<T, R>): UseValidationResult<T, R> {
  const [state, setState] = useState<R>(initialResult);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResultRef = useRef<R>(initialResult);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const emitResult = useCallback(
    (result: R) => {
      lastResultRef.current = result;
      setState(result);
      onValidationChange?.(result);
    },
    [onValidationChange]
  );

  const runValidation = useCallback(
    (value: T, immediate: boolean) => {
      const execute = () => {
        const result = validator(value);
        emitResult(result);
        return result;
      };

      if (immediate || debounceMs <= 0) {
        cancel();
        return execute();
      }

      cancel();
      timeoutRef.current = setTimeout(execute, debounceMs);
      return lastResultRef.current;
    },
    [validator, debounceMs, emitResult, cancel]
  );

  const validate = useCallback(
    (value: T) => {
      runValidation(value, false);
    },
    [runValidation]
  );

  const validateImmediate = useCallback(
    (value: T) => runValidation(value, true),
    [runValidation]
  );

  const reset = useCallback(
    (result: R) => {
      cancel();
      emitResult(result);
    },
    [cancel, emitResult]
  );

  useEffect(() => () => cancel(), [cancel]);

  return {
    state,
    validate,
    validateImmediate,
    reset,
    cancel,
  };
}
