---
sidebar_position: 1
title: Developer Guide
sidebar_label: Overview
---

# Developer Guide

For people who want to run Loom from source, understand how it fits together or contribute a change.

This guide assumes you are comfortable with Python or TypeScript and a terminal. You do not need to be an expert in React, FastAPI or Polars.

## Where to start

| Goal | Start here |
| ---- | ---------- |
| Set up a development environment | [Getting Started](./getting-started.md) |
| Understand how the pieces fit | [Architecture Overview](./architecture/overview.md) |
| Add a tool | [Adding Tools](./contributing/adding-tools.md) |
| Add a file format | [Adding Data Formats](./contributing/adding-formats.md) |
| Fix a bug or send a change | [Contributing Workflow](./contributing/workflow.md) |
| Run the tests | [Testing Philosophy](./testing/philosophy.md) |
| Build or release the app | [Packaging](./building/packaging.md) and [Releasing](./building/releasing.md) |
| Call the API | [API Endpoints](./reference/api-endpoints.md) |

## The codebase in one paragraph

Loom is a monorepo. **Studio** (`studio/`) is a React app that runs in Tauri or a browser. **Server** (`server/`) is a FastAPI service that executes workflows with Polars. **Hub** (`hub/`) is a FastAPI and React platform, backed by PostgreSQL, for teams. Studio never touches your data. It sends workflow JSON to a Server and shows what comes back.

Python uses **uv**. JavaScript uses **Bun**. Both have lockfiles that CI enforces.

## Why contribute

- **You will use it.** The best contributions come from users who hit a limit and fix it.
- **Changes stay local.** Most features touch one tool, one config panel or one endpoint.
- **It stays open.** The code is AGPL-3.0, and the [CLA](./contributing/cla.md) has legal safeguards for that.
- **Reviews are public.** Ask questions in issues and discussions so the answers help others.

## Communication

- **Bugs**: [GitHub Issues](https://github.com/Sigilweaver/Loom/issues)
- **Ideas and questions**: [GitHub Discussions](https://github.com/Sigilweaver/Loom/discussions)
- **Security problems**: see [SECURITY.md](https://github.com/Sigilweaver/Loom/blob/main/SECURITY.md). Do not open a public issue.

## Principles

- **Ship, then polish.** Working software beats perfect plans.
- **Test the bones.** Core logic gets heavy testing. UI gets lighter testing.
- **Explicit over magic.** Behavior should be predictable and traceable.
- **Every feature has a maintenance cost.** Saying no is part of the job.
- **Honest documentation.** If something is broken, say so. If a decision was a trade-off, say why. See [Known Issues](./known-issues.md) and the [Architectural Decisions](./architecture/decisions.md).
