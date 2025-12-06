/**
 * Polars JSON/NDJSON Data Source Configuration
 *
 * Supports two JSON formats:
 * - Standard JSON (.json): Array of objects, eager read only via pl.read_json
 * - NDJSON (.jsonl, .ndjson): Newline-delimited JSON, supports lazy scan via pl.scan_ndjson
 *
 * Based on Polars Python API:
 * - polars.read_json (eager, standard JSON)
 * - polars.scan_ndjson (lazy, NDJSON)
 * - polars.read_ndjson (eager, NDJSON)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_json.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.scan_ndjson.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_ndjson.html
 * https://docs.sigilweaver.app/user/tools/input-output/input/#json
 */

/**
 * JSON Reading Mode
 *
 * - "scan": Lazy evaluation (NDJSON only) - most efficient for large files
 * - "read": Eager evaluation - loads entire file into memory
 *
 * Note: Standard JSON (.json) only supports "read" mode (no lazy scan available)
 */
export type JSONMode = "scan" | "read";

/**
 * JSON Format Type
 *
 * Auto-detected based on file extension:
 * - "json": Standard JSON array of objects (.json)
 * - "ndjson": Newline-delimited JSON (.jsonl, .ndjson)
 */
export type JSONFormat = "json" | "ndjson";

/**
 * NDJSON file extensions
 */
export const NDJSON_EXTENSIONS = [".jsonl", ".ndjson"];

/**
 * Standard JSON file extensions
 */
export const JSON_EXTENSIONS = [".json"];

/**
 * Polars JSON Configuration (for standard JSON)
 * Limited options - no lazy support
 */
export interface PolarsJsonConfig {
  // === File Path ===
  source: string; // File path

  // === Schema Inference ===
  infer_schema_length: number | null; // Max rows for schema inference (null = all). Default: 100
}

/**
 * Polars NDJSON Configuration
 * Full options including lazy scan support
 */
export interface PolarsNdjsonConfig {
  // === Mode Selection ===
  mode: JSONMode;

  // === File Path ===
  source: string; // File path

  // === Schema Inference ===
  infer_schema_length: number | null; // Max rows for schema inference (null = all). Default: 100

  // === Row Selection ===
  n_rows: number | null; // Read only n rows (null = all)

  // === Row Index ===
  row_index_name: string | null; // Add row index column with this name
  row_index_offset: number; // Start row index at this value. Default: 0

  // === Performance ===
  batch_size: number | null; // Rows per batch. Default: 1024
  low_memory: boolean; // Reduce memory at cost of performance. Default: false
  rechunk: boolean; // Rechunk to contiguous memory. Default: false

  // === Error Handling ===
  ignore_errors: boolean; // Return null on schema mismatch errors. Default: false
}

/**
 * Default configuration for standard JSON
 */
export const JSON_DEFAULTS: Partial<PolarsJsonConfig> = {
  source: "",
  infer_schema_length: 100,
};

/**
 * Default configuration for NDJSON in each mode
 */
export const NDJSON_DEFAULTS: Record<JSONMode, Partial<PolarsNdjsonConfig>> = {
  scan: {
    mode: "scan",
    source: "",
    infer_schema_length: 100,
    n_rows: null,
    row_index_name: null,
    row_index_offset: 0,
    batch_size: 1024,
    low_memory: false,
    rechunk: false,
    ignore_errors: false,
  },
  read: {
    mode: "read",
    source: "",
    infer_schema_length: 100,
    n_rows: null,
    row_index_name: null,
    row_index_offset: 0,
    batch_size: 1024,
    low_memory: false,
    rechunk: true, // Different default for read mode
    ignore_errors: false,
  },
};

/**
 * Mode descriptions for UI
 */
export const JSON_MODE_INFO: Record<
  JSONMode,
  { name: string; description: string; useCase: string }
> = {
  scan: {
    name: "Scan (Lazy)",
    description: "Only loads data when needed - most efficient for large NDJSON files",
    useCase:
      "Best for: Large NDJSON files, query optimization, filtering before loading",
  },
  read: {
    name: "Read (Eager)",
    description: "Loads entire file into memory immediately",
    useCase:
      "Best for: Small to medium files, standard JSON (required), when you need all data",
  },
};

/**
 * Detect JSON format from file extension
 */
export function detectJsonFormat(filePath: string): JSONFormat {
  const ext = filePath.toLowerCase().split(".").pop();
  if (ext === "jsonl" || ext === "ndjson") {
    return "ndjson";
  }
  return "json";
}

/**
 * Check if a file path is NDJSON format
 */
export function isNdjsonFile(filePath: string): boolean {
  return detectJsonFormat(filePath) === "ndjson";
}

/**
 * Get available modes for a file type
 */
export function getAvailableJsonModes(filePath: string): JSONMode[] {
  if (isNdjsonFile(filePath)) {
    return ["scan", "read"];
  }
  // Standard JSON only supports read mode
  return ["read"];
}

/**
 * Get default configuration for JSON based on file format and mode
 */
export function getDefaultJsonConfig(
  filePath: string,
  mode?: JSONMode
): Partial<PolarsJsonConfig | PolarsNdjsonConfig> {
  if (isNdjsonFile(filePath)) {
    const effectiveMode = mode || "scan";
    return { ...NDJSON_DEFAULTS[effectiveMode] };
  }
  return { ...JSON_DEFAULTS };
}

/**
 * Validate JSON configuration
 */
export function validateJsonConfig(
  config: Partial<PolarsJsonConfig | PolarsNdjsonConfig>
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: source
  if (!config.source || config.source.trim() === "") {
    errors.push("Source file path is required");
  }

  // Validate infer_schema_length
  if (
    config.infer_schema_length !== null &&
    config.infer_schema_length !== undefined &&
    config.infer_schema_length <= 0
  ) {
    errors.push("infer_schema_length must be > 0 or null");
  }

  // NDJSON-specific validations
  const ndjsonConfig = config as Partial<PolarsNdjsonConfig>;

  if (
    ndjsonConfig.n_rows !== null &&
    ndjsonConfig.n_rows !== undefined &&
    ndjsonConfig.n_rows <= 0
  ) {
    errors.push("n_rows must be > 0 or null");
  }

  if (
    ndjsonConfig.batch_size !== null &&
    ndjsonConfig.batch_size !== undefined &&
    ndjsonConfig.batch_size <= 0
  ) {
    errors.push("batch_size must be > 0 or null");
  }

  if (
    ndjsonConfig.row_index_offset !== undefined &&
    ndjsonConfig.row_index_offset < 0
  ) {
    errors.push("row_index_offset must be >= 0");
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
 * Get mode-specific parameter names for NDJSON
 */
const NDJSON_MODE_SPECIFIC_PARAMS: Record<JSONMode, Set<string>> = {
  scan: new Set([]), // scan supports all params
  read: new Set([]), // read also supports all params for NDJSON
};

/**
 * Check if a parameter is supported by a specific mode
 */
function isSupportedByMode(param: string, mode: JSONMode): boolean {
  // All modes support these core parameters for NDJSON
  const sharedParams = new Set([
    "mode",
    "source",
    "infer_schema_length",
    "n_rows",
    "row_index_name",
    "row_index_offset",
    "batch_size",
    "low_memory",
    "rechunk",
    "ignore_errors",
  ]);

  if (sharedParams.has(param)) return true;
  return NDJSON_MODE_SPECIFIC_PARAMS[mode].has(param);
}

/**
 * Switch NDJSON mode while preserving only non-default shared parameters
 *
 * @param currentConfig - Current NDJSON configuration
 * @param newMode - Target mode to switch to
 * @returns New configuration with mode-specific defaults and preserved customizations
 */
export function switchJsonMode(
  currentConfig: Partial<PolarsNdjsonConfig>,
  newMode: JSONMode
): Partial<PolarsNdjsonConfig> {
  const currentMode = currentConfig.mode || "scan";
  const currentDefaults = NDJSON_DEFAULTS[currentMode];
  const newDefaults = NDJSON_DEFAULTS[newMode];

  // Start with new mode's defaults
  const newConfig: Partial<PolarsNdjsonConfig> = { ...newDefaults };

  // Preserve non-default shared parameters
  for (const key in currentConfig) {
    const typedKey = key as keyof PolarsNdjsonConfig;
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
