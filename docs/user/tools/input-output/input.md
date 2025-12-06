---
sidebar_position: 1
---

# Input

Load data from files into your workflow.

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `output` | Output | Loaded data as a LazyFrame |

## Supported Formats

### CSV

Comma-separated values and other delimited text files.

**Reading Modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Scan** | Lazy loading, streams data | Large files, memory efficiency |
| **Read** | Eager loading, loads entire file | Small files, when you need all data upfront |
| **Batched** | Processes in chunks | Very large files |

**CSV Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the CSV file |
| Separator | `,` | Field delimiter (comma, tab, pipe, etc.) |
| Has Header | `true` | First row contains column names |
| Quote Character | `"` | Character used to quote fields |
| Encoding | `utf-8` | File encoding |
| Skip Rows | `0` | Number of rows to skip at the start |
| Infer Schema Length | `100` | Rows to sample for type inference |
| Try Parse Dates | `false` | Attempt to parse date columns |
| Ignore Errors | `false` | Skip rows with parsing errors |

### Excel

Microsoft Excel spreadsheet files (.xlsx, .xls, .xlsb).

**Reading Mode:**

Excel files only support eager reading (the entire file is loaded into memory). This is a limitation of the Excel format - unlike CSV or Parquet, Excel files cannot be lazily streamed.

**Excel Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the Excel file |
| Sheet Number | `1` | Sheet to read (1 = first sheet, 0 = all sheets) |
| Sheet Name | (none) | Alternative: specify sheet by name |
| Has Header | `true` | First row contains column names |
| Infer Schema Length | `100` | Rows to sample for type inference |
| Drop Empty Rows | `true` | Omit completely empty rows |
| Drop Empty Columns | `true` | Omit empty columns with no headers |
| Error if Empty | `true` | Raise error if sheet contains no data |

:::note Sheet Selection
You can select a sheet either by number (1-indexed) or by name, but not both. If neither is specified, the first sheet is read.
:::

### Parquet

Columnar binary format with embedded schema.

**Reading Modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Scan** | Lazy loading, predicate pushdown | Large files, memory efficiency |
| **Read** | Eager loading | Small files |

**Parquet Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the Parquet file |
| N Rows | (all) | Limit number of rows to read |
| Columns | (all) | Specific columns to load |
| Use Statistics | `true` | Use file statistics for optimization |
| Parallel | `auto` | Parallel reading strategy |

### IPC / Arrow

Apache Arrow's native binary format (.arrow, .ipc, .feather). Designed for zero-copy data sharing and maximum performance.

**Reading Modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Scan** | Lazy loading, memory-mapped | Large files, memory efficiency |
| **Read** | Eager loading | Small files |

**IPC Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the Arrow file |
| N Rows | (all) | Limit number of rows to read |
| Memory Map | `true` | Memory-map the file for efficient access |
| Cache | `true` | Cache scan result (scan mode only) |
| Rechunk | `false` / `true` | Rechunk to contiguous memory (default differs by mode) |
| Retries | `2` | Number of retries on I/O errors |

**Advanced Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Row Index Name | (none) | Add a row index column with this name |
| Row Index Offset | `0` | Start row index at this value |
| Hive Partitioning | `false` | Infer partition columns from directory structure |
| Parse Hive Dates | `true` | Try to parse date columns from Hive partitions |

:::tip Performance
IPC/Arrow is the **fastest format** for read/write operations. Use it for intermediate files in your workflow or for sharing data between applications that support Apache Arrow (DuckDB, Spark, R, Julia, etc.).
:::

## Configuration

1. Add an Input tool to the canvas
2. Select the data source type (CSV, Excel, Parquet, or IPC/Arrow)
3. Choose the file using the file picker
4. Configure format-specific options as needed

## Examples

### Loading a CSV

1. Drag Input tool to canvas
2. Select "CSV" as the data source
3. Click "Browse" and select your file
4. Adjust separator if not comma-delimited
5. Wire the output to downstream tools

### Loading an Excel File

1. Drag Input tool to canvas
2. Select "Excel" as the data source
3. Click "Browse" and select your .xlsx, .xls, or .xlsb file
4. Select the sheet to read (by number or name)
5. Wire the output to downstream tools

### Loading a Parquet

1. Drag Input tool to canvas
2. Select "Parquet" as the data source
3. Click "Browse" and select your file
4. Wire the output to downstream tools

### Loading an IPC/Arrow File

1. Drag Input tool to canvas
2. Select "IPC / Arrow" as the data source
3. Click "Browse" and select your .arrow, .ipc, or .feather file
4. Wire the output to downstream tools

## Notes

- **Lazy loading** (Scan mode) is recommended for CSV, Parquet, and IPC/Arrow when working with large files
- **Excel files** are always loaded entirely into memory - consider converting large Excel files to CSV, Parquet, or IPC for better performance
- **IPC/Arrow** is the fastest format and ideal for intermediate data or sharing between Arrow-compatible applications
- **Schema inference** may not always be accurate - use Select to cast types if needed
- **File paths** must be accessible from where Sigilweaver is running
