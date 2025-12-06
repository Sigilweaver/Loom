/**
 * Polars IPC/Arrow Output Configuration
 *
 * Based on Polars Python API:
 * - polars.LazyFrame.sink_ipc (streaming write)
 * - polars.DataFrame.write_ipc (eager write)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_ipc.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.LazyFrame.sink_ipc.html
 * https://docs.sigilweaver.app/user/tools/input-output/output/#ipc--arrow
 *
 * IPC (Inter-Process Communication) is Apache Arrow's native binary format.
 * It supports only limited compression options: uncompressed, lz4, and zstd.
 */

/**
 * IPC Output Mode
 */
export type IpcOutputMode = "sink" | "write";

/**
 * IPC Compression Options
 * IPC only supports uncompressed, lz4, and zstd
 */
export type IpcCompressionType = "uncompressed" | "lz4" | "zstd";

/**
 * Polars IPC Output Configuration
 * Common parameters between sink_ipc and write_ipc
 */
export interface PolarsIpcOutputConfig {
  // === Mode Selection ===
  ipcMode: IpcOutputMode;

  // === Output Type ===
  type: "ipc";
  category: "file";

  // === File Path ===
  destination: string; // Output file path

  // === Common Parameters (both sink_ipc and write_ipc) ===
  compression: IpcCompressionType; // Compression algorithm. Default: 'uncompressed'
  compat_level: string | null; // Compatibility level (null = newest)
}

/**
 * Default configuration for IPC sink mode (streaming)
 */
export const DEFAULT_IPC_SINK_CONFIG: Partial<PolarsIpcOutputConfig> = {
  ipcMode: "sink",
  type: "ipc",
  category: "file",
  destination: "",
  compression: "uncompressed",
  compat_level: null,
};

/**
 * Default configuration for IPC write mode (eager)
 */
export const DEFAULT_IPC_WRITE_CONFIG: Partial<PolarsIpcOutputConfig> = {
  ...DEFAULT_IPC_SINK_CONFIG,
  ipcMode: "write",
};

/**
 * Get default config for a specific output mode
 */
export function getDefaultIpcOutputConfig(
  mode: IpcOutputMode
): Partial<PolarsIpcOutputConfig> {
  switch (mode) {
    case "sink":
      return { ...DEFAULT_IPC_SINK_CONFIG };
    case "write":
      return { ...DEFAULT_IPC_WRITE_CONFIG };
    default:
      return { ...DEFAULT_IPC_SINK_CONFIG };
  }
}

/**
 * Switch between IPC output modes, preserving only common parameters
 */
export function switchIpcOutputMode(
  currentConfig: Partial<PolarsIpcOutputConfig>,
  newMode: IpcOutputMode
): Partial<PolarsIpcOutputConfig> {
  const baseConfig = getDefaultIpcOutputConfig(newMode);

  // Common parameters that should be preserved across mode switches
  const commonParams: (keyof PolarsIpcOutputConfig)[] = [
    "destination",
    "compression",
    "compat_level",
  ];

  // Preserve common parameters from current config
  const preservedConfig: Partial<PolarsIpcOutputConfig> = {};
  for (const param of commonParams) {
    if (param in currentConfig && currentConfig[param] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (preservedConfig as any)[param] = currentConfig[param];
    }
  }

  return {
    ...baseConfig,
    ...preservedConfig,
    ipcMode: newMode,
  };
}

/**
 * Mode descriptions for UI
 */
export const IPC_OUTPUT_MODE_INFO: Record<
  IpcOutputMode,
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

export const IPC_OUTPUT_DOCUMENTATION_URL = "https://docs.sigilweaver.app/user/tools/input-output/output/#ipc--arrow";

/**
 * Compression options with descriptions
 */
export const IPC_COMPRESSION_OPTIONS: Array<{
  value: IpcCompressionType;
  label: string;
  description: string;
}> = [
  {
    value: "uncompressed",
    label: "Uncompressed",
    description: "No compression - fastest read/write, largest file size",
  },
  {
    value: "lz4",
    label: "LZ4",
    description: "Fast compression with good ratio - balanced choice",
  },
  {
    value: "zstd",
    label: "Zstandard",
    description: "Best compression ratio - slower but smallest files",
  },
];

/**
 * Validate IPC output configuration
 */
export function validateIpcOutputConfig(
  config: Partial<PolarsIpcOutputConfig>
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: destination
  if (!config.destination || config.destination.trim() === "") {
    errors.push("Destination file path is required");
  }

  // Validate compression
  const validCompressions: IpcCompressionType[] = ["uncompressed", "lz4", "zstd"];
  if (config.compression && !validCompressions.includes(config.compression)) {
    errors.push(
      `Invalid compression: ${config.compression}. Must be one of: ${validCompressions.join(", ")}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
