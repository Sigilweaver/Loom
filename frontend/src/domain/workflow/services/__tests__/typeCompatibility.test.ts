import { describe, it, expect } from "vitest";
import {
  getTypeGroup,
  areTypesCompatible,
  filterCompatibleColumns,
  TypeGroup,
} from "../typeCompatibility";
import type { ColumnSchema } from "../../../../api/backend";

describe("typeCompatibility", () => {
  describe("getTypeGroup", () => {
    it.each([
      // Numeric types
      ["Int8", "numeric"],
      ["Int16", "numeric"],
      ["Int32", "numeric"],
      ["Int64", "numeric"],
      ["UInt8", "numeric"],
      ["UInt16", "numeric"],
      ["UInt32", "numeric"],
      ["UInt64", "numeric"],
      ["Float32", "numeric"],
      ["Float64", "numeric"],
      ["decimal", "numeric"],
      // String types
      ["String", "string"],
      ["Utf8", "string"],
      ["str", "string"],
      // Temporal types
      ["Date", "temporal"],
      ["Datetime", "temporal"],
      ["Time", "temporal"],
      ["Duration", "temporal"],
      // Boolean
      ["Boolean", "boolean"],
      ["bool", "boolean"],
      // Categorical
      ["Categorical", "categorical"],
      // Other
      ["List", "other"],
      ["Struct", "other"],
      ["Unknown", "other"],
    ])("classifies %s as %s", (dtype, expectedGroup) => {
      expect(getTypeGroup(dtype)).toBe(expectedGroup as TypeGroup);
    });

    it("is case-insensitive", () => {
      expect(getTypeGroup("INT64")).toBe("numeric");
      expect(getTypeGroup("string")).toBe("string");
      expect(getTypeGroup("BOOLEAN")).toBe("boolean");
    });
  });

  describe("areTypesCompatible", () => {
    describe("same group compatibility", () => {
      it("allows Int64 to join with Int32", () => {
        expect(areTypesCompatible("Int64", "Int32")).toBe(true);
      });

      it("allows Int64 to join with Float64", () => {
        expect(areTypesCompatible("Int64", "Float64")).toBe(true);
      });

      it("allows String to join with Utf8", () => {
        expect(areTypesCompatible("String", "Utf8")).toBe(true);
      });

      it("allows Date to join with Datetime", () => {
        expect(areTypesCompatible("Date", "Datetime")).toBe(true);
      });

      it("allows Boolean to join with Boolean", () => {
        expect(areTypesCompatible("Boolean", "Boolean")).toBe(true);
      });
    });

    describe("cross-group incompatibility", () => {
      it("disallows Int64 to join with String", () => {
        expect(areTypesCompatible("Int64", "String")).toBe(false);
      });

      it("disallows String to join with Boolean", () => {
        expect(areTypesCompatible("String", "Boolean")).toBe(false);
      });

      it("disallows Date to join with Int64", () => {
        expect(areTypesCompatible("Date", "Int64")).toBe(false);
      });

      it("disallows Boolean to join with Float64", () => {
        expect(areTypesCompatible("Boolean", "Float64")).toBe(false);
      });
    });

    describe("categorical special case", () => {
      it("allows Categorical to join with String", () => {
        expect(areTypesCompatible("Categorical", "String")).toBe(true);
      });

      it("allows String to join with Categorical", () => {
        expect(areTypesCompatible("String", "Categorical")).toBe(true);
      });

      it("allows Categorical to join with Categorical", () => {
        expect(areTypesCompatible("Categorical", "Categorical")).toBe(true);
      });

      it("disallows Categorical to join with Int64", () => {
        expect(areTypesCompatible("Categorical", "Int64")).toBe(false);
      });
    });
  });

  describe("filterCompatibleColumns", () => {
    const testColumns: ColumnSchema[] = [
      { name: "id", dtype: "Int64", nullable: false },
      { name: "name", dtype: "String", nullable: false },
      { name: "score", dtype: "Float64", nullable: true },
      { name: "created_at", dtype: "Datetime", nullable: false },
      { name: "is_active", dtype: "Boolean", nullable: false },
      { name: "category", dtype: "Categorical", nullable: true },
    ];

    it("returns all columns when targetDtype is undefined", () => {
      const result = filterCompatibleColumns(testColumns, undefined);
      expect(result).toHaveLength(6);
      expect(result).toEqual(testColumns);
    });

    it("filters to only numeric columns when target is Int64", () => {
      const result = filterCompatibleColumns(testColumns, "Int64");
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).toEqual(["id", "score"]);
    });

    it("filters to string and categorical columns when target is String", () => {
      const result = filterCompatibleColumns(testColumns, "String");
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).toEqual(["name", "category"]);
    });

    it("filters to only boolean columns when target is Boolean", () => {
      const result = filterCompatibleColumns(testColumns, "Boolean");
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("is_active");
    });

    it("filters to only temporal columns when target is Date", () => {
      const result = filterCompatibleColumns(testColumns, "Date");
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("created_at");
    });

    it("returns empty array when no compatible columns exist", () => {
      const numericOnly: ColumnSchema[] = [
        { name: "count", dtype: "Int64", nullable: false },
      ];
      const result = filterCompatibleColumns(numericOnly, "String");
      expect(result).toHaveLength(0);
    });

    it("handles empty columns array", () => {
      const result = filterCompatibleColumns([], "Int64");
      expect(result).toHaveLength(0);
    });
  });
});
