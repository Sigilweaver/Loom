---
sidebar_position: 3
---

# Wiring

Wires connect tools together, defining how data flows through your workflow.

## Sockets

Every tool has **sockets** - connection points for wires:

- **Input sockets**: Left side of the tool - receive data from upstream tools
- **Output sockets**: Right side of the tool - send data to downstream tools

Some tools have multiple sockets with labels indicating their purpose (e.g., for a filter tool: `T` for true, `F` for false).

## Creating Wires

1. Click on an **output socket** (right side of a tool)
2. Drag to an **input socket** (left side of another tool)
3. Release to create the connection

The wire appears as a curved line connecting the two sockets.

### Connection Rules

- Wires flow **left to right** (output to input)
- Each input socket can receive from **one** output (except multi-input sockets)
- Each output socket can send to **multiple** inputs
- You cannot create cycles (loops) in the workflow

## Multi-Input Sockets

Some tools (like **Union**) accept multiple inputs on a single socket. These sockets are marked with an `M` and allow you to connect multiple wires.

## Removing Wires

- Click on a wire to select it, then press **Delete** or **Backspace**, or right click the wire, and select **Delete**
- Drag a new wire to an already-connected input to replace the existing wire

## Wire Validation

Sigilweaver validates connections as you work:

- Invalid connections are prevented (e.g., input-to-input)
- Cycle detection prevents infinite loops

## Socket Types by Tool

### Input Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `output` | Output | Loaded data from file |

### Output Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to save to file |

### Filter Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to filter |
| `T` (output-true) | Output | Rows matching the condition |
| `F` (output-false) | Output | Rows not matching the condition |

### Select, Sort, Formula Tools

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to transform |
| `output` | Output | Transformed data |

### Union Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Multiple datasets to combine (multi-input) |
| `output` | Output | Combined dataset |

### Join Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `L` (input-left) | Input | Left dataset |
| `R` (input-right) | Input | Right dataset |
| `L` (output-left) | Output | Unmatched rows from left |
| `J` (output-match) | Output | Matched/joined rows |
| `R` (output-right) | Output | Unmatched rows from right |

### Summarize Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to summarize |
| `output` | Output | Aggregated results |

### Sample Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to sample from |
| `output` | Output | Sampled rows |

### Unique Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to deduplicate |
| `U` (output-unique) | Output | Unique rows |
| `D` (output-duplicate) | Output | Duplicate rows |

### Pivot Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to pivot |
| `output` | Output | Pivoted (wide-format) data |

### Unpivot Tool

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to unpivot |
| `output` | Output | Unpivoted (long-format) data |
