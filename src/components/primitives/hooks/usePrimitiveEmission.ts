import { XMLEmissionMap } from "@domain/workflow/entities/workflow";
import { useCallback } from "react";
import { useXMLEmission } from "./useXMLEmission";

export interface UsePrimitiveEmissionOptions<T> {
  configKey: string;
  value: T | undefined;
  defaultValue: T;
  onChange: (
    value: T | undefined,
    emitPatch: XMLEmissionMap,
    shouldEmit: boolean
  ) => void;
}

export interface UsePrimitiveEmissionResult<T> {
  shouldEmit: boolean;
  commit: (candidate: T | undefined) => {
    shouldEmit: boolean;
    emittedValue: T | undefined;
    emitPatch: XMLEmissionMap;
  };
  evaluate: (candidate: T | undefined) => boolean;
  build: (shouldEmit: boolean) => XMLEmissionMap;
}

/**
 * Small helper that wraps useXMLEmission and produces a commit helper so
 * primitives can avoid repeating evaluate/build/onChange wiring.
 */
export function usePrimitiveEmission<T>({
  configKey,
  value,
  defaultValue,
  onChange,
}: UsePrimitiveEmissionOptions<T>): UsePrimitiveEmissionResult<T> {
  const { shouldEmit, evaluate, build } = useXMLEmission<T>({
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
