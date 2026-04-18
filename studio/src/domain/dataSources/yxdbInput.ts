/**
 * YXDB (Alteryx Database) Input Configuration
 *
 * Uses OpenYXDB for reading Alteryx .yxdb files.
 * YXDB is a row-based binary format with LZF compression.
 *
 * Unlike columnar formats (Parquet, IPC), YXDB does not support
 * lazy scanning — all reads are eager. This means there is no
 * mode selection (scan vs read).
 *
 * Not affiliated with Alteryx, Inc.
 *
 * References:
 * https://sigilweaver.app/docs/user/tools/input-output/input/#yxdb
 */

/**
 * YXDB configuration — minimal since the format has no tuning knobs.
 */
export interface PolarsYxdbInputConfig {
  // === File Path ===
  source: string; // File path to .yxdb file

  // === Row Selection ===
  n_rows: number | null; // Read only n rows (null = all)
}

/**
 * Default configuration for YXDB input
 */
export const YXDB_INPUT_DEFAULTS: Partial<PolarsYxdbInputConfig> = {
  source: "",
  n_rows: null,
};

export const YXDB_INPUT_DOCUMENTATION_URL =
  "https://sigilweaver.app/docs/user/tools/input-output/input/#yxdb";

/**
 * Get default YXDB input configuration
 */
export function getDefaultYxdbInputConfig(): Partial<PolarsYxdbInputConfig> {
  return { ...YXDB_INPUT_DEFAULTS };
}

/**
 * Validate YXDB input configuration
 */
export function validateYxdbInputConfig(
  config: Partial<PolarsYxdbInputConfig>
): {
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

  return {
    valid: errors.length === 0,
    errors,
  };
}
