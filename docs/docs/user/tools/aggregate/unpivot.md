---
sidebar_position: 3
---

# Unpivot

Reshape data from wide format to long format by turning columns into rows (also known as "melt").

| | |
|---|---|
| **Palette name** | Unpivot (category Reshape) |
| **Type name** | `Unpivot` |

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to unpivot |
| `output` | Output | Unpivoted (long-format) data |

## How Unpivot Works

Unpivot takes a "wide" table and makes it "tall":

**Before (wide format):**

| Region | Sales | Costs |
|--------|-------|-------|
| North | 100 | 80 |
| South | 150 | 90 |

**After unpivoting** (on: `Sales, Costs`, index: `Region`):

| Region | variable | value |
|--------|----------|-------|
| North | Sales | 100 |
| North | Costs | 80 |
| South | Sales | 150 |
| South | Costs | 90 |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| Unpivot Columns | (required) | Columns to turn into rows |
| Keep Columns | (optional) | Columns to preserve as row identifiers |
| Variable Name | `variable` | Name for the column that stores original column names |
| Value Name | `value` | Name for the column that stores the values |

Each input row produces **N output rows**, where N is the number of unpivot columns. For example, unpivoting 5 columns from a 1,000-row table produces 5,000 output rows.

## Column Selection

For each input column, you can choose to:
- **Unpivot** it (its values become rows)
- **Keep** it (preserved as an identifier in every output row)
- **Neither** (dropped from output)

A column cannot be both unpivoted and kept.

## Safety Checks

Sigilweaver Loom checks the potential output size before executing to prevent accidental row explosion. The limit is configurable via `SAFETY_MAX_UNPIVOT_ROWS` (default: 100,000,000).

## Examples

### Monthly Columns to Rows

Given a table with `product`, `jan`, `feb`, `mar` columns:

1. Set columns `jan`, `feb`, `mar` to **Unpivot**
2. Set `product` to **Keep**
3. Set **Variable Name** to `month`
4. Set **Value Name** to `sales`

Result:

| product | month | sales |
|---------|-------|-------|
| Widget | jan | 100 |
| Widget | feb | 120 |
| Widget | mar | 110 |
| ... | ... | ... |

## Notes

- Unpivot is a streaming operation - it does not need to load all data before producing output
- If all unpivot columns share the same data type, the value column inherits that type; otherwise it becomes String
- Use [Pivot](./pivot) to reverse an unpivot operation
- The variable column is always of type String
