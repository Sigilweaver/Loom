---
sidebar_position: 1
---

# User Guide

Welcome to the Sigilweaver User Guide. This documentation covers everything you need to build data transformation workflows.

## Getting Started

Sigilweaver is a visual data pipeline tool that lets you build complex data transformations through an intuitive drag-and-drop interface. Under the hood, it uses [Polars](https://pola.rs) for fast, efficient data processing with lazy evaluation.

## Documentation Sections

### [Interface](./interface/canvas)

Learn how to navigate the application:

- **[Canvas](./interface/canvas)** - The main workspace where you build workflows
- **[Tool Palette](./interface/tool-palette)** - Find and add tools to your workflow
- **[Wiring](./interface/wiring)** - Connect tools to create data flows
- **[Configuration Panel](./interface/configuration-panel)** - Configure tool settings
- **[Data Preview](./interface/data-preview)** - Inspect data at any point in your workflow
- **[Keyboard Shortcuts](./interface/keyboard-shortcuts)** - Work faster with shortcuts

### [Expressions](./expressions/basics)

Master the expression language used in Filter and Formula tools:

- **[Basics](./expressions/basics)** - Column references, literals, and operators
- **[Syntax Rules](./expressions/syntax-rules)** - Parentheses, multi-line expressions, and gotchas
- **[Common Operations](./expressions/common-operations)** - String manipulation, dates, casting, and null handling

### [Data Types](./data-types)

Understand the data types Sigilweaver supports and when to use each.

### [Tools](./tools/)

Reference documentation for every tool:

| Category | Tools |
|----------|-------|
| **Input/Output** | [Input](./tools/input-output/input), [Output](./tools/input-output/output) |
| **Preparation** | [Filter](./tools/preparation/filter), [Select](./tools/preparation/select), [Sort](./tools/preparation/sort), [Formula](./tools/preparation/formula) |
| **Join** | [Union](./tools/join/union), [Join](./tools/join/join-tool) |
| **Aggregate** | [Summarize](./tools/aggregate/summarize) |

## Core Concepts

### Lazy Evaluation

Sigilweaver uses Polars' lazy evaluation model. This means:

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

Many tools use Polars expressions for configuration. Expressions let you:

- Reference columns: `pl.col("column_name")`
- Apply transformations: `pl.col("price") * 1.1`
- Filter rows: `pl.col("status") == "active"`
- Combine conditions: `(pl.col("a") > 10) & (pl.col("b") < 20)`

See the [Expressions](./expressions/basics) section for a complete guide.

## External Resources

- [Polars User Guide](https://docs.pola.rs/user-guide/) - Full Polars documentation
- [Polars Expression Reference](https://docs.pola.rs/user-guide/expressions/) - Complete expression API
- [GitHub Repository](https://github.com/sigilweaver/sigilweaver-app) - Source code and issue tracker
