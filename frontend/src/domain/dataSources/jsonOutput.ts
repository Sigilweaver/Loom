/**
 * Polars JSON/NDJSON Output Configuration
 *
 * Supports two JSON formats:
 * - Standard JSON (.json): Array of objects, eager write only via DataFrame.write_json
 * - NDJSON (.jsonl, .ndjson): Newline-delimited JSON, supports sink (streaming) via LazyFrame.sink_ndjson
 *
 * Based on Polars Python API:
 * - polars.DataFrame.write_json (eager, standard JSON)
 * - polars.LazyFrame.sink_ndjson (streaming, NDJSON)
 * - polars.DataFrame.write_ndjson (eager, NDJSON)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_json.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_ndjson.html
 * https://docs.pola.rs/api/python/stable/reference/api/polars.LazyFrame.sink_ndjson.html
 * https://docs.sigilweaver.app/user/tools/input-output/output/#json
 */

/**
 * JSON Output Mode
 *
 * - "sink": Streaming write (NDJSON only) - most memory efficient
 * - "write": Eager write - collects data before writing
 *
 * Note: Standard JSON (.json) only supports "write" mode (no streaming available)
 */
export type JSONOutputMode = "sink" | "write";

/**
 * NDJSON file extensions for output
 */
export const NDJSON_OUTPUT_EXTENSIONS = [".jsonl", ".ndjson"];

/**
 * Standard JSON file extensions for output
 */
export const JSON_OUTPUT_EXTENSIONS = [".json"];

/**
 * Polars JSON Output Configuration (for standard JSON)
 * Currently minimal options - write_json has few parameters
 */
export interface PolarsJsonOutputConfig {
  // === Output Type ===
  type: "json";
  category: "file";

  // === File Path ===
  destination: string; // Output file path

  // === Format Options ===
  row_oriented: boolean; // Output as array of row objects (default: true)
}

/**
 * Polars NDJSON Output Configuration
 */
export interface PolarsNdjsonOutputConfig {
  // === Mode Selection ===
  jsonMode: JSONOutputMode;

  // === Output Type ===
  type: "json";
  category: "file";

  // === File Path ===
  destination: string; // Output file path
}

/**
 * Default configuration for standard JSON output
 */
export const DEFAULT_JSON_OUTPUT_CONFIG: Partial<PolarsJsonOutputConfig> = {
  type: "json",
  category: "file",
  destination: "",
  row_oriented: true,
};

/**
 * Default configuration for NDJSON sink mode (streaming)
 */
export const DEFAULT_NDJSON_SINK_CONFIG: Partial<PolarsNdjsonOutputConfig> = {
  jsonMode: "sink",
  type: "json",
  category: "file",
  destination: "",
};

/**
 * Default configuration for NDJSON write mode (eager)
 */
export const DEFAULT_NDJSON_WRITE_CONFIG: Partial<PolarsNdjsonOutputConfig> = {
  jsonMode: "write",
  type: "json",
  category: "file",
  destination: "",
};

/**
 * Get default config for a specific output mode
 */
export function getDefaultJsonOutputConfig(
  mode: JSONOutputMode,
  isNdjson: boolean
): Partial<PolarsJsonOutputConfig | PolarsNdjsonOutputConfig> {
  if (isNdjson) {
    switch (mode) {
      case "sink":
        return { ...DEFAULT_NDJSON_SINK_CONFIG };
      case "write":
        return { ...DEFAULT_NDJSON_WRITE_CONFIG };
      default:
        return { ...DEFAULT_NDJSON_SINK_CONFIG };
    }
  }
  return { ...DEFAULT_JSON_OUTPUT_CONFIG };
}

/**
 * Check if a file path is NDJSON format
 */
export function isNdjsonOutputFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().split(".").pop();
  return ext === "jsonl" || ext === "ndjson";
}

/**
 * Get available modes for a file type
 */
export function getAvailableJsonOutputModes(filePath: string): JSONOutputMode[] {
  if (isNdjsonOutputFile(filePath)) {
    return ["sink", "write"];
  }
  // Standard JSON only supports write mode
  return ["write"];
}

/**
 * Switch between JSON output modes, preserving common parameters
 */
export function switchJsonOutputMode(
  currentConfig: Partial<PolarsNdjsonOutputConfig>,
  newMode: JSONOutputMode
): Partial<PolarsNdjsonOutputConfig> {
  return {
    ...currentConfig,
    jsonMode: newMode,
  };
}

/**
 * Mode descriptions for UI
 */
export const JSON_OUTPUT_MODE_INFO: Record<
  JSONOutputMode,
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
      "Collects all data into memory before writing. Required for standard JSON format.",
    badge: "Eager",
  },
};

export const JSON_OUTPUT_DOCUMENTATION_URL = "https://docs.sigilweaver.app/user/tools/input-output/output/#json";
