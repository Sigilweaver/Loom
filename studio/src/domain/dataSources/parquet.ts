/**
 * Polars Parquet Data Source Configuration
 *
 * Based on Polars Python API:
 * - polars.scan_parquet (lazy evaluation)
 * - polars.read_parquet (eager read)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.scan_parquet.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_parquet.html
 * https://docs.sigilweaver.app/user/tools/input-output/input/#parquet
 */

/**
 * Parquet Reading Mode
 */
export type ParquetMode = "scan" | "read";

/**
 * Polars Parquet Configuration
 */
export interface PolarsParquetConfig {
  // === Mode Selection ===
  mode: ParquetMode;

  // === File Path ===
  source: string; // File path or glob pattern

  // === Row Selection ===
  n_rows: number | null; // Read only n rows (null = all)

  // === Row Index ===
  row_index_name: string | null; // Add row index column with this name
  row_index_offset: number; // Start row index at this value. Default: 0

  // === Performance ===
  parallel: string; // Parallelism strategy: "auto", "columns", "row_groups", "none". Default: "auto"
  use_statistics: boolean; // Use Parquet statistics for filtering. Default: true
  rechunk: boolean; // Rechunk to contiguous memory. Default: false
  low_memory: boolean; // Reduce memory at cost of performance. Default: false
  cache: boolean; // Cache result (scan mode). Default: true
  retries: number; // Number of retries on I/O errors. Default: 2

  // === Hive Partitioning ===
  hive_partitioning: boolean; // Infer schema from Hive partitions. Default: false
  hive_schema: Record<string, string> | null; // Explicit Hive partition schema
  try_parse_hive_dates: boolean; // Try parsing Hive dates. Default: true
}

/**
 * Default configuration for each Parquet mode
 */
export const PARQUET_DEFAULTS: Record<ParquetMode, Partial<PolarsParquetConfig>> = {
  scan: {
    mode: "scan",
    source: "",
    n_rows: null,
    row_index_name: null,
    row_index_offset: 0,
    parallel: "auto",
    use_statistics: true,
    rechunk: false,
    low_memory: false,
    cache: true,
    retries: 2,
    hive_partitioning: false,
    hive_schema: null,
    try_parse_hive_dates: true,
  },
  read: {
    mode: "read",
    source: "",
    n_rows: null,
    row_index_name: null,
    row_index_offset: 0,
    parallel: "auto",
    use_statistics: true,
    rechunk: true, // Different default for read mode
    low_memory: false,
    retries: 2,
    hive_partitioning: false,
    hive_schema: null,
    try_parse_hive_dates: true,
  },
};

/**
 * Mode descriptions for UI
 */
export const PARQUET_MODE_INFO: Record<
  ParquetMode,
  { name: string; description: string; useCase: string }
> = {
  scan: {
    name: "Scan (Lazy)",
    description: "Only loads data when needed - most efficient for large files",
    useCase:
      "Best for: Large files, query optimization, when you need to filter/aggregate before loading",
  },
  read: {
    name: "Read (Eager)",
    description: "Loads entire Parquet file into memory immediately",
    useCase:
      "Best for: Small to medium files, when you need all data in memory",
  },
};

export const PARQUET_DOCUMENTATION_URL = "https://docs.sigilweaver.app/user/tools/input-output/input/#parquet";

/**
 * Parallel strategy options
 */
export const PARALLEL_STRATEGIES = [
  { value: "auto", label: "Auto", description: "Let Polars decide" },
  { value: "columns", label: "Columns", description: "Parallelize by columns" },
  { value: "row_groups", label: "Row Groups", description: "Parallelize by row groups" },
  { value: "none", label: "None", description: "No parallelization" },
] as const;

/**
 * Get default configuration for a mode
 */
export function getDefaultParquetConfig(mode: ParquetMode): Partial<PolarsParquetConfig> {
  return { ...PARQUET_DEFAULTS[mode] };
}

/**
 * Validate Parquet configuration
 */
export function validateParquetConfig(config: Partial<PolarsParquetConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: source
  if (!config.source || config.source.trim() === "") {
    errors.push("Source file path is required");
  }

  // Validate n_rows
  if (
    config.n_rows !== null &&
    config.n_rows !== undefined &&
    config.n_rows <= 0
  ) {
    errors.push("n_rows must be > 0 or null");
  }

  // Validate row_index_offset
  if (config.row_index_offset !== undefined && config.row_index_offset < 0) {
    errors.push("row_index_offset must be >= 0");
  }

  // Validate retries
  if (config.retries !== undefined && config.retries < 0) {
    errors.push("retries must be >= 0");
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
const MODE_SPECIFIC_PARAMS: Record<ParquetMode, Set<string>> = {
  scan: new Set(["cache"]),
  read: new Set([]),
};

/**
 * Check if a parameter is supported by a specific mode
 */
function isSupportedByMode(param: string, mode: ParquetMode): boolean {
  // All modes support these core parameters
  const sharedParams = new Set([
    "mode",
    "source",
    "n_rows",
    "row_index_name",
    "row_index_offset",
    "parallel",
    "use_statistics",
    "rechunk",
    "low_memory",
    "retries",
    "hive_partitioning",
    "hive_schema",
    "try_parse_hive_dates",
  ]);

  if (sharedParams.has(param)) return true;
  return MODE_SPECIFIC_PARAMS[mode].has(param);
}

/**
 * Switch Parquet mode while preserving only non-default shared parameters
 *
 * @param currentConfig - Current Parquet configuration
 * @param newMode - Target mode to switch to
 * @returns New configuration with mode-specific defaults and preserved customizations
 */
export function switchParquetMode(
  currentConfig: Partial<PolarsParquetConfig>,
  newMode: ParquetMode
): Partial<PolarsParquetConfig> {
  const currentMode = currentConfig.mode || "scan";
  const currentDefaults = PARQUET_DEFAULTS[currentMode];
  const newDefaults = PARQUET_DEFAULTS[newMode];

  // Start with new mode's defaults
  const newConfig: Partial<PolarsParquetConfig> = { ...newDefaults };

  // Preserve non-default shared parameters
  for (const key in currentConfig) {
    const typedKey = key as keyof PolarsParquetConfig;
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
