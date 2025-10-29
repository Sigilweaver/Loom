# Sigilweaver

**The visual data pipeline tool I always wished existed.**

Sigilweaver is a visual workflow designer for building and executing data processing pipelines through an intuitive drag-and-drop interface. Built as a cross-platform desktop application, it empowers users to create complex data transformations with minimal code.

## Why Sigilweaver?

As a data scientist, I write transformation code all day professionally - complex joins, filters, aggregations, multi-way merges. The code works, but it's hard to **see** what's happening. Debugging a 2000-line pipeline means mentally reconstructing the flow. Onboarding teammates means walking through nested function calls.

Sigilweaver gives you the best of both worlds:
- **Visual clarity**: See your entire pipeline at a glance - branches, joins, transformations laid out spatially
- **Full power**: Backed by [Polars](https://pola.rs) - lazy evaluation, blazing speed, production-ready performance
- **Minimal code**: Write formulas when you need flexibility, drag-and-drop for structure
- **Instant debugging**: Inspect data at any stage, trace errors visually, understand transformations intuitively

This is the tool I always wanted: the cognitive clarity of visual design with the performance and flexibility of code.

**Website**: [sigilweaver.app](https://sigilweaver.app/)  
**Downloads**: [sigilweaver.app/downloads](https://sigilweaver.app/downloads)  
**Documentation**: [docs.sigilweaver.app](https://docs.sigilweaver.app/)

## Features

- **Visual Workflow Designer**: Drag and drop tools onto an infinite canvas to build data pipelines
- **Smart Connection Validation**: Real-time cycle detection prevents invalid workflow structures
- **Polars-Powered Execution**: Lazy dataframe evaluation for speed and memory efficiency
- **Workflow Persistence**: Save and share workflows as portable `.swwf` JSON files
- **Undo/Redo System**: Full history tracking for confident workflow editing
- **Organized Tool Library**: Browse tools by category (In/Out, Preparation, Join, and more)
- **Modern Desktop Experience**: Native desktop application with traditional menu bar and keyboard shortcuts
- **Extensible Architecture**: Domain-driven design makes adding new tools and capabilities straightforward

## Repository Structure

This is a **monorepo** containing both the frontend Electron app and the backend Python server:

```
sigilweaver-app/
├── frontend/           # Electron + React + TypeScript
│   ├── src/           # React components, stores, domain logic
│   ├── electron/      # Electron main process
│   └── public/        # Static assets
├── backend/           # FastAPI + Polars
│   ├── app/          # API routes, domain logic, tool registry
│   └── tests/        # Pytest suite
├── scripts/          # Build and development scripts
│   ├── dev.sh       # Start dev servers (backend + frontend)
│   └── build-all.sh # Build standalone application
└── .github/          # CI/CD workflows for releases
```

**Key Technologies**:
- Frontend: React, Zustand (state), Xyflow (canvas), Vite
- Backend: FastAPI, Polars, Pydantic
- Desktop: Electron, electron-builder
- CI/CD: GitHub Actions, Backblaze B2 CDN

### Architectural Decisions

**Why Monorepo?**  
Packaging the frontend and backend together ensures version compatibility with zero effort. A single release contains a known-good pairing, eliminating "which backend version works with this frontend?" debugging.

**Why Electron?**  
Yes, Electron is bulky and has quirks. But Linux and macOS are criminally underserved in GUI data science tooling. Electron delivers cross-platform compatibility with minimal effort while offering flexibility for native integrations (file dialogs, system tray, etc.). The tradeoff is worth it for reaching users on all platforms.

**Why Python Backend?**  
Python is my strongest language, has excellent data tooling, packages portably (PyInstaller), and enables rapid iteration. Go or Rust would be faster, but Python's ecosystem (FastAPI, Polars, Pydantic) gets a working product in users' hands faster.

**Why Polars?**  
Polars is the best dataframe library for an MVP: lazy evaluation, blazing performance, production-ready. Eventually I may add Dask for multi-machine clusters, but for now, no competitor offers that capability anyway. Polars hits the sweet spot of speed and simplicity.

## Installation

### For Users

Download the latest release for your platform:

- **Linux**: [AppImage](https://download.sigilweaver.app/latest/sigilweaver.appimage) | [Snap](https://download.sigilweaver.app/latest/sigilweaver.snap)
- **macOS**: [DMG](https://download.sigilweaver.app/latest/sigilweaver.dmg)
- **Windows**: [Installer](https://download.sigilweaver.app/latest/sigilweaver.exe)

Visit [sigilweaver.app/downloads](https://sigilweaver.app/downloads) for installation instructions and all available versions.
