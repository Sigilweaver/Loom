# Changelog

All notable changes to Sigilweaver are documented in this file.

This changelog was retroactively assembled from commit history. Starting with
v0.11.0, entries are maintained alongside each release.

## [v0.11.3] - 2026-03-08

### Fixed
- Primary download button on website not triggering download — smooth-scroll handler attached at page load called `preventDefault()` even after the hero button's `href` was updated from `#downloads-grid` to the actual download URL
- Bundled backend not launching in desktop builds — `require("fs")` call in ESM-bundled Electron main process silently failed, preventing server binary detection
- Server crash on first request in packaged builds (AppImage, NSIS) due to read-only filesystem — data paths (archive, audit, cache, connections) now use writable `userData` directory via environment variables
- Missing `cwd` in server `spawn()` call caused working directory mismatch in production
- Backend process early exit not rejecting startup promise — added settled flag pattern so crashes are reported immediately instead of waiting for health check timeout

### Changed
- Comprehensive startup logging in Electron main process (version, platform, arch, paths, backend lifecycle events)
- Build script handles host vs. target platform correctly for server binary verification and copy steps

---

## [v0.11.2] - 2026-03-08

### Changed
- Docker builds now target amd64 only; removed ARM64/QEMU cross-compilation that caused builds to hang compiling sigilyx from source
- CI workflow (`ci.yml`) upgraded to WarpBuild runners

### Fixed
- Hero download button not working on macOS (OS string mismatch: `mac` vs `macos`)
- Download links now use `download` attribute for more reliable browser behavior
- Windows download note updated to reflect signed builds

---

## [v0.11.1] - 2026-03-08

### Added
- Windows code signing via Azure Trusted Signing

### Changed
- Signing secrets scoped to `windows-signing` GitHub environment

---

## [v0.11.0] - 2026-03-07

The first non-alpha release. This cycle focused on the AI agent for Studio,
a new theme system, and infrastructure improvements.

### Added
- AI chat panel with prompt input and suggested prompts
- Tab-scoped AI sessions with multi-agent concurrency guardrails
- Streaming AI proxy with error classification
- Batch canvas operations tool for multi-tool chaining from AI
- Structured formula operations for the AI agent
- Tool comment system with canvas overlay
- Auto-connect tools to nearest compatible socket on drop
- Auto-layout utility for workflow DAGs
- `ask_user` tool and case-insensitive column resolution on the server
- Beta banner component across the site/docs

### Changed
- Switched object storage from Backblaze B2 to Cloudflare R2
- Build workflows now use Warp images
- Semantic version sorting for releases in the manifest builder and API
- Renamed tool categories with blocking indicators
- Improved button styles and color contrast for accessibility
- Strict-mode hardening across Studio and Server

### Fixed
- ESLint configuration cleanup and missing dependency

---

## [v0.10.2-alpha] - 2026-02-14

Patch release for MSI versioning.

### Fixed
- MSI compatibility for versioning in the `set-version` script
- Secret inheritance in build workflows

---

## [v0.10.0-alpha] &ndash; [v0.10.1-alpha] - 2026-02-03 to 2026-02-13

Major release introducing the multi-engine system, visual builders for
Filter and Formula, and a large documentation overhaul.

### Added
- Multi-engine system with precedence-based resolution (`tool.engine` > `meta.defaultEngine` > `DEFAULT_ENGINE`)
- Visual filter expression builder with Hub-aware metadata
- Multi-operation Formula tool with visual GUI builder
- YXDB (Alteryx) format support and devcontainer Docker host detection
- Dotenv reading and updated registration secret handling
- Tauri build target added to release pipeline
- Devcontainer with zero-friction developer experience
- Production Docker deployment with security hardening via Docker secrets
- Tauri as an alternative desktop runtime alongside Electron

### Changed
- Comprehensive audit and update of all Docusaurus documentation
- Pivot aggregations cleanup, Pydantic v2 migration, stricter types
- Hub API migrated to v1 versioned format
- Hub authorization simplified to opaque tokens
- Unified connections with file browser support
- Hub grant groups for permission bundling
- Legal housekeeping: updated license files, CLA enhancements
- Standardized dev ports to `258xx` scheme
- Server runtime data moved to `.working` directory

### Fixed
- Postgres host access in dev mode
- Empty string values in `ConfigSelect`; added error boundaries
- Capitalization of "Sigilweaver" standardized across docs and code

---

## [v0.9.0-alpha] - 2025-12-26

A massive release building out the Hub orchestration platform from scratch,
along with the documentation site, marketing website, and many Studio
quality-of-life improvements.

### Added
- **Hub platform** (initial scaffold through full RBAC):
  - Server registry with health polling
  - Session-based authentication (registration, login, admin panel)
  - Transparent Hub execution layer for Studio
  - Workflow management CRUD and execution orchestration
  - Connection health monitoring and self-service endpoints
  - Groups-based access control for connections
  - Server groups, audit events, execution records
  - Role-based view separation
  - Delayed schedule activation (`start_at`)
- **Documentation site** (Docusaurus):
  - Full tool crash courses, expressions docs, UI guide
  - Mermaid diagram support
  - Downloads page with retry and server/web sections
- **Marketing website**:
  - Interactive landing page, downloads, contributing guide
  - Terms of Use, Privacy Policy, Code of Conduct
  - Cloudflare Pages hosting with caching headers
- Touchscreen support for the canvas
- Light variants for 5 popular themes
- Safety checks to prevent resource exhaustion in Pivot/Join/Unpivot
- Custom icon for Join tool

### Changed
- Renamed `backend`/`frontend` to `server`/`studio` throughout
- `backend` directory renamed to `server`
- Contributing guidelines and CLA added

### Fixed
- Viewport state restoration when switching tabs

---

## [v0.8.0-alpha] - 2025-12-20

Introduced the comprehensive theme system and Radix UI component library.

### Added
- 20+ themes with comprehensive token system
- Radix UI primitive component library (menus, checkboxes, selects)
- `tailwindcss-animate` integration
- Platform abstraction layer for Electron/Web
- `ConfigColumnSelector` primitive with multi-select reordering
- Delete button in `ConfigColumnSelector` and `SummarizeConfiguration`
- Tool selection menus for drag-from-socket and right-click canvas

### Changed
- Migrated hardcoded colors to semantic theme tokens (two passes)
- `ConfigSelect` migrated to Radix UI
- System menu bar removed for a cleaner UI
- Tool palette consolidated into a collapsible left pane

### Fixed
- Viewport synchronization with `UIStore`
- Tab drag-and-drop reordering
- Tabs mark dirty on tool move
- Wire management: users can replace connections in-place

---

## [v0.7.0-alpha] - 2025-12-19

Data profiling, new reshape tools, and component reorganization.

### Added
- Data profile viewer with quality metrics and numeric formatting
- Column profiling endpoint (used for pivot safety checks)
- Pivot and Unpivot tools for data reshaping
- Unique tool for deduplication (two output modes)
- Sample tool for row sampling (multiple modes)
- Frequency filtering in the profile viewer

### Changed
- Components reorganized into domain-based directory structure

### Fixed
- Removed arrowheads due to janky rendering (placeholder for future custom implementation)

---

## [v0.6.0-alpha] - 2025-12-19

Caching, parallel execution, and backend code quality improvements.

### Added
- Tool-level result caching with TTL and LRU eviction
- Batch cache close endpoint for efficient shutdown
- Frontend cache eviction on workflow close
- Optional parallel execution for independent tools
- `useToolConfiguration` hook (Phase 2 of frontend contracts)
- Phase 1 socket constants and type contract tests

### Changed
- Extracted `ExecutionPlanner` and `CacheManager` from the monolithic executor

### Fixed
- Pydantic model construction (field names vs. aliases)
- Remaining backend linting errors (ruff auto-fix + manual)
- `SortTool` missing from `register.py` exports
- Console logs replaced with structured logger
- `connectionResolver` block scope for SQLite case

---

## [v0.5.0-alpha] - 2025-12-14

Focus on caching UX, data table polish, SQL connections, and build tooling.

### Added
- Blocking tool cache with clear/manage UI and `force_refresh` support
- Cache bypass toggle in the header
- DataTable enhancements: copy, formatting, sorting, selection
- SQL database connections: connection manager UI, local + server-managed
- Monaco code editor for SQL input configuration
- Support for untested SQL flavors (MySQL, MSSQL, etc.)
- `uv` for backend dependency management and faster builds
- Titanic dataset in multiple formats as test fixtures

### Changed
- Connection resolution extracted from executor to dedicated resolver

### Fixed
- Backend port updated from 8000 to 8001 (dev server + tests concurrently)
- `connectorx` added as hidden import for PyInstaller SQL builds
- `SummarizeConfiguration` cursor issue (memoized `ActionRow`)
- Decimal recognized as numeric in DataTable code editor

---

## [v0.4.0-alpha] - 2025-12-06

Major file format expansion, emission maps, and early build/release pipeline.

### Added
- Excel input/output support (`.xlsx`, legacy `.xls`)
- ODS (OpenDocument Spreadsheet) support
- Apache Avro file format support
- Apache Arrow IPC/Feather support
- JSON/NDJSON data source support
- Row virtualization in DataTable for large datasets
- Cross join support (no keys specified)
- Emission maps for Filter and Formula tools (track changes from defaults)
- Documentation help links in tool configuration UI
- Search and reset options for column configurations
- Lucide icons replacing emoji icons across components

### Changed
- B2 upload process streamlined; removed `latest/` paths

### Fixed
- `joinType` update logic to prevent unnecessary re-renders / freezes
- Multiline expression structure preserved (supports comments)
- `_emit` undefined handling in `FormulaConfiguration`
- DataTable revert for application freeze issue (deferred to future release)

---

## [v0.3.7-alpha] - 2025-12-03

Tooling, testing, and developer experience improvements.

### Added
- Join tool with socket-specific metadata API
- Sort tool with configuration and UI
- Summarize tool with dropdown field actions and aggregation counts
- Audit logging middleware for request/response tracking
- Edge style settings and connection line types
- Copy/paste preserves tool config and sockets
- Cross-platform `dev.py` and `test.py` scripts replacing shell scripts

### Changed
- Build scripts consolidated into single cross-platform `build.py`
- Test suite enhanced with linting, type checking, and tests
- Backend API refactored for socket-specific schema and preview data
- Execution and code generation unified via `expr_builder`
- Outdated docs removed (migrated to docs.sigilweaver.app)

### Fixed
- Comprehensive type annotations added for static analysis
- TypeScript and ruff lint issues resolved
- Wayland compatibility improvements
- Workflow version corrected from 2.0 to 1.0

---

## [v0.3.6-alpha] - 2025-11-30

Large release covering the Formula/Filter visual builders, multi-tab
workflows, caching, and many quality-of-life features.

### Added
- Multi-tab workflow management with drag-and-drop reordering
- Monaco Editor integration for Formula and Filter tools
- Metadata autocomplete for Formula/Filter (method chaining, multi-line)
- `preview_all` endpoint and UI toggle
- Workflow caching with automatic invalidation
- Workflow archival system with structured logging
- Keyboard shortcuts for workflow actions
- Union tool with N-input support and code generation
- Select tool implementation
- Socket tabs sidebar for quick data preview switching
- DataTable: row numbers, formatting, clipboard copy
- Configurable preview row count
- Centralized logging system with configurable levels
- Cross-session state management and credits dialog
- Animation toggle and user preference management on the website

### Changed
- Unified workflow caching with explicit invalidation
- Socket IDs changed from sequential integers to readable strings
- `Export Workflow` removed (functionally equivalent to Save As)

### Fixed
- "Preview All" stuck as "Loading..." due to state issues
- Workflow viewer toggle in Header (long-standing bug)
- Upstream subgraph extraction for single-tool previews
- `ctrl+N` opening two workflows instead of one

---

## [v0.3.5-alpha] - 2025-11-23

First published release. Marks the point where the application was
distributable as a packaged desktop app with automated builds.

### Added
- Core workflow designer with React, TypeScript, and Electron
- Input tool (CSV, Parquet) and Output tool
- Filter and Formula tools with expression support
- Standalone backend executable via PyInstaller
- Electron-managed backend lifecycle with ephemeral token auth
- Build and release workflows (GitHub Actions)
- Backblaze B2 upload pipeline with manifest generation
- `set-version` script for coordinated version bumps
- Parquet input support

### Changed
- Migrated from Dask to Polars as the execution engine

---

## Pre-release history

The following sections cover development before any versioned releases I kept.
Dates are approximate, grouped by milestone rather than by tag.

### v0.3.x development (Oct -- Nov 2025)

Configuration primitives, Zustand migration, backend integration, and
comprehensive testing.

**Added**
- Configuration primitive library: `ConfigFile`, `ConfigBoolean`, `ConfigText`, `ConfigSelect`, `ConfigNumberRange`, `ConfigNumber`, `ConfigKeyValueList`, `ConfigMultiSelect`, `ConfigColumnSelector`
- CSV data source with native file browser and full Polars `read_csv` options
- Backend server: FastAPI skeleton, health check, data source factory, tool registry
- Formula tool implementation with arithmetic, comparison, and string operations
- Output tool for saving data to files
- Python code generation from workflows with syntax highlighting
- Multi-tab workflow management
- Workflow archival system with structured logging
- XXE protection in workflow manager
- Comprehensive test suites (XMLWorkflowManager, WorkflowStore, UIStore, clipboardStore, historyStore, utility functions, hooks)

**Changed**
- Migrated from XML-based state to Zustand-first state management
- Socket IDs changed from UUID4 to 8-char base62 for readability
- Replaced XMLViewer with WorkflowViewer (JSON-based)
- Clipboard management migrated to Zustand store
- Table implementation switched to `@tanstack/react-table`

### v0.2.x development (Sep -- Oct 2025)

Desktop packaging, canvas interactions, and CI/CD foundations.

**Added**
- Copy/paste with clipboard XML for cross-instance support
- Undo/redo history management
- Arrow key movement for selected nodes
- Alignment and distribution tools for selected nodes
- Edge context menu, marquee selection
- `.swwf` file format for workflows
- CI/CD pipeline: GitHub Actions for build, test, lint, type-check
- Release validation (tags must point to `main`)
- Backblaze B2 artifact publishing
- Downloads page on the marketing website

**Changed**
- Centralized menus and extracted clipboard logic into `clipboardStore`
- Build workflows iterated through self-hosted runners, back to GitHub runners

### v0.1.x development (Aug -- Sep 2025)

The initial prototype: canvas, tools, theming, and the marketing website.

**Added**
- React Flow canvas with tool palette, wire connections, cycle detection
- Notification system and data preview panel
- Developer menu with workflow viewer
- Theming system with CSS custom properties and Tailwind integration
- Grid snapping for tool placement
- Resizable configuration panel with Summarize tool aggregation
- Marketing website (sigilweaver.app): landing page, contributing guide, favicon, SEO
- PWA manifest

**Changed**
- Workflow connections renamed from "edges" to "wires"
- Branding consolidated under "Sigilweaver"

---

[v0.11.3]: https://download.sigilweaver.app/releases/v0.11.3/manifest.json
[v0.11.2]: https://download.sigilweaver.app/releases/v0.11.2/manifest.json
[v0.11.1]: https://download.sigilweaver.app/releases/v0.11.1/manifest.json
[v0.11.0]: https://download.sigilweaver.app/releases/v0.11.0/manifest.json
[v0.10.2-alpha]: https://download.sigilweaver.app/releases/v0.10.2-alpha/manifest.json
[v0.10.0-alpha]: https://download.sigilweaver.app/releases/v0.10.0-alpha/manifest.json
[v0.10.1-alpha]: https://download.sigilweaver.app/releases/v0.10.0-alpha/manifest.json
[v0.9.0-alpha]: https://download.sigilweaver.app/releases/v0.9.0-alpha/manifest.json
[v0.8.0-alpha]: https://download.sigilweaver.app/releases/v0.8.0-alpha/manifest.json
[v0.7.0-alpha]: https://download.sigilweaver.app/releases/v0.7.0-alpha/manifest.json
[v0.6.0-alpha]: https://download.sigilweaver.app/releases/v0.6.0-alpha/manifest.json
[v0.5.0-alpha]: https://download.sigilweaver.app/releases/v0.5.0-alpha/manifest.json
[v0.4.0-alpha]: https://download.sigilweaver.app/releases/v0.4.0-alpha/manifest.json
[v0.3.7-alpha]: https://download.sigilweaver.app/releases/v0.3.7-alpha/manifest.json
[v0.3.6-alpha]: https://download.sigilweaver.app/releases/v0.3.6-alpha/manifest.json
[v0.3.5-alpha]: https://download.sigilweaver.app/releases/v0.3.5-alpha/manifest.json
