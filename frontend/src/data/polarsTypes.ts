/**
 * Polars Data Type Definitions
 *
 * Centralized type metadata for Polars data types used throughout the application.
 * This data is used by components like SelectConfiguration for type casting UI.
 *
 * Reference: https://docs.pola.rs/api/python/stable/reference/datatypes.html
 */

/**
 * Category groupings for Polars data types
 */
export type TypeCategory =
  | "integer"
  | "float"
  | "string"
  | "boolean"
  | "temporal"
  | "other";

/**
 * Metadata for a single Polars data type
 */
export interface PolarsTypeInfo {
  /** The Polars type name (e.g., "Int64", "Float32") */
  value: string;
  /** Human-readable label for display */
  label: string;
  /** Category for grouping in UI */
  category: TypeCategory;
  /** Size in bytes (0 for variable-length types) */
  size: number;
  /** Compact size display for UI (e.g., "8 Bytes | -9.2e18 - 9.2e18") */
  sizeDisplay: string;
  /** Human-readable description of the type */
  description: string;
}

/**
 * All supported Polars data types with metadata
 */
export const POLARS_TYPES: PolarsTypeInfo[] = [
  // Signed integers
  {
    value: "Int8",
    label: "Int8",
    category: "integer",
    size: 1,
    sizeDisplay: "1 Byte | -128 - 127",
    description: "-128 to 127",
  },
  {
    value: "Int16",
    label: "Int16",
    category: "integer",
    size: 2,
    sizeDisplay: "2 Bytes | -32,768 - 32,767",
    description: "-32,768 to 32,767",
  },
  {
    value: "Int32",
    label: "Int32",
    category: "integer",
    size: 4,
    sizeDisplay: "4 Bytes | -2.1B - 2.1B",
    description: "-2.1B to 2.1B",
  },
  {
    value: "Int64",
    label: "Int64",
    category: "integer",
    size: 8,
    sizeDisplay: "8 Bytes | -9.2e18 - 9.2e18",
    description: "-9.2e18 to 9.2e18",
  },
  // Unsigned integers
  {
    value: "UInt8",
    label: "UInt8",
    category: "integer",
    size: 1,
    sizeDisplay: "1 Byte | 0 - 255",
    description: "0 to 255",
  },
  {
    value: "UInt16",
    label: "UInt16",
    category: "integer",
    size: 2,
    sizeDisplay: "2 Bytes | 0 - 65,535",
    description: "0 to 65,535",
  },
  {
    value: "UInt32",
    label: "UInt32",
    category: "integer",
    size: 4,
    sizeDisplay: "4 Bytes | 0 - 4.3B",
    description: "0 to 4.3B",
  },
  {
    value: "UInt64",
    label: "UInt64",
    category: "integer",
    size: 8,
    sizeDisplay: "8 Bytes | 0 - 1.8e19",
    description: "0 to 1.8e19",
  },
  // Floats
  {
    value: "Float32",
    label: "Float32",
    category: "float",
    size: 4,
    sizeDisplay: "4 Bytes | ~7 digits precision",
    description: "~7 digits precision",
  },
  {
    value: "Float64",
    label: "Float64",
    category: "float",
    size: 8,
    sizeDisplay: "8 Bytes | ~15 digits precision",
    description: "~15 digits precision",
  },
  // String
  {
    value: "String",
    label: "String",
    category: "string",
    size: 0,
    sizeDisplay: "variable",
    description: "Variable length text",
  },
  {
    value: "Utf8",
    label: "Utf8",
    category: "string",
    size: 0,
    sizeDisplay: "variable",
    description: "UTF-8 encoded text",
  },
  // Boolean
  {
    value: "Boolean",
    label: "Boolean",
    category: "boolean",
    size: 1,
    sizeDisplay: "1 bit | true - false",
    description: "true / false",
  },
  // Temporal
  {
    value: "Date",
    label: "Date",
    category: "temporal",
    size: 4,
    sizeDisplay: "4 Bytes",
    description: "Calendar date",
  },
  {
    value: "Datetime",
    label: "Datetime",
    category: "temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Date + time (ns)",
  },
  {
    value: "Time",
    label: "Time",
    category: "temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Time of day",
  },
  {
    value: "Duration",
    label: "Duration",
    category: "temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Time duration",
  },
  // Other
  {
    value: "Categorical",
    label: "Categorical",
    category: "other",
    size: 0,
    sizeDisplay: "variable",
    description: "Enum-like values",
  },
];

/**
 * Lookup map for O(1) type info access by value
 */
export const POLARS_TYPES_MAP = new Map(
  POLARS_TYPES.map((t) => [t.value, t])
);

/**
 * Get type info by value, with optional fallback
 */
export function getPolarsTypeInfo(
  value: string
): PolarsTypeInfo | undefined {
  return POLARS_TYPES_MAP.get(value);
}

/**
 * Get types filtered by category
 */
export function getPolarsTypesByCategory(
  category: TypeCategory
): PolarsTypeInfo[] {
  return POLARS_TYPES.filter((t) => t.category === category);
}

/**
 * Check if a type value is numeric (integer or float)
 */
export function isNumericPolarsType(typeValue: string): boolean {
  const info = POLARS_TYPES_MAP.get(typeValue);
  return info?.category === "integer" || info?.category === "float";
}

/**
 * Check if a type value is temporal
 */
export function isTemporalPolarsType(typeValue: string): boolean {
  const info = POLARS_TYPES_MAP.get(typeValue);
  return info?.category === "temporal";
}
