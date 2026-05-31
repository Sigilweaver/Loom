/**
 * Config path utilities
 *
 * Small pure helpers for applying field-level patches to a tool config by
 * path, so the AI agent can amend a single nested field without resending
 * the entire config object. Supports dot and bracket notation:
 *   "conditions.0.value"  ===  "conditions[0].value"
 */

export type PathSegment = string | number;

/**
 * Parse a config path string into segments.
 * Bracket indices (`[0]`) are normalized to dotted form, numeric segments
 * are returned as numbers (array indices), and empty segments are dropped.
 */
export function parseConfigPath(path: string): PathSegment[] {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized
    .split('.')
    .filter((seg) => seg.length > 0)
    .map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg));
}

/**
 * Set a value at the given path, creating intermediate containers as needed.
 * A numeric next-segment creates an array; otherwise an object. Mutates `target`.
 */
export function setConfigPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = parseConfigPath(path);
  if (segments.length === 0) throw new Error('Empty path');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const next = segments[i + 1]!;
    if (cursor[seg] === undefined || cursor[seg] === null) {
      cursor[seg] = typeof next === 'number' ? [] : {};
    }
    cursor = cursor[seg];
    if (typeof cursor !== 'object' || cursor === null) {
      throw new Error(`Cannot descend into non-object at "${String(seg)}"`);
    }
  }
  cursor[segments[segments.length - 1]!] = value;
}

/**
 * Remove the value at the given path. Array elements are spliced out;
 * object keys are deleted. No-ops if the path does not exist. Mutates `target`.
 */
export function removeConfigPath(target: Record<string, unknown>, path: string): void {
  const segments = parseConfigPath(path);
  if (segments.length === 0) throw new Error('Empty path');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (cursor == null || typeof cursor !== 'object') return;
    cursor = cursor[seg];
  }
  if (cursor == null || typeof cursor !== 'object') return;

  const last = segments[segments.length - 1]!;
  if (Array.isArray(cursor) && typeof last === 'number') {
    cursor.splice(last, 1);
  } else {
    delete cursor[last];
  }
}
