/**
 * Polars IPC/Arrow Data Source Configuration
 *
 * Based on Polars Python API:
 * - polars.scan_ipc (lazy evaluation)
 * - polars.read_ipc (eager read)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.scan_ipc.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_ipc.html
 * https://sigilweaver.app/loom/docs/user/tools/input-output/input/#ipc--arrow
 *
 * IPC (Inter-Process Communication) is Apache Arrow's native binary format,
 * also known as Feather v2. It's designed for zero-copy data sharing and
 * maximum read/write performance.
 */

/**
 * IPC Reading Mode
 */
export type IpcMode = "scan" | "read";

/**
 * Polars IPC Configuration
 */
export interface PolarsIpcConfig {
  // === Mode Selection ===
  mode: IpcMode;

  // === File Path ===
  source: string; // File path or glob pattern

  // === Row Selection ===
  n_rows: number | null; // Read only n rows (null = all)

  // === Row Index ===
  row_index_name: string | null; // Add row index column with this name
  row_index_offset: number; // Start row index at this value. Default: 0

  // === Performance ===
  cache: boolean; // Cache result (scan mode). Default: true
  rechunk: boolean; // Rechunk to contiguous memory. Default: false (scan) / true (read)
  memory_map: boolean; // Memory map the file. Default: true
  retries: number; // Number of retries on I/O errors. Default: 2

  // === Hive Partitioning ===
  hive_partitioning: boolean | null; // Infer schema from Hive partitions. Default: null (auto)
  hive_schema: Record<string, string> | null; // Explicit Hive partition schema
  try_parse_hive_dates: boolean; // Try parsing Hive dates. Default: true
}

/**
 * Default configuration for each IPC mode
 */
export const IPC_DEFAULTS: Record<IpcMode, Partial<PolarsIpcConfig>> = {
  scan: {
    mode: "scan",
    source: "",
    n_rows: null,
    row_index_name: null,
    row_index_offset: 0,
    cache: true,
    rechunk: false,
    memory_map: true,
    retries: 2,
    hive_partitioning: null,
    hive_schema: null,
    try_parse_hive_dates: true,
  },
  read: {
    mode: "read",
    source: "",
    n_rows: null,
    row_index_name: null,
    row_index_offset: 0,
    rechunk: true, // Different default for read mode
    memory_map: true,
    retries: 2,
    // Note: read_ipc has fewer options than scan_ipc
  },
};

/**
 * Mode descriptions for UI
 */
export const IPC_MODE_INFO: Record<
  IpcMode,
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
    description: "Loads entire IPC file into memory immediately",
    useCase:
      "Best for: Small to medium files, when you need all data in memory",
  },
};

export const IPC_DOCUMENTATION_URL = "https://sigilweaver.app/loom/docs/user/tools/input-output/input/#ipc--arrow";

/**
 * Get default configuration for a mode
 */
export function getDefaultIpcConfig(mode: IpcMode): Partial<PolarsIpcConfig> {
  return { ...IPC_DEFAULTS[mode] };
}

/**
 * Switch between IPC modes, preserving common parameters
 */
export function switchIpcMode(
  currentConfig: Partial<PolarsIpcConfig>,
  newMode: IpcMode
): Partial<PolarsIpcConfig> {
  const baseConfig = getDefaultIpcConfig(newMode);

  // Parameters to preserve across mode switches
  const preserveKeys: (keyof PolarsIpcConfig)[] = [
    "source",
    "n_rows",
    "row_index_name",
    "row_index_offset",
    "memory_map",
  ];

  const preserved: Partial<PolarsIpcConfig> = {};
  for (const key of preserveKeys) {
    if (key in currentConfig && currentConfig[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (preserved as any)[key] = currentConfig[key];
    }
  }

  return {
    ...baseConfig,
    ...preserved,
    mode: newMode,
  };
}

/**
 * Validate IPC configuration
 */
export function validateIpcConfig(config: Partial<PolarsIpcConfig>): {
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
 * Get non-default values for display/export
 */
export function getNonDefaultIpcConfig(
  config: Partial<PolarsIpcConfig>,
  mode: IpcMode
): Partial<PolarsIpcConfig> {
  const defaults = IPC_DEFAULTS[mode];
  const nonDefault: Partial<PolarsIpcConfig> = {};

  for (const [key, value] of Object.entries(config)) {
    const defaultValue = defaults[key as keyof PolarsIpcConfig];
    if (value !== defaultValue) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (nonDefault as any)[key] = value;
    }
  }

  return nonDefault;
}
