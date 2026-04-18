/**
 * Typed helpers for transferring fields between partial data-source config
 * objects of the same shape (e.g. when switching between CSV scan/read
 * modes). These replace the `(target as any)[key] = ...` pattern that was
 * previously duplicated across every data-source module.
 */

/**
 * Copy `source[key]` onto `target[key]` when the source value is defined.
 * The generic constraint preserves key-value type alignment, so TypeScript
 * keeps us honest without requiring an `any` cast.
 */
export function copyConfigField<T, K extends keyof T>(
  target: Partial<T>,
  source: Partial<T>,
  key: K,
): void {
  const value = source[key];
  if (value !== undefined) {
    target[key] = value;
  }
}

/**
 * Assign a value onto `target[key]` when the value is defined.
 */
export function setConfigField<T, K extends keyof T>(
  target: Partial<T>,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
