/**
 * Polars Data Type Definitions
 *
 * Centralized type metadata for Polars data types used throughout the application.
 * This data is used by components like SelectConfiguration for type casting UI,
 * SummarizeConfiguration for numeric type detection, and csv.ts for schema definitions.
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
  | "nested"
  | "other";

/**
 * UI groupings for type selector dropdowns (distinct from category for display purposes)
 */
export type UITypeGroup =
  | "Integers (Signed)"
  | "Integers (Unsigned)"
  | "Decimal"
  | "Text"
  | "Temporal"
  | "Nested"
  | "Other";

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
  /** UI group for dropdown display */
  uiGroup: UITypeGroup;
  /** Size in bytes (0 for variable-length types) */
  size: number;
  /** Compact size display for UI (e.g., "8 Bytes | -9.2e18 - 9.2e18") */
  sizeDisplay: string;
  /** Human-readable description of the type */
  description: string;
  /**
   * Whether this type can be cast TO in the UI.
   * Some types (Decimal, List, Struct) require additional parameters or aren't
   * supported by the backend's simple type casting.
   * Defaults to true if not specified.
   */
  castable?: boolean;
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
    uiGroup: "Integers (Signed)",
    size: 1,
    sizeDisplay: "1 Byte | -128 - 127",
    description: "-128 to 127",
  },
  {
    value: "Int16",
    label: "Int16",
    category: "integer",
    uiGroup: "Integers (Signed)",
    size: 2,
    sizeDisplay: "2 Bytes | -32,768 - 32,767",
    description: "-32,768 to 32,767",
  },
  {
    value: "Int32",
    label: "Int32",
    category: "integer",
    uiGroup: "Integers (Signed)",
    size: 4,
    sizeDisplay: "4 Bytes | -2.1B - 2.1B",
    description: "-2.1B to 2.1B",
  },
  {
    value: "Int64",
    label: "Int64",
    category: "integer",
    uiGroup: "Integers (Signed)",
    size: 8,
    sizeDisplay: "8 Bytes | -9.2e18 - 9.2e18",
    description: "-9.2e18 to 9.2e18",
  },
  // Unsigned integers
  {
    value: "UInt8",
    label: "UInt8",
    category: "integer",
    uiGroup: "Integers (Unsigned)",
    size: 1,
    sizeDisplay: "1 Byte | 0 - 255",
    description: "0 to 255",
  },
  {
    value: "UInt16",
    label: "UInt16",
    category: "integer",
    uiGroup: "Integers (Unsigned)",
    size: 2,
    sizeDisplay: "2 Bytes | 0 - 65,535",
    description: "0 to 65,535",
  },
  {
    value: "UInt32",
    label: "UInt32",
    category: "integer",
    uiGroup: "Integers (Unsigned)",
    size: 4,
    sizeDisplay: "4 Bytes | 0 - 4.3B",
    description: "0 to 4.3B",
  },
  {
    value: "UInt64",
    label: "UInt64",
    category: "integer",
    uiGroup: "Integers (Unsigned)",
    size: 8,
    sizeDisplay: "8 Bytes | 0 - 1.8e19",
    description: "0 to 1.8e19",
  },
  // Floats / Decimal
  {
    value: "Float32",
    label: "Float32",
    category: "float",
    uiGroup: "Decimal",
    size: 4,
    sizeDisplay: "4 Bytes | ~7 digits precision",
    description: "~7 digits precision",
  },
  {
    value: "Float64",
    label: "Float64",
    category: "float",
    uiGroup: "Decimal",
    size: 8,
    sizeDisplay: "8 Bytes | ~15 digits precision",
    description: "~15 digits precision",
  },
  {
    value: "Decimal",
    label: "Decimal",
    category: "float",
    uiGroup: "Decimal",
    size: 16,
    sizeDisplay: "16 Bytes | arbitrary precision",
    description: "Arbitrary precision decimal",
    castable: false, // Requires precision/scale parameters, not supported in simple casting
  },
  // String / Text
  {
    value: "String",
    label: "String",
    category: "string",
    uiGroup: "Text",
    size: 0,
    sizeDisplay: "variable",
    description: "Variable length text",
  },
  {
    value: "Utf8",
    label: "Utf8",
    category: "string",
    uiGroup: "Text",
    size: 0,
    sizeDisplay: "variable",
    description: "UTF-8 encoded text",
  },
  // Boolean
  {
    value: "Boolean",
    label: "Boolean",
    category: "boolean",
    uiGroup: "Other",
    size: 1,
    sizeDisplay: "1 bit | true - false",
    description: "true / false",
  },
  // Temporal
  {
    value: "Date",
    label: "Date",
    category: "temporal",
    uiGroup: "Temporal",
    size: 4,
    sizeDisplay: "4 Bytes",
    description: "Calendar date",
  },
  {
    value: "Datetime",
    label: "Datetime",
    category: "temporal",
    uiGroup: "Temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Date + time (ns)",
  },
  {
    value: "Time",
    label: "Time",
    category: "temporal",
    uiGroup: "Temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Time of day",
  },
  {
    value: "Duration",
    label: "Duration",
    category: "temporal",
    uiGroup: "Temporal",
    size: 8,
    sizeDisplay: "8 Bytes",
    description: "Time duration",
  },
  // Nested types (for schema definitions, not typically in type casting UI)
  {
    value: "List",
    label: "List",
    category: "nested",
    uiGroup: "Nested",
    size: 0,
    sizeDisplay: "variable",
    description: "List of values",
    castable: false,
  },
  {
    value: "Struct",
    label: "Struct",
    category: "nested",
    uiGroup: "Nested",
    size: 0,
    sizeDisplay: "variable",
    description: "Structured record",
    castable: false,
  },
  // Other
  {
    value: "Categorical",
    label: "Categorical",
    category: "other",
    uiGroup: "Other",
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

/**
 * Get types grouped by UI group for dropdown generation
 */
export function getPolarsTypesGroupedByUI(): Map<UITypeGroup, PolarsTypeInfo[]> {
  const groups = new Map<UITypeGroup, PolarsTypeInfo[]>();
  for (const t of POLARS_TYPES) {
    const group = groups.get(t.uiGroup) || [];
    group.push(t);
    groups.set(t.uiGroup, group);
  }
  return groups;
}

/**
 * Get types for type casting (excludes types that can't be cast to in the UI).
 * Types with castable: false are excluded (e.g., Decimal requires precision/scale,
 * nested types require schema definitions).
 */
export function getCastablePolarsTypes(): PolarsTypeInfo[] {
  return POLARS_TYPES.filter((t) => t.castable !== false);
}

/**
 * Get castable types grouped by UI group for dropdown generation.
 * Pre-computed for efficiency since this is static data.
 */
export const CASTABLE_TYPES_BY_UI_GROUP: Map<UITypeGroup, PolarsTypeInfo[]> = (() => {
  const groups = new Map<UITypeGroup, PolarsTypeInfo[]>();
  for (const t of POLARS_TYPES) {
    if (t.castable === false) continue;
    const group = groups.get(t.uiGroup) || [];
    group.push(t);
    groups.set(t.uiGroup, group);
  }
  return groups;
})();

/**
 * Union type of all valid Polars data type names
 */
export type PolarsDataType =
  | "Int8"
  | "Int16"
  | "Int32"
  | "Int64"
  | "UInt8"
  | "UInt16"
  | "UInt32"
  | "UInt64"
  | "Float32"
  | "Float64"
  | "Decimal"
  | "String"
  | "Utf8"
  | "Boolean"
  | "Date"
  | "Datetime"
  | "Time"
  | "Duration"
  | "List"
  | "Struct"
  | "Categorical";
