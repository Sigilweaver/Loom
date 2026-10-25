---
sidebar_position: 3
title: Studio Architecture
---

# Studio Architecture

Studio is a React application. It runs inside a Tauri shell, or in a browser. It handles everything the user sees: the canvas, tool configuration, state and undo history. All data processing is delegated to a Server.

## Technology stack

| Layer | Technology | Why |
| ----- | ---------- | --- |
| UI | React 18 | Component model and ecosystem |
| State | Zustand (with Immer) | Small, fast, little boilerplate |
| Canvas | Xyflow (React Flow 12) | Built for node editors |
| Bundler | Vite | Fast dev server |
| Desktop | Tauri | Native dialogs and credential storage |
| Styling | Tailwind CSS with a theme token layer | Consistent design tokens, 27 themes |
| Editor | Monaco | Expression and SQL editing |
| AI | Vercel AI SDK with provider packages | OpenAI, Anthropic, Google, Mistral and OpenAI-compatible |
| Tests | Vitest | Vite-native |

## Directory structure

```
studio/src/
|-- components/
|   |-- canvas/         Canvas shell, controls, menus and their hooks
|   |-- workflow/       WorkflowNode, code viewer, comment editor
|   |-- config/         One config component per tool, by palette group
|   |   |-- inout/      Read and Write: one component per format
|   |   |-- prepare/    Filter, Schema, Sort, Calculate, Sample, Unique
|   |   |-- join/       Join, Concatenate
|   |   `-- aggregate/  Aggregate, Pivot, Unpivot
|   |-- shell/          Header, tabs, tool palette, settings pane, bottom pane
|   |-- viewer/         Data table, profile viewer, logs
|   |-- ai/             Chat panel and inline assists
|   |-- primitives/     Reusable config form controls
|   |-- ui/             Shared UI components
|   |-- common/         Code editor, remote file browser, markdown
|   `-- LeftPane.tsx    Palette, workflow, settings and AI tabs, or tool config
|-- state/              Zustand stores
|-- domain/
|   |-- workflow/       entities, serializer, auto layout, loop detection
|   `-- dataSources/    Per-format option types and defaults
|-- api/                Server and Hub clients
|-- platform/           Tauri and web adapters
|-- ai/                 Agent loop, tools, prompts, provider setup
|-- data/               Tool definitions and config schemas
|-- hooks/              Shared hooks
|-- themes/             Theme definitions
|-- types/              Shared TypeScript types
`-- utils/
```

## State management

Zustand stores are the source of truth. Each has one job.

| Store | Holds |
| ----- | ----- |
| `workflowStore` | Tools, wires, edges, the selected tool and workflow metadata |
| `historyStore` | Undo and redo snapshots |
| `tabStore` | Open workflow tabs and their saved state |
| `uiStore` | Left pane tab, bottom pane, favorites, collapsed categories, preview state |
| `settingsStore` | Persisted settings, saved through the platform adapter |
| `connectionStore` | Database connections, merged from client and Hub sources |
| `executionStore` | Run state and logs per tab |
| `clipboardStore` | Copy and paste of tools |
| `runtimeLogStore` | Network log entries |
| `aiStore` | AI settings, chat messages and the agent's run state |
| `autoConnectPreviewStore` | The preview line shown while dragging a tool near a match |

`workflowStore` is the core. Tools and wires are the domain model. Xyflow's edges are derived from wires and kept in sync automatically.

Every meaningful edit pushes a snapshot to `historyStore`. Each tab has its own history. Switching tabs saves the current workflow into the tab and loads the target tab's.

### Persistence

| What | Where |
| ---- | ----- |
| Settings (`settingsStore`) | The platform adapter: Tauri settings file, or browser `localStorage` |
| Favorite tools, collapsed categories, snap to grid | `localStorage` |
| AI settings and recent chat history | `localStorage` |
| Client connection credentials | The operating system's credential store, through the platform adapter |

## Platform adapter

`platform/` exposes one interface (`PlatformAdapter`) with file, settings, credential, authentication and menu operations, plus a `capabilities` object such as `nativeDialogs`. There are two implementations: `tauri.ts` and `web.ts`. The web adapter has limited capabilities. It cannot read a path or store a client credential.

Components import `platform` from `@platform` and check `platform.capabilities`. They never call the Tauri API directly, so all native access stays in one place.

## Tool definitions

`data/tools.ts` lists every tool:

```typescript
{
  type: 'Filter',            // must match the Server's @register_tool name
  name: 'Filter',            // palette name
  icon: Filter,              // lucide-react icon
  category: 'compute',       // 'connect' | 'compute' | 'reshape' | 'combine'
  defaultConfig: { expression: '', mode: 'Basic', conditions: [], combinator: 'and' },
  sockets: [
    { id: 'input', direction: 'input' },
    { id: 'output-true', direction: 'output', type: 'T' },
    { id: 'output-false', direction: 'output', type: 'F' },
  ],
  docsUrl: 'https://sigilweaver.app/loom/docs/user/tools/preparation/filter',
}
```

Some palette names differ from type names (`Input` is shown as Read, `Select` as Schema, `Formula` as Calculate, `Union` as Concatenate, `Summarize` as Aggregate). The `blocking: true` flag shows the warning triangle. Studio hard-codes it, and the Server decides what is cached, so the two lists can drift.

When a tool is dropped on the canvas, Studio clones its definition and gives it a unique ID.

`data/toolConfigComponents.tsx` maps a tool type to its config component. Read and Write are the exception. They go through `SourceConfigurationPanel`, which switches on the chosen data source. `data/toolConfigSchemas.ts` holds config schemas and enums that the AI layer uses.

## Configuration hooks

Config components share logic through hooks in `hooks/useToolConfiguration.ts`:

- `useToolConfiguration` for single-input tools. It tracks the input wire, fetches the upstream columns (`/api/workflow/tool/metadata`) when the wiring changes, and offers `updateField` and `updateFields`, which also mark fields in the emission map (`_emit`).
- `useMultiSocketConfiguration` for tools with several inputs, such as Join.

```typescript
const { columns, loading, hasInput, updateField } = useToolConfiguration({
  toolId,
  socketId: CommonSockets.INPUT,
  tools,
  wires,
  workflowMeta,
  config,
  onChange,
});
```

Socket ID constants are in `domain/workflow/constants/socketIds.ts`. They must match the Server's `sockets.py`, and `src/__tests__/type-contracts.test.ts` checks it.

## API layer

`api/backend.ts` is the typed HTTP client for one Server. `api/execution.ts` wraps it so that calls are Hub-aware. In Hub mode it asks Hub for a token first and sends the request to the Server Hub chose. `api/index.ts` is the barrel. Import execution functions from `@api`, not from `@api/backend`.

`api/hub.ts` is the Hub client. `api/cache.ts` keeps an in-memory cache of previews and schemas, keyed by a tool and its upstream tools, and clears it when a wire or tool changes. `api/connectionResolver.ts` turns connection IDs into what the Server needs before a request.

## Workflow serialization

Workflows are saved as `.swwf` JSON. `WorkflowSerializer` reads and writes the format and validates it. The `version` field in files it writes is `"1.0"` today, although the source comments call the format v2.0. Treat that as a wart to fix before the format is declared stable.

```json
{
  "version": "1.0",
  "meta": { "name": "My Workflow", "author": "User", "workflowId": "...", "defaultEngine": "core/polars" },
  "tools": [
    { "id": "abc", "type": "Filter", "x": 100, "y": 200, "config": {}, "sockets": [] }
  ],
  "wires": [
    { "from": { "tool": "abc", "socket": "output-true" }, "to": { "tool": "def", "socket": "input" } }
  ]
}
```

Only config fields that the user has set are written. A tool's `_emit` map marks them, plus a few structural fields such as `type` and `source`. Engine fields (`meta.defaultEngine`, `tool.engine`, `engines`) are optional. `tool.engine` is omitted when it equals the default. See the [Tool Registry](../reference/tool-registry.md).

Database credentials never enter the file. A database Read tool stores a connection ID, and `connectionResolver` swaps it for a URI only in the request.

## Desktop shells

**Tauri** (`tauri/`): a Rust shell with commands for files, settings, credentials and, in Full builds, the Server sidecar. It starts the bundled Server, waits for its health check, then shows the window. The renderer reaches it only through the platform adapter, and is granted no plugin permissions beyond opening links.

The shell only reads or writes files the user picked in a native open or save dialog in the current session, so a compromised renderer cannot reach other paths (`tauri/src/commands/files.rs`).

## AI assistant

`ai/agent.ts` runs a tool-calling loop against a model created in `ai/providers.ts`. Requests go through the Server's AI proxy. The agent's tools (`ai/tools/`) read and edit the workflow store, preview data, inspect schemas and run read-only database queries. Prompts are in `ai/prompts/`. See [AI Development Philosophy](../ai-philosophy.md).

## Testing

Frontend tests concentrate on:

1. **Domain logic**: serialization, validation, loop detection, auto layout.
2. **State**: store actions and transitions.
3. **Contracts**: socket IDs and config schemas that must match the Server.
4. **Utilities and hooks.**

Component rendering gets lighter coverage because the UI changes often. See [Studio Testing](../testing/frontend.md).

---

Next: [Server Architecture](./backend.md) or [Adding Tools](../contributing/adding-tools.md).
