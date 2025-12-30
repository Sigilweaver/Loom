---
sidebar_position: 4
---

# Configuration Panel

The configuration panel is on the left side of the workspace and shows settings for the currently selected tool or workflow.

## Workflow Configuration

When no tool is selected, the panel shows **Workflow Configuration**:

- **Name**: Display name for the workflow
- **Description**: Optional description of what the workflow does
- **Author**: Optional author information
- **Statistics**: Number of tools and wires in the workflow

## Tool Configuration

When a tool is selected, the panel shows that tool's specific configuration options.

### Header

The panel header shows:

- **Tool icon and name**: Identifies the selected tool
- **Tool type**: The category and type of tool

### Configuration Sections

Each tool type has different configuration options. Common patterns include:

#### File Selection (Input/Output)

- File picker with browse button
- Format-specific options (CSV separators, encoding, etc.)

#### Expression Editor (Filter/Formula)

- Code editor with syntax highlighting
- Autocomplete for column names
- Example expressions for reference

#### Column Selection (Select/Sort/Summarize)

- List of available columns
- Checkboxes, dropdowns, or drag-to-reorder interfaces
- Type casting and renaming options

#### Mode Selection (Union/Join)

- Dropdown or radio buttons for operation modes
- Preview of what each mode does

### Real-time Validation

As you configure tools, validation runs automatically:

- **Errors** are shown inline with the relevant field
- **Warnings** indicate potential issues
- Configuration is saved immediately as you type

## Resizing the Panel

Drag the right edge of the panel to resize it. The panel remembers your preferred width.
