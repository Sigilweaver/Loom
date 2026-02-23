import { describe, expect, it } from "vitest";
import { enrichToolConfig } from "../tools/canvas";

describe("enrichToolConfig", () => {
  it("should pass through config for unknown tool types", () => {
    const config = { foo: "bar", baz: 42 };
    expect(enrichToolConfig("UnknownType", config)).toEqual(config);
  });
});

describe("enrichFilterConfig", () => {
  it("should return config unchanged when no conditions are present", () => {
    const config = { expression: "pl.col('x') > 5" };
    const result = enrichToolConfig("Filter", config);
    expect(result.expression).toBe("pl.col('x') > 5");
  });

  it("should generate expression from flat conditions with 'and' combinator", () => {
    const config = {
      conditions: [
        { column: "age", operator: "gt", value: "18" },
        { column: "status", operator: "eq", value: "active" },
      ],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    expect(result.expression).toBe(
      '(pl.col("age") > 18) & (pl.col("status") == "active")',
    );
    expect(result.mode).toBe("Basic");
  });

  it("should generate expression with 'or' combinator", () => {
    const config = {
      conditions: [
        { column: "x", operator: "eq", value: "1" },
        { column: "y", operator: "eq", value: "2" },
      ],
      combinator: "or",
    };
    const result = enrichToolConfig("Filter", config);
    expect(result.expression).toBe(
      '(pl.col("x") == 1) | (pl.col("y") == 2)',
    );
  });

  it("should handle nested groups for complex logic", () => {
    const config = {
      conditions: [{ column: "survived", operator: "eq", value: "0" }],
      groups: [
        {
          conditions: [
            { column: "sex", operator: "eq", value: "female" },
            { column: "age", operator: "lt", value: "18" },
          ],
          combinator: "or",
        },
      ],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    expect(result.expression).toBe(
      '(pl.col("survived") == 0) & ((pl.col("sex") == "female") | (pl.col("age") < 18))',
    );
  });

  it("should generate conditionGroup tree structure", () => {
    const config = {
      conditions: [{ column: "age", operator: "gt", value: "18" }],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    const group = result.conditionGroup as Record<string, unknown>;
    expect(group.type).toBe("group");
    expect(group.combinator).toBe("and");
    expect(Array.isArray(group.children)).toBe(true);
    const children = group.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    expect(children[0]!.type).toBe("condition");
    expect(children[0]!.column).toBe("age");
  });

  it("should build flat conditions list for legacy compat", () => {
    const config = {
      conditions: [
        { column: "a", operator: "eq", value: "1" },
        { column: "b", operator: "gt", value: "2" },
      ],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    const conds = result.conditions as Array<Record<string, unknown>>;
    expect(conds).toHaveLength(2);
    expect(conds[0]!.column).toBe("a");
    expect(conds[1]!.column).toBe("b");
  });

  it("should strip 'groups' key from final config", () => {
    const config = {
      conditions: [{ column: "x", operator: "eq", value: "1" }],
      groups: [{ conditions: [{ column: "y", operator: "eq", value: "2" }], combinator: "or" }],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    expect(result.groups).toBeUndefined();
  });

  it("should handle string operators (contains, starts_with, etc.)", () => {
    const config = {
      conditions: [
        { column: "name", operator: "contains", value: "john" },
        { column: "email", operator: "starts_with", value: "admin" },
        { column: "code", operator: "ends_with", value: "X" },
        { column: "notes", operator: "not_contains", value: "test" },
      ],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    const expr = result.expression as string;
    expect(expr).toContain('.str.contains("john")');
    expect(expr).toContain('.str.starts_with("admin")');
    expect(expr).toContain('.str.ends_with("X")');
    expect(expr).toContain('~(pl.col("notes").str.contains("test"))');
  });

  it("should handle null operators (is_null, is_not_null)", () => {
    const config = {
      conditions: [
        { column: "a", operator: "is_null" },
        { column: "b", operator: "is_not_null" },
      ],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    const expr = result.expression as string;
    expect(expr).toContain('pl.col("a").is_null()');
    expect(expr).toContain('pl.col("b").is_not_null()');
  });

  it("should handle boolean operators (is_true, is_false)", () => {
    const config = {
      conditions: [
        { column: "active", operator: "is_true" },
        { column: "deleted", operator: "is_false" },
      ],
      combinator: "or",
    };
    const result = enrichToolConfig("Filter", config);
    const expr = result.expression as string;
    expect(expr).toContain('pl.col("active") == True');
    expect(expr).toContain('pl.col("deleted") == False');
  });

  it("should handle single condition without wrapping in parens", () => {
    const config = {
      conditions: [{ column: "x", operator: "eq", value: "1" }],
      combinator: "and",
    };
    const result = enrichToolConfig("Filter", config);
    expect(result.expression).toBe('pl.col("x") == 1');
  });
});

describe("enrichSummarizeConfig", () => {
  it("should return config unchanged when no aggregations or groupBy", () => {
    const config = { someOtherKey: "value" };
    const result = enrichToolConfig("Summarize", config);
    expect(result).toEqual(config);
  });

  it("should build unified actions array with groupBy + aggregations", () => {
    const config = {
      groupByColumns: ["category"],
      aggregations: [
        { column: "amount", operation: "Sum", outputName: "Total" },
      ],
    };
    const result = enrichToolConfig("Summarize", config);
    const actions = result.actions as Array<Record<string, unknown>>;
    expect(actions).toHaveLength(2);
    expect(actions[0]!.action).toBe("GroupBy");
    expect(actions[0]!.column).toBe("category");
    expect(actions[1]!.action).toBe("Sum");
    expect(actions[1]!.column).toBe("amount");
    expect(actions[1]!.outputName).toBe("Total");
  });

  it("should normalize operation names from lowercase to PascalCase", () => {
    const config = {
      aggregations: [
        { column: "x", operation: "sum" },
        { column: "y", operation: "mean" },
        { column: "z", operation: "count" },
        { column: "w", operation: "countdistinct" },
        { column: "v", operation: "count_distinct" },
      ],
    };
    const result = enrichToolConfig("Summarize", config);
    const actions = result.actions as Array<Record<string, unknown>>;
    expect(actions[0]!.action).toBe("Sum");
    expect(actions[1]!.action).toBe("Mean");
    expect(actions[2]!.action).toBe("Count");
    expect(actions[3]!.action).toBe("CountDistinct");
    expect(actions[4]!.action).toBe("CountDistinct");
  });

  it("should handle groupByColumns as objects with 'column' key", () => {
    const config = {
      groupByColumns: [{ column: "region" }, { column: "year" }],
      aggregations: [],
    };
    const result = enrichToolConfig("Summarize", config);
    const actions = result.actions as Array<Record<string, unknown>>;
    expect(actions).toHaveLength(2);
    expect(actions[0]!.column).toBe("region");
    expect(actions[1]!.column).toBe("year");
  });

  it("should use 'alias' as fallback for outputName", () => {
    const config = {
      aggregations: [
        { column: "price", operation: "Mean", alias: "AvgPrice" },
      ],
    };
    const result = enrichToolConfig("Summarize", config);
    const aggs = result.aggregations as Array<Record<string, unknown>>;
    expect(aggs[0]!.outputName).toBe("AvgPrice");
  });

  it("should auto-generate outputName when neither outputName nor alias provided", () => {
    const config = {
      aggregations: [
        { column: "sales", operation: "Sum" },
      ],
    };
    const result = enrichToolConfig("Summarize", config);
    const aggs = result.aggregations as Array<Record<string, unknown>>;
    expect(aggs[0]!.outputName).toBe("sales_Sum");
  });

  it("should normalize aggregations with _id fields", () => {
    const config = {
      groupByColumns: ["city"],
      aggregations: [
        { column: "val", operation: "min" },
        { column: "val", operation: "max" },
      ],
    };
    const result = enrichToolConfig("Summarize", config);
    const aggs = result.aggregations as Array<Record<string, unknown>>;
    expect(aggs).toHaveLength(2);
    expect(aggs[0]!.operation).toBe("Min");
    expect(aggs[1]!.operation).toBe("Max");
    // Each should have a _id
    expect(aggs[0]!._id).toBeTruthy();
    expect(aggs[1]!._id).toBeTruthy();
  });
});

describe("enrichFormulaConfig", () => {
  it("should normalize 'formulas' key to 'operations'", () => {
    const config = {
      formulas: [
        { column: "unit_price", expression: "pl.col('total') / pl.col('qty')" },
      ],
    };
    const result = enrichToolConfig("Formula", config);
    expect(result.formulas).toBeUndefined();
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops).toHaveLength(1);
    expect(ops[0]!.column_name).toBe("unit_price");
    expect(ops[0]!.expression).toBe("pl.col('total') / pl.col('qty')");
  });

  it("should normalize camelCase columnName to snake_case", () => {
    const config = {
      operations: [
        { columnName: "newCol", expression: "1 + 1" },
      ],
    };
    const result = enrichToolConfig("Formula", config);
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops[0]!.column_name).toBe("newCol");
  });

  it("should accept 'column' as alternate field name", () => {
    const config = {
      formulas: [
        { column: "ratio", expression: "pl.col('a') / pl.col('b')" },
      ],
    };
    const result = enrichToolConfig("Formula", config);
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops[0]!.column_name).toBe("ratio");
  });

  it("should wrap top-level column_name + expression into operations array", () => {
    const config = {
      column_name: "total",
      expression: "pl.col('a') + pl.col('b')",
    };
    const result = enrichToolConfig("Formula", config);
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops).toHaveLength(1);
    expect(ops[0]!.column_name).toBe("total");
  });

  it("should wrap top-level columnName (camelCase) into operations array", () => {
    const config = {
      columnName: "result",
      expression: "pl.col('x') * 2",
    };
    const result = enrichToolConfig("Formula", config);
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops).toHaveLength(1);
    expect(ops[0]!.column_name).toBe("result");
  });

  it("should handle multiple operations correctly", () => {
    const config = {
      operations: [
        { column_name: "a", expression: "pl.col('x') + 1" },
        { column_name: "b", expression: "pl.col('y') * 2" },
      ],
    };
    const result = enrichToolConfig("Formula", config);
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops).toHaveLength(2);
    expect(ops[0]!.column_name).toBe("a");
    expect(ops[1]!.column_name).toBe("b");
  });

  it("should default column_name to 'new_column' when missing", () => {
    const config = {
      operations: [{ expression: "1 + 1" }],
    };
    const result = enrichToolConfig("Formula", config);
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops[0]!.column_name).toBe("new_column");
  });

  it("should accept 'name' as alternate field for column_name in formulas", () => {
    const config = {
      formulas: [
        { name: "myCol", expression: "pl.lit(42)" },
      ],
    };
    const result = enrichToolConfig("Formula", config);
    const ops = result.operations as Array<Record<string, unknown>>;
    expect(ops[0]!.column_name).toBe("myCol");
  });
});

describe("enrichJoinConfig", () => {
  it("should normalize joinType to lowercase", () => {
    const config = { joinType: "Inner", leftKeys: ["id"], rightKeys: ["id"] };
    const result = enrichToolConfig("Join", config);
    expect(result.joinType).toBe("inner");
  });

  it("should remove empty leftKeys/rightKeys arrays", () => {
    const config = { joinType: "inner", leftKeys: [], rightKeys: [] };
    const result = enrichToolConfig("Join", config);
    expect(result.leftKeys).toBeUndefined();
    expect(result.rightKeys).toBeUndefined();
  });

  it("should preserve non-empty key arrays", () => {
    const config = { joinType: "left", leftKeys: ["customer_id"], rightKeys: ["id"] };
    const result = enrichToolConfig("Join", config);
    expect(result.leftKeys).toEqual(["customer_id"]);
    expect(result.rightKeys).toEqual(["id"]);
  });

  it("should pass through config when no joinType or keys", () => {
    const config = { someOther: "value" };
    const result = enrichToolConfig("Join", config);
    expect(result).toEqual(config);
  });

  it("should handle mixed empty/non-empty key arrays", () => {
    const config = { joinType: "inner", leftKeys: ["id"], rightKeys: [] };
    const result = enrichToolConfig("Join", config);
    expect(result.leftKeys).toEqual(["id"]);
    expect(result.rightKeys).toBeUndefined();
  });
});
