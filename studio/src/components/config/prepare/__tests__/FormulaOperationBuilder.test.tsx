import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FormulaOperationBuilder,
  createEmptyOperation,
  type FormulaOperationConfig,
} from "../FormulaOperationBuilder";
import type { ColumnSchema } from "@api/backend";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const numericColumns: ColumnSchema[] = [
  { name: "price", dtype: "Float64", nullable: false },
  { name: "quantity", dtype: "Int64", nullable: true },
  { name: "name", dtype: "String", nullable: false },
];

const stringColumns: ColumnSchema[] = [
  { name: "first_name", dtype: "String", nullable: false },
  { name: "last_name", dtype: "String", nullable: true },
];

function makeOperation(
  overrides: Partial<FormulaOperationConfig> = {}
): FormulaOperationConfig {
  return {
    id: "test-op-1",
    operationId: "",
    sourceColumn: "",
    params: {},
    columnName: "",
    columnNameEdited: false,
    mode: "basic",
    expression: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createEmptyOperation
// ---------------------------------------------------------------------------

describe("createEmptyOperation", () => {
  it("uses the first column as sourceColumn when columns are available", () => {
    const op = createEmptyOperation(numericColumns);
    expect(op.sourceColumn).toBe("price");
    expect(op.id).toBeTruthy();
    expect(op.mode).toBe("basic");
    expect(op.operationId).toBe("");
  });

  it("uses empty sourceColumn when no columns", () => {
    const op = createEmptyOperation([]);
    expect(op.sourceColumn).toBe("");
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 10 }, () => createEmptyOperation([]).id));
    expect(ids.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("FormulaOperationBuilder rendering", () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  it("renders source column dropdown and operation dropdown", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "price" })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    expect(screen.getByText("Source Column")).toBeInTheDocument();
    expect(screen.getByText("Operation")).toBeInTheDocument();
    expect(screen.getByText("Output Column")).toBeInTheDocument();
  });

  it("hides source column dropdown when operation does not need it", () => {
    // row_number has needsSourceColumn: false
    render(
      <FormulaOperationBuilder
        operation={makeOperation({ operationId: "row_number" })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    expect(screen.queryByText("Source Column")).not.toBeInTheDocument();
    expect(screen.getByText("Operation")).toBeInTheDocument();
  });

  it("renders column options in source dropdown", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "price" })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    expect(screen.getByText("price (Float64)")).toBeInTheDocument();
    expect(screen.getByText("quantity (Int64)")).toBeInTheDocument();
    expect(screen.getByText("name (String)")).toBeInTheDocument();
  });

  it("renders operation groups in dropdown", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "price" })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    // Numeric column should show math operations as options
    const opSelect = screen.getAllByRole("combobox")[1]!;
    // Check that known math operations appear as options
    const options = Array.from(opSelect.querySelectorAll("option"));
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("Add");
    expect(labels).toContain("Multiply");
    expect(labels).toContain("Round");
  });

  it("renders parameter inputs when an operation is selected", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          operationId: "round",
          params: { decimals: "2" },
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    expect(screen.getByText("Decimal Places")).toBeInTheDocument();
  });

  it("shows expression preview in basic mode", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          operationId: "abs",
          mode: "basic",
          expression: 'pl.col("price").abs()',
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    expect(screen.getByText("Expression Preview")).toBeInTheDocument();
    expect(screen.getByText(/pl\.col\("price"\)\.abs\(\)/)).toBeInTheDocument();
  });

  it("does not show expression preview in advanced mode", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          operationId: "abs",
          mode: "advanced",
          expression: 'pl.col("price").abs()',
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    expect(screen.queryByText("Expression Preview")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// User interactions
// ---------------------------------------------------------------------------

describe("FormulaOperationBuilder interactions", () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  it("calls onChange when source column changes", async () => {
    const user = userEvent.setup();

    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "price" })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    const sourceSelect = screen.getAllByRole("combobox")[0]!;
    await user.selectOptions(sourceSelect, "quantity");

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const updated = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    expect(updated.sourceColumn).toBe("quantity");
  });

  it("calls onChange when operation is selected", async () => {
    const user = userEvent.setup();

    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "price" })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    // The operation dropdown is the second combobox
    const opSelect = screen.getAllByRole("combobox")[1]!;
    await user.selectOptions(opSelect, "round");

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const updated = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    expect(updated.operationId).toBe("round");
    // Should auto-generate column name
    expect(updated.columnName).toBe("price_rounded");
    // Should generate expression
    expect(updated.expression).toContain("round");
  });

  it("auto-generates column name when operation changes and name not manually edited", async () => {
    const user = userEvent.setup();

    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          columnNameEdited: false,
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    const opSelect = screen.getAllByRole("combobox")[1]!;
    await user.selectOptions(opSelect, "abs");

    const updated = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    expect(updated.columnName).toBe("price_abs");
  });

  it("preserves manually-edited column name when operation changes", async () => {
    const user = userEvent.setup();

    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          columnName: "my_custom_name",
          columnNameEdited: true,
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    const opSelect = screen.getAllByRole("combobox")[1]!;
    await user.selectOptions(opSelect, "abs");

    const updated = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    // Should NOT overwrite the manual name
    expect(updated.columnName).toBe("my_custom_name");
  });

  it("calls onChange when output column name changes", async () => {
    const user = userEvent.setup();

    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "price" })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    const nameInput = screen.getByPlaceholderText("result");
    await user.type(nameInput, "t");

    // Should call onChange at least once for the keystroke
    expect(mockOnChange).toHaveBeenCalled();
    const firstCall = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    expect(firstCall.columnName).toBe("t");
    expect(firstCall.columnNameEdited).toBe(true);
  });

  it("resets operationId when source column dtype changes to incompatible type", async () => {
    const user = userEvent.setup();

    // Start with a numeric op selected, then switch to a string column
    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          operationId: "add",
          params: { mode: "value", operand: "10" },
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    const sourceSelect = screen.getAllByRole("combobox")[0]!;
    await user.selectOptions(sourceSelect, "name"); // String column

    const updated = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    // "add" is numeric-only, not valid for string → should be cleared
    expect(updated.operationId).toBe("");
  });

  it("keeps operationId when source column dtype stays compatible", async () => {
    const user = userEvent.setup();

    // "cast" applies to "any" type, should survive column changes
    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          operationId: "cast",
          params: { target_type: "String" },
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    const sourceSelect = screen.getAllByRole("combobox")[0]!;
    await user.selectOptions(sourceSelect, "name"); // String column

    const updated = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    // "cast" has applicableTypes: ["any"], should stay
    expect(updated.operationId).toBe("cast");
  });

  it("updates expression when parameter changes", async () => {
    const user = userEvent.setup();

    render(
      <FormulaOperationBuilder
        operation={makeOperation({
          sourceColumn: "price",
          operationId: "power",
          params: { exponent: "2" },
          mode: "basic",
        })}
        columns={numericColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    // Find the exponent number input and type into it
    const expInput = screen.getByDisplayValue("2");
    // Typing a character triggers onChange with the new param value
    await user.type(expInput, "3");

    expect(mockOnChange).toHaveBeenCalled();
    // First call should have the param updated (appending "3" to "2" → "23")
    const firstCall = mockOnChange.mock.calls[0][0] as FormulaOperationConfig;
    expect(firstCall.params.exponent).toBe("23");
    expect(firstCall.expression).toContain("pow");
  });
});

// ---------------------------------------------------------------------------
// String column operations
// ---------------------------------------------------------------------------

describe("FormulaOperationBuilder with string columns", () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  it("shows text operations for string columns", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "first_name" })}
        columns={stringColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    // Check that text operations appear in the dropdown
    const opSelect = screen.getAllByRole("combobox")[1]!;
    const options = Array.from(opSelect.querySelectorAll("option"));
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("Uppercase");
    expect(labels).toContain("Lowercase");
  });

  it("does not show math operations for string columns", () => {
    render(
      <FormulaOperationBuilder
        operation={makeOperation({ sourceColumn: "first_name" })}
        columns={stringColumns}
        onChange={mockOnChange}
        index={0}
      />
    );

    const opSelect = screen.getAllByRole("combobox")[1]!;
    const options = Array.from(opSelect.querySelectorAll("option"));
    const labels = options.map((o) => o.textContent);
    // Math-only operations should NOT appear
    expect(labels).not.toContain("Add");
    expect(labels).not.toContain("Square Root");
  });
});
