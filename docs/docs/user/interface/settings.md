---
sidebar_position: 8
title: Settings
---

# Settings

Open the **Settings** tab in the left pane. Its sections collapse and expand. Studio saves changes as you make them.

## General

| Setting         | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| **Author Name** | The default author written into new workflows.             |

## Execution

Choose where workflows run. See [Execution modes](../concepts.md#execution-modes).

| Setting                       | Modes             | Meaning                                                           |
| ----------------------------- | ----------------- | ----------------------------------------------------------------- |
| **Execution Mode**            | All               | Bundled, External or Hub.                                         |
| **Server URL**                | Bundled, External | Where Studio finds the Server. Default `http://localhost:25811`. Restart Studio after changing it. |
| **Auto-start bundled server** | Bundled           | Start the bundled Server when the app launches. Desktop Full builds only. |
| **Preview Rows**              | Bundled, External | Rows shown in data previews. Default 100.                         |
| **Hub URL**                   | Hub               | Your Hub's address, for example `https://hub.example.com`.        |
| **Remember login**            | Hub               | Keep your Hub session between launches.                           |
| **Login to Hub** / **Logout** | Hub               | Sign in with your Hub username and password.                      |

## Connections

Shows your Hub connections (in Hub mode, when logged in) and your local connections. **Add Connection** creates a local one. See [Managing Connections](./connections.md).

## Appearance

| Setting                        | Meaning                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| **Theme**                      | 27 built-in themes: Sigilweaver (Signature, Dark, Light), High Contrast, and popular families such as GitHub, One, Nord, Gruvbox, Catppuccin, Tokyo Night, Solarized and Rose Pine. Families offer a dark and a light variant. |
| **Snap to grid**               | Snap tools to a 20 px grid.                                        |
| **Show minimap**               | Show the overview map. Choose its corner with **Minimap Position**. |
| **Show blocking indicators**   | Show the warning triangle on blocking tools.                       |
| **Edge Style**                 | Wire shape: Bezier (curved), Straight, Step (sharp corners) or Smooth Step. |

## Behavior

| Setting                   | Meaning                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| **Auto-connect on drop**  | Wire a new tool to the nearest compatible tool when you drop it. Default on. |
| **Auto-connect radius**   | How far, in canvas pixels, Studio searches for a tool to connect (100 to 600, default 300). |

## Comments

| Setting                       | Meaning                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| **Show comments on canvas**   | Show each tool's comment under it.                           |
| **Text Alignment**            | Left, center or right.                                       |
| **Max Width**, **Max Height** | Size limits for the comment label.                           |

## Auto Layout

Controls the **Auto Layout** command on the canvas.

| Setting                                | Meaning                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| **Alignment**                          | Upstream keeps chains straight, Downstream aligns tools with their outputs, Balanced centers them. |
| **Horizontal Spacing**, **Vertical Spacing** | Gaps between columns and rows, in pixels.            |
| **Grid Snap**                          | Snap laid-out tools to a grid. 0 turns it off.             |

## AI

Turns on the AI assistant and picks a model provider. See [AI Assistant](./ai-assistant.md).

## About

Version information and links.

## Where settings are stored

The desktop app keeps settings in its own storage. The web build keeps them in the browser's local storage. Hub session tokens are stored only if you turn on **Remember login**.
