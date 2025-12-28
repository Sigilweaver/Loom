/**
 * Polars Excel Data Source Configuration
 *
 * Based on Polars Python API:
 * - polars.read_excel (eager read only - no lazy support)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_excel.html
 * https://docs.sigilweaver.app/user/tools/input-output/input/#excel
 *
 * Note: Excel files only support eager reading. The calamine engine (default)
 * is the fastest option, using the fastexcel module.
 */

/**
 * Excel Engine Options
 * - calamine: Fast Rust-based parser (default, recommended)
 * - openpyxl: Slower but more compatible fallback
 * - xlsx2csv: Converts to CSV first, then parses
 */
export type ExcelEngine = "calamine" | "openpyxl" | "xlsx2csv";

/**
 * Polars Excel Configuration
 */
export interface PolarsExcelConfig {
  // === File Path ===
  source: string; // File path

  // === Sheet Selection ===
  // Only one of sheet_id or sheet_name can be set
  sheet_id: number | null; // 1-indexed sheet number (1 = first sheet, 0 = all sheets)
  sheet_name: string | null; // Sheet name

  // === Header Options ===
  has_header: boolean; // First row contains column names. Default: true

  // === Column Selection ===
  columns: string[] | number[] | null; // Columns to read (names or indices)

  // === Schema Inference ===
  infer_schema_length: number | null; // Rows to scan for type inference (null = all). Default: null

  // === Empty Data Handling ===
  drop_empty_rows: boolean; // Omit empty rows. Default: true
  drop_empty_cols: boolean; // Omit empty columns. Default: true
  raise_if_empty: boolean; // Raise error if sheet is empty. Default: true

  // === Engine (always calamine for best performance) ===
  engine: ExcelEngine;
}

/**
 * Default configuration for Excel
 */
export const EXCEL_DEFAULTS: PolarsExcelConfig = {
  source: "",
  sheet_id: 1, // First sheet by default
  sheet_name: null,
  has_header: true,
  columns: null,
  infer_schema_length: null, // Scan entire file (eager read anyway)
  drop_empty_rows: true,
  drop_empty_cols: true,
  raise_if_empty: true,
  engine: "calamine",
};

/**
 * Mode info for UI (Excel only has one mode - eager read)
 */
export const EXCEL_MODE_INFO = {
  name: "Read (Eager)",
  description:
    "Loads entire Excel sheet into memory. Excel files do not support lazy loading.",
  useCase: "Best for: All Excel files - this is the only available mode.",
};

export const EXCEL_DOCUMENTATION_URL = "https://docs.sigilweaver.app/user/tools/input-output/input/#excel";

/**
 * Get default configuration
 */
export function getDefaultExcelConfig(): Partial<PolarsExcelConfig> {
  return { ...EXCEL_DEFAULTS };
}

/**
 * Validate Excel configuration
 */
export function validateExcelConfig(config: Partial<PolarsExcelConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: source
  if (!config.source || config.source.trim() === "") {
    errors.push("Source file path is required");
  }

  // Validate sheet_id
  if (config.sheet_id !== null && config.sheet_id !== undefined) {
    if (!Number.isInteger(config.sheet_id) || config.sheet_id < 0) {
      errors.push("sheet_id must be >= 0 (0 = all sheets, 1+ = specific sheet)");
    }
  }

  // Cannot have both sheet_id and sheet_name
  if (config.sheet_id !== null && config.sheet_name !== null) {
    errors.push("Cannot specify both sheet_id and sheet_name");
  }

  // Validate infer_schema_length
  if (
    config.infer_schema_length !== null &&
    config.infer_schema_length !== undefined &&
    config.infer_schema_length <= 0
  ) {
    errors.push("infer_schema_length must be > 0 or null");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
