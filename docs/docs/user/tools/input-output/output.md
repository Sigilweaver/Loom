---
sidebar_position: 2
title: Write (Output)
sidebar_label: Write
---

# Write (Output)

Save data from your workflow to files.

| | |
|---|---|
| **Palette name** | Write (category Connect) |
| **Type name** | `Output` |

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to save |

The Write tool has no output sockets. It ends a branch of the workflow.

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
| Include BOM | `false` | Write UTF-8 byte-order mark at start of file |
| Quote Character | `"` | Character used to quote fields |
| Quote Style | `necessary` | When to quote fields |
| Line Terminator | `\n` | End-of-line character(s) |
| Null Value | (empty) | String to represent null values |
| Date Format | (ISO) | Format for date columns |
| Datetime Format | (ISO) | Format for datetime columns |
| Time Format | (ISO) | Format for time columns |
| Float Precision | (full) | Decimal places for floats |
| Float Scientific | (auto) | Use scientific notation for floats |

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
| Data Page Size | (default) | Size of data pages within row groups |
| Statistics | `true` | Write column statistics |

### IPC / Arrow

Apache Arrow's native binary format (.arrow, .ipc, .feather). Fastest format for read/write operations.

**Writing Modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Sink** | Streaming write | Large datasets, memory efficiency |
| **Write** | Collects all data first | Small datasets |

**IPC Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file (.arrow, .ipc, or .feather) |
| Compression | `uncompressed` | Compression (uncompressed, lz4, or zstd) |
| Compat Level | (newest) | Arrow IPC compatibility level for older consumers |

:::tip When to Use IPC/Arrow
- **Intermediate files**: Use IPC for temporary data between pipeline stages
- **Cross-application sharing**: IPC works with DuckDB, Spark, R, Julia, and other Arrow-compatible tools
- **Maximum speed**: IPC has the fastest read/write performance of any format
- **Memory efficiency**: Files can be memory-mapped for efficient access
:::

### Excel

Microsoft Excel spreadsheet files (.xlsx).

**Writing Mode:**

Excel only supports eager writing (data is collected before writing). There is no streaming sink support.

**Excel Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file (.xlsx) |
| Worksheet | `Sheet1` | Name of the worksheet to create |
| Table Name | (empty) | Optional name for the Excel table object |
| Table Style | `Table Style Medium 4` | Excel table style (e.g., "Table Style Medium 9") |
| Include Header | `true` | Write column names as header row |
| Autofilter | `true` | Enable autofilter dropdown in header |
| Autofit | `false` | Auto-calculate column widths to fit content |
| Hide Gridlines | `false` | Hide worksheet gridlines |
| Float Precision | `3` | Decimal places for float numbers |
| Sheet Zoom | `100%` | Zoom level (10-400%) |
| Freeze Panes | (none) | Cell position to freeze (e.g., "A2" freezes top row) |

:::tip Excel Table Styles
Excel table styles provide professional formatting. Popular options include:
- **Light styles** (1-21): Subtle, minimalist
- **Medium styles** (1-28): Balanced, good for most uses
- **Dark styles** (1-11): High contrast, bold headers
- **None**: Plain data without table formatting

You can also enter any custom Excel table style name. See the full visual reference below.

<details>
<summary>Click to view all Excel table styles</summary>

![Excel Table Styles Reference](/img/excel-table-styles.png)

</details>
:::

### Avro

Apache Avro binary format (.avro). Row-based format for big data ecosystems.

**Writing Mode:**

Avro only supports eager writing (data is collected before writing). There is no streaming sink support.

**Avro Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file (.avro) |
| Compression | `uncompressed` | Compression (uncompressed, snappy, or deflate) |
| Schema Name | (empty) | Optional name for the Avro schema |

:::note Avro Use Cases
Use Avro when:
- Integrating with Hadoop, Kafka, or Spark pipelines
- Schema evolution is important for your data workflow
- Interoperability with Java/JVM ecosystems is required

For maximum performance within Sigilweaver Loom, prefer IPC/Arrow or Parquet.
:::

### JSON / NDJSON

JSON data files. The format is auto-detected by file extension.

| Format | Extensions | Writing Mode | Description |
|--------|-----------|-------------|-------------|
| **Standard JSON** | `.json` | Write (eager) | Array of objects or column-oriented |
| **NDJSON** | `.jsonl`, `.ndjson` | Sink (streaming) or Write | Newline-delimited JSON |

**JSON Options (standard .json):**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file |
| Row Oriented | `true` | Write as array of row objects (vs column-oriented) |

**NDJSON Options (.jsonl, .ndjson):**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file |

:::tip NDJSON for Large Files
Use NDJSON format (`.jsonl` or `.ndjson`) for streaming sink support. Standard `.json` files must be collected into memory before writing.
:::

### YXDB

YXDB database files (.yxdb). Written using [SigilYX](https://github.com/Sigilweaver/SigilYX).

**Writing Mode:**

YXDB only supports eager writing (data is collected before writing).

**YXDB Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Destination | (required) | Path for the output file (.yxdb) |



## Configuration

1. Add a Write tool to the canvas
2. Connect an input wire from an upstream tool
3. Select the output format (CSV, Excel, Parquet, IPC/Arrow, JSON/NDJSON, Avro, or YXDB)
4. Choose the destination path
5. Configure format-specific options as needed

## Examples

### Saving to CSV

1. Wire data into the Write tool
2. Select "CSV" as the output format
3. Enter the destination file path (e.g., `/path/to/output.csv`)
4. Adjust options like separator or header as needed

### Saving to Parquet

1. Wire data into the Write tool
2. Select "Parquet" as the output format
3. Enter the destination file path (e.g., `/path/to/output.parquet`)
4. Choose compression (zstd recommended for balance of speed and size)

### Saving to IPC/Arrow

1. Wire data into the Write tool
2. Select "IPC / Arrow" as the output format
3. Enter the destination file path (e.g., `/path/to/output.arrow`)
4. Choose compression if needed (uncompressed is fastest, zstd for smaller files)

### Saving to Excel

1. Wire data into the Write tool
2. Select "Excel" as the output format
3. Enter the destination file path (e.g., `/path/to/output.xlsx`)
4. Optionally configure worksheet name, table styling, and formatting options
5. Use freeze panes to keep headers visible when scrolling

### Saving to Avro

1. Wire data into the Write tool
2. Select "Avro" as the output format
3. Enter the destination file path (e.g., `/path/to/output.avro`)
4. Choose compression (uncompressed for speed, snappy or deflate for smaller files)

### Saving to JSON

1. Wire data into the Write tool
2. Select "JSON" as the output format
3. Enter the destination file path:
   - Use `.json` for standard JSON (array of objects)
   - Use `.jsonl` or `.ndjson` for newline-delimited JSON (streaming support)
4. For standard JSON, choose row-oriented (array of objects) or column-oriented output

### Saving to YXDB

1. Wire data into the Write tool
2. Select "YXDB" as the output format
3. Enter the destination file path (e.g., `/path/to/output.yxdb`)

## Notes

- **Destination directories** are created automatically if they don't exist
- **Sink mode** is recommended for large datasets to minimize memory usage (CSV, Parquet, IPC, NDJSON)
- **Excel, Avro, standard JSON, and YXDB** do not support streaming - data is collected before writing
- **IPC/Arrow** is the fastest format - use it when speed is critical
- **Excel files** are best for business reporting and sharing with non-technical users
- **YXDB files** are supported via [SigilYX](https://github.com/Sigilweaver/SigilYX)
- **NDJSON** (`.jsonl`, `.ndjson`) supports streaming sink unlike standard `.json` files
- **Overwriting**: Existing files at the destination path will be overwritten
- **When it writes**: Write tools run when you click **Run** or **Preview All**. Previewing a single socket runs only the tools upstream of it, so it does not write files
