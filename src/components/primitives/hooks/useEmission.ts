import { EmissionMap } from "@domain/workflow/entities/workflow";
import { useCallback, useMemo } from "react";

type Path = string[];

export interface UseEmissionOptions<T> {
  configKey: string;
  value: T | undefined;
  defaultValue: T;
}

export interface UseEmissionResult<T> {
  shouldEmit: boolean;
  emitPatch: EmissionMap;
  build: (shouldEmit: boolean) => EmissionMap;
  evaluate: (candidate: T | undefined) => boolean;
}

const splitConfigKey = (configKey: string): Path =>
  configKey
    .split(".")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    for (const key of keysA) {
      if (
        !Object.prototype.hasOwnProperty.call(b, key) ||
        !deepEqual(a[key], b[key])
      ) {
        return false;
      }
    }
    return true;
  }

  return false;
};

const buildPatchFromPath = (
  path: Path,
  shouldEmit: boolean
): EmissionMap => {
  if (path.length === 0) {
    return {};
  }

  const head = path[0]!;
  const rest = path.slice(1);
  const result: EmissionMap = {};
  if (rest.length === 0) {
    result[head] = shouldEmit;
    return result;
  }

  result[head] = buildPatchFromPath(rest, shouldEmit);
  return result;
};

export const calculateShouldEmit = <T>(
  value: T | undefined,
  defaultValue: T
): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (defaultValue === undefined || defaultValue === null) {
    return true;
  }

  if (typeof value === "number" && typeof defaultValue === "number") {
    return !Object.is(value, defaultValue);
  }

  if (typeof value === "boolean" && typeof defaultValue === "boolean") {
    return value !== defaultValue;
  }

  if (typeof value === "string" && typeof defaultValue === "string") {
    return value !== defaultValue;
  }

  return !deepEqual(value, defaultValue);
};

export const buildEmitPatch = (
  configKey: string | Path,
  shouldEmit: boolean
): EmissionMap => {
  const path = Array.isArray(configKey) ? configKey : splitConfigKey(configKey);
  return buildPatchFromPath(path, shouldEmit);
};

export const mergeEmitPatch = (
  base: EmissionMap | undefined,
  patch: EmissionMap
): EmissionMap => {
  const result: EmissionMap = { ...(base ?? {}) };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === "boolean") {
      result[key] = value;
      continue;
    }

    if (isPlainObject(value)) {
      const existing = isPlainObject(result[key])
        ? (result[key] as EmissionMap)
        : undefined;
      result[key] = mergeEmitPatch(existing, value as EmissionMap);
    }
  }

  return result;
};

export const emissionMapsEqual = (
  a: EmissionMap | undefined,
  b: EmissionMap | undefined
): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return deepEqual(a, b);
};

export function useEmission<T>({
  configKey,
  value,
  defaultValue,
}: UseEmissionOptions<T>): UseEmissionResult<T> {
  const path = useMemo(() => splitConfigKey(configKey), [configKey]);

  const shouldEmit = useMemo(
    () => calculateShouldEmit(value, defaultValue),
    [value, defaultValue]
  );

  const build = useCallback(
    (emit: boolean) => buildPatchFromPath(path, emit),
    [path]
  );

  const emitPatch = useMemo(() => build(shouldEmit), [build, shouldEmit]);

  const evaluate = useCallback(
    (candidate: T | undefined) => calculateShouldEmit(candidate, defaultValue),
    [defaultValue]
  );

  return {
    shouldEmit,
    emitPatch,
    build,
    evaluate,
  };
}
