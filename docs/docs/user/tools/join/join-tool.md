---
sidebar_position: 2
---

# Join

Combine two datasets horizontally based on matching key columns.

| | |
|---|---|
| **Palette name** | Join (category Combine) |
| **Type name** | `Join` |

## Sockets

### Inputs

| Socket | Direction | Description |
|--------|-----------|-------------|
| `L` (input-left) | Input | Left dataset |
| `R` (input-right) | Input | Right dataset |

### Outputs

| Socket | Direction | Description |
|--------|-----------|-------------|
| `L` (output-left) | Output | Unmatched rows from left (left anti-join) |
| `J` (output-match) | Output | Matched/joined rows (inner join) |
| `R` (output-right) | Output | Unmatched rows from right (right anti-join) |

## Configuration

| Option | Description |
|--------|-------------|
| **Left Key** | Column(s) from left input to match on |
| **Right Key** | Column(s) from right input to match on |
| **Right Suffix** | Suffix for right columns that conflict with left (default: `_right`) |

## How It Works

The Join tool performs three operations simultaneously:

1. **Inner Join** (J output): Rows where keys match between left and right
2. **Left Anti-Join** (L output): Rows from left with no match in right
3. **Right Anti-Join** (R output): Rows from right with no match in left

This gives you complete visibility into what matched and what didn't.

## Key Configuration

### Single Key

Match on one column from each side:

| Left Key | Right Key |
|----------|-----------|
| `customer_id` | `id` |

### Multiple Keys

Match on multiple columns (composite key):

| Left Key | Right Key |
|----------|-----------|
| `year` | `year` |
| `month` | `month` |

Keys are matched in order - first left key matches first right key, etc.

### No Keys (Cross Join)

If no keys are specified, a **cross join** is performed - every row from left is combined with every row from right. Use with caution on large datasets!

## Column Handling

### Key Columns

Key columns from the right input are **excluded** from the joined output (J socket) to avoid duplication. The left key columns are included.

### Conflicting Column Names

If left and right have non-key columns with the same name, the right column is renamed with the suffix (default `_right`):

- Left has: `id`, `value`
- Right has: `id`, `value`
- Joined on `id`
- Output: `id`, `value`, `value_right`

You can customize the suffix in configuration.

## Examples

### Basic Join

Match orders to customers:

**Left (Orders):**
| order_id | customer_id | amount |
|----------|-------------|--------|
| 1 | 101 | 50 |
| 2 | 102 | 75 |
| 3 | 103 | 25 |

**Right (Customers):**
| id | name |
|----|------|
| 101 | Alice |
| 102 | Bob |

**Configuration:**
- Left Key: `customer_id`
- Right Key: `id`

**J Output (Matched):**
| order_id | customer_id | amount | name |
|----------|-------------|--------|------|
| 1 | 101 | 50 | Alice |
| 2 | 102 | 75 | Bob |

**L Output (Unmatched Left):**
| order_id | customer_id | amount |
|----------|-------------|--------|
| 3 | 103 | 25 |

**R Output (Unmatched Right):**
(empty - all customers had orders)

### Finding Missing Data

Use the `L` and `R` outputs to find records that don't have matches:

- `L` output: "Orders without customers"
- `R` output: "Customers without orders"

## Notes

- **Key types should match**: Join works best when key columns have the same type. Cast if needed.
- **Null keys**: Rows with null keys will not match (nulls never equal other values in joins)
- **Performance**: Joins on indexed or sorted columns are faster
- **Memory**: Large cross joins can produce massive results

## Related

- [Select](../preparation/select) - Cast types or rename columns before joining
- [Filter](../preparation/filter) - Filter results after joining
