---
sidebar_position: 1
---

# Filter

Split data into rows that match or don't match a condition.

| | |
|---|---|
| **Palette name** | Filter (category Compute) |
| **Type name** | `Filter` |

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to filter |
| `T` (output-true) | Output | Rows where condition is **true** |
| `F` (output-false) | Output | Rows where condition is **false** |

## Configuration

The Filter tool has two modes:

| Mode | Description |
|------|-------------|
| **Basic** (default) | Visual condition builder - no coding required |
| **Custom** | Write Polars expressions directly for advanced logic |

Toggle between modes using the switch at the top of the configuration panel.

:::tip No coding required
Most users will never need to leave Basic mode. The visual builder handles single conditions, multiple conditions with AND/OR logic, and even nested condition groups - all through dropdowns and text inputs.
:::

## How It Works

The Filter tool evaluates your expression against each row:

- Rows where the expression is **true** go to the `T` output
- Rows where the expression is **false** go to the `F` output

Both outputs are always available - you can wire to either or both depending on your needs.

## Basic Mode (Visual Builder)

The visual builder lets you construct filter conditions entirely through dropdowns and inputs:

1. **Pick a column** from the dropdown (auto-populated from your data)
2. **Choose an operator** - the available operators adapt to the column's data type:
   - **Numeric**: equals, not equals, greater than, less than, etc.
   - **Text**: equals, contains, starts with, ends with, etc.
   - **Boolean**: is true, is false
   - **Date/Time**: equals, is after, is before, etc.
   - **All types**: is null, is not null
3. **Enter a value** to compare against

### Adding Multiple Conditions

Click **Add Condition** to add more rules. Use the **ALL / ANY** toggle to switch between AND and OR logic:

- **ALL match** (AND) - every condition must be true
- **ANY match** (ANY) - at least one condition must be true

### Nested Groups

For more complex logic, click **Add Group** to create a nested condition group (up to 3 levels deep). Nested groups automatically default to the opposite combinator for clarity - e.g., an AND group inside an OR group.

### Comments

Each condition or group can have an optional comment to document your reasoning.

### Expression Preview

The bottom of the panel shows a read-only preview of the generated Polars expression, so you can see exactly what will be executed.

## Custom Mode (Advanced)

Switch to Custom mode to write Polars expressions directly. This is useful for complex logic that goes beyond what the visual builder supports. The editor provides **autocomplete for column names and Polars methods**.

### Expression Examples

#### Simple Comparisons

```python
# Rows where age is over 18
pl.col("age") > 18

# Rows where status is "active"
pl.col("status") == "active"

# Rows where price is between 10 and 100
(pl.col("price") >= 10) & (pl.col("price") <= 100)
```

#### Multiple Conditions

```python
# AND - all conditions must be true
(pl.col("status") == "active") & (pl.col("country") == "US")

# OR - any condition can be true
(pl.col("status") == "active") | (pl.col("status") == "pending")
```

#### String Matching

```python
# Contains substring
pl.col("email").str.contains("@gmail.com")

# Case-insensitive contains
pl.col("name").str.to_lowercase().str.contains("john")

# Starts with
pl.col("product_code").str.starts_with("ABC")
```

#### Null Handling

```python
# Filter out nulls
pl.col("value").is_not_null()

# Keep only nulls
pl.col("value").is_null()
```

#### Negation

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
- **Mode switching**: Switching from Basic to Custom preserves the generated expression. Switching back to Basic preserves the visual builder state

## Related

- [Expression Basics](../../expressions/basics) - How to write expressions (for Custom mode)
- [Syntax Rules](../../expressions/syntax-rules) - Parentheses and multi-line rules
