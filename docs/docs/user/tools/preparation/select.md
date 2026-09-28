---
sidebar_position: 2
title: Schema (Select)
sidebar_label: Schema
---

# Schema (Select)

Choose, rename, reorder, and cast columns.

| | |
|---|---|
| **Palette name** | Schema (category Compute) |
| **Type name** | `Select` |

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to transform |
| `output` | Output | Data with selected columns |

## Configuration

The Schema tool shows a table of all available columns with the following controls:

| Column | Description |
|--------|-------------|
| **Checkbox** | Include/exclude the column from output |
| **Name** | Original column name (read-only) |
| **Rename** | New name for the column (optional) |
| **Type** | Target data type (optional, for casting) |
| **Size** | For string types, maximum character length (optional) |

### Column Order

Drag rows to reorder columns. The output will have columns in the order shown in the configuration.

## Operations

### Selecting Columns

Check the columns you want to keep, uncheck those you want to remove.

**At least one column must be selected.**

### Renaming Columns

Enter a new name in the "Rename" field. Leave empty to keep the original name.

### Reordering Columns

Drag and drop rows to change column order. The first row becomes the first column, etc.

### Casting Types

Select a target type from the dropdown to convert the column. Available types:

| Category | Types |
|----------|-------|
| Integer | Int8, Int16, Int32, Int64, UInt8, UInt16, UInt32, UInt64 |
| Float | Float32, Float64 |
| String | String, Utf8 |
| Boolean | Boolean |
| Temporal | Date, Datetime, Time, Duration |
| Other | Categorical |

### Truncating Strings

For String/Utf8 columns, enter a size limit to truncate values to that many characters.

## Examples

### Keep Only Specific Columns

1. Uncheck all columns you don't need
2. Keep checked only the columns you want

### Rename a Column

1. Find the column in the list
2. Enter the new name in the "Rename" field

### Cast String to Integer

1. Find the column containing numeric strings
2. Select "Int64" from the Type dropdown
3. Ensure the data is actually numeric, or the cast will fail

### Reorder Columns

1. Drag the "id" row to the top
2. Drag "name" below it
3. Arrange remaining columns as needed

## Notes

- **Empty configuration**: If no columns are configured, all columns pass through unchanged
- **Duplicate names**: An error is shown if you rename two columns to the same name
- **Cast failures**: If a value can't be cast to the target type, execution will fail
- **Row count unchanged**: Schema only affects columns, not rows

## Related

- [Data Types](../../data-types) - Details on available data types
