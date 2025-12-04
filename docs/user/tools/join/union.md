---
sidebar_position: 1
---

# Union

Combine multiple datasets vertically (stack rows).

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Multiple datasets to combine (multi-input socket) |
| `output` | Output | Combined dataset with all rows |

The input socket accepts **multiple connections** - you can wire several upstream tools to the same input.

## Configuration

| Option | Description |
|--------|-------------|
| **By Name** | Align columns by name. Missing columns are filled with nulls. |
| **By Position** | Align columns by position. Columns are renamed to match the first input. |

### By Name (Default)

Columns are matched by name across all inputs:

- Columns with the same name are stacked
- Columns that exist in some inputs but not others are filled with null
- Column order follows the first input, with additional columns appended

**Example:**

Input 1:
| id | name |
|----|------|
| 1  | Alice |

Input 2:
| id | email |
|----|-------|
| 2  | bob@example.com |

Output (By Name):
| id | name | email |
|----|------|-------|
| 1  | Alice | null |
| 2  | null | bob@example.com |

### By Position

Columns are matched by their position (first column to first column, etc.):

- Columns from subsequent inputs are renamed to match the first input
- All inputs should have the same number of columns
- Column types should be compatible

**Example:**

Input 1:
| id | name |
|----|------|
| 1  | Alice |

Input 2:
| user_id | full_name |
|---------|-----------|
| 2  | Bob |

Output (By Position):
| id | name |
|----|------|
| 1  | Alice |
| 2  | Bob |

## Usage

1. Add a Union tool to the canvas
2. Connect multiple upstream tools to the input socket
3. Select the union mode (By Name or By Position)
4. Connect the output to downstream tools

## Examples

### Combining Monthly Files

If you have separate files for each month with identical columns:

1. Add multiple Input tools (one per file)
2. Connect all to a Union tool
3. Use "By Name" mode

### Combining Files with Different Column Names

If files have different column names but the same meaning:

1. Use "By Position" mode, OR
2. Use Select tools to rename columns before Union, then use "By Name"

## Notes

- **Single input**: If only one input is connected, data passes through unchanged
- **No inputs**: Returns an empty dataset
- **Type compatibility**: Polars will attempt to upcast types when they differ (e.g., Int32 + Int64 = Int64)
- **Row order**: Rows from the first input come first, then second input, etc.
