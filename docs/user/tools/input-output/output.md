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

:::tip When to Use IPC/Arrow
- **Intermediate files**: Use IPC for temporary data between pipeline stages
- **Cross-application sharing**: IPC works with DuckDB, Spark, R, Julia, and other Arrow-compatible tools
- **Maximum speed**: IPC has the fastest read/write performance of any format
- **Memory efficiency**: Files can be memory-mapped for efficient access
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

For maximum performance within Sigilweaver, prefer IPC/Arrow or Parquet.
:::

## Configuration

1. Add an Output tool to the canvas
2. Connect an input wire from an upstream tool
3. Select the output format (CSV, Parquet, IPC/Arrow, or Avro)
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

### Saving to IPC/Arrow

1. Wire data into the Output tool
2. Select "IPC / Arrow" as the output format
3. Enter the destination file path (e.g., `/path/to/output.arrow`)
4. Choose compression if needed (uncompressed is fastest, zstd for smaller files)

### Saving to Avro

1. Wire data into the Output tool
2. Select "Avro" as the output format
3. Enter the destination file path (e.g., `/path/to/output.avro`)
4. Choose compression (uncompressed for speed, snappy or deflate for smaller files)

## Notes

- **Destination directories** are created automatically if they don't exist
- **Sink mode** is recommended for large datasets to minimize memory usage (CSV, Parquet, IPC)
- **Avro** does not support streaming - data is collected before writing
- **IPC/Arrow** is the fastest format - use it when speed is critical
- **Overwriting**: Existing files at the destination path will be overwritten
- **Execution**: Output tools only write files when the workflow is executed (not during preview)
