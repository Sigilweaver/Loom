import { EmissionMap } from "@domain/workflow/entities/workflow";
import { useCallback } from "react";
import { useEmission } from "./useEmission";

export interface UsePrimitiveEmissionOptions<T> {
  configKey: string;
  value: T | undefined;
  defaultValue: T;
  onChange: (
    value: T | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
}

export interface UsePrimitiveEmissionResult<T> {
  shouldEmit: boolean;
  commit: (candidate: T | undefined) => {
    shouldEmit: boolean;
    emittedValue: T | undefined;
    emitPatch: EmissionMap;
  };
  evaluate: (candidate: T | undefined) => boolean;
  build: (shouldEmit: boolean) => EmissionMap;
}

/**
 * Small helper that wraps useEmission and produces a commit helper so
 * primitives can avoid repeating evaluate/build/onChange wiring.
 */
export function usePrimitiveEmission<T>({
  configKey,
  value,
  defaultValue,
  onChange,
}: UsePrimitiveEmissionOptions<T>): UsePrimitiveEmissionResult<T> {
  const { shouldEmit, evaluate, build } = useEmission<T>({
    configKey,
    value,
    defaultValue,
  });

  const commit = useCallback(
    (candidate: T | undefined) => {
      const nextShouldEmit = evaluate(candidate);
      const emitPatch = build(nextShouldEmit);
      const emittedValue = nextShouldEmit ? candidate : undefined;
      onChange(emittedValue, emitPatch, nextShouldEmit);
      return {
        shouldEmit: nextShouldEmit,
        emittedValue,
        emitPatch,
      };
    },
    [evaluate, build, onChange]
  );

  return {
    shouldEmit,
    commit,
    evaluate,
    build,
  };
}
