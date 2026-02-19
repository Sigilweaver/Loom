/**
 * Compact Formatting Utilities for AI Agent
 *
 * Converts data structures (preview rows, schemas, profiles) into
 * token-efficient text formats for the LLM. JSON is extremely wasteful
 * for tabular data — column names are repeated per row, null keys are
 * included, and verbose nesting burns tokens.
 *
 * Conventions:
 *   - Rows: CSV with typed header (ColName:Type, ? suffix = nullable)
 *   - Profiles: one line per column with inline stats
 *   - Errors: plain text
 */

import type { ColumnSchema } from '@api/backend';

// ---------------------------------------------------------------------------
// Type abbreviations — keep header short
// ---------------------------------------------------------------------------

const DTYPE_SHORT: Record<string, string> = {
  Int8: 'i8', Int16: 'i16', Int32: 'i32', Int64: 'i64',
  UInt8: 'u8', UInt16: 'u16', UInt32: 'u32', UInt64: 'u64',
  Float32: 'f32', Float64: 'f64',
  Boolean: 'bool',
  String: 'str', Utf8: 'str',
  Date: 'date', Datetime: 'datetime', Time: 'time', Duration: 'duration',
  Null: 'null', Binary: 'bin', Categorical: 'cat',
  Object: 'obj',
};

function shortDtype(dtype: string): string {
  return DTYPE_SHORT[dtype] ?? dtype.toLowerCase();
}

// ---------------------------------------------------------------------------
// CSV formatting
// ---------------------------------------------------------------------------

/**
 * Format a typed CSV header from schema columns.
 * Example: "PassengerId:i64,Name:str,Age:f64?,Cabin:str?"
 */
function formatTypedHeader(schema: ColumnSchema[]): string {
  return schema
    .map((c) => `${c.name}:${shortDtype(c.dtype)}${c.nullable ? '?' : ''}`)
    .join(',');
}

/**
 * Escape a value for CSV. Wraps in quotes if the value contains commas,
 * quotes, or newlines.
 */
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Format an array of row objects as CSV text with a typed header.
 *
 * @param rows - Array of row objects (key-value pairs)
 * @param schema - Column schema for header typing
 * @param rowCount - Total row count (may exceed rows.length)
 * @returns Compact CSV string
 */
export function formatRowsAsCSV(
  rows: Record<string, unknown>[],
  schema: ColumnSchema[],
  rowCount: number,
): string {
  if (rows.length === 0) {
    return `(empty — 0 rows)\nSchema: ${formatTypedHeader(schema)}`;
  }

  const colNames = schema.map((c) => c.name);
  const header = formatTypedHeader(schema);
  const dataLines = rows.map((row) =>
    colNames.map((col) => {
      const val = row[col];
      // Round floats to 4 decimal places to save tokens
      if (typeof val === 'number' && !Number.isInteger(val)) {
        return String(Math.round(val * 10000) / 10000);
      }
      return csvEscape(val);
    }).join(','),
  );

  const parts = [header, ...dataLines];
  if (rowCount > rows.length) {
    parts.push(`... (${rowCount} rows total, showing ${rows.length})`);
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Preview result formatting
// ---------------------------------------------------------------------------

/**
 * Format a preview result (rows + schema + rowCount) into compact text.
 * Used by `preview_tool_output` and inline previews in `add_tool`.
 */
export function formatPreviewResult(
  rows: Record<string, unknown>[],
  schema: ColumnSchema[],
  rowCount: number,
): string {
  return formatRowsAsCSV(rows, schema, rowCount);
}

/**
 * Format a compact execution status for `add_tool` inline preview.
 * Returns status line + optional CSV data.
 */
export function formatAddToolResult(
  toolId: string,
  type: string,
  connected: boolean,
  preview?: { rows: Record<string, unknown>[]; schema: ColumnSchema[]; rowCount: number },
  warning?: string,
): string {
  const parts: string[] = [];
  parts.push(`Added ${type} [${toolId}]${connected ? ', connected' : ''}`);
  if (warning) parts.push(`Warning: ${warning}`);

  if (preview && preview.rows.length > 0) {
    parts.push(`Output (${preview.rowCount} rows, ${preview.schema.length} cols):`);
    parts.push(formatPreviewResult(preview.rows, preview.schema, preview.rowCount));
  } else if (preview && preview.schema.length > 0) {
    parts.push(`Output: ${preview.rowCount} rows, schema: ${formatTypedHeader(preview.schema)}`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Profile formatting
// ---------------------------------------------------------------------------

export interface ProfileColumn {
  name: string;
  dtype: string;
  count?: number | undefined;
  nulls?: number | undefined;
  null_pct?: number | undefined;
  unique?: number | undefined;
  min?: unknown;
  max?: unknown;
  mean?: number | undefined;
  top_values?: Array<{ value: string; count: number }> | undefined;
}

/**
 * Format a compact data profile in text form.
 * One line per column with salient stats inline.
 *
 * Example output:
 *   891 rows, 12 cols
 *   PassengerId:i64 [1..891, 891 unique]
 *   Age:f64? [0.42..80, mean=29.7, 177 nulls (19.9%)]
 *   Sex:str [2 unique: "male"(577), "female"(314)]
 */
export function formatCompactProfile(
  rowCount: number,
  columnCount: number,
  columns: ProfileColumn[],
): string {
  const lines: string[] = [];
  lines.push(`${rowCount} rows, ${columnCount} cols`);

  for (const col of columns) {
    const dtype = shortDtype(col.dtype);
    const nullable = (col.nulls != null && col.nulls > 0) ? '?' : '';
    const parts: string[] = [];

    // Range for numeric types
    if (col.min != null && col.max != null) {
      parts.push(`${col.min}..${col.max}`);
    }

    // Mean for numeric
    if (col.mean != null) {
      parts.push(`mean=${col.mean}`);
    }

    // Unique count
    if (col.unique != null) {
      parts.push(`${col.unique} unique`);
    }

    // Nulls
    if (col.nulls != null && col.nulls > 0) {
      const pct = col.null_pct != null ? ` (${col.null_pct}%)` : '';
      parts.push(`${col.nulls} nulls${pct}`);
    }

    // Top values for string/categorical columns (show after unique count)
    if (col.top_values && col.top_values.length > 0) {
      // If few unique values, show all top values inline
      const tvs = col.top_values.slice(0, 5)
        .map((tv) => `"${tv.value}"(${tv.count})`)
        .join(', ');
      // Replace "N unique" with "N unique: values" if we have top values
      const uniqueIdx = parts.findIndex((p) => p.endsWith('unique'));
      if (uniqueIdx >= 0) {
        parts[uniqueIdx] = `${parts[uniqueIdx]}: ${tvs}`;
      } else {
        parts.push(tvs);
      }
    }

    const statsStr = parts.length > 0 ? ` [${parts.join(', ')}]` : '';
    lines.push(`${col.name}:${dtype}${nullable}${statsStr}`);
  }

  return lines.join('\n');
}
