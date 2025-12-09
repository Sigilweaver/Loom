---
sidebar_position: 1
---

# Filter

Split data into rows that match or don't match a condition.

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to filter |
| `T` (output-true) | Output | Rows where condition is **true** |
| `F` (output-false) | Output | Rows where condition is **false** |

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| Filter Expression | Yes | Polars expression that returns true/false for each row |

:::tip Using the Expression Editor
The expression editor provides **autocomplete for column names and Polars methods**. Press Tab after typing `pl.col("` to see your columns, or press `.` + Tab after any expression to see available methods. See [Expression Basics](../../expressions/basics#using-the-expression-editor) for a step-by-step guide.
:::

## How It Works

The Filter tool evaluates your expression against each row:

- Rows where the expression is **true** go to the `T` output
- Rows where the expression is **false** go to the `F` output

Both outputs are always available - you can wire to either or both depending on your needs.

## Expression Examples

### Simple Comparisons

```python
# Rows where age is over 18
pl.col("age") > 18

# Rows where status is "active"
pl.col("status") == "active"

# Rows where price is between 10 and 100
(pl.col("price") >= 10) & (pl.col("price") <= 100)
```

### Multiple Conditions

```python
# AND - all conditions must be true
(pl.col("status") == "active") & (pl.col("country") == "US")

# OR - any condition can be true
(pl.col("status") == "active") | (pl.col("status") == "pending")
```

### String Matching

```python
# Contains substring
pl.col("email").str.contains("@gmail.com")

# Case-insensitive contains
pl.col("name").str.to_lowercase().str.contains("john")

# Starts with
pl.col("product_code").str.starts_with("ABC")
```

### Null Handling

```python
# Filter out nulls
pl.col("value").is_not_null()

# Keep only nulls
pl.col("value").is_null()
```

### Negation

```python
# NOT - invert a boolean column
~pl.col("is_deleted")

# NOT - invert a condition
~(pl.col("status") == "inactive")
```

## Common Patterns

### Keeping Only Matching Rows

Wire only the `T` output to downstream tools - the `F` output is discarded.

### Removing Matching Rows

Wire only the `F` output - the rows that DON'T match go forward.

### Splitting Data

Wire both outputs to different downstream paths to process matching and non-matching rows separately.

## Notes

- **Empty expression**: If no expression is provided, all rows go to `T` output
- **Invalid expression**: Configuration error is shown, tool won't execute
- **Schema unchanged**: Filter doesn't add, remove, or rename columns - only filters rows

## Related

- [Expression Basics](../../expressions/basics) - How to write expressions
- [Syntax Rules](../../expressions/syntax-rules) - Parentheses and multi-line rules
