# Sigilweaver

**The visual data pipeline tool we always wished existed.**

Sigilweaver is a visual workflow designer and platform for building data processing pipelines through an intuitive drag-and-drop interface. Whether you're working locally on your laptop or orchestrating workflows across a fleet of servers, Sigilweaver gives you the tools to design, execute, and manage complex data transformations.

**Website**: [sigilweaver.app](https://sigilweaver.app/)  
**Downloads**: [sigilweaver.app/downloads](https://sigilweaver.app/downloads)  
**Documentation**: [docs.sigilweaver.app](https://docs.sigilweaver.app/)  

## Why Sigilweaver?

As data scientists, we write transformation code all day - complex joins, filters, aggregations, multi-way merges. The code works, but it's hard to **see** what's happening. Debugging a 2000-line pipeline means mentally reconstructing the flow. Onboarding teammates means walking through nested function calls.

Sigilweaver is the best of both worlds:
- **Visual clarity**: See your entire pipeline at a glance - branches, joins, transformations laid out spatially
- **Full power**: Backed by [Polars](https://pola.rs) - lazy evaluation, blazing speed, production-ready performance
- **Minimal code**: Write formulas when you need flexibility, drag-and-drop for structure
- **Instant debugging**: Inspect data at any stage, trace errors visually, understand transformations intuitively

This is the tool we always wanted: the cognitive clarity of visual design with the performance and flexibility of code.

## Features

- **Visual Workflow Designer**: Drag and drop tools onto an infinite canvas to build data pipelines
- **Smart Connection Validation**: Real-time cycle detection prevents invalid workflow structures
- **Polars-Powered Execution**: Lazy dataframe evaluation for speed and memory efficiency
- **Workflow Persistence**: Save and share workflows as portable `.swwf` JSON files
- **Undo/Redo System**: Full history tracking for confident workflow editing
- **Organized Tool Library**: Browse tools by category (In/Out, Preparation, Join, and more)
- **Modern Desktop Experience**: Native desktop application with traditional menu bar and keyboard shortcuts
- **Extensible Architecture**: Domain-driven design makes adding new tools and capabilities straightforward

## Installation

Download the latest release for your platform (Linux, macOS, or Windows) from the **[Downloads Page](https://sigilweaver.app/downloads)**.

## Documentation

| Audience | Link |
|----------|------|
| **Users** | [docs.sigilweaver.app/user](https://docs.sigilweaver.app/user/) |
| **Coming from other tools?** | [Crash Courses](https://docs.sigilweaver.app/user/crash-courses/) |
| **Developers / Contributors** | [docs.sigilweaver.app/developer](https://docs.sigilweaver.app/developer/) |
| **Architectural Decisions** | [Architecture Decisions](https://docs.sigilweaver.app/developer/architecture/decisions) |
| **Code of Conduct** | [Code of Conduct](https://docs.sigilweaver.app/code-of-conduct) |

## Repository Structure

This repository contains three components that can be used independently or together:

```
app/
├── server/                 # Sigilweaver Server (FastAPI + Polars)
│   ├── app/                # API routes, domain logic, tool registry
│   └── tests/              # Pytest suite
├── studio/                 # Sigilweaver Studio (Electron + React)
│   ├── src/                # React components, stores, domain logic
│   └── electron/           # Electron main process
├── hub/                    # Sigilweaver Hub (Web Platform)
│   ├── backend/            # Hub API (FastAPI + PostgreSQL)
│   ├── frontend/           # Hub UI (React + Vite)
│   └── scripts/            # Hub dev scripts
└── scripts/                # Dev scripts
```

## Components

### Server

The execution engine. Runs workflows and returns results.

- Executes Polars-based data transformations
- Exposes REST API for workflow execution
- Manages data connections and caching
- Can run standalone, with Studio, or orchestrated by Hub

### Studio

The desktop application. Design workflows visually.

- Drag-and-drop workflow canvas
- Real-time preview of transformations
- Connects to a local or remote Server
- Save/load workflows as `.swwf` files

### Hub

The orchestration platform. Manage workflows at scale.

- Store and organize workflow files
- Register and monitor multiple Servers
- Schedule automated workflow runs
- Web-based admin interface

## How They Work Together

```
┌─────────────────────────────────────────────────────────────────┐
│                      STUDIO (Desktop)                           │
│              Design workflows, preview results                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    connects to either
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                     ┌───────────────────────┐
│  SERVER (Local)   │                     │    HUB (Central)      │
│  Single instance  │                     │  Routes to Servers    │
│  for development  │                     │  Stores workflows     │
└───────────────────┘                     │  Manages schedules    │
                                          └───────────────────────┘
                                                    │
                                          orchestrates multiple
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              ▼                     ▼                     ▼
                        ┌──────────┐          ┌──────────┐          ┌──────────┐
                        │ SERVER 1 │          │ SERVER 2 │          │ SERVER N │
                        │  (Dev)   │          │ (Staging)│          │  (Prod)  │
                        └──────────┘          └──────────┘          └──────────┘
```

| Component | Description | Tech Stack |
|-----------|-------------|------------|
| **Server** | Data pipeline executor | FastAPI, Polars, Pydantic |
| **Studio** | Visual workflow designer | React, Zustand, Xyflow, Electron |
| **Hub Backend** | Workflow storage & orchestration | FastAPI, PostgreSQL, SQLAlchemy |
| **Hub Frontend** | Admin UI | React, Vite, Tailwind |

## Contributing

Contributions are welcome! Please read our [Code of Conduct](https://docs.sigilweaver.app/code-of-conduct) and check the [Developer Documentation](https://docs.sigilweaver.app/developer/) before getting started.

## Team

| Role | Maintainer |
|------|------------|
| **Lead Developer** | [Nathan Riley](https://github.com/Nathan-D-R) |
| **Community Manager** | [Madalyn Riley](https://github.com/mads040205) |

## License

Sigilweaver is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means you're free to use, modify, and distribute Sigilweaver, but if you run a modified version as a network service, you must release your source code under the same license. This protects the project from being absorbed by large corporations without contributing back.

See [LICENSE](LICENSE) for the full text.