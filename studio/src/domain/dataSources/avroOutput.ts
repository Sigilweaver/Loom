/**
 * Polars Avro Output Configuration
 *
 * Based on Polars Python API:
 * - polars.DataFrame.write_avro (eager write only - no streaming sink)
 *
 * References:
 * https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_avro.html
 * https://sigilweaver.app/docs/user/tools/input-output/output/#avro
 *
 * Apache Avro is a row-based binary format commonly used in
 * big data ecosystems (Hadoop, Kafka, Spark).
 *
 * Note: Unlike IPC/Parquet, Avro does not support streaming sink in Polars.
 * All writes are eager (entire DataFrame must be collected first).
 */

/**
 * Avro Compression Options
 * write_avro supports: 'uncompressed', 'snappy', 'deflate'
 */
export type AvroCompressionType = "uncompressed" | "snappy" | "deflate";

/**
 * Polars Avro Output Configuration
 */
export interface PolarsAvroOutputConfig {
  // === Output Type ===
  type: "avro";
  category: "file";

  // === File Path ===
  destination: string; // Output file path

  // === Compression ===
  compression: AvroCompressionType; // Default: 'uncompressed'

  // === Schema Name ===
  name: string; // Schema name (defaults to empty string)
}

/**
 * Default configuration for Avro output
 */
export const DEFAULT_AVRO_OUTPUT_CONFIG: Partial<PolarsAvroOutputConfig> = {
  type: "avro",
  category: "file",
  destination: "",
  compression: "uncompressed",
  name: "",
};

/**
 * Avro compression options for UI
 */
export const AVRO_COMPRESSION_OPTIONS: {
  value: AvroCompressionType;
  label: string;
  description: string;
}[] = [
  {
    value: "uncompressed",
    label: "Uncompressed",
    description: "No compression - fastest write/read, largest file size",
  },
  {
    value: "snappy",
    label: "Snappy",
    description: "Fast compression with moderate ratio - good for speed",
  },
  {
    value: "deflate",
    label: "Deflate",
    description: "Higher compression ratio - smaller files, slower",
  },
];

/**
 * Avro output format information for UI
 */
export const AVRO_OUTPUT_INFO = {
  name: "Apache Avro",
  description:
    "Row-based binary format for big data ecosystems",
  documentationUrl: "https://sigilweaver.app/docs/user/tools/input-output/output/#avro",
  note: "Avro does not support streaming writes - data is collected before writing",
  features: [
    "Self-describing with embedded schema",
    "Schema evolution support",
    "Widely supported in Hadoop/Kafka/Spark",
  ],
};

/**
 * Get default config for Avro output
 */
export function getDefaultAvroOutputConfig(): Partial<PolarsAvroOutputConfig> {
  return { ...DEFAULT_AVRO_OUTPUT_CONFIG };
}

/**
 * Validate Avro output configuration
 */
export function validateAvroOutputConfig(
  config: Partial<PolarsAvroOutputConfig>
): string[] {
  const errors: string[] = [];

  if (!config.destination) {
    errors.push("Destination file path is required");
  } else if (!config.destination.toLowerCase().endsWith(".avro")) {
    errors.push("Destination should have .avro extension");
  }

  const validCompressions: AvroCompressionType[] = [
    "uncompressed",
    "snappy",
    "deflate",
  ];
  if (
    config.compression &&
    !validCompressions.includes(config.compression)
  ) {
    errors.push(
      `Invalid compression: ${config.compression}. Must be one of: ${validCompressions.join(", ")}`
    );
  }

  return errors;
}
