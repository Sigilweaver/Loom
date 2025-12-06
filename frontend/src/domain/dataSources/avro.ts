/**
 * Polars Avro Data Source Configuration
 *
 * Based on Polars Python API:
 * - polars.read_avro (eager read only - no lazy scan support)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.read_avro.html
 * https://docs.sigilweaver.app/user/tools/input-output/input/#avro
 *
 * Apache Avro is a row-based binary data format commonly used in
 * big data ecosystems (Hadoop, Kafka, Spark). It's schema-first and
 * supports schema evolution.
 *
 * Note: Unlike IPC/Parquet, Avro does not support lazy scanning in Polars.
 * All reads are eager (entire file is loaded into memory).
 */

/**
 * Polars Avro Configuration
 *
 * Avro has limited read options in Polars:
 * - columns: Select specific columns (by name or index)
 * - n_rows: Limit number of rows to read
 */
export interface PolarsAvroConfig {
  // === File Path ===
  source: string; // File path

  // === Column Selection ===
  columns: string[] | number[] | null; // Columns to read (names or indices)

  // === Row Selection ===
  n_rows: number | null; // Read only n rows (null = all)
}

/**
 * Default configuration for Avro read
 */
export const AVRO_DEFAULTS: PolarsAvroConfig = {
  source: "",
  columns: null,
  n_rows: null,
};

/**
 * Avro format information for UI
 */
export const AVRO_INFO = {
  name: "Apache Avro",
  description:
    "Row-based binary format commonly used in Hadoop and Kafka ecosystems",
  extensions: [".avro"],
  features: [
    "Schema-first design",
    "Compact binary encoding",
    "Schema evolution support",
    "Common in big data pipelines",
  ],
  limitations: [
    "No lazy scanning (always loads full file)",
    "Row-based (less efficient for columnar queries)",
  ],
};

/**
 * Create a new Avro config with defaults
 */
export function createAvroConfig(
  overrides: Partial<PolarsAvroConfig> = {}
): PolarsAvroConfig {
  return {
    ...AVRO_DEFAULTS,
    ...overrides,
  };
}

/**
 * Validate Avro configuration
 */
export function validateAvroConfig(
  config: Partial<PolarsAvroConfig>
): string[] {
  const errors: string[] = [];

  if (!config.source) {
    errors.push("Source file path is required");
  }

  if (config.n_rows !== null && config.n_rows !== undefined) {
    if (!Number.isInteger(config.n_rows) || config.n_rows <= 0) {
      errors.push("Number of rows must be a positive integer");
    }
  }

  if (config.columns !== null && config.columns !== undefined) {
    if (!Array.isArray(config.columns)) {
      errors.push("Columns must be an array");
    }
  }

  return errors;
}
