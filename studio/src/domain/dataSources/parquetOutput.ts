/**
 * Polars Parquet Output Configuration
 *
 * Based on Polars Python API:
 * - polars.LazyFrame.sink_parquet (streaming write)
 * - polars.DataFrame.write_parquet (eager write)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_parquet.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.LazyFrame.sink_parquet.html
 * https://sigilweaver.app/loom/docs/user/tools/input-output/output/#parquet
 */

/**
 * Parquet Output Mode
 */
export type ParquetOutputMode = "sink" | "write";

/**
 * Compression Options
 */
export type CompressionType =
  | "uncompressed"
  | "snappy"
  | "gzip"
  | "lz4"
  | "zstd"
  | "brotli";

/**
 * Polars Parquet Output Configuration
 * Common parameters between sink_parquet and write_parquet
 */
export interface PolarsParquetOutputConfig {
  // === Mode Selection ===
  parquetMode: ParquetOutputMode;

  // === Output Type ===
  type: "parquet";
  category: "file";

  // === File Path ===
  destination: string; // Output file path

  // === Common Parameters (both sink_parquet and write_parquet) ===
  compression: CompressionType; // Compression algorithm. Default: 'zstd'
  compression_level: number | null; // Compression level (null = default for algorithm)
  statistics: boolean; // Write statistics. Default: true
  row_group_size: number | null; // Rows per row group (null = auto)
  data_page_size: number | null; // Data page size in bytes (null = auto)
}

/**
 * Default configuration for Parquet sink mode (streaming)
 */
export const DEFAULT_PARQUET_SINK_CONFIG: Partial<PolarsParquetOutputConfig> = {
  parquetMode: "sink",
  type: "parquet",
  category: "file",
  compression: "zstd",
  compression_level: null,
  statistics: true,
  row_group_size: null,
  data_page_size: null,
};

/**
 * Default configuration for Parquet write mode (eager)
 */
export const DEFAULT_PARQUET_WRITE_CONFIG: Partial<PolarsParquetOutputConfig> = {
  ...DEFAULT_PARQUET_SINK_CONFIG,
  parquetMode: "write",
};

/**
 * Get default config for a specific output mode
 */
export function getDefaultParquetOutputConfig(
  mode: ParquetOutputMode
): Partial<PolarsParquetOutputConfig> {
  switch (mode) {
    case "sink":
      return { ...DEFAULT_PARQUET_SINK_CONFIG };
    case "write":
      return { ...DEFAULT_PARQUET_WRITE_CONFIG };
    default:
      return { ...DEFAULT_PARQUET_SINK_CONFIG };
  }
}

/**
 * Switch between Parquet output modes, preserving only common parameters
 */
export function switchParquetOutputMode(
  currentConfig: Partial<PolarsParquetOutputConfig>,
  newMode: ParquetOutputMode
): Partial<PolarsParquetOutputConfig> {
  const baseConfig = getDefaultParquetOutputConfig(newMode);

  // Common parameters that should be preserved across mode switches
  const commonParams: (keyof PolarsParquetOutputConfig)[] = [
    "destination",
    "compression",
    "compression_level",
    "statistics",
    "row_group_size",
    "data_page_size",
  ];

  // Preserve common parameters from current config
  const preservedConfig: Partial<PolarsParquetOutputConfig> = {};
  for (const param of commonParams) {
    if (param in currentConfig && currentConfig[param] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (preservedConfig as any)[param] = currentConfig[param];
    }
  }

  return {
    ...baseConfig,
    ...preservedConfig,
    parquetMode: newMode,
  };
}

/**
 * Mode descriptions for UI
 */
export const PARQUET_OUTPUT_MODE_INFO: Record<
  ParquetOutputMode,
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
      "Collects all data into memory before writing. Use when you need specific write options.",
    badge: "Eager",
  },
};

export const PARQUET_OUTPUT_DOCUMENTATION_URL = "https://sigilweaver.app/loom/docs/user/tools/input-output/output/#parquet";

/**
 * Compression options with descriptions
 */
export const COMPRESSION_OPTIONS: Array<{
  value: CompressionType;
  label: string;
  description: string;
}> = [
  {
    value: "zstd",
    label: "ZSTD (Recommended)",
    description: "Best compression ratio and speed balance",
  },
  {
    value: "snappy",
    label: "Snappy",
    description: "Very fast compression, lower ratio",
  },
  {
    value: "gzip",
    label: "GZIP",
    description: "Good compression, slower than Snappy",
  },
  {
    value: "lz4",
    label: "LZ4",
    description: "Extremely fast, lower compression",
  },
  {
    value: "brotli",
    label: "Brotli",
    description: "High compression ratio, slower",
  },
  {
    value: "uncompressed",
    label: "Uncompressed",
    description: "No compression",
  },
];

/**
 * Compression level ranges by algorithm
 */
export const COMPRESSION_LEVEL_RANGES: Record<
  CompressionType,
  { min: number; max: number; default: number } | null
> = {
  uncompressed: null,
  snappy: null, // Snappy doesn't support levels
  gzip: { min: 1, max: 9, default: 6 },
  lz4: null, // LZ4 doesn't support levels in Parquet
  zstd: { min: 1, max: 22, default: 3 },
  brotli: { min: 0, max: 11, default: 6 },
};
