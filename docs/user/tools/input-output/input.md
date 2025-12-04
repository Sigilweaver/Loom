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

## Configuration

1. Add an Input tool to the canvas
2. Select the data source type (CSV or Parquet)
3. Choose the file using the file picker
4. Configure format-specific options as needed

## Examples

### Loading a CSV

1. Drag Input tool to canvas
2. Select "CSV" as the data source
3. Click "Browse" and select your file
4. Adjust separator if not comma-delimited
5. Wire the output to downstream tools

### Loading a Parquet

1. Drag Input tool to canvas
2. Select "Parquet" as the data source
3. Click "Browse" and select your file
4. Wire the output to downstream tools

## Notes

- **Lazy loading** (Scan mode) is recommended for most use cases
- **Schema inference** for CSV may not always be accurate - use Select to cast types
- **File paths** must be accessible from where Sigilweaver is running
