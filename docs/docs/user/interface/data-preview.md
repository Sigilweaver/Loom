---
sidebar_position: 5
---

# Data Preview

The data preview panel at the bottom of the workspace lets you inspect data at any point in your workflow.

## Opening the Panel

The bottom panel can be toggled and has three tabs:

- **Data Preview**: View data from selected tool outputs
- **Logs**: View execution logs
- **Network**: View API request/response activity

## Previewing Data

### Selecting an Output Socket

When a tool is selected, the left sidebar shows available output sockets:

1. Select a tool on the canvas
2. Click on an output socket tab in the sidebar (e.g., `output`, `T`, `F`)
3. Click "Preview" or wait for automatic preview

### Data Table

The preview shows data in a scrollable table:

- **Columns**: Show column names and inferred types
- **Rows**: First N rows of the dataset (limited for performance)
- **Scrolling**: Horizontal and vertical scrolling for large datasets

### Limitations

- Preview fetches a **limited sample** of rows (typically 100-1000)
- Large datasets are not fully loaded into memory
- Some operations may require executing upstream tools first

## Socket Tabs

For tools with multiple outputs (like Filter with T/F or Join with L/J/R), tabs let you switch between outputs:

| Tool | Output Tabs |
|------|-------------|
| Filter | `T` (matching rows), `F` (non-matching rows) |
| Join | `L` (unmatched left), `J` (matched), `R` (unmatched right) |
| Other tools | Single `output` tab |

## Resizing the Panel

Drag the top edge of the panel to resize it vertically. The panel remembers your preferred height.

## Closing the Panel

Click the `×` button in the panel header to close it.
