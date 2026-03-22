---
sidebar_position: 1
---

# User Guide

Welcome to the Sigilweaver Loom User Guide. This documentation covers everything you need to build data transformation workflows.

## Getting Started

Sigilweaver Loom is a visual data pipeline tool that lets you build complex data transformations through an intuitive drag-and-drop interface. Under the hood, it uses [Polars](https://pola.rs) for fast, efficient data processing with lazy evaluation.



## Documentation Sections

### [Interface](./interface/canvas)

Learn how to navigate Studio:

- **[Canvas](./interface/canvas)** - The main workspace where you build workflows
- **[Tool Palette](./interface/tool-palette)** - Find and add tools to your workflow
- **[Wiring](./interface/wiring)** - Connect tools to create data flows
- **[Configuration Panel](./interface/configuration-panel)** - Configure tool settings
- **[Data Preview](./interface/data-preview)** - Inspect data at any point in your workflow
- **[Keyboard Shortcuts](./interface/keyboard-shortcuts)** - Work faster with shortcuts
- **[Managing Connections](./interface/connections)** - Set up database connections securely
- **[Using Hub](./interface/hub)** - Connect to Hub for team features

### [Expressions](./expressions/basics)

The expression language used in the Custom/Advanced mode of Filter and Formula tools. Most users won't need this - the visual builders handle the vast majority of use cases. But when you need more power, the expression editor has full autocomplete:

- **[Basics](./expressions/basics)** - Autocomplete, column references, and operators
- **[Syntax Rules](./expressions/syntax-rules)** - Parentheses, multi-line expressions, and gotchas
- **[Common Operations](./expressions/common-operations)** - String manipulation, dates, casting, and null handling

### [Data Types](./data-types)

Understand the data types Sigilweaver Loom supports and when to use each.

### [Tools](./tools/)

Reference documentation for every tool:

| Category | Tools |
|----------|-------|
| **Input/Output** | [Input](./tools/input-output/input), [Output](./tools/input-output/output) |
| **Preparation** | [Filter](./tools/preparation/filter), [Select](./tools/preparation/select), [Sort](./tools/preparation/sort), [Formula](./tools/preparation/formula), [Sample](./tools/preparation/sample), [Unique](./tools/preparation/unique) |
| **Join** | [Union](./tools/join/union), [Join](./tools/join/join-tool) |
| **Aggregate** | [Summarize](./tools/aggregate/summarize), [Pivot](./tools/aggregate/pivot), [Unpivot](./tools/aggregate/unpivot) |

## Core Concepts

### Lazy Evaluation

Sigilweaver Loom uses Polars' lazy evaluation model. This means:

- Operations are **not executed immediately** when you build the workflow
- The entire pipeline is **optimized** before execution
- Data is processed efficiently in a **streaming** fashion when possible

This allows you to work with datasets much larger than your available memory.

### Workflows

A workflow is a directed acyclic graph (DAG) of tools connected by wires:

- **Tools** perform operations on data (filtering, joining, aggregating, etc.)
- **Wires** connect tool outputs to tool inputs, defining data flow
- **Sockets** are the connection points on tools (inputs on the left, outputs on the right)

### Expressions

Many tools use Polars expressions for configuration. The **Filter** and **Formula** tools provide **visual builders** (Basic mode) that handle most use cases without any coding. For advanced logic, **Custom mode** lets you write expressions directly:

- Reference columns: `pl.col("column_name")`
- Apply transformations: `pl.col("price") * 1.1`
- Filter rows: `pl.col("status") == "active"`
- Combine conditions: `(pl.col("a") > 10) & (pl.col("b") < 20)`

See the [Expressions](./expressions/basics) section for a complete guide.

## External Resources

- [Polars User Guide](https://docs.pola.rs/user-guide/) - Full Polars documentation
- [Polars Expression Reference](https://docs.pola.rs/user-guide/expressions/) - Complete expression API
- [GitHub Repository](https://github.com/Sigilweaver/Loom) - Source code and issue tracker

## For Administrators

If you're managing a Sigilweaver Loom Hub deployment for your team, see the [Administrator Guide](/admin/) for:

- [Roles and Permissions](/admin/roles) - Understanding access control
- [User Management](/admin/users) - Creating and managing user accounts
- [Groups](/admin/groups) - Organizing users and controlling access
- [Hub Connections](/admin/connections) - Providing secure database access
- [Server Management](/admin/servers) - Managing execution infrastructure
- [Security Model](/admin/security) - Zero-trust credential handling
