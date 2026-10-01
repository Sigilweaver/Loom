---
sidebar_position: 5
title: Data Preview
---

# Data Preview

The bottom pane lets you look at your data at any wire. It opens when you preview a socket, and you can close it with the `x` in its header.

## Previewing a socket

Do any of these:

- Click a socket on a tool.
- Right-click a socket and choose **Preview Data**.
- Select a tool and click one of the socket buttons in the pane's left column.

Studio runs the workflow up to that socket and shows the first rows. This does not write files. The number of rows comes from **Settings > Execution > Preview Rows** (default 100). The Server also enforces its own limit, `MAX_PREVIEW_ROWS` (default 10,000).

**Validate** in the header checks the workflow without running it. Unconnected inputs, loops and missing required settings appear in the **Problems** tab of this pane. Validation is advisory and never blocks Run.

**Preview All** in the header evaluates the workflow and loads previews for its tools at once. It skips Write tools, so it does not create or overwrite output files. Use **Run** to write outputs.

## Tabs

| Tab                | Shows                                                       |
| ------------------ | ----------------------------------------------------------- |
| **Data Preview**   | A table of the sampled rows and their column types.         |
| **Data Profile**   | Per-column statistics and data-quality checks.              |
| **Workflow Logs**  | Messages from the last run: progress, timings and errors.   |
| **Network Logs**   | Requests Studio made to the Server.                         |

### Socket buttons

Data Preview and Data Profile have a column of buttons for the selected tool. **Inputs** lists connected input sockets and **Outputs** lists every output. Tools with several outputs use these labels:

| Tool   | Output buttons                                        |
| ------ | ----------------------------------------------------- |
| Filter | True, False                                           |
| Unique | U (unique rows), D (duplicate rows)                   |
| Join   | Left Out, Join Out, Right Out                         |
| Others | Output                                                |

## Working with the table

- Click a column header to sort the sample ascending, then descending, then clear. This sorts only what you see, not the workflow.
- Drag to select cells. Arrow keys move the selection, and `Shift` with a click or arrow key extends it. Click a header to select a column. `Ctrl+A` selects everything and `Esc` clears the selection.
- `Ctrl+C` copies the selection with headers. `Ctrl+Shift+C` copies without headers. With nothing selected, the **Copy All** buttons copy the whole sample. Copies are tab-separated, so they paste into a spreadsheet.
- Double-click a cell to copy its value. Long values are shortened in the table.

## Data Profile

Profile a socket by right-clicking it and choosing **Profile Data**. The Server computes statistics over the **full** data, not the preview sample, so it can take time on large inputs.

For each column the profile shows counts of OK, blank, issue and null values. It also shows, depending on the type, the most frequent values, smallest and largest values, aggregate statistics, and issue details such as leading or trailing whitespace, line breaks and non-ASCII characters.

## Refreshing stale data

Studio reuses earlier previews while the workflow is unchanged. If a source changed outside Loom, open the arrow next to **Preview All** and choose **Bypass Cache** or **Clear Backend Cache**. See [Performance and Caching](./caching.md).

## Resizing

Drag the top edge of the pane to change its height.
