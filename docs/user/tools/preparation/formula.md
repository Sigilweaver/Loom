---
sidebar_position: 4
---

# Formula

Create or replace calculated columns using Polars expressions.

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to transform |
| `output` | Output | Data with new/updated column |

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| Target Column | Yes | Select existing column to replace, or choose "(New Column)" |
| New Column Name | If new | Name for the new column (only when creating new) |
| Formula Expression | Yes | Polars expression defining the column value |

:::tip Using the Expression Editor
The expression editor provides **autocomplete for column names and Polars methods**. Press Tab after typing `pl.col("` to see your columns, or press `.` + Tab after any expression to see available methods. See [Expression Basics](../../expressions/basics) for a step-by-step guide.
:::

## Creating a New Column

1. Select "(New Column)" from the Target Column dropdown
2. Enter a name for the new column
3. Write the expression that calculates the value

The new column is added to the end of the dataset.

## Replacing an Existing Column

1. Select the column name from the Target Column dropdown
2. Write the expression that calculates the new value

The column is replaced in place, maintaining its position in the column order.

## Expression Examples

### Arithmetic

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

## Related

- [Expression Basics](../../expressions/basics) - How to write expressions
- [Common Operations](../../expressions/common-operations) - Frequently used operations
