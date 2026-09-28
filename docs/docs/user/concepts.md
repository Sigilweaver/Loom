---
sidebar_position: 3
title: Core Concepts
---

# Core Concepts

The vocabulary used throughout these docs. Each concept has one name, and this page defines it.

## The three components

| Term       | Meaning                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| **Studio** | The app where you design workflows. It never reads your data itself.                 |
| **Server** | The service that executes workflows and returns previews. It does all data processing. |
| **Hub**    | The optional team platform that manages users, shared connections, schedules and audit logs. |

## Workflows, tools, wires and sockets

A **workflow** is a graph of **tools** joined by **wires**. Data moves along the wires from left to right. The graph cannot contain loops.

- A **tool** does one job: read a file, filter rows, join two datasets, and so on.
- A **socket** is a connection point on a tool. Inputs are on the left and outputs are on the right.
- A **wire** joins one output socket to one input socket.

Some tools have several sockets, and Studio labels them:

| Label   | Meaning                                          | Tool      |
| ------- | ------------------------------------------------ | --------- |
| `T`, `F` | Rows where the condition is true or false       | Filter    |
| `U`, `D` | Unique rows and duplicate rows                  | Unique    |
| `L`, `R` | Left and right inputs                           | Join      |
| `L`, `J`, `R` | Unmatched left rows, joined rows, unmatched right rows | Join |
| `M`     | Accepts many wires on one input                  | Concatenate |

An output can feed many inputs. An input takes one wire unless it is marked `M`.

Workflows are saved as `.swwf` files. A `.swwf` file is JSON, so you can diff it and keep it in Git.

## Tool names

Studio's palette uses short names. Workflow files, exported code, the API and the AI assistant use the tool's **type name**. This documentation uses the palette name and gives the type name on each tool page.

| Palette name | Type name   | Palette category |
| ------------ | ----------- | ---------------- |
| Read         | `Input`     | Connect          |
| Write        | `Output`    | Connect          |
| Filter       | `Filter`    | Compute          |
| Schema       | `Select`    | Compute          |
| Sort         | `Sort`      | Compute          |
| Calculate    | `Formula`   | Compute          |
| Sample       | `Sample`    | Compute          |
| Unique       | `Unique`    | Compute          |
| Concatenate  | `Union`     | Combine          |
| Join         | `Join`      | Combine          |
| Aggregate    | `Summarize` | Reshape          |
| Pivot        | `Pivot`     | Reshape          |
| Unpivot      | `Unpivot`   | Reshape          |

## Lazy evaluation and blocking tools

Loom builds on Polars' lazy engine. Adding tools to a workflow does not run anything. The Server assembles a query plan and Polars optimizes it, so it can skip columns you do not use and stream data instead of loading it all.

Some operations cannot stream, because they must see every row before they can output one. Studio marks these with a warning triangle on the tool. Examples are Sort, Join, Aggregate and Pivot. The Server caches their results so that editing a tool downstream of them stays fast. See [Performance and Caching](./interface/caching.md).

You can turn the triangles off in **Settings > Appearance**.

## Preview, profile and run

| Action          | How                                        | What it does                                                         |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| **Preview**     | Click a socket                             | Runs the tools upstream of that socket and shows the first rows.     |
| **Profile**     | Right-click a socket, then Profile Data    | Computes column statistics and data-quality checks over the full data. |
| **Preview All** | Header button or `Ctrl+P`                  | Runs the whole workflow and caches a preview for every tool.         |
| **Run**         | Header button or `F5`                      | Runs the whole workflow, including Write tools.                      |

## Expressions

Filter and Calculate can take Polars expressions such as `pl.col("price") * 1.1`. Both tools have a visual **Basic** mode that covers most needs, and a **Custom** mode for expressions. See [Expressions](./expressions/basics.md).

## Connections

A **connection** stores how to reach a database. There are three kinds:

| Kind       | Stored in                                   | Managed by     | Credentials visible to you |
| ---------- | ------------------------------------------- | -------------- | -------------------------- |
| **Client** | Your machine, in the operating system's credential store | You    | Yes, you entered them      |
| **Hub**    | Hub, encrypted                              | An administrator | No                       |
| **Server** | The Server's own encrypted store            | A Server administrator | No                 |

Studio's Connection Manager creates client connections. Hub connections appear when you are logged in to Hub. Workflows store only a connection ID, never credentials. See [Managing Connections](./interface/connections.md).

## Execution modes

The execution mode decides which Server runs your workflow. Change it in **Settings > Execution**.

| Mode         | Where the work happens                                | Typical use              |
| ------------ | ----------------------------------------------------- | ------------------------ |
| **Bundled**  | A Server that ships inside the Full desktop app.      | One person, one machine. Default. |
| **External** | A Server you run and address by URL.                  | Your own or a shared Server. |
| **Hub**      | A Server that Hub selects, after you log in to Hub.   | Teams. See [Using Hub](./interface/hub.md). |

## Where to go next

- [Interface](./interface/canvas.md)
- [Tools Reference](./tools/index.md)
- [Data Types](./data-types.md)
