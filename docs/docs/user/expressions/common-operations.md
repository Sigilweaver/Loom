---
sidebar_position: 3
title: Common Operations
---

# Common Operations

This page covers frequently used operations in Polars expressions.

## String Operations

String methods are accessed via `.str`:

```python
# Case conversion
pl.col("name").str.to_lowercase()
pl.col("name").str.to_uppercase()

# Substring matching
pl.col("email").str.contains("@gmail.com")
pl.col("code").str.starts_with("ABC")
pl.col("file").str.ends_with(".csv")

# Trimming whitespace
pl.col("input").str.strip_chars()        # Both ends
pl.col("input").str.strip_chars_start()  # Left only
pl.col("input").str.strip_chars_end()    # Right only

# Substring extraction
pl.col("text").str.head(10)              # First 10 characters
pl.col("text").str.tail(5)               # Last 5 characters
pl.col("text").str.slice(0, 10)          # Characters 0-9

# Length
pl.col("name").str.len_chars()           # Character count
pl.col("name").str.len_bytes()           # Byte count (UTF-8)

# Replace
pl.col("text").str.replace("old", "new")           # First occurrence
pl.col("text").str.replace_all("old", "new")       # All occurrences

# Split
pl.col("csv_field").str.split(",")       # Returns list
```

### Case-Insensitive Matching

Combine lowercasing with contains:

```python
pl.col("name").str.to_lowercase().str.contains("john")
```

## Null Handling

```python
# Check for nulls
pl.col("value").is_null()
pl.col("value").is_not_null()

# Fill nulls with a value
pl.col("value").fill_null(0)
pl.col("name").fill_null("Unknown")

# Fill nulls with another column
pl.col("primary").fill_null(pl.col("fallback"))

# Drop nulls (in filter context)
pl.col("value").is_not_null()  # Use as filter condition
```

## Type Casting

Use `.cast()` to convert between types:

```python
# To integer
pl.col("str_number").cast(pl.Int64)

# To float
pl.col("value").cast(pl.Float64)

# To string
pl.col("id").cast(pl.Utf8)

# To boolean
pl.col("flag").cast(pl.Boolean)

# To date
pl.col("date_str").str.to_date()

# To datetime
pl.col("datetime_str").str.to_datetime()
```

See [Data Types](../data-types.md) for the full list of available types.

## Date and Time Operations

Date/time methods are accessed via `.dt`:

```python
# Extract components
pl.col("date").dt.year()
pl.col("date").dt.month()
pl.col("date").dt.day()
pl.col("datetime").dt.hour()
pl.col("datetime").dt.minute()
pl.col("datetime").dt.second()

# Day of week (Monday = 1, Sunday = 7)
pl.col("date").dt.weekday()

# Date arithmetic
pl.col("date") + pl.duration(days=7)
pl.col("date") - pl.duration(months=1)

# Truncate to period
pl.col("datetime").dt.truncate("1d")     # To day
pl.col("datetime").dt.truncate("1mo")    # To month
```

## Numeric Operations

```python
# Rounding
pl.col("value").round(2)                 # Round to 2 decimal places
pl.col("value").floor()                  # Round down
pl.col("value").ceil()                   # Round up

# Absolute value
pl.col("diff").abs()

# Clipping
pl.col("value").clip(0, 100)             # Constrain to range

# Mathematical functions
pl.col("value").sqrt()
pl.col("value").log()
pl.col("value").exp()
```

## Conditional Logic

Use `pl.when().then().otherwise()` for if-else logic. Wrap multi-line expressions in parentheses:

```python
# Simple condition
(
    pl.when(pl.col("age") >= 18)
    .then(pl.lit("Adult"))
    .otherwise(pl.lit("Minor"))
)

# Multiple conditions (chained)
(
    pl.when(pl.col("score") >= 90)
    .then(pl.lit("A"))
    .when(pl.col("score") >= 80)
    .then(pl.lit("B"))
    .when(pl.col("score") >= 70)
    .then(pl.lit("C"))
    .otherwise(pl.lit("F"))
)
```

:::tip
Remember to use `pl.lit()` for literal values in `then()` and `otherwise()`.
:::

## Combining Columns

```python
# String concatenation
pl.col("first_name") + pl.lit(" ") + pl.col("last_name")

# Or use format
pl.format("{} {}", pl.col("first_name"), pl.col("last_name"))

# Arithmetic
pl.col("quantity") * pl.col("unit_price")
(pl.col("revenue") - pl.col("cost")) / pl.col("revenue") * 100
```

## List Operations

For columns containing lists:

```python
# List length
pl.col("items").list.len()

# Get element by index
pl.col("items").list.get(0)              # First element
pl.col("items").list.get(-1)             # Last element

# Check if contains
pl.col("tags").list.contains("urgent")

# Join list to string
pl.col("items").list.join(", ")
```

## External Reference

For the complete API, see:
- [Polars Expressions Guide](https://docs.pola.rs/user-guide/expressions/)
- [Polars API Reference](https://docs.pola.rs/api/python/stable/reference/)
