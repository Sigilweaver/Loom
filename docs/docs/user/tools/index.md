---
sidebar_position: 1
title: Tools Reference
sidebar_label: Overview
---

# Tools Reference

Loom has 13 tools. Each page lists the tool's sockets, options and examples.

Studio's palette shows a short name for each tool. The name in parentheses is the tool's **type name**, which you will see in workflow files, exported code, the AI assistant and the API.

## Connect

Load and save data.

| Tool                                                | Type name | Purpose                                   |
| --------------------------------------------------- | --------- | ----------------------------------------- |
| [Read](./input-output/input.md)                     | `Input`   | Load data from files or databases         |
| [Write](./input-output/output.md)                   | `Output`  | Save data to files                        |

## Compute

Clean and transform rows and columns.

| Tool                                                | Type name | Purpose                                                        |
| --------------------------------------------------- | --------- | -------------------------------------------------------------- |
| [Filter](./preparation/filter.md)                   | `Filter`  | Split rows by a condition (visual builder or expression)       |
| [Schema](./preparation/select.md)                   | `Select`  | Choose, rename, reorder and cast columns                       |
| [Sort](./preparation/sort.md)                       | `Sort`    | Order rows by column values                                    |
| [Calculate](./preparation/formula.md)               | `Formula` | Create or replace columns (50+ built-in operations)            |
| [Sample](./preparation/sample.md)                   | `Sample`  | Take a subset of rows (first N, random and more)               |
| [Unique](./preparation/unique.md)                   | `Unique`  | Split unique rows from duplicates                              |

## Reshape

Summarize data and change its shape.

| Tool                                                | Type name   | Purpose                                     |
| --------------------------------------------------- | ----------- | ------------------------------------------- |
| [Aggregate](./aggregate/summarize.md)               | `Summarize` | Group rows and calculate totals, counts and more |
| [Pivot](./aggregate/pivot.md)                       | `Pivot`     | Turn long data into wide data               |
| [Unpivot](./aggregate/unpivot.md)                   | `Unpivot`   | Turn wide data into long data               |

## Combine

Merge datasets.

| Tool                                                | Type name | Purpose                                     |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| [Concatenate](./join/union.md)                      | `Union`   | Stack datasets on top of each other         |
| [Join](./join/join-tool.md)                         | `Join`    | Match rows on key columns                   |

## Which tool do I need?

| I want to...                        | Use                                                         |
| ----------------------------------- | ----------------------------------------------------------- |
| Load a CSV, Parquet or Excel file   | [Read](./input-output/input.md)                             |
| Query a database                    | [Read](./input-output/input.md) with a database source      |
| Save results                        | [Write](./input-output/output.md)                           |
| Keep only certain rows              | [Filter](./preparation/filter.md)                           |
| Remove, rename or retype columns    | [Schema](./preparation/select.md)                           |
| Order my data                       | [Sort](./preparation/sort.md)                               |
| Calculate a new column              | [Calculate](./preparation/formula.md)                       |
| Take a sample                       | [Sample](./preparation/sample.md)                           |
| Find or remove duplicates           | [Unique](./preparation/unique.md)                           |
| Total, count or average by group    | [Aggregate](./aggregate/summarize.md)                       |
| Turn long data into wide data       | [Pivot](./aggregate/pivot.md)                               |
| Turn wide data into long data       | [Unpivot](./aggregate/unpivot.md)                           |
| Stack two tables                    | [Concatenate](./join/union.md)                              |
| Match rows between two tables       | [Join](./join/join-tool.md)                                 |

## Common concepts

### Sockets

Every tool has sockets. Inputs are on the left and outputs are on the right. Some tools have several sockets, labelled with a letter such as `T` and `F`, or `L`, `J` and `R`. See [Wiring](../interface/wiring.md).

### Blocking tools

Sort, Join, Aggregate, Pivot and Unpivot show a warning triangle in Studio. Blocking operations must read all their input before they produce output. The Server caches these results. See [Performance and Caching](../interface/caching.md).

### Configuration

Select a tool to configure it in the left pane. Changes apply immediately. See [Configuration Panel](../interface/configuration-panel.md).

### Expressions

Filter and Calculate accept Polars expressions in Custom mode. See [Expressions](../expressions/basics.md).

### Lazy evaluation

Tools build a Polars query plan. Nothing runs until you preview a socket or run the workflow.
