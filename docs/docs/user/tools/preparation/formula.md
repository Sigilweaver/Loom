---
sidebar_position: 4
title: Calculate (Formula)
sidebar_label: Calculate
---

# Calculate (Formula)

Create or replace calculated columns using visual operation builders or Polars expressions.

| | |
|---|---|
| **Palette name** | Calculate (category Compute) |
| **Type name** | `Formula` |

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to transform |
| `output` | Output | Data with new/updated column(s) |

## Configuration

Each Calculate tool can contain **multiple operations** - add as many as you need in a single node. Operations run sequentially, so later operations can reference columns created by earlier ones.

Each operation has two modes:

| Mode | Description |
|------|-------------|
| **Basic** (default) | Visual builder with dropdowns - no coding required |
| **Custom** | Write Polars expressions directly for advanced logic |

:::tip No coding required
The Basic mode provides **50+ built-in operations** across math, text, dates, type casting, null handling, and conditional logic. Most data transformations can be done entirely through dropdowns and parameter inputs - no expression syntax needed.
:::

## Basic Mode (Visual Builder)

The visual builder walks you through each operation step by step:

1. **Pick a source column** from the dropdown
2. **Choose an operation** - the list filters to show only operations compatible with your column's data type
3. **Set parameters** - each operation shows relevant inputs (values, column pickers, format strings, etc.)
4. **Name the output column** - a sensible default is generated automatically, or enter your own

An expression preview at the bottom shows the generated Polars code.

### Available Operations

| Category | Operations |
|----------|------------|
| **Math** | Add, Subtract, Multiply, Divide, Modulo, Power, Round, Floor, Ceiling, Absolute Value, Square Root, Logarithm, Clip, Negate, Percent of Total, Cumulative Sum, Rank |
| **Text** | Uppercase, Lowercase, Title Case, Trim, Replace, Substring, Pad, String Length, Contains, Starts With, Ends With, Extract (Regex), Split & Get, Concatenate Columns |
| **Date/Time** | Extract Year/Month/Day/Hour/Minute/Second, Day of Week, Truncate, Format Date, Date Difference |
| **Type Casting** | Cast Type, Parse Date from String, Parse DateTime from String |
| **Null Handling** | Fill Null (Value), Fill Null (Strategy: forward/backward/mean/min/max/zero), Coalesce, Is Null, Is Not Null |
| **Conditional** | If/Then/Else, Map/Replace Values |
| **Other** | Row Number, Literal Value, Shift (Lag/Lead) |

### Multiple Operations

A single Calculate tool can hold multiple operations:

- Click **Add Operation** to add more
- **Drag and drop** to reorder
- **Collapse/expand** individual operations to keep things tidy
- **Duplicate** an operation to create a variation
- Each operation can independently use Basic or Custom mode

## Custom Mode (Advanced)

Switch any operation to Custom mode to write Polars expressions directly. This is useful when you need logic that goes beyond the built-in operations.

| Field | Required | Description |
|-------|----------|-------------|
| Target Column | Yes | Select existing column to replace, or choose "(New Column)" |
| New Column Name | If new | Name for the new column (only when creating new) |
| Formula Expression | Yes | Polars expression defining the column value |

## Creating a New Column

In **Basic mode**, select a source column and operation - the output column name is generated automatically. In **Custom mode**:

1. Select "(New Column)" from the Target Column dropdown
2. Enter a name for the new column
3. Write the expression

## Replacing an Existing Column

In **Basic mode**, the output column name defaults to the source column - just leave it as-is to replace in place. In **Custom mode**:

1. Select the column name from the Target Column dropdown
2. Write the expression

### Expression Examples

#### Arithmetic

```python
# Calculate total from quantity and unit price
pl.col("quantity") * pl.col("unit_price")

# Calculate profit margin
(pl.col("revenue") - pl.col("cost")) / pl.col("revenue") * 100

# Add 10% markup
pl.col("price") * 1.1
```

### String Operations

```python
# Combine first and last name
pl.col("first_name") + pl.lit(" ") + pl.col("last_name")

# Convert to uppercase
pl.col("status").str.to_uppercase()

# Extract first 3 characters
pl.col("code").str.head(3)
```

### Conditional Logic

```python
# Categorize by value
pl.when(pl.col("amount") >= 1000)
  .then(pl.lit("High"))
  .when(pl.col("amount") >= 100)
  .then(pl.lit("Medium"))
  .otherwise(pl.lit("Low"))

# Flag condition
pl.when(pl.col("status") == "active")
  .then(pl.lit(True))
  .otherwise(pl.lit(False))
```

### Date Operations

```python
# Extract year
pl.col("date").dt.year()

# Calculate age in days
(pl.lit(pl.date(2024, 1, 1)) - pl.col("birth_date")).dt.total_days()
```

### Type Casting

```python
# Convert string to integer
pl.col("id_string").cast(pl.Int64)

# Convert to string
pl.col("numeric_code").cast(pl.Utf8)
```

### Null Handling

```python
# Replace nulls with a default
pl.col("value").fill_null(0)

# Replace nulls with another column
pl.col("primary").fill_null(pl.col("fallback"))
```

## Notes

- **Column naming**: If you create a column with the same name as an existing column, it replaces that column
- **Expression must be valid**: Invalid expressions show an error in configuration
- **Output type**: The formula determines the output column's data type automatically
- **Operation chaining**: Operations within a Calculate tool run sequentially - operation 2 can reference a column created by operation 1
- **Mode mixing**: Each operation in a multi-operation Calculate tool can independently use Basic or Custom mode

## Related

- [Expression Basics](../../expressions/basics) - How to write expressions (for Custom mode)
- [Common Operations](../../expressions/common-operations) - Frequently used operations
