import { describe, it, expect } from "vitest";
import {
  ALL_OPERATIONS,
  OPERATIONS_BY_ID,
  OPERATION_CATEGORY_LABELS,
  getTypeCategory,
  getOperationsForDtype,
  getOperationsGroupedForDtype,
  type TypeCategory,
} from "../formulaOperations";

// ---------------------------------------------------------------------------
// Catalog integrity
// ---------------------------------------------------------------------------

describe("formulaOperations catalog", () => {
  it("has no duplicate operation IDs", () => {
    const ids = ALL_OPERATIONS.map((op) => op.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("OPERATIONS_BY_ID contains every operation", () => {
    expect(Object.keys(OPERATIONS_BY_ID).length).toBe(ALL_OPERATIONS.length);
    for (const op of ALL_OPERATIONS) {
      expect(OPERATIONS_BY_ID[op.id]).toBe(op);
    }
  });

  it("every operation has a valid category", () => {
    const validCategories = Object.keys(OPERATION_CATEGORY_LABELS);
    for (const op of ALL_OPERATIONS) {
      expect(validCategories).toContain(op.category);
    }
  });

  it("every operation has at least one applicable type", () => {
    for (const op of ALL_OPERATIONS) {
      expect(op.applicableTypes.length).toBeGreaterThan(0);
    }
  });

  it("every operation with params has default values or placeholders", () => {
    for (const op of ALL_OPERATIONS) {
      for (const param of op.params) {
        const hasHint =
          param.defaultValue !== undefined || param.placeholder !== undefined;
        // select params use options instead
        if (param.kind === "select") {
          expect(param.options).toBeDefined();
          expect(param.options!.length).toBeGreaterThan(0);
        } else if (param.kind !== "boolean" && param.kind !== "condition" && param.kind !== "column_or_value") {
          expect(hasHint).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getTypeCategory
// ---------------------------------------------------------------------------

describe("getTypeCategory", () => {
  it.each<[string, TypeCategory]>([
    ["Int32", "numeric"],
    ["Int64", "numeric"],
    ["UInt8", "numeric"],
    ["UInt64", "numeric"],
    ["Float32", "numeric"],
    ["Float64", "numeric"],
    ["Decimal", "numeric"],
    ["String", "string"],
    ["Utf8", "string"],
    ["Boolean", "boolean"],
    ["Date", "temporal"],
    ["Datetime", "temporal"],
    ["Time", "temporal"],
    ["Duration", "temporal"],
    ["List", "any"],
    ["Struct", "any"],
    ["Unknown", "any"],
  ])('maps %s to %s', (dtype, expected) => {
    expect(getTypeCategory(dtype)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getOperationsForDtype
// ---------------------------------------------------------------------------

describe("getOperationsForDtype", () => {
  it("returns math ops + any-typed ops for numeric columns", () => {
    const ops = getOperationsForDtype("Int64");
    const ids = ops.map((o) => o.id);
    // Should include math operations
    expect(ids).toContain("add");
    expect(ids).toContain("subtract");
    expect(ids).toContain("round");
    // Should include 'any'-typed operations
    expect(ids).toContain("cast");
    expect(ids).toContain("fill_null_value");
    expect(ids).toContain("row_number");
    // Should NOT include text-only operations
    expect(ids).not.toContain("uppercase");
    expect(ids).not.toContain("trim");
  });

  it("returns text ops + any-typed ops for string columns", () => {
    const ops = getOperationsForDtype("String");
    const ids = ops.map((o) => o.id);
    expect(ids).toContain("uppercase");
    expect(ids).toContain("lowercase");
    expect(ids).toContain("replace");
    expect(ids).toContain("cast");
    expect(ids).toContain("parse_date");
    // Should NOT include math-only operations
    expect(ids).not.toContain("add");
    expect(ids).not.toContain("sqrt");
  });

  it("returns temporal ops + any-typed ops for date columns", () => {
    const ops = getOperationsForDtype("Datetime");
    const ids = ops.map((o) => o.id);
    expect(ids).toContain("dt_year");
    expect(ids).toContain("dt_month");
    expect(ids).toContain("dt_truncate");
    expect(ids).toContain("cast");
    expect(ids).not.toContain("uppercase");
    expect(ids).not.toContain("add");
  });

  it("returns only any-typed ops for boolean columns", () => {
    const ops = getOperationsForDtype("Boolean");
    const ids = ops.map((o) => o.id);
    expect(ids).toContain("cast");
    expect(ids).toContain("is_null");
    expect(ids).toContain("row_number");
    expect(ids).not.toContain("add");
    expect(ids).not.toContain("uppercase");
    expect(ids).not.toContain("dt_year");
  });
});

// ---------------------------------------------------------------------------
// getOperationsGroupedForDtype
// ---------------------------------------------------------------------------

describe("getOperationsGroupedForDtype", () => {
  it("groups numeric ops with correct category labels", () => {
    const groups = getOperationsGroupedForDtype("Float64");
    const cats = groups.map((g) => g.category);
    expect(cats).toContain("math");
    expect(cats).not.toContain("text");
    expect(cats).not.toContain("datetime");
    // Should have type, null, conditional, other (all "any"-typed)
    expect(cats).toContain("type");
    expect(cats).toContain("null");
    expect(cats).toContain("conditional");
    expect(cats).toContain("other");
  });

  it("preserves category order", () => {
    const groups = getOperationsGroupedForDtype("String");
    const cats = groups.map((g) => g.category);
    // text should come before type, null, conditional, other
    const textIdx = cats.indexOf("text");
    const typeIdx = cats.indexOf("type");
    const nullIdx = cats.indexOf("null");
    expect(textIdx).toBeLessThan(typeIdx);
    expect(typeIdx).toBeLessThan(nullIdx);
  });

  it("has correct labels on each group", () => {
    const groups = getOperationsGroupedForDtype("Int64");
    for (const group of groups) {
      expect(group.label).toBe(OPERATION_CATEGORY_LABELS[group.category]);
    }
  });

  it("returns non-empty operation arrays in each group", () => {
    const groups = getOperationsGroupedForDtype("Float64");
    for (const group of groups) {
      expect(group.operations.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Math operations — toExpression
// ---------------------------------------------------------------------------

describe("Math operations — toExpression", () => {
  const col = "amount";

  it("add with value", () => {
    const op = OPERATIONS_BY_ID["add"]!;
    expect(op.toExpression(col, { mode: "value", operand: "10" })).toBe(
      `pl.col("amount") + 10`
    );
  });

  it("add with column", () => {
    const op = OPERATIONS_BY_ID["add"]!;
    expect(op.toExpression(col, { mode: "column", operand: "tax" })).toBe(
      `pl.col("amount") + pl.col("tax")`
    );
  });

  it("subtract", () => {
    const op = OPERATIONS_BY_ID["subtract"]!;
    expect(op.toExpression(col, { mode: "value", operand: "5" })).toBe(
      `pl.col("amount") - 5`
    );
  });

  it("multiply", () => {
    const op = OPERATIONS_BY_ID["multiply"]!;
    expect(op.toExpression(col, { mode: "value", operand: "1.1" })).toBe(
      `pl.col("amount") * 1.1`
    );
  });

  it("divide", () => {
    const op = OPERATIONS_BY_ID["divide"]!;
    expect(op.toExpression(col, { mode: "value", operand: "2" })).toBe(
      `pl.col("amount") / 2`
    );
  });

  it("modulo", () => {
    const op = OPERATIONS_BY_ID["modulo"]!;
    expect(op.toExpression(col, { mode: "value", operand: "3" })).toBe(
      `pl.col("amount") % 3`
    );
  });

  it("power", () => {
    const op = OPERATIONS_BY_ID["power"]!;
    expect(op.toExpression(col, { exponent: "3" })).toBe(
      `pl.col("amount").pow(3)`
    );
  });

  it("round", () => {
    const op = OPERATIONS_BY_ID["round"]!;
    expect(op.toExpression(col, { decimals: "2" })).toBe(
      `pl.col("amount").round(2)`
    );
  });

  it("floor", () => {
    const op = OPERATIONS_BY_ID["floor"]!;
    expect(op.toExpression(col, {})).toBe(`pl.col("amount").floor()`);
  });

  it("ceil", () => {
    const op = OPERATIONS_BY_ID["ceil"]!;
    expect(op.toExpression(col, {})).toBe(`pl.col("amount").ceil()`);
  });

  it("abs", () => {
    const op = OPERATIONS_BY_ID["abs"]!;
    expect(op.toExpression(col, {})).toBe(`pl.col("amount").abs()`);
  });

  it("sqrt", () => {
    const op = OPERATIONS_BY_ID["sqrt"]!;
    expect(op.toExpression(col, {})).toBe(`pl.col("amount").sqrt()`);
  });

  it("log with base", () => {
    const op = OPERATIONS_BY_ID["log"]!;
    expect(op.toExpression(col, { base: "2" })).toBe(
      `pl.col("amount").log(2)`
    );
  });

  it("clip with bounds", () => {
    const op = OPERATIONS_BY_ID["clip"]!;
    expect(op.toExpression(col, { lower: "0", upper: "100" })).toBe(
      `pl.col("amount").clip(0, 100)`
    );
  });

  it("clip with missing bounds uses None", () => {
    const op = OPERATIONS_BY_ID["clip"]!;
    expect(op.toExpression(col, {})).toBe(
      `pl.col("amount").clip(None, None)`
    );
  });

  it("negate", () => {
    const op = OPERATIONS_BY_ID["negate"]!;
    expect(op.toExpression(col, {})).toBe(`-pl.col("amount")`);
  });

  it("pct_of_total", () => {
    const op = OPERATIONS_BY_ID["pct_of_total"]!;
    expect(op.toExpression(col, {})).toBe(
      `pl.col("amount") / pl.col("amount").sum()`
    );
  });

  it("cum_sum", () => {
    const op = OPERATIONS_BY_ID["cum_sum"]!;
    expect(op.toExpression(col, {})).toBe(`pl.col("amount").cum_sum()`);
  });

  it("rank with method", () => {
    const op = OPERATIONS_BY_ID["rank"]!;
    expect(op.toExpression(col, { method: "dense" })).toBe(
      `pl.col("amount").rank(method="dense")`
    );
  });
});

// ---------------------------------------------------------------------------
// Math operations — toColumnName
// ---------------------------------------------------------------------------

describe("Math operations — toColumnName", () => {
  it("multiply with value", () => {
    const op = OPERATIONS_BY_ID["multiply"]!;
    expect(op.toColumnName("price", { mode: "value", operand: "2" })).toBe("price_x_2");
  });

  it("multiply with column", () => {
    const op = OPERATIONS_BY_ID["multiply"]!;
    expect(op.toColumnName("price", { mode: "column", operand: "qty" })).toBe("price_x_qty");
  });

  it("add", () => {
    expect(OPERATIONS_BY_ID["add"]!.toColumnName("x", {})).toBe("x_plus");
  });

  it("subtract", () => {
    expect(OPERATIONS_BY_ID["subtract"]!.toColumnName("x", {})).toBe("x_minus");
  });

  it("power", () => {
    expect(OPERATIONS_BY_ID["power"]!.toColumnName("x", { exponent: "3" })).toBe("x_pow3");
  });

  it("log", () => {
    expect(OPERATIONS_BY_ID["log"]!.toColumnName("x", { base: "2" })).toBe("x_log2");
  });
});

// ---------------------------------------------------------------------------
// Text operations — toExpression
// ---------------------------------------------------------------------------

describe("Text operations — toExpression", () => {
  const col = "name";

  it("uppercase", () => {
    expect(OPERATIONS_BY_ID["uppercase"]!.toExpression(col, {})).toBe(
      `pl.col("name").str.to_uppercase()`
    );
  });

  it("lowercase", () => {
    expect(OPERATIONS_BY_ID["lowercase"]!.toExpression(col, {})).toBe(
      `pl.col("name").str.to_lowercase()`
    );
  });

  it("titlecase", () => {
    expect(OPERATIONS_BY_ID["titlecase"]!.toExpression(col, {})).toBe(
      `pl.col("name").str.to_titlecase()`
    );
  });

  it("trim both", () => {
    expect(OPERATIONS_BY_ID["trim"]!.toExpression(col, { side: "both" })).toBe(
      `pl.col("name").str.strip_chars()`
    );
  });

  it("trim left", () => {
    expect(OPERATIONS_BY_ID["trim"]!.toExpression(col, { side: "left" })).toBe(
      `pl.col("name").str.lstrip_chars()`
    );
  });

  it("trim right", () => {
    expect(OPERATIONS_BY_ID["trim"]!.toExpression(col, { side: "right" })).toBe(
      `pl.col("name").str.rstrip_chars()`
    );
  });

  it("replace all", () => {
    expect(
      OPERATIONS_BY_ID["replace"]!.toExpression(col, {
        find: "foo",
        replace_with: "bar",
        all: "all",
      })
    ).toBe(`pl.col("name").str.replace_all("foo", "bar")`);
  });

  it("replace first", () => {
    expect(
      OPERATIONS_BY_ID["replace"]!.toExpression(col, {
        find: "x",
        replace_with: "y",
        all: "first",
      })
    ).toBe(`pl.col("name").str.replace("x", "y")`);
  });

  it("slice with length", () => {
    expect(
      OPERATIONS_BY_ID["slice"]!.toExpression(col, { offset: "0", length: "4" })
    ).toBe(`pl.col("name").str.slice(0, 4)`);
  });

  it("slice without length", () => {
    expect(
      OPERATIONS_BY_ID["slice"]!.toExpression(col, { offset: "2" })
    ).toBe(`pl.col("name").str.slice(2)`);
  });

  it("pad left", () => {
    expect(
      OPERATIONS_BY_ID["pad"]!.toExpression(col, {
        side: "left",
        width: "10",
        fillchar: "0",
      })
    ).toBe(`pl.col("name").str.pad_start(10, "0")`);
  });

  it("pad right", () => {
    expect(
      OPERATIONS_BY_ID["pad"]!.toExpression(col, {
        side: "right",
        width: "8",
        fillchar: " ",
      })
    ).toBe(`pl.col("name").str.pad_end(8, " ")`);
  });

  it("length", () => {
    expect(OPERATIONS_BY_ID["length"]!.toExpression(col, {})).toBe(
      `pl.col("name").str.len_chars()`
    );
  });

  it("contains", () => {
    expect(
      OPERATIONS_BY_ID["contains"]!.toExpression(col, { pattern: "test" })
    ).toBe(`pl.col("name").str.contains("test")`);
  });

  it("starts_with", () => {
    expect(
      OPERATIONS_BY_ID["starts_with"]!.toExpression(col, { prefix: "Mr" })
    ).toBe(`pl.col("name").str.starts_with("Mr")`);
  });

  it("ends_with", () => {
    expect(
      OPERATIONS_BY_ID["ends_with"]!.toExpression(col, { suffix: "Jr" })
    ).toBe(`pl.col("name").str.ends_with("Jr")`);
  });

  it("extract", () => {
    expect(
      OPERATIONS_BY_ID["extract"]!.toExpression(col, {
        pattern: "(\\d+)",
        group: "1",
      })
    ).toBe(`pl.col("name").str.extract("(\\\\d+)", 1)`);
  });

  it("split_get", () => {
    expect(
      OPERATIONS_BY_ID["split_get"]!.toExpression(col, {
        delimiter: ",",
        index: "0",
      })
    ).toBe(`pl.col("name").str.split(",").list.get(0)`);
  });

  it("concatenate with column", () => {
    expect(
      OPERATIONS_BY_ID["concatenate"]!.toExpression(col, {
        mode: "column",
        other_column: "surname",
        separator: " ",
      })
    ).toBe(
      `pl.col("name") + pl.lit(" ") + pl.col("surname")`
    );
  });

  it("concatenate with literal", () => {
    expect(
      OPERATIONS_BY_ID["concatenate"]!.toExpression(col, {
        mode: "value",
        other_column: "!",
        separator: "",
      })
    ).toBe(`pl.col("name") + pl.lit("!")`);
  });
});

// ---------------------------------------------------------------------------
// Datetime operations — toExpression
// ---------------------------------------------------------------------------

describe("Datetime operations — toExpression", () => {
  const col = "created_at";

  it("dt_year", () => {
    expect(OPERATIONS_BY_ID["dt_year"]!.toExpression(col, {})).toBe(
      `pl.col("created_at").dt.year()`
    );
  });

  it("dt_month", () => {
    expect(OPERATIONS_BY_ID["dt_month"]!.toExpression(col, {})).toBe(
      `pl.col("created_at").dt.month()`
    );
  });

  it("dt_day", () => {
    expect(OPERATIONS_BY_ID["dt_day"]!.toExpression(col, {})).toBe(
      `pl.col("created_at").dt.day()`
    );
  });

  it("dt_hour", () => {
    expect(OPERATIONS_BY_ID["dt_hour"]!.toExpression(col, {})).toBe(
      `pl.col("created_at").dt.hour()`
    );
  });

  it("dt_minute", () => {
    expect(OPERATIONS_BY_ID["dt_minute"]!.toExpression(col, {})).toBe(
      `pl.col("created_at").dt.minute()`
    );
  });

  it("dt_second", () => {
    expect(OPERATIONS_BY_ID["dt_second"]!.toExpression(col, {})).toBe(
      `pl.col("created_at").dt.second()`
    );
  });

  it("dt_weekday", () => {
    expect(OPERATIONS_BY_ID["dt_weekday"]!.toExpression(col, {})).toBe(
      `pl.col("created_at").dt.weekday()`
    );
  });

  it("dt_truncate", () => {
    expect(
      OPERATIONS_BY_ID["dt_truncate"]!.toExpression(col, { every: "1d" })
    ).toBe(`pl.col("created_at").dt.truncate("1d")`);
  });

  it("dt_format", () => {
    expect(
      OPERATIONS_BY_ID["dt_format"]!.toExpression(col, {
        format: "%Y-%m-%d",
      })
    ).toBe(`pl.col("created_at").dt.strftime("%Y-%m-%d")`);
  });

  it("dt_diff", () => {
    expect(
      OPERATIONS_BY_ID["dt_diff"]!.toExpression(col, {
        other_column: "updated_at",
        mode: "column",
        unit: "hours",
      })
    ).toBe(
      `(pl.col("created_at") - pl.col("updated_at")).dt.total_hours()`
    );
  });
});

// ---------------------------------------------------------------------------
// Type casting operations — toExpression
// ---------------------------------------------------------------------------

describe("Type casting operations — toExpression", () => {
  it("cast to Float64", () => {
    expect(
      OPERATIONS_BY_ID["cast"]!.toExpression("x", { target_type: "Float64" })
    ).toBe(`pl.col("x").cast(pl.Float64)`);
  });

  it("cast to String", () => {
    expect(
      OPERATIONS_BY_ID["cast"]!.toExpression("x", { target_type: "String" })
    ).toBe(`pl.col("x").cast(pl.String)`);
  });

  it("parse_date", () => {
    expect(
      OPERATIONS_BY_ID["parse_date"]!.toExpression("date_str", {
        format: "%Y-%m-%d",
      })
    ).toBe(`pl.col("date_str").str.to_date("%Y-%m-%d")`);
  });

  it("parse_datetime", () => {
    expect(
      OPERATIONS_BY_ID["parse_datetime"]!.toExpression("ts_str", {
        format: "%Y-%m-%d %H:%M:%S",
      })
    ).toBe(
      `pl.col("ts_str").str.to_datetime("%Y-%m-%d %H:%M:%S")`
    );
  });
});

// ---------------------------------------------------------------------------
// Null handling operations — toExpression
// ---------------------------------------------------------------------------

describe("Null handling operations — toExpression", () => {
  it("fill_null_value with numeric", () => {
    expect(
      OPERATIONS_BY_ID["fill_null_value"]!.toExpression("x", { value: "0" })
    ).toBe(`pl.col("x").fill_null(0)`);
  });

  it("fill_null_value with string", () => {
    expect(
      OPERATIONS_BY_ID["fill_null_value"]!.toExpression("x", { value: "N/A" })
    ).toBe(`pl.col("x").fill_null("N/A")`);
  });

  it("fill_null_strategy forward", () => {
    expect(
      OPERATIONS_BY_ID["fill_null_strategy"]!.toExpression("x", {
        strategy: "forward",
      })
    ).toBe(`pl.col("x").fill_null(strategy="forward")`);
  });

  it("fill_null_strategy mean", () => {
    expect(
      OPERATIONS_BY_ID["fill_null_strategy"]!.toExpression("x", {
        strategy: "mean",
      })
    ).toBe(`pl.col("x").fill_null(strategy="mean")`);
  });

  it("coalesce with column", () => {
    expect(
      OPERATIONS_BY_ID["coalesce"]!.toExpression("x", {
        other_column: "y",
        mode: "column",
      })
    ).toBe(`pl.coalesce(pl.col("x"), pl.col("y"))`);
  });

  it("coalesce with literal", () => {
    expect(
      OPERATIONS_BY_ID["coalesce"]!.toExpression("x", {
        other_column: "fallback",
        mode: "value",
      })
    ).toBe(`pl.coalesce(pl.col("x"), pl.lit("fallback"))`);
  });

  it("is_null", () => {
    expect(OPERATIONS_BY_ID["is_null"]!.toExpression("x", {})).toBe(
      `pl.col("x").is_null()`
    );
  });

  it("is_not_null", () => {
    expect(OPERATIONS_BY_ID["is_not_null"]!.toExpression("x", {})).toBe(
      `pl.col("x").is_not_null()`
    );
  });
});

// ---------------------------------------------------------------------------
// Conditional operations — toExpression
// ---------------------------------------------------------------------------

describe("Conditional operations — toExpression", () => {
  it("if_then_else with numeric comparison", () => {
    const op = OPERATIONS_BY_ID["if_then_else"]!;
    const result = op.toExpression("", {
      condition_col: "age",
      condition_op: "gte",
      condition_value: "18",
      then_value: "1",
      else_value: "0",
    });
    expect(result).toBe(
      `pl.when(pl.col("age") >= 18).then(1).otherwise(0)`
    );
  });

  it("if_then_else with is_null", () => {
    const op = OPERATIONS_BY_ID["if_then_else"]!;
    const result = op.toExpression("", {
      condition_col: "email",
      condition_op: "is_null",
      condition_value: "",
      then_value: "missing",
      else_value: "present",
    });
    expect(result).toBe(
      `pl.when(pl.col("email").is_null()).then(pl.lit("missing")).otherwise(pl.lit("present"))`
    );
  });

  it("if_then_else with string comparison", () => {
    const op = OPERATIONS_BY_ID["if_then_else"]!;
    const result = op.toExpression("", {
      condition_col: "status",
      condition_op: "eq",
      condition_value: "active",
      then_value: "1",
      else_value: "0",
    });
    expect(result).toBe(
      `pl.when(pl.col("status") == "active").then(1).otherwise(0)`
    );
  });

  it("if_then_else needsSourceColumn is false", () => {
    expect(OPERATIONS_BY_ID["if_then_else"]!.needsSourceColumn).toBe(false);
  });

  it("map_values", () => {
    const op = OPERATIONS_BY_ID["map_values"]!;
    expect(
      op.toExpression("status", { old_value: "A", new_value: "Active" })
    ).toBe(`pl.col("status").replace({"A": "Active"})`);
  });
});

// ---------------------------------------------------------------------------
// Other operations — toExpression
// ---------------------------------------------------------------------------

describe("Other operations — toExpression", () => {
  it("row_number (no source column)", () => {
    const op = OPERATIONS_BY_ID["row_number"]!;
    expect(op.needsSourceColumn).toBe(false);
    expect(op.toExpression("", {})).toBe(`pl.int_range(pl.len())`);
  });

  it("literal with numeric value", () => {
    const op = OPERATIONS_BY_ID["literal"]!;
    expect(op.needsSourceColumn).toBe(false);
    expect(op.toExpression("", { value: "42" })).toBe(`pl.lit(42)`);
  });

  it("literal with string value", () => {
    const op = OPERATIONS_BY_ID["literal"]!;
    expect(op.toExpression("", { value: "hello" })).toBe(`pl.lit("hello")`);
  });

  it("shift positive (lag)", () => {
    const op = OPERATIONS_BY_ID["shift"]!;
    expect(op.toExpression("x", { periods: "3" })).toBe(
      `pl.col("x").shift(3)`
    );
  });

  it("shift negative (lead)", () => {
    const op = OPERATIONS_BY_ID["shift"]!;
    expect(op.toExpression("x", { periods: "-1" })).toBe(
      `pl.col("x").shift(-1)`
    );
  });

  it("shift toColumnName for positive periods", () => {
    const op = OPERATIONS_BY_ID["shift"]!;
    expect(op.toColumnName("x", { periods: "2" })).toBe("x_lag2");
  });

  it("shift toColumnName for negative periods", () => {
    const op = OPERATIONS_BY_ID["shift"]!;
    expect(op.toColumnName("x", { periods: "-3" })).toBe("x_lead3");
  });
});

// ---------------------------------------------------------------------------
// Edge cases: column names with special characters
// ---------------------------------------------------------------------------

describe("Special character escaping", () => {
  it("escapes double quotes in column names", () => {
    const op = OPERATIONS_BY_ID["abs"]!;
    expect(op.toExpression('col"name', {})).toBe(
      `pl.col("col\\"name").abs()`
    );
  });

  it("escapes backslashes in column names", () => {
    const op = OPERATIONS_BY_ID["abs"]!;
    expect(op.toExpression("col\\name", {})).toBe(
      `pl.col("col\\\\name").abs()`
    );
  });

  it("escapes special chars in replace text", () => {
    const op = OPERATIONS_BY_ID["replace"]!;
    const result = op.toExpression("name", {
      find: 'say "hi"',
      replace_with: 'say "hello"',
      all: "all",
    });
    expect(result).toContain('replace_all');
    expect(result).toContain('say');
    expect(result).toContain('hi');
  });

  it("handles non-numeric value in add (wraps in pl.lit)", () => {
    const op = OPERATIONS_BY_ID["add"]!;
    expect(op.toExpression("x", { mode: "value", operand: "abc" })).toBe(
      `pl.col("x") + pl.lit("abc")`
    );
  });
});
