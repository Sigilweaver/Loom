---
sidebar_position: 4
---

# Data Types

Sigilweaver Loom uses Polars data types. Understanding these types helps you work with data effectively and avoid type-related errors.

## Numeric Types

### Integers

| Type | Size | Range | Use Case |
|------|------|-------|----------|
| `Int8` | 1 byte | -128 to 127 | Small counters, flags |
| `Int16` | 2 bytes | -32,768 to 32,767 | Small numbers |
| `Int32` | 4 bytes | -2.1B to 2.1B | Most integer data |
| `Int64` | 8 bytes | -9.2e18 to 9.2e18 | Large IDs, timestamps |
| `UInt8` | 1 byte | 0 to 255 | Byte values, small positive |
| `UInt16` | 2 bytes | 0 to 65,535 | Port numbers, small positive |
| `UInt32` | 4 bytes | 0 to 4.3B | Positive integers |
| `UInt64` | 8 bytes | 0 to 1.8e19 | Large positive integers |

### Floating Point

| Type | Size | Precision | Use Case |
|------|------|-----------|----------|
| `Float32` | 4 bytes | ~7 digits | Graphics, less precision needed |
| `Float64` | 8 bytes | ~15 digits | Most decimal numbers, scientific data |

### Decimal

| Type | Description | Use Case |
|------|-------------|----------|
| `Decimal` | Arbitrary precision decimal | Financial calculations, exact decimal math |

`Decimal` avoids floating-point rounding errors. Use it when precision matters (money, accounting).

## Text Types

| Type | Description |
|------|-------------|
| `String` | UTF-8 encoded text (variable length) |
| `Utf8` | Alias for String |

Both types are interchangeable. Use them for any text data.

## Boolean

| Type | Values |
|------|--------|
| `Boolean` | `True` / `False` |

## Temporal Types

| Type | Description | Example |
|------|-------------|---------|
| `Date` | Calendar date (no time) | `2024-01-15` |
| `Datetime` | Date + time with nanosecond precision | `2024-01-15 14:30:00.123456789` |
| `Time` | Time of day only | `14:30:00` |
| `Duration` | Time span | `1 day, 2:30:00` |

## Other Types

| Type | Description |
|------|-------------|
| `Categorical` | Enum-like string values (memory efficient for repeated values) |
| `List` | Nested list of values |
| `Struct` | Nested structure with named fields |

## Type Inference

When loading data, Sigilweaver Loom infers types automatically:

- **CSV files**: Types are inferred by sampling rows
- **Parquet files**: Types are stored in the file metadata

You can override inferred types using the **Select** tool's type casting feature.

## Casting Types

Use the Select tool or Formula expressions to convert between types:

### In Select Tool

1. Open the Select tool configuration
2. Find the column you want to cast
3. Select the target type from the dropdown

### In Formula Expressions

```python
# Cast to integer
pl.col("str_number").cast(pl.Int64)

# Cast to float
pl.col("value").cast(pl.Float64)

# Cast to string
pl.col("id").cast(pl.Utf8)

# Parse date from string
pl.col("date_str").str.to_date()
```

## Type Compatibility

When joining or unioning data, column types should match:

| Operation | Requirement |
|-----------|-------------|
| Join keys | Should be same type (e.g., both Int64) |
| Union | Columns are upcast if types differ |

### Automatic Upcasting

Polars automatically upcasts when combining different numeric types:

- `Int32` + `Int64` = `Int64`
- `Float32` + `Float64` = `Float64`
- `Int64` + `Float64` = `Float64`

## Choosing Types

### Memory Optimization

Choose the smallest type that fits your data:

| If your values are... | Use |
|----------------------|-----|
| 0-255 | `UInt8` |
| Small positive integers | `UInt16` or `UInt32` |
| Integers with negatives | `Int32` or `Int64` |
| Decimal numbers | `Float64` |
| Repeated string values | `Categorical` |

### Precision

- For **financial calculations**, use `Decimal` to avoid rounding errors
- For **scientific/general decimal**, use `Float64`

## Common Type Errors

### "Could not convert to Int64"

The column contains non-numeric values. Clean the data first:

```python
# Filter out non-numeric before casting
pl.col("value").str.contains("^-?\\d+$").is_not_null()
```

### "Type mismatch in join"

Join keys have different types. Cast one to match the other:

```python
pl.col("id").cast(pl.Int64)
```
