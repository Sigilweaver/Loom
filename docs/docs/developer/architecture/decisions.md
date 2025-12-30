---
sidebar_position: 4
---

# Architectural Decisions

This page documents the major architectural decisions behind Sigilweaver: the "why" behind the "what." I'm not claiming these are the objectively correct choices, just that they're deliberate tradeoffs made with specific goals in mind.

## Why Monorepo?

**Decision**: Keep frontend and backend in a single repository.

**Context**: Many projects split frontend and backend into separate repos for "separation of concerns." But separate repos create real problems:
- Version compatibility becomes a coordination problem
- "Which backend version works with frontend v2.3.1?" is a real question people ask
- CI/CD has to coordinate across repos
- Contributors have to clone multiple repos and keep them in sync

**Tradeoff**: The monorepo is larger and mixes languages. Some tooling (like language servers) can get confused. But packaging a desktop app requires both halves anyway. A single repo means a single commit = a single release = a known-good pairing.

**Result**: One repo, one clone, one version. `git checkout v1.0.0` gives you everything you need.

---

## Why Electron?

**Decision**: Use Electron for the desktop shell.

**Context**: Electron gets a lot of hate. It's resource-heavy, ships a whole Chromium instance, and has security quirks. Alternatives like Tauri are lighter, and native frameworks (Qt, GTK) are even leaner.

**But here's my perspective**:
- **Cross-platform is hard.** Qt requires C++, GTK is Linux-first, native Swift/WinUI means three codebases.
- **Tauri requires Rust.** I'd rather ship a working product in a language I know than a perfect architecture I can't build.
- **Web technologies are accessible.** The React/TypeScript ecosystem has far more developers than Qt/GTK.
- **Linux and macOS are underserved.** Most data science GUI tools are Windows-only or web-only. Electron delivers real desktop apps on all platforms with minimal effort.

**Tradeoff**: Larger app size (~200MB), higher baseline memory usage. For a data science tool that will load multi-gigabyte datasets anyway, this is acceptable.

---

## Why Python Backend?

**Decision**: Write the data processing backend in Python.

**Context**: Go, Rust, and C++ would technically be faster. But:
- **Python is my strongest language.** Shipping beats optimizing.
- **Python has excellent data tooling.** Polars, Pandas, FastAPI, Pydantic. The ecosystem is unmatched.
- **PyInstaller works.** Bundling Python into a standalone executable is solved.
- **Iteration speed matters.** Pre-v1.0, I'm changing the backend constantly. Python's dynamic typing helps here (and hurts later, yes).

**Tradeoff**: Slower execution than compiled languages. But Polars does the heavy lifting in Rust anyway, so Python is mostly orchestration.

**Future**: If performance becomes a bottleneck, the tool execution layer could be rewritten in Rust with Python bindings. The API contract wouldn't change.

---

## Why Polars?

**Decision**: Use Polars as the dataframe library, not Pandas.

**Context**: Pandas is the standard. Everyone knows it, most tutorials use it, I've used it for years, and Stack Overflow has a decade of Pandas answers.

**But Polars has key advantages**:
- **Lazy evaluation by default.** You can build complex transformations without loading data until needed.
- **Blazing fast.** Written in Rust, uses all available cores automatically.
- **Consistent API.** Less "there are 5 ways to do this" confusion.
- **Memory efficient.** Lazy evaluation means we only load what we need for previews.

**Tradeoff**: Smaller community, fewer tutorials, some operations need relearning. Most data scientists will need to learn Polars idioms.

**Future**: The tool abstraction layer (`BaseTool`) could support multiple backends. A tool could target Pandas, Dask, or Spark while exposing the same interface. But for MVP, Polars-only is fine.

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

---

## Why Frontend-Backend Split?

**Decision**: The UI and data processing are separate processes communicating over HTTP.

**Alternative**: Run Polars in the browser via WASM, or use in-process Python (like PyScript).

**Reasons for the split**:
- **Security.** The frontend runs in a browser context. Data processing can access the filesystem, run arbitrary code (Formula tool), etc. Isolation is appropriate.
- **Performance.** Polars' Rust implementation doesn't run in WASM efficiently. Native execution is faster.
- **Debuggability.** I can test the backend independently with curl. I can test the frontend with mock data.
- **Flexibility.** The backend can run on a server for shared team workflows. The split makes this possible.

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

**Context**: Xyflow is purpose-built for node-based editors. It's React-native (nodes are just components), has good defaults for panning/zooming/selection, and is actively maintained. There wasn't really a close second choice here. Xyflow is the obvious tool for this job.

**Tradeoff**: Commercial license for some features. Open source version is sufficient for Sigilweaver.

---

## Why .swwf Files?

**Decision**: Workflows are saved as `.swwf` JSON files.

**Context**: I actually started building this with XML. It seemed like the "proper" format for structured documents. That was a mistake. I spent more time fighting XML parsing and schema validation than building features. Switching to JSON meant I could just use `JSON.stringify()` and `JSON.parse()`, leverage Zustand's state directly, and move on.

The switch paid off immediately: files are human-readable (debug by opening in a text editor), diffable (Git shows what changed), and require zero serialization libraries.

The `.swwf` extension is arbitrary branding. It's just JSON with a custom extension so the OS associates it with Sigilweaver.

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
| Monorepo | Mixed languages | Version compatibility guaranteed |
| Electron | Large bundle | True cross-platform desktop |
| Python backend | Slower than -XYZ- | Fast iteration, rich ecosystem |
| Polars | Smaller community | Lazy eval, speed, memory efficiency |
| Frontend/Backend split | HTTP overhead | Security, debuggability, flexibility |
| Desktop-first | Harder updates | File access, privacy, offline |

Every decision here could be revisited as the project grows. The goal is shipping something useful, not achieving architectural purity.

---

Next: [Contributing Workflow](../contributing/workflow) to learn how to propose and submit changes.
