---
sidebar_position: 1
---

# Tools Overview

Sigilweaver provides a set of tools for building data transformation workflows. Each tool performs a specific operation on data.

## Tool Categories

### Input/Output

Load and save data:

| Tool | Purpose |
|------|---------|
| [Input](./input-output/input) | Load data from files |
| [Output](./input-output/output) | Save data to files |

### Preparation

Transform and clean data:

| Tool | Purpose |
|------|---------|
| [Filter](./preparation/filter) | Split data based on a condition |
| [Select](./preparation/select) | Choose, rename, reorder, and cast columns |
| [Sort](./preparation/sort) | Order rows by column values |
| [Formula](./preparation/formula) | Create or replace calculated columns |

### Join

Combine datasets:

| Tool | Purpose |
|------|---------|
| [Union](./join/union) | Stack datasets vertically |
| [Join](./join/join-tool) | Combine datasets horizontally on key columns |

### Aggregate

Summarize data:

| Tool | Purpose |
|------|---------|
| [Summarize](./aggregate/summarize) | Group data and calculate aggregations |

## Common Concepts

### Sockets

Every tool has sockets for connecting to other tools:

- **Input sockets** (left side): Receive data from upstream tools
- **Output sockets** (right side): Send data to downstream tools

Some tools have multiple sockets with labels (e.g., `L`/`R` for left/right, `T`/`F` for true/false).

### Configuration

Each tool has a configuration panel that appears when the tool is selected. Configuration options vary by tool type.

### Lazy Evaluation

All tools use Polars' lazy evaluation. Operations are not executed immediately - they're optimized and run together when you preview or execute the workflow.

## Cheat Sheet

| I want to... | Use |
|--------------|-----|
| Load a CSV file | [Input](./input-output/input) |
| Save results | [Output](./input-output/output) |
| Keep only certain rows | [Filter](./preparation/filter) |
| Remove or rename columns | [Select](./preparation/select) |
| Order my data | [Sort](./preparation/sort) |
| Calculate a new column | [Formula](./preparation/formula) |
| Stack two tables | [Union](./join/union) |
| Match rows between tables | [Join](./join/join-tool) |
| Calculate totals by group | [Summarize](./aggregate/summarize) |
