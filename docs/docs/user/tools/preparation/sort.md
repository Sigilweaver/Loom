---
sidebar_position: 3
---

# Sort

Order rows by one or more column values.

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to sort |
| `output` | Output | Sorted data |

## Configuration

The Sort tool shows a table of all available columns. For each column, select a sort order:

| Option | Description |
|--------|-------------|
| **None** | Don't sort by this column |
| **Ascending** | Sort low to high (A-Z, 0-9) |
| **Descending** | Sort high to low (Z-A, 9-0) |
| **Ascending (nulls first)** | Ascending, nulls at the top |
| **Descending (nulls first)** | Descending, nulls at the top |

## Multi-Column Sorting

When multiple columns have sort orders set, they are applied in sequence:

1. First, data is sorted by the first column with a sort order
2. Ties are broken by the second column
3. And so on for additional columns

### Example

To sort by `department` (ascending), then by `salary` (descending within each department):

1. Set `department` to "Ascending"
2. Set `salary` to "Descending"

Result: Rows are grouped by department alphabetically, and within each department, employees are ordered by salary from highest to lowest.

## Null Handling

By default, null values sort to the **end** (after all non-null values).

Use the "nulls first" options to put nulls at the beginning instead:

- **Ascending (nulls first)**: nulls, then low to high
- **Descending (nulls first)**: nulls, then high to low

## Examples

### Simple Sort

Sort customers by name alphabetically:

1. Find the `name` column
2. Select "Ascending"

### Sort by Date (Newest First)

Show most recent records first:

1. Find the `created_at` column
2. Select "Descending"

### Sort with Tie-Breaking

Sort products by category, then by price within category:

1. Set `category` to "Ascending"
2. Set `price` to "Ascending"

## Notes

- **Empty configuration**: If no columns have sort orders, data passes through unchanged
- **Column order**: The order of columns in the configuration table determines tie-breaking priority
- **Schema unchanged**: Sort only affects row order, not columns
- **Stable sort**: Rows with equal values maintain their relative order from the input
