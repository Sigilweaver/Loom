# Architecture Overview (Updated Through Phase 2)

This document captures the evolving architecture as we refactor toward a layered, testable, and extensible system.

## Current High-Level Layers (Target State In Progress)

- **domain/**: Pure business logic and entities (framework-agnostic). Contains workflow graph entities & services.
- **state/**: Application state stores (Zustand) bridging domain and UI.
- **ui/**: React components + hooks for rendering and interaction.
- **theming/**: Theme definitions + token to CSS variable pipeline.
- **data/**: Static or semi-static data (tool definitions, seed content).
- **utils/**: Cross-cutting helpers (positioning, formatting, etc.).
- **electron/**: Desktop shell integration & main/preload scripts.

## Refactor Phases (Summary & Status)
1. Baseline + metrics (CI, lint, strict TS) ✅
2. Directory reshape & type moves (domain layer, services relocation) ✅
3. State consolidation (workflowStore, uiStore) ✅ (initial slice: workflow graph + UI toggles/notifications)
4. Canvas decomposition ✅ (split into CanvasShell + subcomponents: Surface, Controls, Minimap, PositionMenu, DragAndDropLayer, hooks: useSnapToGrid/useMinimapStyle/useNodeColor)
5. Domain service hardening (connection validation abstraction, cycle detection optimization) ⏳ (partially: cycle detection centralized, validation to expand)
6. Tool registry & plugin architecture scaffold (future)
7. Persistence layer unification (future XML/JSON) (future)
8. Testing strategy (now adding Vitest + first unit tests) 🚧
9. Performance optimizations & bundle splitting (future)
10. Electron boundary isolation & tree-shaking (future)
11. Developer experience (Storybook/Ladle, ADRs, token pipeline) (future)
12. Future enhancements (undo/redo, collaboration, a11y, i18n, plugin sandbox) (future)

## Decisions (ADR Stubs)
- **Entities Location**: Workflow entities moved from `src/types/workflow.ts` to `src/domain/workflow/entities/workflow.ts` (Phase 1) to promote domain isolation.
- **Service Relocation**: `EdgeManager` and loop detection moved under `domain/workflow/services` for pure logic & easier testing.
- **State Layer**: Introduced `workflowStore` (domain graph state) and `uiStore` (interaction + notifications) using Zustand to decouple React component state.
- **Cycle Handling**: Cycle feedback centralized in `App.addWire` (temporary error edge + timed removal) removing ad-hoc Canvas logic.
- **Notification Strategy**: Global notification state lifted to `uiStore`; Canvas no longer duplicates ephemeral UI state.
- **Styling Strategy**: Continue CSS variables injection; token extraction automation deferred to Phase 4.

## Pending Work (Short-Term Next)
- Add domain tests (edge reconciliation edge-cases, connection validation abstraction once added).
- Add hook/component tests (minimap position menu interactions, node color mapping by category).
- Introduce connection validation pipeline abstraction (beyond cycle + socket direction) with typed result enum & pluggable validators.
- Add vitest jsdom config + React Testing Library (component tests stage 2).
- Extend uiStore tests for minimap position menu open/close behavior.
- Architecture ADR: Canvas decomposition rationale (trade-offs, test seams created).
- Consider extracting XMLWorkflowManager behind interface for future JSON persistence.

## Canvas Decomposition Notes
The monolithic `Canvas.tsx` (≈400 lines) is now a thin re-export of `CanvasShell` which orchestrates:
- Structural Layers: `CanvasDragAndDropLayer` (drop handling) -> `CanvasSurface` (React Flow) -> controls/minimap portals.
- Hooks: Pure logic for snap-to-grid, minimap styling, node color mapping (theme aware).
- Store Boundaries: UI state (minimap, snap, menu) isolated to `uiStore`; domain graph state flows in via props from `workflowStore`.
Test Impact: Each hook/component can now be unit tested without mounting full React Flow graph; future interaction tests target smaller surfaces.

## Test Strategy (Initial)
- Unit tests: pure functions & services (`loopDetection`, `edgeManager` behavior with stub XML manager, store slices).
- Store tests: verify mutations & immutability expectations.
- Later: component tests with React Testing Library (after Canvas decomposition reduces surface area).

---
Document evolves per phase; keep diffs small & focused.

---
Document will evolve per phase; keep entries concise and actionable.
