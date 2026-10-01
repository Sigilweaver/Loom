---
sidebar_position: 1
title: Canvas
---

# Canvas

The canvas is the workspace where you place tools and wire them together.

## Workflow tabs

Each workflow opens in its own tab above the canvas. Tabs keep separate undo history, selection and viewport.

| Action      | How                                  |
| ----------- | ------------------------------------ |
| New tab     | `+` button or `Ctrl+T`               |
| Close tab   | `x` on the tab or `Ctrl+W`           |
| Next tab    | `Ctrl+Tab`                           |
| Previous tab | `Ctrl+Shift+Tab`                    |

A dot on a tab means the workflow has unsaved changes. See [Keyboard Shortcuts](./keyboard-shortcuts.md).

## Navigating

- **Pan**: scroll with the mouse wheel or drag two fingers on a trackpad.
- **Zoom**: hold `Ctrl` while scrolling, or pinch on a trackpad.
- **Controls**: the buttons in a corner of the canvas (bottom-right by default) hold zoom in, zoom out and fit view, plus toggles for the minimap and snap-to-grid and an Actions menu.
- **Minimap**: shows the whole workflow. Toggle it from the controls. Right-click the minimap button to move it to another corner.

## Adding tools

You can add a tool in three ways.

1. Drag it from the **Tools** tab in the left pane onto the canvas. See [Tool Palette](./tool-palette.md).
2. Right-click empty canvas and choose a tool from the menu. The tool appears where you clicked.
3. Drag a wire from a socket and release it on empty canvas. The menu lists tools that can accept that wire.

With **auto-connect** on (the default), a tool you drop is wired to the nearest compatible tool. A preview line shows the connection before you release. Turn it off in **Settings > Behavior**.

## Selecting

- Click a tool to select it. Its configuration opens in the left pane.
- Drag on empty canvas to draw a selection box.
- `Ctrl` or `Cmd` plus click adds or removes a tool from the selection.
- `Ctrl+A` selects all tools.
- `Escape` or a click on empty canvas clears the selection.

## Moving tools

Drag a tool to move it. Selected tools move together.

Arrow keys move the selection by one grid step (20 px). `Shift` plus an arrow key moves five steps.

Tools snap to a 20 px grid while **snap to grid** is on. Toggle it from the canvas controls or in **Settings > Appearance**.

### Auto layout

Select a tool, open the Actions menu (right-click the tool, or use the Actions button in the controls) and choose **Auto Layout**. Loom rearranges the whole workflow in layers that follow the data flow. Alignment and spacing are set in **Settings > Auto Layout**. You can undo the result.

## Copy, cut and paste

`Ctrl+C`, `Ctrl+X` and `Ctrl+V` copy, cut and paste the selected tools with the wires between them. Paste places the copy at the mouse pointer. You can paste into another tab.

## Deleting

Press `Delete` or `Backspace` to remove the selected tools. Wires attached to a deleted tool are removed too. To remove a single wire, select it and press `Delete` or `Backspace`, or right-click it and choose **Delete**.

## Context menus

| Right-click on | Menu                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| Empty canvas   | Add a tool at that point.                                                 |
| A tool         | Copy, Cut, Paste, Delete, Auto Layout.                                    |
| A wire         | Delete, and Change input or output to move the wire to another socket.    |
| A socket       | Preview Data or Profile Data. See [Data Preview](./data-preview.md).      |

## Comments

Every tool can carry a short comment that appears under it on the canvas. Loom generates a comment from the tool's configuration. You can replace it, clear it or reset it to the generated text. Edit the comment at the top of the configuration pane. Show, hide and size comments in **Settings > Comments**.

## Undo and redo

`Ctrl+Z` undoes and `Ctrl+Shift+Z` (or `Ctrl+Y`) redoes. History is kept per tab.
