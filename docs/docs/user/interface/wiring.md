---
sidebar_position: 3
title: Wiring
---

# Wiring

Wires connect tools and define how data flows through a workflow.

## Sockets

Every tool has **sockets**:

- **Input sockets** are on the left edge. They receive data from upstream tools.
- **Output sockets** are on the right edge. They send data downstream.

Tools with several sockets label them with a letter. See [Socket labels](#socket-labels).

## Creating a wire

1. Press on an output socket.
2. Drag to an input socket on another tool.
3. Release.

If you release on empty canvas instead, Studio offers a menu of tools that can accept the wire and adds the one you choose. With auto-connect on, a tool you drop from the palette is wired for you.

### Rules

- Wires run from an output to an input.
- An output can feed many inputs.
- An input accepts one wire, unless it is marked `M` (multiple). Studio refuses a second wire to a single input.
- A wire that would create a loop is drawn as a dashed, animated line in the error color. Remove it, because a workflow with a loop cannot run.
- You cannot connect two inputs or two outputs.

## Multi-input sockets

The Concatenate tool's input is marked `M`. You can connect any number of wires to it.

## Changing or removing a wire

- Select a wire and press `Delete`, or right-click it and choose **Delete**.
- Right-click a wire and choose **Change input to** or **Change output to** to move one end to another socket on the same tool. The menu lists only sockets that are free.
- To rewire an input that is already connected, remove the old wire first.

## Socket labels

Studio shows a letter on sockets that need one.

| Tool        | Socket                | Label | Carries                                  |
| ----------- | --------------------- | ----- | ---------------------------------------- |
| Read        | `output`              |       | The loaded data                          |
| Write       | `input`               |       | The data to save. No outputs.            |
| Filter      | `input`               |       | Data to filter                           |
|             | `output-true`         | `T`   | Rows where the condition is true         |
|             | `output-false`        | `F`   | Rows where it is false                   |
| Schema, Sort, Calculate, Sample, Aggregate, Pivot, Unpivot | `input`, `output` | | One in, one out |
| Unique      | `input`               |       | Data to check                            |
|             | `output-unique`       | `U`   | Rows counted as unique                   |
|             | `output-duplicate`    | `D`   | Rows counted as duplicates               |
| Concatenate | `input`               | `M`   | Any number of datasets                   |
|             | `output`              |       | The stacked result                       |
| Join        | `input-left`          | `L`   | Left dataset                             |
|             | `input-right`         | `R`   | Right dataset                            |
|             | `output-left`         | `L`   | Left rows with no match                  |
|             | `output-match`        | `J`   | Joined rows                              |
|             | `output-right`        | `R`   | Right rows with no match                 |

The socket IDs in the second column are what workflow files and the API use.

## Previewing a wire

Click any socket to preview the data at that point. See [Data Preview](./data-preview.md).
