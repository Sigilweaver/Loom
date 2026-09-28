---
sidebar_position: 2
title: Expression Syntax Rules
---

# Expression Syntax Rules

Polars expressions follow Python syntax with some important rules you must know to avoid errors.

## Wrap Comparisons in Parentheses

**This is the most common mistake.** Due to Python operator precedence, `&` and `|` bind tighter than comparison operators (`>`, `<`, `==`, etc.).

```python
# WRONG - will error
pl.col("price") > 100 & pl.col("qty") > 0

# CORRECT - wrap each comparison in parentheses
(pl.col("price") > 100) & (pl.col("qty") > 0)
```

The incorrect version is parsed by Python as:
```python
pl.col("price") > (100 & pl.col("qty")) > 0  # Not what you want!
```

### Rule of Thumb

**Always parenthesize each comparison** when using `&`, `|`, or `~`:

```python
# Two conditions with AND
(pl.col("a") > 10) & (pl.col("b") < 20)

# Three conditions with OR
(pl.col("status") == "active") | (pl.col("status") == "pending") | (pl.col("status") == "new")

# NOT with a comparison
~(pl.col("is_deleted") == True)
```

## Multi-Line Expressions

You can break a long expression across lines. Python allows line breaks inside parentheses, so **wrap the whole expression in outer parentheses**:

```python
(
    (pl.col("category") == "electronics")
    & (pl.col("price") > 500)
    & (pl.col("in_stock") == True)
)
```

### With Comments

Comments start with `#` and run to the end of the line:

```python
(
    (pl.col("amount") > 1000)            # High value transaction
    & (pl.col("status") == "pending")    # Not yet processed
    & (pl.col("risk_score") >= 7)        # Flagged as risky
)
```

## Method Chaining for Readability

When an expression has several method calls, put one call on each line. Wrap the entire chain in parentheses:

```python
(pl.col("customer_email")
    .str.to_lowercase()
    .str.strip_chars()
    .str.replace_all("@gmail.com", "@google.com")
)
```

This is especially useful for complex string operations:

```python
(pl.col("product_name")
    .str.to_lowercase()              # Normalize case
    .str.strip_chars()               # Remove leading/trailing whitespace
    .str.replace_all("  ", " ")      # Collapse multiple spaces
    .str.replace("&", "and")         # Expand ampersands
    .str.slice(0, 50)                # Truncate to 50 characters
)
```

### Conditionals

Use `pl.when()`, `.then()` and `.otherwise()`. You can repeat `.when()` and `.then()` for several cases:

```python
(
    pl.when(pl.col("customer_tier") == "gold")
    .then(pl.col("purchase_amount") * 0.8)    # 20% discount
    .when(pl.col("customer_tier") == "silver")
    .then(pl.col("purchase_amount") * 0.9)    # 10% discount
    .otherwise(pl.col("purchase_amount"))     # No discount
)
```

### Chaining Date Operations

Date/time methods chain naturally:

```python
(pl.col("order_date")
    .dt.truncate("1d")        # Truncate to day
    .dt.offset_by("1w")       # Add one week
    .dt.strftime("%Y-%m-%d")  # Format as string
)
```

:::tip Key Rule
Wrap a multi-line expression in outer parentheses.
:::

## Quote Characters

Use single or double quotes for strings - they're interchangeable:

```python
pl.col("name")      # Double quotes
pl.col('name')      # Single quotes - same result
```

For strings containing quotes, use the other quote type:

```python
pl.col("status") == 'it\'s done'     # Escaped single quote
pl.col("status") == "it's done"      # Or use double quotes outside
```

## What Loom Accepts

An expression must be a single Polars expression that starts from `pl`. Loom checks it before running it and rejects imports, lambdas, comprehensions and names other than `pl`, `True`, `False` and `None`. The editor reports the reason.

## Common Errors and Fixes

### `TypeError: unsupported operand type(s)`

Usually means missing parentheses around comparisons:

```python
# Error
pl.col("a") > 10 & pl.col("b") < 5

# Fix
(pl.col("a") > 10) & (pl.col("b") < 5)
```

### `SyntaxError: invalid syntax`

Often caused by unclosed parentheses or invalid Python:

```python
# Error - unclosed parenthesis
(pl.col("a") > 10

# Fix
(pl.col("a") > 10)
```

### `ColumnNotFoundError`

Column name doesn't exist - check spelling and case:

```python
# Error - typo in column name
pl.col("Stauts") == "active"

# Fix - correct spelling
pl.col("Status") == "active"
```

## Summary

| Rule | Example |
|------|---------|
| Wrap comparisons with `&`/`\|` | `(a > 10) & (b < 20)` |
| Use `~` for NOT (booleans only) | `~pl.col("is_deleted")` |
| Multi-line needs outer parens | `(\n  (a > 1)\n  & (b < 2)\n)` |
| Chain methods with line breaks | `(col\n  .method1()\n  .method2()\n)` |
| Use `pl.lit()` for constants | `pl.lit("active")` |
| Use `==` for equality | `pl.col("x") == 5` |
