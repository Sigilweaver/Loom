---
sidebar_position: 6
---

# Unique

Remove duplicate rows from your data, with the option to output both unique and duplicate rows.

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to deduplicate |
| `output-unique` (U) | Output | Rows identified as unique |
| `output-duplicate` (D) | Output | Rows identified as duplicates |

:::tip Two Outputs
Unlike most tools, Unique has **two outputs**. Connect the **U** output for unique rows and the **D** output for duplicates. You can use either or both outputs in your workflow.
:::

## Deduplication Modes

| Mode | Unique Output | Duplicate Output |
|------|--------------|-----------------|
| **First Occurrence** | First row of each value group | All subsequent rows |
| **Strictly Unique** | Only values appearing exactly once | All rows from repeated groups |

### First Occurrence (Default)

Groups rows by the selected columns. The **first** row in each group goes to the unique output; all remaining rows in the group go to the duplicate output.

### Strictly Unique

Only rows whose value combination appears **exactly once** in the dataset go to the unique output. If a value combination appears two or more times, **all** rows with that combination go to the duplicate output.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| Columns | (all) | Columns to check for duplicates. Leave empty to check all columns. |
| Mode | `First Occurrence` | How to determine which rows are unique |

:::warning Blocking Operation
Unique is always a blocking operation - it must read all rows before it can determine which are unique and which are duplicates. The entire dataset must fit in memory.
:::

## Examples

### Remove Duplicate Emails

1. Connect data to the Unique tool
2. Select only the `email` column
3. Set Mode to **First Occurrence**
4. Wire the **U** output to downstream tools

### Find All Duplicated Records

1. Connect data to the Unique tool
2. Select the columns that define uniqueness
3. Set Mode to **Strictly Unique**
4. Wire the **D** output to see all rows that have duplicates

### Deduplicate on Multiple Columns

1. Connect data to the Unique tool
2. Select `first_name`, `last_name`, and `date_of_birth`
3. Set Mode to **First Occurrence**
4. The first row for each name + DOB combination goes to **U**, rest to **D**

## Notes

- The output schema for both outputs is identical to the input schema
- When no columns are selected, all columns are used for comparison
- **First Occurrence** is useful for simple deduplication (keep one, discard rest)
- **Strictly Unique** is useful for finding records that definitely have no duplicates
