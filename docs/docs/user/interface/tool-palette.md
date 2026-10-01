---
sidebar_position: 2
title: Tool Palette
---

# Tool Palette

The tool palette lists every tool you can add to a workflow. It lives in the **Tools** tab of the left pane.

## Categories

Tools are grouped into collapsible categories. Click a category header to collapse or expand it. The number in parentheses is how many tools it holds.

| Category      | Tools                                          | Purpose                              |
| ------------- | ---------------------------------------------- | ------------------------------------ |
| **Favorites** | Your starred tools                             | Quick access                         |
| **Connect**   | Read, Write                                    | Load and save data                   |
| **Compute**   | Filter, Schema, Sort, Calculate, Sample, Unique | Clean and transform rows and columns |
| **Reshape**   | Aggregate, Pivot, Unpivot                      | Summarize and change table shape     |
| **Combine**   | Concatenate, Join                              | Merge datasets                       |

The palette uses the tool's short name. Each tool's type name (for example `Input` for Read) is on its [reference page](../tools/index.md).

## Favorites

Hover over a tool and click the star to add or remove it from **Favorites**. New installs start with Read, Write, Filter, Schema, Sort, Calculate, Concatenate, Join and Aggregate starred.

## Adding a tool

Drag a tool from the palette and drop it on the canvas. On a touch screen, press, drag past a few pixels and release over the canvas.

The tool arrives with default settings. Select it to configure it. See [Configuration Panel](./configuration-panel.md).

## Blocking indicators

A small warning triangle on a tool means it is a **blocking** operation: it has to read all of its input before it can produce output. The Server caches these results. See [Performance and Caching](./caching.md). You can hide the triangles in **Settings > Appearance**.

## Tool colors

Each category has its own border color. The exact colors depend on your theme.
