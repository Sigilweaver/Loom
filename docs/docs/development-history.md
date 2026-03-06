# Development History

This document provides a summarized chronological history of the Sigilweaver project from its inception through January 2026, organized newest-first.

---

## Summary Statistics

| Period         | Commits |
| -------------- | ------- |
| January 2026   | 30      |
| December 2025  | 240     |
| November 2025  | 96      |
| October 2025   | 87      |
| September 2025 | 36      |
| August 2025    | 111     |
| **Total**      | **600** |

## Key Milestones

1. **January 2026** - Monorepo consolidation and production deployment support
2. **December 2025** - Hub platform launch and comprehensive file format support
3. **November 2025** - Monaco editor integration and multi-tab support
4. **October 2025** - Backend creation and monorepo formation
5. **August 2025** - Project inception with core canvas and workflow management

---

## 2026

### January 2026

#### Week 5 (Jan 29-31)
**Production Hardening**

- **Docker Secrets** - Production security hardening with Docker secrets management
- **PostgreSQL Dev Access** - Enabled postgres host access in dev mode
- **Documentation Standardization** - Consistent port references and configuration docs

#### Week 4 (Jan 20-29)
**Docker & Desktop Runtimes**

- **Docker Production** - Production deployment support for Hub and Server
- **Tauri Support** - Added Tauri as alternative desktop runtime to Electron
- **Auth Simplification** - Hub authorization simplified to opaque tokens

#### Week 1 (Jan 1-4)
**Monorepo Consolidation & Legal**

- **Unified Connections** - Connections merged with file browser support across Hub/Server/Studio
- **API Versioning** - Hub API migrated to v1 versioned format
- **Grant Groups** - Permission bundling for simplified access control
- **Contributor License Agreement** - Added CLA with human-readable summary
- **ConfigSelect Fix** - Handle empty string values with error boundaries
- **Docs Repo Merge** - Documentation merged into main monorepo for reduced friction
- **Site Repo Merge** - Marketing site merged for unified CI/CD
- **Legal Housekeeping** - Updated ownership to Sigilweaver Holdings LLC / Sigilweaver LLC structure
- **Port Standardization** - Adopted 258xx scheme (Studio: 25810, Server: 25811, Hub: 25802/25803)

---

## 2025

### December 2025

#### Week 5 (Dec 29-31)
**Hub Expansion**

- **Server Groups** - Logical server grouping with audit events and execution records
- **Role Separation** - Prevent admin-level users from joining groups
- **Role-Based Views** - UI separation based on user roles
- **Health Monitoring** - Connection health checks and self-service endpoints
- **Schedule Fixes** - Preserve unset fields in schedule updates, block auditor deletes

#### Week 4 (Dec 27-28)
**Hub Platform Launch**

- **Hub Scaffold** - Initial orchestration platform with FastAPI backend and React frontend
- **Server Registry** - Server health polling and registration
- **Directory Rename** - `backend/` → `server/`, `frontend/` → `studio/`
- **Authentication System** - Session-based auth with user registration, login, and admin panel
- **Connection Access Control** - Groups-based permissions for connections
- **Hub Execution Layer** - Transparent execution through Hub for Studio
- **Workflow Management** - CRUD operations for Hub-managed workflows
- **Execution Scheduling** - Cron-based workflow execution with start_at field
- **Touchscreen Support** - Comprehensive touch/gesture support
- **Viewport Tab Isolation** - Restore viewport state correctly when switching tabs

#### Week 4 (Dec 22-26)
**Platform & UI Modernization**

- **Radix UI Migration** - Adopted Radix primitives for menus, checkboxes, and selects
- **Platform Abstraction** - Electron/Web abstraction layer
- **Theme System Overhaul** - 20+ themes with light variants for 5 popular themes
- **Safety Checks** - Resource exhaustion prevention in Pivot/Join/Unpivot
- **Tool Palette Consolidation** - Collapsible categories in left pane
- **UX Improvements** - Drag-from-socket menus, right-click canvas menus, tab drag-and-drop reordering
- **Custom Icons** - Custom Sigilweaver icon for Join tool, FileDown for Output
- **ConfigColumnSelector** - Multi-select column reordering primitive

#### Week 3 (Dec 18-21)
**Caching & Performance**

- **Tool Cache** - Blocking cache with TTL and LRU eviction for expensive operations
- **Cache Management** - Force-refresh support, clear cache option, batch close endpoint
- **Parallel Execution** - Optional parallel execution for independent tools
- **ExecutionPlanner/CacheManager** - Extracted from monolithic executor
- **Sample Tool** - Row sampling with multiple modes
- **Unique Tool** - Deduplication with two output modes
- **Pivot/Unpivot Tools** - Data reshaping (pivot wide/long)
- **Column Profiling** - Quality metrics endpoint and ProfileViewer UI
- **Component Reorganization** - Domain-based directory structure for frontend

#### Week 2 (Dec 9-14)
**Architecture & Connections**

- **Connection Manager** - Database connections management UI with local and server-managed connections
- **Connection Resolver** - Extracted from executor to dedicated module
- **uv Package Manager** - Adopted for faster, reproducible Python builds
- **SQL Configuration** - Monaco editor for SQL query input
- **Port Standardization** - Backend port updated to 8001 for concurrent dev/test
- **Canvas Hooks Refactor** - Extracted inline logic into dedicated hooks with tests

#### Week 1 (Dec 1-7)
**Workflow & I/O Improvements**

- **Ephemeral Token Auth** - Desktop mode authentication for backend
- **DataTable Virtualization** - Row virtualization for large datasets
- **Cross Join** - Support for joins without keys specified
- **Excel Support** - Input and output for .xlsx and legacy .xls files
- **JSON/NDJSON** - JSON data source support
- **Apache Arrow IPC** - Feather file format support
- **Apache Avro** - Avro file format support
- **ODS Format** - OpenDocument Spreadsheet support
- **Documentation Help Links** - Tool configuration UIs link to relevant docs
- **Lucide Icons** - Replaced emoji icons with consistent icon library
- **Wayland Compatibility** - Improved DevTools handling and file dialogs

---

### November 2025

#### Week 5 (Nov 27-30)
**Core Tools & UI**

- **Summarize Tool** - Aggregation operations with grouped statistics and field action dropdowns
- **Sort Tool** - Multi-column sorting with configuration UI
- **Join Tool** - Multi-table joins with socket-specific metadata API and type compatibility
- **Audit Logging** - Middleware for request/response tracking
- **Monaco Autocomplete** - Method chaining, multi-line support, function snippets
- **Edge Styles** - Configurable connection line types

#### Week 4 (Nov 24-26)
**Editor & Tabs**

- **Monaco Editor** - Integrated for Formula and Filter expression editing with autocomplete
- **Workflow Archival** - Structured logging and API integration for workflow archives
- **Wrangler Config** - Cloudflare Pages deployment configuration
- **Metadata Autocomplete** - Column name suggestions in Formula/Filter tools

#### Week 4 (Nov 22-24)
**Multi-Tab & Data Preview**

- **Multi-Tab Support** - Workflow tabs with dirty state tracking
- **Cross-Session Persistence** - State management and credits dialog
- **Data Preview** - Socket tabs sidebar for quick preview switching
- **DataTable Enhancements** - Row numbers, formatting, clipboard copy
- **Select Tool** - Column selection/reordering tool
- **Union Tool** - Combine multiple datasets with Python code generation
- **Downloads Page** - Verification features and platform-specific instructions

#### Week 1 (Nov 1-2)
**Scripts & Quality**

- **Dev Scripts** - Cross-platform `dev.py`, `test.py`, and `build.py` scripts
- **Type Annotations** - Comprehensive static analysis support for backend
- **Backend API Refactor** - Socket-specific schema and preview data support
- **Ruff Linting** - Automated lint fixes and manual error resolution

---

### October 2025

#### Week 5 (Oct 29)
**Monorepo Formation**

- **Monorepo Merge** - Combined frontend and backend into single repository
- **CI/CD Migration** - Reused workflows from previous monorepo attempt
- **Build Scripts** - Comprehensive build and test scripts with platform support
- **Parquet Input** - Added Parquet file format support
- **lsb-release** - Linux CI build dependency added

#### Week 4 (Oct 25-28)
**Backend Development**

- **PyInstaller Support** - Standalone executable builds
- **Electron-Backend Integration** - Electron manages backend process lifecycle
- **Python Code Generation** - Workflow-to-Python code preview generation
- **Output Tool** - CSV file output with configuration component
- **Formula Configuration** - UI for configuring formula expressions
- **Bottom Pane** - Data preview and logs panel

#### Week 4 (Oct 23-25)
**Backend Foundation**

- **Backend Created** - FastAPI backend with configuration, API routes, and health check endpoints
- **Data Models** - Pydantic models for workflows, data sources, and execution metrics
- **Tool Registration** - Registry system with factory pattern for data sources
- **Formula Tool** - Arithmetic, comparison, and string operations with tests
- **Filter Tool** - Expression-based row filtering with configuration UI
- **Backend Integration Tests** - Comprehensive API client testing
- **CSV Configuration** - Polars CSV data source configuration

#### Weeks 3 (Oct 18-22)
**State Management Migration**

- **Zustand-First Architecture** - Migrated from XML-based to Zustand-first state management
- **Clipboard Store** - Centralized clipboard handling with dedicated store
- **History Store** - Replaced saveSnapshot with pushState pattern
- **Terminology Update** - Replaced "XML" references with "JSON" internally
- **WorkflowViewer** - Renamed from XMLViewer
- **File Extension** - Updated menu labels and dialogs to reference SWWF format
- **useEmission Hook** - Added with comprehensive tests

#### Week 1 (Oct 1)
**AI Assistance**

- **Copilot Instructions** - Added context files for AI-assisted development

---

### September 2025

#### Week 4 (Sep 27-28)
**Enhanced Primitives**

- **ConfigSelect** - Enhanced with search and selection features
- **ConfigNumberRange** - Numeric input with min/max validation
- **CI/CD Enhancements** - Restructured workflow with artifact management and parallelization
- **README Updates** - Configuration primitives guidance

#### Weeks 1-2 (Sep 1-15)
**Configuration Primitives**

- **ConfigFile** - File picker primitive with native browser integration
- **ConfigBoolean** - Toggle primitive with automatic default filtering
- **ConfigField/ConfigText** - Text input primitives with validation
- **useXMLEmission Hook** - Standardized emission pattern for configuration components
- **CSV Data Source** - Native file browser integration with delimiter detection
- **CI Quality Gate** - Linting, type-checking, and test requirements
- **Type Safety** - Replaced `any` with `unknown` throughout codebase

---

### August 2025

#### Week 4 (Aug 28-31)
**Testing & Stability**

- **Test Infrastructure** - Comprehensive test suites for XMLWorkflowManager and Zustand stores
- **Security** - XXE (XML External Entity) protection added to XMLWorkflowManager
- **Coverage Reporting** - Added `@vitest/coverage-v8` for test coverage metrics
- **Wire Management Tests** - Extensive tests for tool and wire lifecycle operations
- **Arrow Key Movement** - Keyboard navigation for selected nodes

#### Week 3 (Aug 19-23)
**Release Pipeline**

- **Nightly Builds** - Tag handling and asset upload process refinements
- **Artifact Management** - Stable version tag restrictions
- **Vitest Configuration** - Coverage settings and dependency updates
- **CI Workflow** - Build, test, and artifact management

#### Week 2 (Aug 15-18)
**Build Infrastructure & Core**

- **Initial Commit** (Aug 15) - Workflow designer application initialized with React, TypeScript, and Electron
- **Core Canvas System** - React Flow integration with tool socket definitions supporting multiple connections
- **XML Workflow Format** - XMLWorkflowManager for workflow persistence
- **Theme System** - Comprehensive theming with CSS custom properties and Tailwind CSS integration
- **Wire Connections** - Cycle detection and notification system
- **Configuration Panel** - Resizable tool configuration panel
- **Tool Palette** - Categorized tool palette with icons
- **Grid Snapping** - Tool positioning snaps to grid on drop
- **Cross-Platform Builds** - GitHub Actions workflows for Windows, macOS, and Linux packaging
- **Clipboard Operations** - Copy/cut/paste with keyboard shortcuts
- **File Format** - Adopted `.swwf` extension for workflow files
- **History Management** - Undo/redo functionality
- **Branding** - Application named Sigilweaver with custom logo
- **Cloudflare R2** - Asset publishing

#### Week 1 (Aug 1-9)
**Project Genesis**

- **Workflow Designer Core** - Initial React Flow canvas with tool connections
- **XMLWorkflowManager** - Hybrid JSON/XML management, later refactored to pure XML
- **Notification System** - Preview functionality and cycle detection warnings
- **Tool Definitions** - Initial tool socket definitions with multi-connection support
- **Website Foundation** - Landing page with interactive features
- **SEO & Accessibility** - Performance enhancements and mobile menu
- **Contributing Guide** - Contribution documentation with getting started sections
- **Edge Management** - Connection validation and phantom connection bug fixes
