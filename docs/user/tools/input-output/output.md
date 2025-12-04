---
sidebar_position: 2
---

# Output

Save data from your workflow to files.

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to save |

The Output tool has no output sockets - it's a terminal node in the workflow.

## Supported Formats

### CSV

Comma-separated values and other delimited text files.

**Writing Modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Sink** | Streaming write, memory efficient | Large datasets |
| **Write** | Collects all data first, then writes | When you need specific write options |

**CSV Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file |
| Separator | `,` | Field delimiter |
| Include Header | `true` | Write column names as first row |
| Quote Character | `"` | Character used to quote fields |
| Quote Style | `necessary` | When to quote fields |
| Line Terminator | `\n` | End-of-line character(s) |
| Null Value | (empty) | String to represent null values |
| Date Format | (ISO) | Format for date columns |
| Datetime Format | (ISO) | Format for datetime columns |
| Float Precision | (full) | Decimal places for floats |

### Parquet

Columnar binary format, efficient for analytics.

**Writing Modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Sink** | Streaming write | Large datasets |
| **Write** | Collects all data first | When you need specific write options |

**Parquet Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file |
| Compression | `zstd` | Compression algorithm (zstd, snappy, lz4, gzip, none) |
| Compression Level | (default) | Compression level (algorithm-specific) |
| Row Group Size | (default) | Rows per row group |
| Statistics | `true` | Write column statistics |

## Configuration

1. Add an Output tool to the canvas
2. Connect an input wire from an upstream tool
3. Select the output format (CSV or Parquet)
4. Choose the destination path
5. Configure format-specific options as needed

## Examples

### Saving to CSV

1. Wire data into the Output tool
2. Select "CSV" as the output format
3. Enter the destination file path (e.g., `/path/to/output.csv`)
4. Adjust options like separator or header as needed

### Saving to Parquet

1. Wire data into the Output tool
2. Select "Parquet" as the output format
3. Enter the destination file path (e.g., `/path/to/output.parquet`)
4. Choose compression (zstd recommended for balance of speed and size)

## Notes

- **Destination directories** are created automatically if they don't exist
- **Sink mode** is recommended for large datasets to minimize memory usage
- **Overwriting**: Existing files at the destination path will be overwritten
- **Execution**: Output tools only write files when the workflow is executed (not during preview)
