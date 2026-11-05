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
