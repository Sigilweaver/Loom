# Sigilweaver Loom

[![CI](https://github.com/Sigilweaver/Loom/actions/workflows/ci.yml/badge.svg)](https://github.com/Sigilweaver/Loom/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE.md)
[![Docs](https://img.shields.io/badge/docs-sigilweaver.app-blue.svg)](https://sigilweaver.app/loom/docs/)

**The visual data pipeline platform you always wished existed.**

Free and open source. No compromises.

[Website](https://sigilweaver.app) | [Downloads](https://sigilweaver.app/loom/downloads) | [Documentation](https://sigilweaver.app/docs)

---

## What is Sigilweaver Loom?

Sigilweaver Loom is more than a workflow designer - it's a complete data pipeline platform.

**Studio** lets you design workflows visually. Drag tools onto an infinite canvas, wire them together, watch your data flow.
**Server** executes those workflows with blazing speed using Polars' lazy evaluation.
**Hub** turns it all into a platform - centralizing workflow storage, managing multiple servers, scheduling automated runs, and providing team collaboration with robust security.

Whether you're a data scientist prototyping on a laptop, a hobbyist automating reports at home, or an architect designing large-scale ETL, Sigilweaver Loom meets you where you are.

Powerful no-code expression builders and an optional AI assistant lower the barrier to data transformation - without limiting what experienced users can do.

No artificial limits. No vendor lock-in. No SaaS subscription required. Just you, your data, and infrastructure you control.

## Why Sigilweaver Loom?

### Zero Trust, Zero Compromise

Your data never leaves your infrastructure. Sigilweaver Loom is designed for **self-hosting from day one**. Run it on your laptop, your homelab, or your production Kubernetes cluster. The architecture is the same - only the scale changes.

### Lazy Evaluation

Powered by [Polars](https://pola.rs), Sigilweaver Loom builds optimized query plans rather than executing transformations immediately. This means you can design pipelines on a 10 billion row dataset without loading it all into memory.

### No Row Limits

Unlike SaaS tools that impose artificial limits, Sigilweaver Loom processes what your hardware can handle. If it fits on your machine, it runs on your machine.

### Visual Clarity, Full Power

See your entire pipeline at a glance - branches, joins, transformations laid out spatially. Inspect data at any node. Debug visually. Understand intuitively.

### No-Code Where You Want It

Formula and Filter tools include visual builders: 50+ built-in operations covering math, text, dates, type conversion, null handling, and conditional logic - all configured through dropdowns with no expression syntax required. Add multiple conditions with AND/OR logic and nested groups in the Filter builder. Need something beyond the built-ins? Switch to Custom mode and write Polars directly. Both modes coexist in the same tool.

### Optional AI, On Your Terms

An AI assistant in Studio can build entire workflows from natural language, write Polars expressions, explain existing pipelines, and inspect data at any step. It's opt-in - the application is fully functional without it. When enabled, AI calls are proxied through your own Server, no data is stored or logged, and local models via Ollama or LM Studio are fully supported.

## Our Philosophy

**"Production Grade" does not mean "Complicated."**

We build Sigilweaver Loom with the security, reliability, and scalability that serious work demands. But we believe those same qualities belong to everyone:

- **Self-Hosting First**: We actively encourage individuals to run their own Hub. Your personal data pipeline infrastructure should be as robust as anyone else's.
- **No Artificial Limits**: The same codebase powers a hobbyist's Raspberry Pi and a company's server farm.
- **Community Ownership**: The AGPL license ensures Sigilweaver Loom remains open forever. No rug-pulls. No sudden paywalls.

Production grade means "it works when you need it." That's a promise we make to every user, whether you're processing CSV exports or financial transactions.

## The Platform

| Component   | What It Does                                                                              |
| ----------- | ----------------------------------------------------------------------------------------- |
| **Studio**  | Visual workflow designer with no-code builders and optional AI assistant (React + Electron/Tauri) |
| **Server**  | Execution engine that runs workflows (FastAPI + Polars)                                   |
| **Hub**     | Orchestration platform for teams and automation (Full stack)                              |

Use Studio + Server for single-user local development. Add Hub when you need centralized storage, scheduling, multi-server management, or team collaboration.

See individual component READMEs for more details: [server/](server/README.md), [studio/](studio/README.md), [hub/](hub/README.md)

## Installation

Download the latest release for your platform from the **[Downloads Page](https://sigilweaver.app/loom/downloads)**.

For development setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

| Audience                       | Link                                                                     |
| ------------------------------ | ------------------------------------------------------------------------ |
| **Getting Started**            | [sigilweaver.app/docs/user](https://sigilweaver.app/docs/user)           |
| **Developers**                 | [sigilweaver.app/docs/developer](https://sigilweaver.app/docs/developer) |
| **Architecture Decisions**     | [ADRs](https://sigilweaver.app/docs/developer/architecture/decisions)    |

## License

Sigilweaver Loom is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

- **Free forever**: Use, modify, and distribute without restriction.
- **Copyleft**: If you run a modified version as a network service, you must release your changes under AGPL.
- **Protection**: Large corporations cannot absorb this project without contributing back.

### The CLA

Sigilweaver Loom requires contributors to sign a Contributor License Agreement (CLA). This gives Sigilweaver Holdings LLC unified copyright ownership, which is necessary to defend the license and enforce copyleft.

**What this means for you:**
- The project stays AGPLv3 forever - no one can close the source
- If the holding company ever violates its open source commitments, IP automatically reverts to contributors
- You can always use, fork, and modify Sigilweaver Loom under the AGPL

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on the CLA, and [LICENSE](LICENSE.md) for the full AGPL text.

---

<p align="center">
  <strong>Built for the community. Owned by the community.</strong>
</p>
