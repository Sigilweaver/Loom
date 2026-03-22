/**
 * Polars Excel Output Configuration
 *
 * Based on Polars Python API:
 * - polars.DataFrame.write_excel (eager write only - no streaming support)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_excel.html
 * https://xlsxwriter.readthedocs.io/working_with_tables.html
 * https://sigilweaver.app/docs/user/tools/input-output/output/#excel
 *
 * Note: Excel files only support eager writing. The file is written using xlsxwriter.
 * See Sigilweaver Loom documentation for visual reference of all Excel table styles.
 */

/**
 * Polars Excel Output Configuration
 */
export interface PolarsExcelOutputConfig {
  // === Output Type ===
  type: "excel";
  category: "file";

  // === File Path ===
  destination: string; // Output file path

  // === Worksheet Options ===
  worksheet: string | null; // Worksheet name (default: "Sheet1")
  table_name: string | null; // Table name for Excel references

  // === Table Styling ===
  table_style: string | null; // Excel table style name (e.g., "Table Style Medium 9")

  // === Display Options ===
  include_header: boolean; // Include column names as header. Default: true
  autofilter: boolean; // Enable autofilter in header row. Default: true
  autofit: boolean; // Auto-calculate column widths. Default: false
  hide_gridlines: boolean; // Hide worksheet gridlines. Default: false

  // === Formatting ===
  float_precision: number; // Decimal places for floats. Default: 3

  // === View Options ===
  sheet_zoom: number | null; // Zoom level (10-400). Default: null (100%)
  freeze_panes: string | null; // Cell notation for freeze position (e.g., "A2")
}

/**
 * Default configuration for Excel output
 */
export const DEFAULT_EXCEL_OUTPUT_CONFIG: Partial<PolarsExcelOutputConfig> = {
  type: "excel",
  category: "file",
  destination: "",
  worksheet: null,
  table_name: null,
  table_style: "Table Style Medium 4",
  include_header: true,
  autofilter: true,
  autofit: false,
  hide_gridlines: false,
  float_precision: 3,
  sheet_zoom: null,
  freeze_panes: null,
};

/**
 * Get default Excel output config
 */
export function getDefaultExcelOutputConfig(): Partial<PolarsExcelOutputConfig> {
  return { ...DEFAULT_EXCEL_OUTPUT_CONFIG };
}

/**
 * Mode info for UI (Excel only has one mode - eager write)
 */
export const EXCEL_OUTPUT_MODE_INFO = {
  label: "Write (Eager)",
  description:
    "Collects all data into memory before writing. Excel files do not support streaming writes.",
  badge: "Eager",
};

export const EXCEL_OUTPUT_DOCUMENTATION_URL = "https://sigilweaver.app/loom/docs/user/tools/input-output/output/#excel";

/**
 * Curated list of popular Excel table styles
 * Users can also enter custom style names
 *
 * To find style names: In Excel, select a range, press Ctrl+T to create a table,
 * go to Table Design tab, and hover over styles to see names like "Table Style Medium 4"
 */
export const EXCEL_TABLE_STYLE_OPTIONS: Array<{
  value: string | null;
  label: string;
  category: "none" | "light" | "medium";
}> = [
  // No styling
  { value: null, label: "None (no table formatting)", category: "none" },

  // Light styles (8-14) - subtle, professional
  { value: "Table Style Light 8", label: "Light 8", category: "light" },
  { value: "Table Style Light 9", label: "Light 9", category: "light" },
  { value: "Table Style Light 10", label: "Light 10", category: "light" },
  { value: "Table Style Light 11", label: "Light 11", category: "light" },
  { value: "Table Style Light 12", label: "Light 12", category: "light" },
  { value: "Table Style Light 13", label: "Light 13", category: "light" },
  { value: "Table Style Light 14", label: "Light 14", category: "light" },

  // Medium styles (1-7) - balanced, good for most uses
  { value: "Table Style Medium 1", label: "Medium 1", category: "medium" },
  { value: "Table Style Medium 2", label: "Medium 2", category: "medium" },
  { value: "Table Style Medium 3", label: "Medium 3", category: "medium" },
  { value: "Table Style Medium 4", label: "Medium 4 (Default)", category: "medium" },
  { value: "Table Style Medium 5", label: "Medium 5", category: "medium" },
  { value: "Table Style Medium 6", label: "Medium 6", category: "medium" },
  { value: "Table Style Medium 7", label: "Medium 7", category: "medium" },

  // Medium styles (15-21) - bolder headers
  { value: "Table Style Medium 15", label: "Medium 15", category: "medium" },
  { value: "Table Style Medium 16", label: "Medium 16", category: "medium" },
  { value: "Table Style Medium 17", label: "Medium 17", category: "medium" },
  { value: "Table Style Medium 18", label: "Medium 18", category: "medium" },
  { value: "Table Style Medium 19", label: "Medium 19", category: "medium" },
  { value: "Table Style Medium 20", label: "Medium 20", category: "medium" },
  { value: "Table Style Medium 21", label: "Medium 21", category: "medium" },
];

/**
 * Common freeze pane positions
 */
export const FREEZE_PANE_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: "None" },
  { value: "A2", label: "Freeze Top Row" },
  { value: "B1", label: "Freeze First Column" },
  { value: "B2", label: "Freeze Top Row & First Column" },
];
