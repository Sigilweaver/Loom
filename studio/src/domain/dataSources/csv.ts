/**
 * Polars CSV Data Source Configuration
 *
 * Based on Polars Python API:
 * - polars.scan_csv (lazy evaluation)
 * - polars.read_csv (eager read)
 * - polars.read_csv_batched (batched reader)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.scan_csv.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_csv.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_csv_batched.html
 * https://sigilweaver.app/docs/user/tools/input-output/input/#csv
 */

import { PolarsDataType } from "../../data/polarsTypes";

// Re-export for consumers of this module
export type { PolarsDataType };

/**
 * CSV Reading Mode
 */
export type CSVMode = "scan" | "read" | "batched";

/**
 * Quote Character Options
 */
export type QuoteChar = '"' | "'" | null;

/**
 * Null Value Representation
 */
export type NullValues = string | string[] | Record<string, string>;

/**
 * Schema Definition (column name -> data type)
 */
export type Schema = Record<string, PolarsDataType>;

/**
 * Encoding Options
 */
export type Encoding =
  | "utf8"
  | "utf8-lossy"
  | "ascii"
  | "latin1"
  | "windows-1252"
  | "iso-8859-1";

/**
 * End-of-Line Character
 */
export type EOLChar = "\n" | "\r\n" | "\r";

/**
 * Comment Prefix
 */
export type CommentPrefix = string | null;

/**
 * Polars CSV Configuration
 * All parameters with their Polars defaults
 */
export interface PolarsCsvConfig {
  // === Mode Selection ===
  mode: CSVMode;

  // === File Path ===
  source: string; // File path or glob pattern

  // === Parsing Options ===
  separator: string; // Default: ','
  has_header: boolean; // Default: true
  columns: string[] | null; // Subset of columns to read (null = all)
  new_columns: string[] | null; // Rename columns after reading

  // === Data Types ===
  dtypes: Schema | null; // Override inferred types
  schema: Schema | null; // Explicit schema (no type inference)

  // === Rows ===
  skip_rows: number; // Skip n rows at start. Default: 0
  skip_rows_after_header: number; // Skip n rows after header. Default: 0
  n_rows: number | null; // Read only n rows (null = all)

  // === Inference ===
  infer_schema_length: number | null; // Rows for type inference (null = all)

  // === Batch Reading (batched mode only) ===
  batch_size: number | null; // Rows per batch (null = auto)

  // === Chunking (read mode only) ===
  n_threads: number | null; // Parallel parsing threads (null = auto)

  // === Memory Management (scan mode) ===
  rechunk: boolean; // Rechunk to contiguous memory. Default: false
  low_memory: boolean; // Reduce memory at cost of performance. Default: false

  // === String Handling ===
  quote_char: QuoteChar; // Quote character. Default: '"'
  eol_char: EOLChar; // End-of-line character. Default: '\n'
  encoding: Encoding; // File encoding. Default: 'utf8'

  // === Missing Values ===
  null_values: NullValues | null; // Strings to interpret as null
  missing_utf8_is_empty_string: boolean; // Treat missing as empty string. Default: false

  // === Error Handling ===
  ignore_errors: boolean; // Skip rows with errors. Default: false
  try_parse_dates: boolean; // Auto-parse date strings. Default: false

  // === Optimization ===
  cache: boolean; // Cache result (scan mode). Default: true
  with_column_names: ((names: string[]) => string[]) | null; // Transform column names

  // === Comments ===
  comment_prefix: CommentPrefix; // Skip lines starting with this. Default: null

  // === Row Index ===
  row_index_name: string | null; // Add row index column with this name
  row_index_offset: number; // Start row index at this value. Default: 0

  // === Advanced ===
  truncate_ragged_lines: boolean; // Truncate lines with too many values. Default: false
  decimal_comma: boolean; // Use comma as decimal separator. Default: false
}

/**
 * Default configuration for each CSV mode
 */
export const CSV_DEFAULTS: Record<CSVMode, Partial<PolarsCsvConfig>> = {
  scan: {
    mode: "scan",
    source: "",
    separator: ",",
    has_header: true,
    columns: null,
    new_columns: null,
    dtypes: null,
    schema: null,
    skip_rows: 0,
    skip_rows_after_header: 0,
    n_rows: null,
    infer_schema_length: 100,
    rechunk: false,
    low_memory: false,
    quote_char: '"',
    eol_char: "\n",
    encoding: "utf8",
    null_values: null,
    missing_utf8_is_empty_string: false,
    ignore_errors: false,
    try_parse_dates: false,
    cache: true,
    with_column_names: null,
    comment_prefix: null,
    row_index_name: null,
    row_index_offset: 0,
    truncate_ragged_lines: false,
    decimal_comma: false,
  },
  read: {
    mode: "read",
    source: "",
    separator: ",",
    has_header: true,
    columns: null,
    new_columns: null,
    dtypes: null,
    schema: null,
    skip_rows: 0,
    skip_rows_after_header: 0,
    n_rows: null,
    infer_schema_length: 100,
    n_threads: null,
    rechunk: true, // Different default for read mode
    quote_char: '"',
    eol_char: "\n",
    encoding: "utf8",
    null_values: null,
    missing_utf8_is_empty_string: false,
    ignore_errors: false,
    try_parse_dates: false,
    with_column_names: null,
    comment_prefix: null,
    row_index_name: null,
    row_index_offset: 0,
    truncate_ragged_lines: false,
    decimal_comma: false,
  },
  batched: {
    mode: "batched",
    source: "",
    separator: ",",
    has_header: true,
    columns: null,
    new_columns: null,
    dtypes: null,
    schema: null,
    skip_rows: 0,
    skip_rows_after_header: 0,
    infer_schema_length: 100,
    batch_size: null,
    rechunk: true,
    quote_char: '"',
    eol_char: "\n",
    encoding: "utf8",
    null_values: null,
    missing_utf8_is_empty_string: false,
    ignore_errors: false,
    try_parse_dates: false,
    with_column_names: null,
    comment_prefix: null,
    row_index_name: null,
    row_index_offset: 0,
    truncate_ragged_lines: false,
    decimal_comma: false,
  },
};

/**
 * Mode descriptions for UI
 */
export const CSV_MODE_INFO: Record<
  CSVMode,
  { name: string; description: string; useCase: string }
> = {
  scan: {
    name: "Scan (Lazy)",
    description: "Only loads data when needed - most efficient overall",
    useCase:
      "Best for: Large files, query optimization, when you need to filter/aggregate before loading",
  },
  read: {
    name: "Read (Eager)",
    description: "Loads entire CSV into memory immediately",
    useCase:
      "Best for: Small to medium files, when you need all data in memory",
  },
  batched: {
    name: "Batched Read",
    description: "Reads CSV in chunks/batches for memory-efficient processing",
    useCase:
      "Best for: Very large files that don't fit in memory, streaming workflows",
  },
};

export const CSV_DOCUMENTATION_URL = "https://sigilweaver.app/docs/user/tools/input-output/input/#csv";

/**
 * Common delimiter options
 */
export const COMMON_DELIMITERS = [
  { value: ",", label: "Comma (,)", description: "Standard CSV" },
  { value: "\t", label: "Tab (\\t)", description: "TSV files" },
  { value: "|", label: "Pipe (|)", description: "Log files" },
  { value: ";", label: "Semicolon (;)", description: "European CSV" },
  { value: " ", label: "Space", description: "Space-delimited" },
] as const;

/**
 * Common encoding options
 */
export const COMMON_ENCODINGS: {
  value: Encoding;
  label: string;
  description: string;
}[] = [
  {
    value: "utf8",
    label: "UTF-8",
    description: "Universal encoding (default)",
  },
  {
    value: "utf8-lossy",
    label: "UTF-8 (Lossy)",
    description: "UTF-8 with error recovery",
  },
  { value: "ascii", label: "ASCII", description: "7-bit ASCII" },
  {
    value: "latin1",
    label: "Latin-1 (ISO-8859-1)",
    description: "Western European",
  },
  {
    value: "windows-1252",
    label: "Windows-1252",
    description: "Windows Western European",
  },
];

/**
 * Get default configuration for a mode
 */
export function getDefaultConfig(mode: CSVMode): Partial<PolarsCsvConfig> {
  return { ...CSV_DEFAULTS[mode] };
}

/**
 * Validate CSV configuration
 */
export function validateCsvConfig(config: Partial<PolarsCsvConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: source
  if (!config.source || config.source.trim() === "") {
    errors.push("Source file path is required");
  }

  // Validate separator
  if (config.separator !== undefined && config.separator.length === 0) {
    errors.push("Separator cannot be empty");
  }

  // Validate skip_rows
  if (config.skip_rows !== undefined && config.skip_rows < 0) {
    errors.push("skip_rows must be >= 0");
  }

  // Validate skip_rows_after_header
  if (
    config.skip_rows_after_header !== undefined &&
    config.skip_rows_after_header < 0
  ) {
    errors.push("skip_rows_after_header must be >= 0");
  }

  // Validate n_rows
  if (
    config.n_rows !== null &&
    config.n_rows !== undefined &&
    config.n_rows <= 0
  ) {
    errors.push("n_rows must be > 0 or null");
  }

  // Validate batch_size (batched mode)
  if (
    config.mode === "batched" &&
    config.batch_size !== null &&
    config.batch_size !== undefined &&
    config.batch_size <= 0
  ) {
    errors.push("batch_size must be > 0 or null");
  }

  // Validate infer_schema_length
  if (
    config.infer_schema_length !== null &&
    config.infer_schema_length !== undefined &&
    config.infer_schema_length <= 0
  ) {
    errors.push("infer_schema_length must be > 0 or null");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deep equality check for configuration values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null
  ) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (
        !deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      )
        return false;
    }
    return true;
  }

  return false;
}

/**
 * Get mode-specific parameter names
 */
const MODE_SPECIFIC_PARAMS: Record<CSVMode, Set<string>> = {
  scan: new Set(["cache", "low_memory"]),
  read: new Set(["n_threads"]),
  batched: new Set(["batch_size"]),
};

/**
 * Check if a parameter is supported by a specific mode
 */
function isSupportedByMode(param: string, mode: CSVMode): boolean {
  // All modes support these core parameters
  const sharedParams = new Set([
    "mode",
    "source",
    "separator",
    "has_header",
    "columns",
    "new_columns",
    "dtypes",
    "schema",
    "skip_rows",
    "skip_rows_after_header",
    "n_rows",
    "infer_schema_length",
    "rechunk",
    "quote_char",
    "eol_char",
    "encoding",
    "null_values",
    "missing_utf8_is_empty_string",
    "ignore_errors",
    "try_parse_dates",
    "with_column_names",
    "comment_prefix",
    "row_index_name",
    "row_index_offset",
    "truncate_ragged_lines",
    "decimal_comma",
  ]);

  if (sharedParams.has(param)) return true;
  return MODE_SPECIFIC_PARAMS[mode].has(param);
}

/**
 * Switch CSV mode while preserving only non-default shared parameters
 *
 * @param currentConfig - Current CSV configuration
 * @param newMode - Target mode to switch to
 * @returns New configuration with mode-specific defaults and preserved customizations
 *
 * @example
 * const config = {
 *   mode: 'scan',
 *   separator: '|',  // custom
 *   skip_rows: 5,    // custom
 *   cache: true,     // default for scan
 * };
 *
 * const newConfig = switchCsvMode(config, 'read');
 * // Result: {
 * //   mode: 'read',
 * //   separator: '|',  // preserved (non-default)
 * //   skip_rows: 5,    // preserved (non-default)
 * //   rechunk: true,   // new default for read
 * //   n_threads: null, // new default for read
 * //   // cache removed (scan-specific)
 * // }
 */
export function switchCsvMode(
  currentConfig: Partial<PolarsCsvConfig>,
  newMode: CSVMode
): Partial<PolarsCsvConfig> {
  const currentMode = currentConfig.mode || "scan";
  const currentDefaults = CSV_DEFAULTS[currentMode];
  const newDefaults = CSV_DEFAULTS[newMode];

  // Start with new mode's defaults
  const newConfig: Partial<PolarsCsvConfig> = { ...newDefaults };

  // Preserve non-default shared parameters
  for (const key in currentConfig) {
    const typedKey = key as keyof PolarsCsvConfig;
    const currentValue = currentConfig[typedKey];
    const defaultValue = currentDefaults[typedKey];

    // Skip if it's the mode field itself
    if (key === "mode") continue;

    // Skip if value matches default (not customized)
    if (deepEqual(currentValue, defaultValue)) continue;

    // Only preserve if new mode supports this parameter
    if (isSupportedByMode(key, newMode)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newConfig as any)[typedKey] = currentValue;
    }
  }

  return newConfig;
}
