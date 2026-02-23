import { describe, expect, it } from "vitest";
import type { ToolConfig } from "@domain/workflow/entities/workflow";
import { generateComment } from "../commentGenerator";

describe("commentGenerator", () => {
  describe("Input tool", () => {
    it("should return filename from source path", () => {
      const config: ToolConfig = { source: "/data/sales.csv" };
      expect(generateComment("Input", config)).toBe("sales.csv");
    });

    it("should return filename from filePath", () => {
      const config: ToolConfig = { filePath: "C:\\Users\\data\\report.parquet" };
      expect(generateComment("Input", config)).toBe("report.parquet");
    });

    it("should return database label for database category", () => {
      const config: ToolConfig = {
        category: "database",
        type: "postgres",
        connectionName: "prod-db",
        query: "SELECT * FROM orders",
      };
      expect(generateComment("Input", config)).toBe(
        "prod-db: SELECT * FROM orders"
      );
    });

    it("should return empty string for sparse config", () => {
      expect(generateComment("Input", {})).toBe("");
    });
  });

  describe("Output tool", () => {
    it("should return filename from destination", () => {
      const config: ToolConfig = { destination: "/out/result.csv" };
      expect(generateComment("Output", config)).toBe("result.csv");
    });

    it("should return database label with table name", () => {
      const config: ToolConfig = {
        category: "database",
        type: "postgres",
        connectionName: "warehouse",
        tableName: "dim_users",
      };
      expect(generateComment("Output", config)).toBe("warehouse: dim_users");
    });
  });

  describe("Filter tool", () => {
    it("should return expression in expression mode", () => {
      const config: ToolConfig = {
        mode: "Expression",
        expression: "pl.col('age') > 18",
      };
      expect(generateComment("Filter", config)).toBe("pl.col('age') > 18");
    });

    it("should format single condition", () => {
      const config: ToolConfig = {
        conditions: [{ column: "status", operator: "=", value: "active" }],
      };
      expect(generateComment("Filter", config)).toBe("status = active");
    });

    it("should summarize multiple conditions", () => {
      const config: ToolConfig = {
        conditions: [
          { column: "a", operator: ">", value: 1 },
          { column: "b", operator: "<", value: 10 },
        ],
        combinator: "and",
      };
      expect(generateComment("Filter", config)).toBe("2 conditions (AND)");
    });

    it("should return empty for no conditions", () => {
      const config: ToolConfig = { conditions: [] };
      expect(generateComment("Filter", config)).toBe("");
    });
  });

  describe("Select tool", () => {
    it("should count columns", () => {
      const config: ToolConfig = {
        columnConfigs: [{ column: "a" }, { column: "b" }, { column: "c" }],
      };
      expect(generateComment("Select", config)).toBe("3 columns");
    });

    it("should show single rename", () => {
      const config: ToolConfig = {
        columnConfigs: [{ column: "old_name", rename: "new_name" }],
      };
      expect(generateComment("Select", config)).toBe("old_name → new_name");
    });

    it("should count renames", () => {
      const config: ToolConfig = {
        columnConfigs: [
          { column: "a", rename: "x" },
          { column: "b", rename: "b" },
          { column: "c", rename: "z" },
        ],
      };
      expect(generateComment("Select", config)).toBe("3 columns, 2 renamed");
    });
  });

  describe("Sort tool", () => {
    it("should show single sort", () => {
      const config: ToolConfig = {
        sortColumns: [{ column: "price", direction: "desc" }],
      };
      expect(generateComment("Sort", config)).toBe("by price DESC");
    });

    it("should show first + count for multiple sorts", () => {
      const config: ToolConfig = {
        sortColumns: [
          { column: "date", direction: "asc" },
          { column: "id", direction: "desc" },
        ],
      };
      expect(generateComment("Sort", config)).toBe("by date ASC, +1 more");
    });

    it("should return empty for no sort columns", () => {
      expect(generateComment("Sort", { sortColumns: [] })).toBe("");
    });
  });

  describe("Formula tool", () => {
    it("should show single formula assignment", () => {
      const config: ToolConfig = {
        operations: [{ column_name: "total", expression: "qty * price" }],
      };
      expect(generateComment("Formula", config)).toBe("total = qty * price");
    });

    it("should count multiple formulas", () => {
      const config: ToolConfig = {
        operations: [
          { column_name: "a", expression: "1" },
          { column_name: "b", expression: "2" },
          { column_name: "c", expression: "3" },
        ],
      };
      expect(generateComment("Formula", config)).toBe("3 formulas");
    });

    it("should fall back to legacy single expression", () => {
      const config: ToolConfig = {
        column_name: "result",
        expression: "a + b",
      };
      expect(generateComment("Formula", config)).toBe("result = a + b");
    });
  });

  describe("Sample tool", () => {
    it("should describe FirstN", () => {
      const config: ToolConfig = { mode: "FirstN", n: 50 };
      expect(generateComment("Sample", config)).toBe("First 50 rows");
    });

    it("should describe RandomPercent", () => {
      const config: ToolConfig = { mode: "RandomPercent", percent: 25 };
      expect(generateComment("Sample", config)).toBe("Random 25%");
    });

    it("should use defaults when n is missing", () => {
      const config: ToolConfig = { mode: "FirstN" };
      expect(generateComment("Sample", config)).toBe("First 100 rows");
    });
  });

  describe("Unique tool", () => {
    it("should show single column", () => {
      const config: ToolConfig = { columns: ["email"] };
      expect(generateComment("Unique", config)).toBe("by email");
    });

    it("should count multiple columns", () => {
      const config: ToolConfig = { columns: ["a", "b", "c"] };
      expect(generateComment("Unique", config)).toBe("by 3 columns");
    });

    it("should default to all columns", () => {
      expect(generateComment("Unique", { columns: [] })).toBe("All columns");
    });
  });

  describe("Union tool", () => {
    it("should show union mode", () => {
      expect(generateComment("Union", { mode: "by Position" })).toBe(
        "Concatenate by Position"
      );
    });

    it("should default to by Name", () => {
      expect(generateComment("Union", {})).toBe("Concatenate by Name");
    });
  });

  describe("Join tool", () => {
    it("should show join type and key", () => {
      const config: ToolConfig = {
        joinType: "left",
        leftKeys: ["id"],
        rightKeys: ["user_id"],
      };
      expect(generateComment("Join", config)).toBe("Left on id");
    });

    it("should count multiple keys", () => {
      const config: ToolConfig = {
        joinType: "inner",
        leftKeys: ["a", "b"],
        rightKeys: ["c", "d"],
      };
      expect(generateComment("Join", config)).toBe("Inner on 2 keys");
    });

    it("should show type only when no keys", () => {
      const config: ToolConfig = { joinType: "outer" };
      expect(generateComment("Join", config)).toBe("Outer");
    });
  });

  describe("Summarize tool", () => {
    it("should show single aggregation with group", () => {
      const config: ToolConfig = {
        groupByColumns: ["region"],
        aggregations: [{ column: "sales", operation: "Sum" }],
      };
      expect(generateComment("Summarize", config)).toBe("Sum sales by region");
    });

    it("should count multiple aggregations and groups", () => {
      const config: ToolConfig = {
        groupByColumns: ["a", "b"],
        aggregations: [
          { column: "x", operation: "Sum" },
          { column: "y", operation: "Avg" },
        ],
      };
      expect(generateComment("Summarize", config)).toBe(
        "2 aggregations by 2 groups"
      );
    });

    it("should return empty for no aggregations", () => {
      expect(generateComment("Summarize", {})).toBe("");
    });
  });

  describe("Pivot tool", () => {
    it("should describe pivot", () => {
      const config: ToolConfig = {
        on: "category",
        index: ["date"],
        values: "amount",
      };
      expect(generateComment("Pivot", config)).toBe(
        "Pivot category by date (amount)"
      );
    });

    it("should return empty for sparse config", () => {
      expect(generateComment("Pivot", {})).toBe("");
    });
  });

  describe("Unpivot tool", () => {
    it("should describe single column unpivot", () => {
      const config: ToolConfig = { on: ["revenue"] };
      expect(generateComment("Unpivot", config)).toBe("Unpivot revenue");
    });

    it("should count multiple columns", () => {
      const config: ToolConfig = { on: ["a", "b", "c"] };
      expect(generateComment("Unpivot", config)).toBe("Unpivot 3 columns");
    });
  });

  describe("Unknown tool type", () => {
    it("should return empty string", () => {
      expect(generateComment("CustomTool", {})).toBe("");
    });
  });
});
