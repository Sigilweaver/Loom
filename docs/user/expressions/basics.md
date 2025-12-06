---
sidebar_position: 1
---

# Expression Basics

Sigilweaver uses [Polars expressions](https://docs.pola.rs/user-guide/expressions/) for filtering data and creating calculated columns. This page covers the fundamentals.

## Column References

Reference a column by name using `pl.col()`:

```python
pl.col("column_name")
pl.col("age")
pl.col("Total Sales")
```

Column names with spaces or special characters work the same way - just wrap them in quotes.

## Literals

Use `pl.lit()` to wrap constant values when they need to become column expressions:

```python
pl.lit("active")       # String literal
pl.lit(42)             # Integer literal
pl.lit(3.14)           # Float literal
pl.lit(True)           # Boolean literal
```

### When You Need `pl.lit()`

You **must** use `pl.lit()` when assigning or returning a constant value:

```python
# In Formula tool - assign a constant to a new column
pl.lit("Complete")

# In conditional returns (.then and .otherwise)
pl.when(pl.col("status") == "active").then(pl.lit("Yes")).otherwise(pl.lit("No"))

# Fill null values with a constant
pl.col("value").fill_null(pl.lit(0))
```

### When You Don't Need `pl.lit()`

You **don't need** `pl.lit()` for comparisons - bare values work fine:

```python
# Comparing to constants - no pl.lit() needed
pl.col("status") == "active"        # Works
pl.col("age") > 18                   # Works
pl.col("price") < 100.0              # Works

# These also work but are unnecessarily verbose:
pl.col("status") == pl.lit("active") # Unnecessary
pl.col("age") > pl.lit(18)           # Unnecessary
```

:::tip Rule of Thumb
**Comparisons**: Use bare values (`"active"`, `18`, `100.0`)  
**Assignments/Returns**: Use `pl.lit()` to wrap the value
:::

## Comparison Operators

| Operation | Operator | Example |
|-----------|----------|---------|
| Equals | `==` | `pl.col("status") == "active"` |
| Not equals | `!=` | `pl.col("status") != "deleted"` |
| Greater than | `>` | `pl.col("age") > 18` |
| Greater or equal | `>=` | `pl.col("score") >= 70` |
| Less than | `<` | `pl.col("price") < 100` |
| Less or equal | `<=` | `pl.col("quantity") <= 10` |

## Logical Operators

| Operation | Operator | Example |
|-----------|----------|---------|
| And | `&` | `(expr1) & (expr2)` |
| Or | `\|` | `(expr1) \| (expr2)` |
| Not / Invert | `~` | `~pl.col("is_deleted")` |

### Invert (`~`)

The `~` operator inverts boolean values:

```python
~pl.col("is_active")           # True becomes False, False becomes True
~(pl.col("status") == "done")  # Rows where status is NOT "done"
```

:::caution
The `~` operator only works on boolean columns or expressions that return boolean values.
:::

## Arithmetic Operators

| Operation | Operator | Example |
|-----------|----------|---------|
| Addition | `+` | `pl.col("price") + pl.col("tax")` |
| Subtraction | `-` | `pl.col("revenue") - pl.col("cost")` |
| Multiplication | `*` | `pl.col("quantity") * pl.col("unit_price")` |
| Division | `/` | `pl.col("total") / pl.col("count")` |
| Floor division | `//` | `pl.col("seconds") // 60` |
| Modulo | `%` | `pl.col("value") % 2` |

## Chaining Operations

Polars expressions are chainable - you can call multiple methods in sequence:

```python
pl.col("name").str.to_lowercase().str.strip_chars()
pl.col("date").dt.year()
pl.col("price").round(2).cast(pl.Float64)
```

## Autocomplete

The expression editor in Sigilweaver provides autocomplete for:

- **Column names**: Type `pl.col("` to see available columns
- **Polars functions**: Type `pl.` or `.` after an expression to see methods

## External Reference

For the complete Polars expression API, see the [Polars User Guide](https://docs.pola.rs/user-guide/expressions/).
