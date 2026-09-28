---
sidebar_position: 2
---

# Pivot

Reshape data from long format to wide format by turning unique values from one column into new columns.

| | |
|---|---|
| **Palette name** | Pivot (category Reshape) |
| **Type name** | `Pivot` |

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to pivot |
| `output` | Output | Pivoted (wide-format) data |

## How Pivot Works

Pivot takes a "tall" table and makes it "wide":

**Before (long format):**

| Region | Metric | Value |
|--------|--------|-------|
| North | Sales | 100 |
| North | Costs | 80 |
| South | Sales | 150 |
| South | Costs | 90 |

**After pivoting** (on: `Metric`, index: `Region`, values: `Value`, aggregate: `first`):

| Region | Sales | Costs |
|--------|-------|-------|
| North | 100 | 80 |
| South | 150 | 90 |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| Pivot Column | (required) | Column whose unique values become new column headers |
| Group By | (required) | One or more columns that identify each row in the output |
| Values Column | (required) | Column whose values fill the new pivot columns |
| Aggregate Function | `first` | How to combine values when multiple rows map to the same cell |

### Aggregate Functions

| Function | Description | Numeric Only |
|----------|-------------|:------------:|
| `first` | First value encountered | No |
| `last` | Last value encountered | No |
| `sum` | Sum of values | Yes |
| `mean` | Average of values | Yes |
| `median` | Median of values | Yes |
| `min` | Minimum value | No |
| `max` | Maximum value | No |
| `len` | Count of values | No |

:::warning Blocking Operation
Pivot is always a blocking operation - it must read all data to determine the complete set of unique values for column headers.
:::

## Safety Checks

Sigilweaver Loom checks the number of unique values in the pivot column before executing:

| Unique Values | Behavior |
|--------------|----------|
| < 100 | Normal execution |
| 100 - 1,000 | Warning displayed |
| > 1,000 | Blocked by default (configurable via `SAFETY_MAX_PIVOT_COLUMNS`) |

The configuration panel shows cardinality indicators (green/yellow/red) next to each column in the Pivot Column dropdown to help you choose safely.

## Examples

### Sales by Region and Product

Given a table with `region`, `product`, and `revenue` columns:

1. Set **Pivot Column** to `product`
2. Set **Group By** to `region`
3. Set **Values Column** to `revenue`
4. Set **Aggregate Function** to `sum`

Result: One row per region, one column per product, with summed revenue values.

## Notes

- A column cannot be used in multiple roles (e.g., both as Pivot Column and Group By)
- The output schema depends on the actual data values, so it cannot be fully predicted from configuration alone
- Use [Unpivot](./unpivot) to reverse a pivot operation
- If your pivot column has too many unique values, consider filtering the data first
