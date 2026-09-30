---
sidebar_position: 2
title: Getting Started
---

# Getting Started

Install Studio, build a small workflow and run it. This takes about ten minutes.

## Choose a build

Downloads are on the [downloads page](https://sigilweaver.app/loom/downloads). Each release has these variants:

| Variant                | What you get                                                  | Use it when                                         |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| **Full** desktop app   | Studio plus a bundled Server. Installers for Windows, macOS and Linux (AppImage, Snap). | You work on your own machine. Start here.           |
| **Client** desktop app | Studio only. It connects to a Server or Hub that you run.     | Your team already runs a Server or Hub.             |
| **Web** build          | Static files that you host yourself.                          | You want Studio in a browser. You also need a Server. |

:::note Browser limits
In a browser, Studio cannot see full file paths. You must type or paste the complete path to each file, and the Server has to be able to read that path. Use a desktop app when you can.
:::

Install the Full app like any other desktop app and start it. The bundled Server starts automatically. If the app cannot reach its Server, open **Settings > Execution** and check the mode and the Server URL (see [Execution modes](./concepts.md#execution-modes)).

## The workspace

Studio has four areas.

1. **Header.** Open, Save, Save As, Preview All and Run.
2. **Left pane.** Tabs for **Tools**, **Workflow**, **Settings** and (when enabled) **AI**. When you select a tool on the canvas, this pane shows that tool's configuration.
3. **Canvas.** Where you build. Workflow tabs sit above it.
4. **Bottom pane.** Data Preview, Data Profile, Workflow Logs and Network Logs. It opens when you preview a socket.

See the [Interface](./interface/canvas.md) pages for details.

## Build your first workflow

You will read a CSV file, keep some rows and write them to Parquet.

### 1. Add a Read tool

1. Open the **Tools** tab in the left pane.
2. Drag **Read** from the **Connect** category onto the canvas.
3. Click the tool. Its configuration opens in the left pane.
4. Choose **CSV** as the data source.
5. Click **Browse** and pick your file, or type the full path.

Click the tool's output socket (the small circle on its right edge). The bottom pane opens and shows the first rows of your data.

### 2. Add a Filter tool

1. Drag **Filter** from **Compute** onto the canvas. If auto-connect is on (the default), Studio wires it to the nearest compatible tool.
2. If it is not wired, drag from the Read tool's output socket to the Filter tool's input socket.
3. Select the Filter tool. In **Basic** mode, pick a column, an operator and a value.
4. Click the **True** output socket (`T`) to preview the rows that match.

### 3. Add a Write tool

1. Drag **Write** from **Connect** onto the canvas.
2. Wire the Filter tool's `T` output to the Write tool's input.
3. Select the Write tool, choose **Parquet** and enter a destination path such as `/tmp/filtered.parquet`.

### 4. Run it

Click **Run** in the header, or press `F5`. Studio executes the whole workflow and the Write tool creates the file. Progress and errors appear in the **Workflow Logs** tab.

:::caution Preview and Run are different
Clicking a socket previews that one wire. **Preview All** evaluates the workflow for previews. Both skip Write tools and do not create or overwrite output files. **Run** executes Write tools and needs at least one Write tool.
:::

### 5. Save your work

Press `Ctrl+S` (`Cmd+S` on macOS). Workflows are saved as `.swwf` files, which are plain JSON. You can keep them in version control.

## Where to go next

- [Core Concepts](./concepts.md): workflows, sockets, lazy evaluation and execution modes.
- [Tools Reference](./tools/index.md): every tool and its options.
- [Managing Connections](./interface/connections.md): query PostgreSQL, MySQL, SQLite or SQL Server.
- [AI Assistant](./interface/ai-assistant.md): let a model draft a workflow for you.
- [Keyboard Shortcuts](./interface/keyboard-shortcuts.md)
