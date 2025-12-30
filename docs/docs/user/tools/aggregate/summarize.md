---
sidebar_position: 1
---

# Summarize

Group data and calculate aggregations (sums, averages, counts, etc.).

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to summarize |
| `output` | Output | Aggregated results |

## Configuration

The Summarize tool shows a table of all available columns. For each column, select an action:

| Action | Description | Works On |
|--------|-------------|----------|
| **Group By** | Group rows by this column's values | Any type |
| **Sum** | Calculate total | Numeric only |
| **Mean** | Calculate average | Numeric only |
| **Median** | Calculate median value | Numeric only |
| **Min** | Find minimum value | Any type |
| **Max** | Find maximum value | Any type |
| **Count** | Count non-null values | Any type |
| **Count Distinct** | Count unique values | Any type |
| **First** | Get first value in group | Any type |
| **Last** | Get last value in group | Any type |
| **Std Dev** | Calculate standard deviation | Numeric only |
| **Variance** | Calculate variance | Numeric only |
| **Concat** | Concatenate strings with comma | String only |

### Output Column Names

Each aggregation creates an output column named `{Action}_{Column}` by default (e.g., `Sum_amount`).

You can customize output names in the configuration.

## How It Works

### With Group By Columns

When you select one or more columns as "Group By":

1. Rows are grouped by unique combinations of those column values
2. Aggregations are calculated within each group
3. Output has one row per group

### Without Group By (Global Aggregation)

If no Group By columns are selected:

1. All rows are treated as a single group
2. Aggregations are calculated across the entire dataset
3. Output has a single row

## Examples

### Total Sales by Region

**Input:**
| region | product | amount |
|--------|---------|--------|
| East | Widget | 100 |
| East | Gadget | 150 |
| West | Widget | 200 |
| West | Widget | 75 |

**Configuration:**
- `region`: Group By
- `amount`: Sum

**Output:**
| region | Sum_amount |
|--------|------------|
| East | 250 |
| West | 275 |

### Multiple Aggregations

**Configuration:**
- `region`: Group By
- `amount`: Sum
- `amount`: Count
- `product`: Count Distinct

**Output:**
| region | Sum_amount | Count_amount | CountDistinct_product |
|--------|------------|--------------|----------------------|
| East | 250 | 2 | 2 |
| West | 275 | 2 | 1 |

### Global Totals (No Group By)

**Configuration:**
- `amount`: Sum
- `amount`: Mean
- `amount`: Count

**Output:**
| Sum_amount | Mean_amount | Count_amount |
|------------|-------------|--------------|
| 525 | 131.25 | 4 |

### Distinct Values Only

Use Group By without any aggregations to get unique values:

**Configuration:**
- `region`: Group By

**Output:**
| region |
|--------|
| East |
| West |

## Aggregation Details

### Numeric Aggregations

| Aggregation | Behavior |
|-------------|----------|
| Sum | Total of all values (nulls ignored) |
| Mean | Average (nulls ignored) |
| Median | Middle value when sorted |
| Std Dev | Standard deviation |
| Variance | Variance |
| Min/Max | Minimum/maximum value |

### Count Aggregations

| Aggregation | Behavior |
|-------------|----------|
| Count | Number of non-null values |
| Count Distinct | Number of unique values (nulls excluded) |

### String Aggregations

| Aggregation | Behavior |
|-------------|----------|
| Concat | Joins values with `, ` separator |
| First/Last | First or last value in the group |

## Notes

- **Empty groups**: Groups with all null values produce null aggregation results
- **Row order**: Group By output order is not guaranteed (sort if needed)
- **Multiple aggregations per column**: You can apply multiple aggregations to the same column
- **Null handling**: Most aggregations skip null values
