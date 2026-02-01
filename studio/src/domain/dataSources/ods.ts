/**
 * Polars ODS (OpenDocument Spreadsheet) Data Source Configuration
 *
 * Based on Polars Python API:
 * - polars.read_ods (eager read only - no lazy scan support)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_ods.html
 * https://sigilweaver.app/docs/user/tools/input-output/input/#ods
 *
 * OpenDocument Spreadsheet (.ods) is the spreadsheet format used by
 * LibreOffice Calc and OpenOffice Calc. Similar to Excel, it only
 * supports eager reading in Polars.
 */

/**
 * Polars ODS Configuration
 */
export interface PolarsOdsConfig {
  // === File Path ===
  source: string; // File path

  // === Sheet Selection ===
  sheet_id: number | null; // Sheet number (1 = first, 0 = all sheets)
  sheet_name: string | null; // Alternative: sheet by name

  // === Data Options ===
  has_header: boolean; // First row contains column names
  columns: string[] | number[] | null; // Columns to read (names or indices)
  infer_schema_length: number | null; // Rows to sample for type inference
  drop_empty_rows: boolean; // Omit empty rows
  drop_empty_cols: boolean; // Omit empty columns
  raise_if_empty: boolean; // Error if sheet is empty
}

/**
 * Default configuration for ODS read
 */
export const ODS_DEFAULTS: PolarsOdsConfig = {
  source: "",
  sheet_id: 1, // First sheet by default
  sheet_name: null,
  has_header: true,
  columns: null,
  infer_schema_length: null, // Scan entire file (eager read anyway)
  drop_empty_rows: true,
  drop_empty_cols: true,
  raise_if_empty: true,
};

/**
 * ODS format information for UI
 */
export const ODS_INFO = {
  name: "OpenDocument Spreadsheet",
  description: "Spreadsheet format used by LibreOffice and OpenOffice",
  extensions: [".ods"],
  documentationUrl: "https://sigilweaver.app/docs/user/tools/input-output/input/#ods",
  features: [
    "Open standard format",
    "Cross-platform compatibility",
    "Sheet-based organization",
    "Type inference from data",
  ],
  limitations: [
    "No lazy scanning (always loads full sheet)",
    "Read-only in Polars (no write support)",
    "Excel row limit: 1,048,576 rows maximum",
  ],
};

/**
 * Create a new ODS config with defaults
 */
export function createOdsConfig(
  overrides: Partial<PolarsOdsConfig> = {}
): PolarsOdsConfig {
  return {
    ...ODS_DEFAULTS,
    ...overrides,
  };
}

/**
 * Validate ODS configuration
 */
export function validateOdsConfig(config: Partial<PolarsOdsConfig>): string[] {
  const errors: string[] = [];

  if (!config.source) {
    errors.push("Source file path is required");
  }

  // Cannot specify both sheet_id and sheet_name
  if (
    config.sheet_id !== null &&
    config.sheet_id !== undefined &&
    config.sheet_name
  ) {
    errors.push("Cannot specify both sheet number and sheet name");
  }

  if (config.sheet_id !== null && config.sheet_id !== undefined) {
    if (!Number.isInteger(config.sheet_id) || config.sheet_id < 0) {
      errors.push("Sheet number must be a non-negative integer (0 = all sheets)");
    }
  }

  if (
    config.infer_schema_length !== null &&
    config.infer_schema_length !== undefined
  ) {
    if (
      !Number.isInteger(config.infer_schema_length) ||
      config.infer_schema_length <= 0
    ) {
      errors.push("Schema inference length must be a positive integer");
    }
  }

  return errors;
}
