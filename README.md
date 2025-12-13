# Sigilweaver

**The visual data pipeline tool I always wished existed.**

Sigilweaver is a visual workflow designer for building and executing data processing pipelines through an intuitive drag-and-drop interface. Built as a cross-platform desktop application, it empowers users to create complex data transformations with minimal code.

**Website**: [sigilweaver.app](https://sigilweaver.app/)  
**Downloads**: [sigilweaver.app/downloads](https://sigilweaver.app/downloads)  
**Documentation**: [docs.sigilweaver.app](https://docs.sigilweaver.app/)  

## Why Sigilweaver?

As a data scientist, I write transformation code all day professionally - complex joins, filters, aggregations, multi-way merges. The code works, but it's hard to **see** what's happening. Debugging a 2000-line pipeline means mentally reconstructing the flow. Onboarding teammates means walking through nested function calls.

Sigilweaver gives you the best of both worlds:
- **Visual clarity**: See your entire pipeline at a glance - branches, joins, transformations laid out spatially
- **Full power**: Backed by [Polars](https://pola.rs) - lazy evaluation, blazing speed, production-ready performance
- **Minimal code**: Write formulas when you need flexibility, drag-and-drop for structure
- **Instant debugging**: Inspect data at any stage, trace errors visually, understand transformations intuitively

This is the tool I always wanted: the cognitive clarity of visual design with the performance and flexibility of code.

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

This is a **monorepo** containing both the frontend Electron app and the backend Python server:

```
sigilweaver-app/
├── .github/
│   ├── scripts/            # Scripts used for the CI/CD process
│   └── workflows/          # CI/CD: build, test, release automation
├── backend/                # FastAPI + Polars
│   ├── app/                # API routes, domain logic, tool registry
│   ├── tests/              # Pytest suite
│   └── docs/               # Backend API and tool documentation
└── frontend/               # Electron + React + TypeScript
    ├── src/                # React components, stores, domain logic
    ├── electron/           # Electron main process
    ├── docs/               # Frontend integration documentation
    ├── public/             # Static assets
    └── scripts/            # Development utilities
        ├── dev.py          # Start Vite dev server
        ├── build.py        # Build standalone application
        ├── test.py         # Run all tests
        └── lint_repo.py    # Lint check
```

**Key Technologies**:
- **Frontend**: React, Zustand (state), Xyflow (canvas), Vite
- **Backend**: FastAPI, Polars, Pydantic
- **Desktop**: Electron, electron-builder
- **CI/CD**: GitHub Actions, Backblaze B2 CDN

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