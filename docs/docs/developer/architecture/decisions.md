---
sidebar_position: 6
---

# Architectural Decisions

This page outlines why I made different decisions throughout Sigilweaver Loom's development. Some of these are documented because I did it the "wrong" way first and discovered a better approach. Others are just refined versions of my most significant Architecture Decision Records (ADRs). I'm not claiming these are objectively correct choices - just deliberate tradeoffs made with specific goals in mind.

None of this was ever set in stone, and it still isn't. Things change, needs change, stacks change. About four months into development, I discovered FlowFile - a similar visual data pipeline tool built with Polars. Honestly, I probably wouldn't have started Sigilweaver Loom if I'd known it existed beforehand. But I'm glad I didn't. Starting fresh meant I had to carefully consider every decision: what stack to use, how I wanted things to work, what the software should support long-term. That deliberate process shaped the architecture in ways that copying wouldn't have.

Every decision here could be revisited as the project grows.

## Why Monorepo?

**Decision**: Keep all components in a single repository.

**Context**: Many projects split components into separate repos for "separation of concerns." But separate repos create real problems:
- Version compatibility becomes a coordination problem
- "Which backend version works with frontend v2.3.1?" is a real question people ask
- CI/CD has to coordinate across repos
- Contributors have to clone multiple repos and keep them in sync

**What's in the monorepo**:
- **Server**  -  Python/FastAPI data processing engine
- **Studio**  -  React/Electron visual workflow designer
- **Hub**  -  Multi-user orchestration platform (FastAPI backend + React frontend)
- **Docs**  -  Docusaurus documentation site
- **Site**  -  Marketing/landing page

These components are tightly integrated. Hub imports Server's workflow execution logic. Studio and Hub share UI patterns and the `.swwf` file format. Docs references code examples from all components. When the workflow schema changes, everything needs to update together.

**Tradeoff**: The monorepo is larger and mixes languages (Python, TypeScript, Rust eventually). Some tooling (like language servers) can get confused. Cloning is heavier.

**Result**: One repo, one clone, one version. A single commit can update the workflow schema, the server that executes it, the studio that designs it, the hub that orchestrates it, and the docs that explain it - all atomically. `git checkout v1.0.0` gives you everything you need.

---

## Why Electron?

**Decision**: Use Electron for the desktop shell, with Tauri available as a secondary option.

**Context**: Electron gets a lot of hate. It's resource-heavy, ships a whole Chromium instance, and has security quirks. Alternatives like Tauri are lighter (~5MB vs ~200MB), and native frameworks (Qt, GTK) are even leaner.

**But here's my perspective**:
- **Cross-platform is hard.** Qt requires C++, GTK is Linux-first, native Swift/WinUI means three codebases.
- **Iteration speed in Rust is slower.** I know Rust reasonably well, but the gap from "what I want" to "working code" takes longer than TypeScript. For rapid iteration, that matters.
- **Web technologies are accessible.** The React/TypeScript ecosystem has far more developers than Qt/GTK.
- **Linux and macOS are underserved.** Most data science GUI tools are Windows-only or web-only. Electron delivers real desktop apps on all platforms with minimal effort.
- **Bundle size is misleading.** Yes, Electron is ~200MB. But the bundled Python server is *larger* than the entire Electron app. Electron's memory overhead matters more than disk space, and for a data tool loading multi-gigabyte datasets, baseline memory is noise.
- **Mature ecosystem.** Electron's secure storage (`safeStorage`), auto-update, and distribution tooling are battle-tested.

**Why not Tauri (yet)?** Two specific blockers:
1. **Secure storage maturity.** Electron's `safeStorage` uses OS-level encryption (Keychain, DPAPI, Secret Service) reliably. Tauri's equivalents are improving but not at parity.
2. **Distribution formats.** Tauri's `.msi` installer triggers admin prompts even when installing to user-space (`AppData`). Electron's NSIS installer handles this correctly.

**Tauri is implemented.** Studio uses a platform abstraction layer (`src/platform/`) that isolates all Electron-specific code behind a `PlatformAdapter` interface. Tauri support exists as a secondary build target - contributors can build and test it today. When the ecosystem gaps close, Tauri will become the primary shell. The architecture is ready; we're waiting on tooling.

---

## Why Python Server?

**Decision**: Write the data processing server in Python.

**Context**: Go, Rust, and C++ would technically be faster. I know moderate Rust and some Go/Zig. But:
- **Python has excellent data tooling.** Polars, Pandas, FastAPI, Pydantic. The ecosystem is unmatched.
- **PyInstaller works.** Bundling Python into a standalone executable is solved.
- **Iteration speed matters.** Pre-v1.0, I'm changing the server constantly. The gap from idea to working code is shortest in Python. That velocity compounds.

**Tradeoff**: Slower execution than compiled languages. But Polars does the heavy lifting in Rust anyway, so Python is mostly orchestration.

**Future**: If performance becomes a bottleneck, the tool execution layer could be rewritten in Rust with Python bindings. The API contract wouldn't change.

---

## Why Polars?

**Decision**: Use Polars as the dataframe library, not Pandas.

**Context**: Pandas is the standard. Everyone knows it, most tutorials use it, I've used it for years, and Stack Overflow has a decade of Pandas answers.

**Polars was the obvious choice**:
- **Lazy evaluation philosophy.** "Why compute things if you're going to immediately throw them away?" This isn't just a feature - it's the right way to think about data pipelines. Polars makes it the default.
- **Blazing fast.** Written in Rust, uses all available cores automatically.
- **Cleaner syntax.** The API is more consistent and honestly easier to pick up than Pandas or Dask. Less "there are 5 ways to do this" confusion.
- **Memory efficient.** Lazy evaluation means we only load what we need for previews.
- **The natural evolution.** Polars is what Pandas/Dask should have become. It's the new age of dataframe libraries.

**Alternatives considered**:
- **Spark**: Too heavy. Requires JVM, cluster setup overhead. Not feasible for a desktop tool.
- **Dask**: Good for scaling Pandas, but still inherits Pandas' API quirks.
- **DuckDB**: Considered for SQL predicate pushdown. Polars may add this capability - when they do, it'll be the undisputed king of data engineering/science tooling.

**Future upside**: Polars is pushing into geospatial. Those with supply chain experience know that geospatial is one of the areas data science desperately needs better tooling. Polars following that path is a good sign.

**Tradeoff**: Smaller community, fewer tutorials, some operations need relearning. Most data scientists will need to learn Polars idioms. Worth it.

---

## Why FastAPI?

**Decision**: Use FastAPI for the REST API.

**Alternatives considered**: Flask, Django REST Framework, Starlette

**FastAPI wins because**:
- **Async by default.** Matches the async tool execution model.
- **Pydantic integration.** Request/response validation is automatic.
- **Auto-generated OpenAPI docs.** `/docs` gives you interactive API documentation for free.
- **Type hints everywhere.** Catches errors at development time, not runtime.

**Tradeoff**: Slightly more opinionated than Flask. But I feel the opinions are good ones.

**On rewriting Server in another language**: Probably never worth it. The heavy lifting is done by libraries - primarily Polars, which is already Rust. Python is orchestration glue. Rewriting orchestration in Go or Rust would be a lot of work for minimal performance gain.

---

## Why Studio/Server Split?

**Decision**: Studio (UI) and Server (data processing) are separate processes communicating over HTTP.

**Alternative**: Run Polars in the browser via WASM, or use in-process Python (like PyScript).

**Reasons for the split**:
- **Security.** Studio runs in a browser context. Server can access the filesystem, run arbitrary code (Formula tool), etc. Isolation is appropriate.
- **Performance.** Polars' Rust implementation doesn't run in WASM efficiently. Native execution is faster.
- **Debuggability.** I can test Server independently with curl. I can test Studio with mock data.
- **Hub was always the plan.** I knew from day one that I wanted a multi-user orchestration layer. There's a serious gap in sensitive data science environments - government, enterprise, military - for zero-trust architecture. Code review isn't enough; you need infrastructure that enforces isolation. The Studio/Server split made Hub possible without rearchitecting.

**Tradeoff**: Latency for API calls (negligible for local). Complexity of two processes.

---

## Why Zustand?

**Decision**: Use Zustand for frontend state management.

**Alternatives considered**: Redux, MobX, Jotai, React Context

**Zustand wins because**:
- **Minimal boilerplate.** Define a store in 10 lines, not 50.
- **No providers.** Just import and use.
- **Immer middleware.** Immutable updates with mutable syntax.
- **Devtools.** Full state inspection in browser.

**Tradeoff**: Less structure than Redux. For a small team (me), this is fine. For a large team, Redux's ceremony might be worth it.

---

## Why Xyflow?

**Decision**: Use Xyflow (React Flow) for the visual canvas.

**Context**: Xyflow is purpose-built for node-based editors. It's React-native (nodes are just components), has good defaults for panning/zooming/selection, and is actively maintained. For my stack, there wasn't really a close second choice.

**Tradeoff**: Commercial license for some features. Open source version is sufficient for Sigilweaver Loom.

---

## Why .swwf Files?

**Decision**: Workflows are saved as `.swwf` JSON files.

**Context**: I actually started building this with XML. It seemed like the "proper" format for structured documents. That was a mistake. I spent more time fighting XML parsing and schema validation than building features. Switching to JSON meant I could just use `JSON.stringify()` and `JSON.parse()`, leverage Zustand's state directly, and move on.

The switch paid off immediately: files are human-readable (debug by opening in a text editor), diffable (Git shows what changed), and require zero serialization libraries.

The `.swwf` extension is arbitrary branding. It's just JSON with a custom extension so the OS associates it with Sigilweaver Loom.

**Tradeoff**: Larger file sizes than binary, no built-in compression. For workflows (kilobytes), this is irrelevant.

---

## Why Desktop-First?

**Decision**: Build a desktop application, not a web app.

**Context**: Web apps are easier to deploy, update automatically, work on any device. Why build a desktop app?

**Reasons**:
- **File access.** Data science means local files: CSVs, Parquets, databases. Web apps struggle here.
- **Performance.** Native file dialogs, native process spawning, no browser sandboxing.
- **Privacy.** Your data stays on your machine. No cloud services required.
- **Offline.** Works without internet.

**Tradeoff**: Harder to update (need auto-update mechanism), platform-specific bugs, larger download.

---

## Summary

| Decision | Tradeoff | Why It's Worth It |
|----------|----------|-------------------|
| Monorepo | Mixed languages, heavier clone | Atomic updates across all components |
| Electron (Tauri ready) | Large bundle (but smaller than Server) | Mature tooling, Tauri when ecosystem catches up |
| Python Server | Slower than compiled | Fastest iteration, unmatched data ecosystem |
| Polars | Smaller community | Lazy eval, speed, memory efficiency |
| Studio/Server split | HTTP overhead | Security, debuggability, Hub flexibility |
| Desktop-first | Harder updates | File access, privacy, offline |

Every decision here could be revisited as the project grows. The goal is shipping something useful, not achieving architectural purity.

---

Next: [Contributing Workflow](../contributing/workflow) to learn how to propose and submit changes.
