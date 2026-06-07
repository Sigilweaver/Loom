/**
 * QVD (Qlik QlikView Data) Input Configuration
 *
 * Uses OpenQVD for reading Qlik .qvd files.
 * QVD is a columnar binary format. OpenQVD applies column projection at
 * the Rust level, but the reader currently performs an eager decode, so
 * there is no scan vs read mode selection.
 *
 * Not affiliated with QlikTech.
 *
 * References:
 * https://sigilweaver.app/docs/user/tools/input-output/input/#qvd
 */

/**
 * QVD configuration - minimal since the format has no tuning knobs.
 */
export interface PolarsQvdInputConfig {
  // === File Path ===
  source: string; // File path to .qvd file

  // === Row Selection ===
  n_rows: number | null; // Read only n rows (null = all)
}

/**
 * Default configuration for QVD input
 */
export const QVD_INPUT_DEFAULTS: Partial<PolarsQvdInputConfig> = {
  source: "",
  n_rows: null,
};

export const QVD_INPUT_DOCUMENTATION_URL =
  "https://sigilweaver.app/docs/user/tools/input-output/input/#qvd";

/**
 * Get default QVD input configuration
 */
export function getDefaultQvdInputConfig(): Partial<PolarsQvdInputConfig> {
  return { ...QVD_INPUT_DEFAULTS };
}

/**
 * Validate QVD input configuration
 */
export function validateQvdInputConfig(config: Partial<PolarsQvdInputConfig>): {
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
