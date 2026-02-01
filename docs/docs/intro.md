---
sidebar_position: 1
slug: /
---

# Welcome to Sigilweaver

**The visual data pipeline platform you always wished existed.**

Sigilweaver is both a **desktop application** for building visual data workflows and a **self-hostable platform** for collaboration and organization. Design pipelines by dragging tools onto an infinite canvas, wire them together, and watch your data flow.

:::warning Private Beta
Sigilweaver is currently in **Private Beta**. The codebase is not yet public, but binaries and documentation are published to test the distribution pipeline and gather feedback. Expect rough edges, breaking changes, and evolving APIs. See the [Roadmap](./roadmap) and [Development History](./development-history) for progress and what's coming.
:::

## The Platform

| Component  | What It Does                                    |
| ---------- | ----------------------------------------------- |
| **Studio** | Desktop app for visual workflow design          |
| **Server** | Execution engine powered by Polars              |
| **Hub**    | Orchestration platform for teams and automation |

Use **Studio + Server** for single-user local development. Add **Hub** when you need centralized storage, scheduling, or team collaboration.

## Why Sigilweaver?

- **Visual clarity**: See your entire pipeline at a glance - branches, joins, transformations laid out spatially
- **Full power**: Backed by [Polars](https://pola.rs) - lazy evaluation, blazing speed, production-ready performance
- **No row limits**: Process what your hardware can handle, not what a SaaS vendor allows
- **Self-hosting first**: Your data never leaves your infrastructure

## Find What You Need

| Goal                                 | Go here                                          |
| ------------------------------------ | ------------------------------------------------ |
| Download and start using Sigilweaver | [Downloads](https://sigilweaver.app/downloads)   |
| Learn how to build workflows         | [User Guide](/user)                              |
| Understand the architecture          | [Architecture](/developer/architecture/overview) |
| Contribute to the project            | [Contributing](/developer/contributing/workflow) |
| Coming from Alteryx or KNIME?        | [Crash Courses](/user/crash-courses)             |

## Open Source and Licensing

Sigilweaver is **AGPL-3.0 licensed**. The entire suite is **completely free for all users**. No hidden costs, no premium tiers, no feature gates.

A commercial license is available exclusively for organizations that cannot use AGPL-licensed software due to legal or corporate policy constraints. The commercial license grants the same functionality under different terms—it does not unlock additional features.

- **Website**: [sigilweaver.app](https://sigilweaver.app)
- **GitHub**: Coming with v1.0 public release
