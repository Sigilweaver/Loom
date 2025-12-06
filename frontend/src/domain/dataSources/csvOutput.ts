/**
 * Polars CSV Output Configuration
 *
 * Based on Polars Python API:
 * - polars.LazyFrame.sink_csv (streaming write)
 * - polars.DataFrame.write_csv (eager write)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_csv.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.LazyFrame.sink_csv.html
 * https://docs.sigilweaver.app/user/tools/input-output/output/#csv
 */

/**
 * CSV Output Mode
 */
export type CSVOutputMode = "sink" | "write";

/**
 * Quote Style Options
 */
export type QuoteStyle = "necessary" | "always" | "non_numeric" | "never";

/**
 * Polars CSV Output Configuration
 * Common parameters between sink_csv and write_csv
 */
export interface PolarsCsvOutputConfig {
  // === Mode Selection ===
  csvMode: CSVOutputMode;

  // === Output Type ===
  type: "csv";
  category: "file";

  // === File Path ===
  destination: string; // Output file path

  // === Common Parameters (both sink_csv and write_csv) ===
  include_bom: boolean; // Include UTF-8 BOM. Default: false
  include_header: boolean; // Include column names as header. Default: true
  separator: string; // Column separator. Default: ','
  line_terminator: string; // Line terminator. Default: '\n'
  quote_char: string; // Quote character. Default: '"'
  batch_size: number; // Rows per batch. Default: 1024
  datetime_format: string | null; // Format string for datetime. Default: null
  date_format: string | null; // Format string for date. Default: null
  time_format: string | null; // Format string for time. Default: null
  float_scientific: boolean | null; // Use scientific notation for floats. Default: null
  float_precision: number | null; // Decimal places for floats. Default: null
  null_value: string; // String to represent null values. Default: ''
  quote_style: QuoteStyle; // When to use quotes. Default: 'necessary'
}

/**
 * Default configuration for CSV sink mode (streaming)
 */
export const DEFAULT_CSV_SINK_CONFIG: Partial<PolarsCsvOutputConfig> = {
  csvMode: "sink",
  type: "csv",
  category: "file",
  include_bom: false,
  include_header: true,
  separator: ",",
  line_terminator: "\n",
  quote_char: '"',
  batch_size: 1024,
  datetime_format: null,
  date_format: null,
  time_format: null,
  float_scientific: null,
  float_precision: null,
  null_value: "",
  quote_style: "necessary",
};

/**
 * Default configuration for CSV write mode (eager)
 */
export const DEFAULT_CSV_WRITE_CONFIG: Partial<PolarsCsvOutputConfig> = {
  ...DEFAULT_CSV_SINK_CONFIG,
  csvMode: "write",
};

/**
 * Get default config for a specific output mode
 */
export function getDefaultOutputConfig(
  mode: CSVOutputMode
): Partial<PolarsCsvOutputConfig> {
  switch (mode) {
    case "sink":
      return { ...DEFAULT_CSV_SINK_CONFIG };
    case "write":
      return { ...DEFAULT_CSV_WRITE_CONFIG };
    default:
      return { ...DEFAULT_CSV_SINK_CONFIG };
  }
}

/**
 * Switch between CSV output modes, preserving only common parameters
 */
export function switchCsvOutputMode(
  currentConfig: Partial<PolarsCsvOutputConfig>,
  newMode: CSVOutputMode
): Partial<PolarsCsvOutputConfig> {
  const baseConfig = getDefaultOutputConfig(newMode);

  // Common parameters that should be preserved across mode switches
  const commonParams: (keyof PolarsCsvOutputConfig)[] = [
    "destination",
    "include_bom",
    "include_header",
    "separator",
    "line_terminator",
    "quote_char",
    "batch_size",
    "datetime_format",
    "date_format",
    "time_format",
    "float_scientific",
    "float_precision",
    "null_value",
    "quote_style",
  ];

  // Preserve common parameters from current config
  const preservedConfig: Partial<PolarsCsvOutputConfig> = {};
  for (const param of commonParams) {
    if (param in currentConfig && currentConfig[param] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (preservedConfig as any)[param] = currentConfig[param];
    }
  }

  return {
    ...baseConfig,
    ...preservedConfig,
    csvMode: newMode,
  };
}

/**
 * Mode descriptions for UI
 */
export const CSV_OUTPUT_MODE_INFO: Record<
  CSVOutputMode,
  { label: string; description: string; badge: string }
> = {
  sink: {
    label: "Sink (Streaming)",
    description:
      "Streams data to disk without loading into memory. Most efficient for large datasets.",
    badge: "Recommended",
  },
  write: {
    label: "Write (Eager)",
    description:
      "Collects all data into memory before writing. Use when you need to write after collecting.",
    badge: "Eager",
  },
};

/**
 * Common separator options
 */
export const COMMON_SEPARATORS: Array<{ value: string; label: string }> = [
  { value: ",", label: "Comma (,)" },
  { value: "\t", label: "Tab (\\t)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "|", label: "Pipe (|)" },
  { value: " ", label: "Space" },
];

/**
 * Common line terminator options
 */
export const COMMON_LINE_TERMINATORS: Array<{ value: string; label: string }> =
  [
    { value: "\n", label: "LF (\\n) - Unix/Linux" },
    { value: "\r\n", label: "CRLF (\\r\\n) - Windows" },
    { value: "\r", label: "CR (\\r) - Old Mac" },
  ];

/**
 * Quote style options
 */
export const QUOTE_STYLE_OPTIONS: Array<{ value: QuoteStyle; label: string }> =
  [
    { value: "necessary", label: "Necessary (only when needed)" },
    { value: "always", label: "Always (all fields)" },
    { value: "non_numeric", label: "Non-numeric only" },
    { value: "never", label: "Never" },
  ];
