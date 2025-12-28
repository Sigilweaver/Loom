/**
 * Type compatibility logic for join operations.
 * 
 * Determines which data types can be joined together based on
 * semantic compatibility groups.
 */

import type { ColumnSchema } from "../../../api/backend";

/**
 * Type compatibility groups for join keys.
 * Types within the same group can be joined.
 */
export type TypeGroup =
  | "numeric"
  | "string"
  | "temporal"
  | "boolean"
  | "categorical"
  | "other";

/**
 * Determine which compatibility group a dtype belongs to.
 */
export function getTypeGroup(dtype: string): TypeGroup {
  // Normalize to lowercase for comparison
  const d = dtype.toLowerCase();

  // Numeric types (integers and floats)
  if (d.includes("int") || d.includes("float") || d === "decimal") {
    return "numeric";
  }

  // String types
  if (d === "string" || d === "utf8" || d === "str") {
    return "string";
  }

  // Temporal types
  if (d === "date" || d === "datetime" || d === "time" || d === "duration") {
    return "temporal";
  }

  // Boolean
  if (d === "boolean" || d === "bool") {
    return "boolean";
  }

  // Categorical (can join with string or categorical)
  if (d === "categorical") {
    return "categorical";
  }

  return "other";
}

/**
 * Check if two dtypes are compatible for joining.
 * 
 * Compatible types:
 * - Same group (numeric with numeric, string with string, etc.)
 * - Categorical with String (special case)
 */
export function areTypesCompatible(
  leftDtype: string,
  rightDtype: string
): boolean {
  const leftGroup = getTypeGroup(leftDtype);
  const rightGroup = getTypeGroup(rightDtype);

  // Same group is always compatible
  if (leftGroup === rightGroup) return true;

  // Categorical can join with string
  if (
    (leftGroup === "categorical" && rightGroup === "string") ||
    (leftGroup === "string" && rightGroup === "categorical")
  ) {
    return true;
  }

  return false;
}

/**
 * Filter columns to only those compatible with a given dtype.
 * If no targetDtype is specified, returns all columns.
 */
export function filterCompatibleColumns(
  columns: ColumnSchema[],
  targetDtype: string | undefined
): ColumnSchema[] {
  if (!targetDtype) return columns;
  return columns.filter((col) => areTypesCompatible(targetDtype, col.dtype));
}
