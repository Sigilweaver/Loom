---
sidebar_position: 1
slug: /
title: Welcome to Sigilweaver Loom
---

# Welcome to Sigilweaver Loom

Sigilweaver Loom is a visual data-pipeline platform. You build a **workflow** by dragging **tools** onto a canvas and connecting them with **wires**. Loom runs the workflow with [Polars](https://pola.rs) and shows you the data at every step.

:::caution Pre-1.0 software
Loom has not had a stable 1.0 release. Workflow files, configuration and APIs can still change between releases. The [Roadmap](./roadmap.md) lists what is done, what is rough and what is planned.
:::

## The platform

Loom has three components. You can use the first two on their own.

| Component  | What it is                                                                 | Where to start                     |
| ---------- | -------------------------------------------------------------------------- | ---------------------------------- |
| **Studio** | The visual workflow designer. A desktop app (Electron or Tauri) or a web build. | [Getting Started](./user/getting-started.md) |
| **Server** | The execution engine. A FastAPI service that runs workflows with Polars.   | [Server Configuration](./admin/server-configuration.md) |
| **Hub**    | An optional orchestrator for teams: users, roles, shared connections, schedules and audit log. Open beta. | [Administrator Guide](./admin/index.md) |

Which one do you need?

- **Just you, on one machine.** Install the desktop app. The full build bundles a Server, so there is nothing else to set up.
- **You, with your own Server.** Run the Server yourself and point Studio at it (External mode).
- **A team.** Deploy Hub and one or more Servers, then have people connect Studio to Hub (Hub mode).

## What you can do today

- Read CSV, Excel, Parquet, Arrow IPC, Avro, ODS, JSON and NDJSON, YXDB and QVD files, and query PostgreSQL, MySQL, SQLite and SQL Server.
- Transform data with 13 tools: filter, reshape, join, aggregate, sort, sample and more. See the [Tools Reference](./user/tools/index.md).
- Write results to CSV, Parquet, Arrow IPC, Excel, Avro, JSON/NDJSON and YXDB.
- Preview and profile data at any wire, and export the workflow as standalone Polars code.
- Ask the optional [AI Assistant](./user/interface/ai-assistant.md) to build or explain a workflow, using your own model provider.
- Self-host everything. Your data stays on your own infrastructure.

## Find what you need

| Goal                                   | Go here                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| Install Studio and build a workflow    | [Getting Started](./user/getting-started.md)                 |
| Learn the vocabulary                   | [Core Concepts](./user/concepts.md)                          |
| Look up a tool                         | [Tools Reference](./user/tools/index.md)                           |
| Connect to a database                  | [Managing Connections](./user/interface/connections.md)      |
| Deploy Hub and Servers for a team      | [Deployment Guide](./admin/deployment.md)                    |
| Run Studio and Server from source      | [Developer Getting Started](./developer/getting-started.md)  |
| Contribute a change                    | [Contributing Workflow](./developer/contributing/workflow.md) |

## License

The software is licensed under the [AGPL-3.0](https://github.com/Sigilweaver/Loom/blob/main/LICENSE.md). There are no paid tiers and no feature gates. This documentation is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

- **Website**: [sigilweaver.app](https://sigilweaver.app)
- **Downloads**: [sigilweaver.app/loom/downloads](https://sigilweaver.app/loom/downloads)
- **Source and issues**: [github.com/Sigilweaver/Loom](https://github.com/Sigilweaver/Loom)
