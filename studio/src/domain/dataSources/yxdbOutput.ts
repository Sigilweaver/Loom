/**
 * YXDB (Alteryx Database) Output Configuration
 *
 * Uses SigilYX for writing Alteryx .yxdb files.
 * YXDB is always written eagerly — the format requires knowing
 * the record count upfront and uses row-based LZF-compressed blocks.
 *
 * There is no mode selection (sink vs write) because YXDB does not
 * support streaming writes via Polars' native sink API.
 *
 * Not affiliated with Alteryx, Inc.
 *
 * References:
 * https://sigilweaver.app/docs/user/tools/input-output/output/#yxdb
 */

/**
 * YXDB output configuration — minimal since the format has no tuning knobs.
 */
export interface PolarsYxdbOutputConfig {
  // === Output Type ===
  type: "yxdb";
  category: "file";

  // === File Path ===
  destination: string; // Output file path
}

/**
 * Default configuration for YXDB output
 */
export const DEFAULT_YXDB_OUTPUT_CONFIG: Partial<PolarsYxdbOutputConfig> = {
  type: "yxdb",
  category: "file",
  destination: "",
};

export const YXDB_OUTPUT_DOCUMENTATION_URL =
  "https://sigilweaver.app/docs/user/tools/input-output/output/#yxdb";

/**
 * Get default YXDB output configuration
 */
export function getDefaultYxdbOutputConfig(): Partial<PolarsYxdbOutputConfig> {
  return { ...DEFAULT_YXDB_OUTPUT_CONFIG };
}

/**
 * Validate YXDB output configuration
 */
export function validateYxdbOutputConfig(
  config: Partial<PolarsYxdbOutputConfig>
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: destination
  if (!config.destination || config.destination.trim() === "") {
    errors.push("Destination file path is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
