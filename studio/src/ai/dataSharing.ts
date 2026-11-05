/**
 * What workflow data the agent may send to the model provider.
 *
 * Column names, types and row/unique/null counts are always sent: the agent
 * cannot configure tools without them. Data values (sample rows, min/max,
 * mean, frequent values, query results) are sent only when the user turns on
 * "Share sample data" in Settings -> AI.
 */

import { useAIStore } from '@state/aiStore';
import type { ProfileColumn } from './format';

export const SAMPLE_DATA_WITHHELD =
  'Sample values withheld: "Share sample data with the AI provider" is off in Settings -> AI. ' +
  'Work from column names and types; ask the user for specific values if you need them.';

export function sampleDataAllowed(): boolean {
  return useAIStore.getState().shareSampleData;
}

/** Rows to send: all of them when sharing is on, none otherwise. */
export function shareableRows<T>(rows: T[]): T[] {
  return sampleDataAllowed() ? rows : [];
}

/** Profile columns without value statistics when sharing is off. */
export function shareableProfile(columns: ProfileColumn[]): ProfileColumn[] {
  if (sampleDataAllowed()) return columns;
  return columns.map(({ name, dtype, count, nulls, null_pct, unique }) => ({ name, dtype, count, nulls, null_pct, unique }));
}

/**
 * Best-effort removal of data values that Server errors quote, such as
 * Polars cast failures ("... failed for 3 out of 891 values: ["abc", ...]")
 * or parse errors ("could not parse `abc` as dtype `i64`"). Column names,
 * dtypes and tool names are kept so the error stays actionable.
 */
export function redactErrorValues(text: string): string {
  return text
    .replace(/\b(values?(?:\(s\))?)(:?\s*)\[[^\]]*\]/gi, '$1$2[values withheld]')
    .replace(/\b(value|got|found|literal)(\s*[:=]?\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi, '$1$2<value withheld>')
    .replace(/\b(could not parse)\s+`[^`]*`/gi, '$1 <value withheld>');
}

const ERROR_LINE = /error|fail|could not|invalid|cannot|unable/i;

/**
 * Apply {@link redactErrorValues} to a tool result's error text when sample
 * data sharing is off: the `error` field and any error-looking line of a
 * compact `data` result.
 */
export function shareableToolResult(result: unknown): unknown {
  if (sampleDataAllowed() || result == null || typeof result !== 'object') return result;
  const r = { ...(result as Record<string, unknown>) };
  if (typeof r.error === 'string') r.error = redactErrorValues(r.error);
  if (typeof r.data === 'string') {
    r.data = r.data.split('\n').map((line) => (ERROR_LINE.test(line) ? redactErrorValues(line) : line)).join('\n');
  }
  return r;
}
