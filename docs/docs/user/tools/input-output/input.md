---
sidebar_position: 1
title: Read (Input)
sidebar_label: Read
---

# Read (Input)

Load data from files or databases into your workflow.

| | |
|---|---|
| **Palette name** | Read (category Connect) |
| **Type name** | `Input` |

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `output` | Output | Loaded data as a LazyFrame |

## Supported Formats

### CSV

Comma-separated values and other delimited text files (`.csv`, `.tsv`, `.tab`, `.txt`).

**Reading Modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Scan** | Lazy loading, streams data | Large files, memory efficiency |
| **Read** | Eager loading, loads entire file | Small files, when you need all data upfront |

**CSV Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the CSV file |
| Separator | `,` | Field delimiter (comma, tab, pipe, etc.) |
| Has Header | `true` | First row contains column names |
| Quote Character | `"` | Character used to quote fields |
| Encoding | `utf-8` | File encoding |
| Skip Rows | `0` | Number of rows to skip at the start |
| Skip Rows After Header | `0` | Rows to skip after the header row |
| N Rows | (all) | Limit number of rows to read |
| Infer Schema Length | `100` | Rows to sample for type inference |
| Try Parse Dates | `false` | Attempt to parse date columns |
| Ignore Errors | `false` | Skip rows with parsing errors |
| Truncate Ragged Lines | `false` | Truncate lines that are too long instead of erroring |
| Comment Prefix | (none) | Character that marks comment lines to skip |
| Null Values | (none) | String(s) to interpret as null |
| Decimal Comma | `false` | Use comma as decimal separator (European format) |
| Low Memory | `false` | Reduce memory usage at cost of speed |
| Rechunk | `false` | Rechunk to contiguous memory after reading |

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
| Low Memory | `false` | Reduce memory usage at cost of speed |
| Cache | `true` | Cache scan result (scan mode only) |
| Rechunk | `false` | Rechunk to contiguous memory |
| Retries | `2` | Number of retries on I/O errors |

**Advanced Parquet Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Row Index Name | (none) | Add a row index column with this name |
| Row Index Offset | `0` | Start row index at this value |
| Hive Partitioning | `false` | Infer partition columns from directory structure |
| Parse Hive Dates | `true` | Try to parse date columns from Hive partitions |

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

### Avro

Apache Avro binary format (.avro). A row-based format commonly used in big data ecosystems like Hadoop, Kafka, and Spark.

**Reading Mode:**

Avro files only support eager reading (the entire file is loaded into memory). Unlike IPC or Parquet, Avro does not support lazy scanning in Polars.

**Avro Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the Avro file |
| N Rows | (all) | Limit number of rows to read |
| Columns | (all) | Specific columns to load (by name or index) |

:::note When to Use Avro
Avro is ideal when:
- Integrating with Hadoop, Kafka, or Spark pipelines
- You need schema evolution support
- Working with row-based data patterns
- Interoperability with Java/JVM ecosystems is important

For pure performance within Sigilweaver Loom, consider IPC/Arrow or Parquet instead.
:::

### ODS

OpenDocument Spreadsheet (.ods) files from LibreOffice and OpenOffice. Similar to Excel but uses an open standard format.

**Reading Mode:**

ODS files only support eager reading (the entire file is loaded into memory). Polars does not support lazy scanning or writing for ODS format - it is read-only.

**ODS Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the ODS file |
| Sheet ID | 1 | Which sheet to read (1-indexed, 0 = all sheets) |
| Sheet Name | (none) | Alternative to Sheet ID - read by name |
| Has Header | true | First row contains column names |
| Columns | (all) | Specific columns to load (by name or index) |
| Infer Schema Length | 100 | Number of rows to scan for type inference |
| Drop Empty Rows | true | Remove completely empty rows |
| Drop Empty Cols | true | Remove completely empty columns |
| Raise If Empty | true | Error if the sheet is empty |

:::note When to Use ODS
ODS is ideal when:
- Working with LibreOffice or OpenOffice spreadsheets
- You need an open standard alternative to Excel
- Sharing data between open source office suites
- Compatibility with government or academic systems using open formats

**Note:** ODS is read-only. Use the Write tool with Excel, CSV or Parquet to save data.
:::

### PostgreSQL

Query data directly from PostgreSQL databases.

**Connections:**

| Kind | Credentials | Best for |
|------|-------------|----------|
| **Local (client) connection** | Stored on your machine in the operating system's credential store | Personal databases, development |
| **Hub connection** | Managed by a Hub administrator and never shown to you | Shared databases, team environments |

**PostgreSQL Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Connection | (required) | Select a configured database connection |
| Query | (required) | SQL query to execute |

**Setting Up Connections:**

Connections are managed in **Settings > Connections**. See [Managing Connections](../../interface/connections.md) for details on creating and using database connections.

:::tip Security
Credentials are never stored in workflow files. The workflow keeps only a connection ID. When you export Python code or view the workflow JSON, credentials are stripped or replaced by placeholders.

Queries that contain write or DDL keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE` and similar) are rejected. Treat that as a safety net and give the database user read-only permissions.
:::

:::note Lazy Evaluation
PostgreSQL queries are lazily evaluated like file sources. The query is executed when you preview data or run the workflow, not when you configure the tool.
:::

### MySQL

Query data directly from MySQL databases.

**MySQL Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Connection | (required) | Select a configured database connection |
| Query | (required) | SQL query to execute |

Connection setup and security are the same as PostgreSQL. See [Managing Connections](../../interface/connections.md) for details.

### SQLite

Query data from SQLite database files.

**SQLite Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Database file | (required) | Path to a `.db`, `.sqlite`, `.sqlite3` or `.db3` file |
| Query | (required) | SQL query to execute |

:::note No connection needed
SQLite is file-based, so you pick the file directly instead of creating a connection. The file must be readable from where the Server runs.
:::

### SQL Server

Query data from Microsoft SQL Server databases. The type name is `mssql`.

**SQL Server Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Connection | (required) | Select a configured database connection |
| Query | (required) | SQL query to execute |

Connection setup and security are the same as PostgreSQL. See [Managing Connections](../../interface/connections.md) for details.

### JSON

JSON data files. Sigilweaver Loom supports two JSON formats, auto-detected by file extension:

| Format | Extensions | Reading Mode | Description |
|--------|-----------|-------------|-------------|
| **Standard JSON** | `.json` | Eager (Read) | Array of objects |
| **NDJSON** | `.jsonl`, `.ndjson` | Lazy (Scan) | Newline-delimited JSON |

**JSON Options (standard .json):**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the JSON file |
| Infer Schema Length | `100` | Rows to sample for type inference |

**NDJSON Options (.jsonl, .ndjson):**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the NDJSON file |
| Infer Schema Length | `100` | Rows to sample for type inference |
| N Rows | (all) | Limit number of rows to read |
| Batch Size | (default) | Processing batch size |
| Low Memory | `false` | Reduce memory usage at cost of speed |
| Rechunk | `false` | Rechunk to contiguous memory |
| Ignore Errors | `false` | Skip rows with parsing errors |

:::tip NDJSON for Large Files
If your JSON data is large, use NDJSON format (`.jsonl` or `.ndjson`) for lazy streaming support. Standard `.json` files must be loaded entirely into memory.
:::

### YXDB

YXDB database files (.yxdb). Read using [SigilYX](https://github.com/Sigilweaver/SigilYX), a high-performance Rust-based reader.

**Reading Mode:**

YXDB files are read eagerly (the entire file is loaded into memory). The row-based LZF compression used by the format prevents partial reads or predicate pushdown. The result is wrapped in a LazyFrame for workflow compatibility, so subsequent operations (filter, select, join) are still composed lazily.

**YXDB Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the YXDB file |
| N Rows | (all) | Limit number of rows to read |

:::note YXDB Support
Sigilweaver Loom supports all 17 YXDB field types including Bool, Int16/32/64, Float, Double, FixedDecimal, String/WString/VString/VWString, Date, Time, DateTime, Blob, and SpatialObj. Blob and SpatialObj fields are read as strings.
:::

### QVD

QVD (QlikView Data) files (.qvd). Read using [OpenQVD](https://github.com/Sigilweaver/OpenQVD), a Rust-based reader for the QlikView and Qlik Sense data format.

**Reading Mode:**

QVD files are read eagerly (the entire file is loaded into memory) and wrapped in a LazyFrame for workflow compatibility, so subsequent operations (filter, select, join) are still composed lazily.

**QVD Options:**

| Option | Default | Description |
|--------|---------|-------------|
| Source | (required) | Path to the QVD file |
| Number of Rows | (all) | Limit number of rows to read |

:::note QVD Support
QVD is the native storage format produced by QlikView and Qlik Sense. Values are decoded into Polars types (integers, floats, and strings). QVD has no native boolean type, so boolean-like fields surface as integers or strings depending on how they were stored.
:::

## Configuration

1. Add a Read tool to the canvas
2. Select the data source type:
   - **File sources**: CSV, Excel, Parquet, IPC/Arrow, Avro, ODS, JSON/NDJSON, YXDB, or QVD
   - **Database sources**: PostgreSQL, MySQL, SQLite, or SQL Server
3. For file sources, choose the file with **Browse** (or **Remote** to browse the Server in External and Hub modes), or type the full path
4. For PostgreSQL, MySQL and SQL Server, select a connection and write a SQL query. For SQLite, pick the file and write a query
5. Configure format-specific options as needed

## Examples

### Loading a CSV

1. Drag a Read tool onto the canvas
2. Select "CSV" as the data source
3. Click "Browse" and select your file
4. Adjust separator if not comma-delimited
5. Wire the output to downstream tools

### Loading an Excel File

1. Drag a Read tool onto the canvas
2. Select "Excel" as the data source
3. Click "Browse" and select your .xlsx, .xls, or .xlsb file
4. Select the sheet to read (by number or name)
5. Wire the output to downstream tools

### Loading a Parquet

1. Drag a Read tool onto the canvas
2. Select "Parquet" as the data source
3. Click "Browse" and select your file
4. Wire the output to downstream tools

### Loading an IPC/Arrow File

1. Drag a Read tool onto the canvas
2. Select "IPC / Arrow" as the data source
3. Click "Browse" and select your .arrow, .ipc, or .feather file
4. Wire the output to downstream tools

### Loading an Avro File

1. Drag a Read tool onto the canvas
2. Select "Avro" as the data source
3. Click "Browse" and select your .avro file
4. Optionally limit rows with "Max Rows" option
5. Wire the output to downstream tools

### Loading an ODS File

1. Drag a Read tool onto the canvas
2. Select "ODS" as the data source
3. Click "Browse" and select your .ods file
4. Select the sheet to read (by number or name)
5. Configure options like drop empty rows/columns
6. Wire the output to downstream tools

### Querying a PostgreSQL Database

1. Drag a Read tool onto the canvas
2. Select "Database" as the data source category
3. Select "PostgreSQL" as the database type
4. Choose an existing connection or create one in Settings > Connections
5. Enter your SQL query
6. Wire the output to downstream tools

## Notes

- **Lazy loading** (Scan mode) is recommended for CSV, Parquet, IPC/Arrow, and NDJSON when working with large files
- **Excel, Avro, ODS, standard JSON, and YXDB files** are always loaded entirely into memory - consider converting large files to CSV, Parquet, or IPC for better performance
- **IPC/Arrow** is the fastest format and ideal for intermediate data or sharing between Arrow-compatible applications
- **NDJSON** (`.jsonl`, `.ndjson`) supports lazy scanning unlike standard `.json` files
- **YXDB** is read using SigilYX's Rust core for high performance
- **Avro** is best for interoperability with big data ecosystems (Hadoop, Kafka, Spark)
- **ODS** and **QVD** are read-only in Loom. Use a Write tool with Excel, CSV or another format to save
- **All database types** (PostgreSQL, MySQL, SQLite, SQL Server) use the connectorx engine for high-performance reads
- **Database credentials** are never stored in workflow files. Only connection IDs are saved
- **Schema inference** may not always be accurate. Use the Schema tool to cast types if needed
- **File paths** must be accessible from where Sigilweaver Loom is running
