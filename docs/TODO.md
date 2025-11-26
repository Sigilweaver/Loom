# To Do List

## Before Launch

### Pre-Release (Required for v1.0)

#### Core Features

- **Tool Implementations** (Priority: High)
  - **Needs Improvement**:
    - Filter Tool: Add syntax highlighting, field insertion helper, common function palette, expression validation
    - Formula Tool: Add syntax highlighting, field insertion helper, common function palette, expression validation
  - **Not Yet Implemented**:
    - Select Tool: Column selection interface
    - Sort Tool: Multi-column sorting with direction
    - Union Tool: Combine multiple datasets
    - Join Tool: Left/right/inner/outer joins with key selection
    - Summarize Tool: Group by + aggregations
    - Pivot Tool: Reshape data from long to wide
    - Unpivot Tool: Reshape data from wide to long

- **Data Sources** (Priority: Medium)
  - Input Tool: Add support for additional file types
    - Excel (.xlsx, .xls)
    - JSON (.json, .jsonl)
    - Database connections (PostgreSQL, MySQL, SQLite)
  - Output Tool: Match input capabilities for file types

- **UI/Visual Polish** (Priority: High)
  - **Icon System**: Replace all emoji icons with proper SVG/icon library
    - Tool icons (📂, 💾, 🔍, ✅, 🔢, 🧮, 🔗, 🤝, 📊)
    - Category icons in tool palette
    - UI action icons
    - Accessibility: Better screen reader support
  - **Theme Refinement**:
    - Accessibility improvements (WCAG 2.1 AA compliance)
    - Color contrast validation for all themes
    - Visual polish and consistency across themes
    - High contrast theme improvements

#### Infrastructure

- **Legal & Documentation** (Priority: High)
  - **Privacy Policy**: Create privacy policy document
    - Data collection (what data is stored locally/never transmitted)
    - User file handling (workflows, data sources)
    - Analytics (if any - likely none for desktop app)
    - Third-party services (if any)
    - User rights (data export, deletion)
  - **Terms of Use**: Create terms of use/EULA
    - Software license terms (MIT/Apache/proprietary)
    - Acceptable use policy
    - Disclaimers and liability limitations
    - Support and warranty statements
  - **Documentation Site**: Set up initial documentation
    - Getting Started guide
    - Tool reference (each tool with examples)
    - Tutorial workflows (common use cases)
    - FAQ
    - Troubleshooting guide
    - API documentation (for future custom tools)

- **Backend URL Configuration**: Add settings panel for custom backend URL (both full and client modes)
  - Full mode: Option to override auto-started backend URL
  - Client mode: Required field for external backend connection
  - Health indicator showing backend connection status

- **Auto-Updates**: Implement electron-updater for automatic application updates
  - Requires update server configuration
  - Check for updates on launch
  - Download and install updates in background

- **Code Signing**: Obtain and configure code signing certificates
  - Windows: Authenticode certificate for .exe files (reduces SmartScreen warnings)
  - macOS: Apple Developer ID for app notarization (required for Gatekeeper)
  - Linux: No signing required, but consider AppImage signing

- **Snap Confinement Configuration**:
  - Full version (bundled backend): Use `classic` confinement for backend process spawning
  - Client version: Use `strict` confinement (sandboxed, no backend spawning needed)
  - Update snapcraft.yaml accordingly for each variant

- **API Request Caching**: Implement caching layer for schema and preview requests
  - Cache schema responses based on tool + dependency hash
  - Cache preview data when tool configuration hasn't changed
  - Invalidate cache when upstream tools or wires are modified
  - Track dependency graph to determine what needs re-fetching
  - Implementation approach:
    - Generate cache key from: tool ID, config, all upstream tool IDs/configs, wire connections
    - Store in Map or use library like react-query/swr
    - Add cache invalidation on tool config changes
    - Memory management: limit cache size, LRU eviction
  - Estimated effort: 3-4 hours
  - Benefits: Reduced server load, faster UI response, better UX during workflow editing

## After Launch

- **Stateful Backend**: Non-stateless server with workflow caching
  - Per-session workflow caching using content hashes
  - Cache expiration strategy
  - Session management
  - Benefits: Reduce redundant computation, faster preview/schema requests
  - Estimated effort: 1-2 days

### Tool Expansion

- **Additional Tools**:
  - Deduplicate: Remove duplicate rows
  - Sample: Random/stratified sampling
  - Transpose: Swap rows and columns
  - Explode: Expand list/array columns into multiple rows
  - Concatenate: Combine columns into new column
  - Split: Split column by delimiter
  - Case When: Conditional logic (SQL-style CASE WHEN)
  - Window Functions: Rank, lag, lead, rolling aggregates
  - Cross Join: Cartesian product

- **Advanced Data Sources**:
  - API/REST endpoints
  - Cloud storage (S3, Azure Blob, GCS)
  - Streaming sources (Kafka, MQTT)
  - Web scraping

### UI Enhancements

- **Tab Features** (from MULTI_TAB_IMPLEMENTATION.md):
  - Tab drag-and-drop reordering
  - Tab persistence to localStorage/Electron store
  - Max tab limit configuration
  - Tab overflow scroll/menu
  - Duplicate tab functionality
  - Tab groups/colors
  - Recently closed tabs list

- **Canvas Improvements**:
  - Minimap navigation
  - Tool search/filter in palette
  - Workflow templates/snippets
  - Export workflow as image
  - Zoom to fit/zoom to selection

- **Editor Features**:
  - Code editor for Formula/Filter with autocomplete
  - Column name autocomplete in expressions
  - Live expression validation feedback
  - Expression builder UI (visual query builder)

### Bug Fixes & Known Issues

- **Linux file dialog z-order issue**: File dialogs (Import/Export/CSV Browse) sometimes appear behind the main window on Linux. Root cause is Electron's GTK integration - `GtkFileChooserNative` casting errors suggest compatibility issues between Electron 28 and system GTK. Windows works perfectly using native dialogs.
  - Current workaround: Use `event.sender` to get parent window (eliminates race conditions)
  - Still problematic on some Linux window managers/compositors
  - Potential solutions:
    - Wait for Electron GTK fixes in future versions
    - Build custom HTML5-based file picker for Linux
    - Use different dialog library (e.g., node-file-dialog)
    - Document as known limitation for Linux users

### Documentation

- User guide/manual
- Video tutorials
- Example workflows/templates
- API documentation for custom tool development
- Contributing guide for open source contributors

### Testing

- Increase test coverage (current gaps identified in code):
  - Edge cases in HistoryManager
  - Complex workflow scenarios
  - Tool validation edge cases
  - UI component integration tests
- End-to-end testing with Playwright/Cypress
- Performance benchmarking
- Accessibility testing (screen readers, keyboard navigation)

## Ideas / Future Considerations

### Long-Term (Post v1.0, 6-12+ months)

- **Data Catalog**:
  - Remember frequently used data sources
  - Quick access to recent files/connections
  - Metadata management (descriptions, tags, last modified)
  - Search/filter saved sources
  - Data source favorites/bookmarks

- **Enterprise Features**:
  - **Security & Compliance**:
    - User-opaque database encryption keys
    - Row-level security (RLS) for shared datasets
    - Column-level permissions
    - Data masking/redaction for sensitive fields
    - Compliance logging (GDPR, HIPAA audit trails)
  - **Authentication & Authorization**:
    - SSO/SAML integration
    - LDAP/Active Directory support
    - Role-based access control (RBAC)
    - Team/organization management
  - **Governance**:
    - Workflow approval processes
    - Change management/versioning
    - Centralized policy enforcement
    - Data retention policies
  - **Monitoring & Observability**:
    - Detailed audit logging (who ran what, when)
    - Performance metrics and dashboards
    - Error tracking and alerting
    - Resource usage monitoring
  - **Deployment**:
    - On-premise deployment options
    - Air-gapped environment support
    - Custom branding/white-labeling
    - Multi-tenancy support

### Far-Future (Experimental, 12+ months)

- **Advanced Execution**:
  - **Parallel Execution**: Multi-threaded tool execution for independent branches
  - **Distributed Computing**: Spark/Dask integration for cluster processing
  - **GPU Acceleration**: CUDA/Rapids support for large dataset operations
  - **Incremental Execution**: Smart caching - only re-run changed workflow segments
  - **Streaming Mode**: Real-time data processing pipelines
  - **Scheduled Execution**: Cron-like workflow scheduling
  - **Workflow Orchestration**: Integration with Airflow/Prefect for production pipelines

- **AI/ML Integration** (Uncertain - depends on stability/debuggability):
  - **Workflow Assistant**: AI chatbot to help build/debug workflows
    - Challenges: In-dev software makes training difficult, AI suggestions hard to debug
    - Would need mature, stable codebase first
  - **AutoML Tools**: Automated model training/selection
  - **Prediction/Inference**: Deploy trained models as workflow tools
  - **Feature Engineering**: AI-suggested transformations
  - **Anomaly Detection**: Automatic data quality checks

- **Collaboration Features via External Repository Software**:
  - Note: Not built into Sigilweaver - handled by separate future project
  - Multi-user workflow editing (not simultaneous - too complex, even Alteryx doesn't have this)
  - Version control for workflows
  - Team libraries of shared tools/templates
  - Comments and annotations on workflows
  - Reason: Complexity not justified for core product; external tool is better approach

## Never / Out of Scope

**Things we will NOT implement** (and why):

- **Real-time Collaborative Editing** (Google Docs style):
  - Reason: Far too complex for data pipeline software
  - Even industry leaders like Alteryx don't support this
  - Conflict resolution in data workflows is exponentially harder than text editing
  - Better served by sequential editing with version control
  - Alternative: External repository software for team coordination

- **Built-in Version Control System**:
  - Reason: Git already exists and does this perfectly
  - Workflows can be stored as JSON files and versioned externally
  - No need to reinvent the wheel
  - Integration with Git/GitHub is preferred approach

- **Web-Based Deployment** (Browser-only version):
  - Reason: Desktop application provides better performance and file system access
  - Backend processing requirements don't suit browser constraints
  - Electron provides best of both worlds (web tech + native capabilities)
  - Cloud/SaaS could be future consideration but not web-only

- **Mobile App**:
  - Reason: Data pipeline design requires large screen real estate
  - Complex workflows not suitable for mobile interaction
  - Mobile viewing of results could be considered, but not editing
  - Not a use case that justifies development effort

- **Embedded Database Engine**:
  - Reason: Polars + file-based approach is sufficient
  - Adding database adds complexity, deployment issues, maintenance burden
  - Users can connect to external databases for persistence needs
  - Workflow execution is ephemeral by design
