# Sigilweaver Copilot Instructions

## Project Overview

Sigilweaver is a visual workflow designer (similar to Alteryx) built with Electron, React, Vite, TypeScript, and ReactFlow. Users create data processing workflows by dragging tools onto a canvas and connecting them. The **XML document is the single source of truth**—all state derives from it.

## Core Architecture Principles

### XML-Driven State Management

- `XMLWorkflowManager` (`src/utils/XMLWorkflowManager.ts`) is the authoritative store for all workflow data
- The DOM `Document` object holds the canonical XML; all state is read from and written to this document
- Never maintain parallel state—always read from XML via `getTools()`, `getWires()`, `getMetadata()`
- The `workflowStore` (Zustand) is a **derived cache** that mirrors XML state for reactive UI updates
- After XML mutations (add/remove tool, update config), call `updateStateFromXML()` to sync the store

### State Flow Pattern

```
User Action → XMLWorkflowManager mutation → updateStateFromXML() → Zustand store update → React re-render
```

### Edge Management (`EdgeManager`)

- `EdgeManager` (`src/domain/workflow/services/edgeManager.ts`) orchestrates ReactFlow edges and XML wires
- Manages optimistic UI updates: immediately update ReactFlow edges, then sync to XML
- Handles cycle detection and error styling (dashed red edges for loops)
- Always use `EdgeManager.addWire()` and `EdgeManager.removeWire()` instead of direct XML calls

## Configuration Primitives Philosophy

**Essential Reading**: `docs/configuration-primitives-philosophy.md` defines the mental model for all config controls.

### Key Principles

1. **Model defaults explicitly**: Every primitive accepts `defaultValue` to show the engine's real default
2. **Treat `undefined` as "use engine default"**: Primitives omit XML attributes when value is undefined
3. **Emit only when behavior changes**: Use `usePrimitiveEmission` hook to auto-compute `shouldEmit`
4. **XML Emission Map (`_emit`)**: Controls which config fields emit to XML. Shape: `{ fieldName: boolean | XMLEmissionMap }`

### Primitive Usage

- `ConfigSelect`: Dropdown with search support, default value coercion, and `emptyOptionLabel` for "unset" states
- `ConfigNumberRange`: Range inputs with `{ start, end }` objects, partial range support via `allowPartial`
- `ConfigBoolean`: Toggle switches that collapse back to `undefined` when set to default value
- `ConfigText`: Text/char inputs with regex validation and preset suggestions via `presetOptions`
- `ConfigFile`: File pickers with browser warnings (only work in Electron context)

### onChange Signature

All primitives use: `onChange(value: T | undefined, emitPatch: XMLEmissionMap, shouldEmit: boolean)`

- `value`: The new value (undefined means "use default")
- `emitPatch`: Nested object specifying which fields should emit to XML
- `shouldEmit`: Whether this specific field should emit (computed by primitive)

## Development Workflows

### Running the App

- `npm run electron:dev` — Start Vite dev server + Electron in parallel (preferred)
- `npm run dev` — Vite dev server only (web mode, no Electron APIs)
- `npm run build` — TypeScript compile + Vite build + Electron build
- `npm run build:web` — Web-only build (no Electron packaging)

### Testing

- `npm test` — Run all tests once (Vitest)
- `npm run test:watch` — Watch mode for TDD
- `npm run test:coverage` — Generate coverage report
- Test files: `**/__tests__/**/*.{test,spec}.{ts,tsx}` or `**/*.{test,spec}.{ts,tsx}`
- Testing Library (`@testing-library/react`) for component tests
- Primitives test accessibility: use `getByRole`, `getByLabelText` to verify ARIA attributes

### Code Quality

- `npm run type-check` — TypeScript validation without emit
- `npm run lint` — ESLint check
- `npm run lint:fix` — Auto-fix linting issues
- `npm run format` — Prettier formatting

## Project Structure Conventions

### Path Aliases (vite.config.ts & vitest.config.ts)

```typescript
@domain      → src/domain       (business logic, entities, services)
@state       → src/state        (Zustand stores)
@components  → src/components   (React components)
@utils       → src/utils        (utilities, managers)
@data        → src/data         (tool definitions)
@contexts    → src/contexts     (React contexts)
```

**Always use these aliases** instead of relative imports for top-level directories.

### Key Directories

- `src/domain/workflow/entities/` — Core types: `Tool`, `Wire`, `ToolConfig`, `WorkflowMeta`
- `src/domain/workflow/services/` — Business logic: `EdgeManager`, `loopDetection`
- `src/components/primitives/` — Reusable config controls with tests in `__tests__/`
- `src/state/` — Zustand stores: `workflowStore.ts` (workflow cache), `uiStore.ts` (notifications, UI state)
- `src/utils/` — Managers: `XMLWorkflowManager`, `HistoryManager`, `XMLClipboard`

## Tool System

### Tool Definitions (`src/data/tools.ts`)

- `TOOL_DEFINITIONS` array defines all available tools
- Each tool has: `type`, `name`, `icon`, `category`, `defaultConfig`, `sockets`
- Categories: `inout` (green), `preparation` (blue), `join` (purple), `aggregate` (orange)
- Sockets: `{ id, direction: 'input'|'output', type?: string, multiple?: boolean }`
- Socket types (e.g., `'L'`, `'R'`, `'T'`, `'F'`) are displayed as labels on handles

### Adding a New Tool

1. Add definition to `TOOL_DEFINITIONS` in `src/data/tools.ts`
2. Define `defaultConfig` with all config fields
3. Specify socket array (input/output configuration)
4. Create config panel component in `src/components/` if needed
5. Add to `FAVORITES_TOOLS` array if it should appear in Favorites tab

## Theming System

### CSS Variables

- Themes inject CSS variables into `:root` via `ThemeContext`
- Theme tokens in `src/themes/tokens/` (e.g., `canvas.ts`, `node.ts`)
- Use semantic variables: `var(--color-theme-text-primary)`, `var(--color-tool-inout)`
- Tool category colors: `--color-tool-inout`, `--color-tool-preparation`, `--color-tool-join`, `--color-tool-aggregate`
- Edge colors: `--color-edge-default-stroke`, `--color-edge-invalid-stroke`

### Available Themes

- `sigilweaver` (default) — Purple-accented dark theme
- `light`, `dark`, `highContrast` — Accessible alternatives
- Theme registry in `src/themes/index.ts`

### Dynamic Color Access

Use `getThemeColor(varName)` from `src/utils/themeColors.ts` when you need colors in JS (e.g., for ReactFlow edges).

## History & Undo/Redo

### HistoryManager (`src/utils/HistoryManager.ts`)

- Maintains XML snapshots for undo/redo
- Call `history.checkpoint(xml, label)` before mutations
- For multi-step operations: `history.begin(xml, label)` → operations → `history.commit(xml, { label })`
- Global shortcuts: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y (redo)
- Undo/redo listener in `App.tsx` prevents shortcuts when typing in inputs

## Clipboard & Copy/Paste

### XML Clipboard (`src/utils/XMLClipboard.ts`)

- `buildClipboardFragment(xml, selectedIds)` — Extract selected tools+wires as XML fragment
- `applyClipboardFragment(xmlManager, fragment, anchor)` — Paste at anchor position
- Fragment format: `<ClipboardFragment><Tools>...</Tools><Wires>...</Wires></ClipboardFragment>`
- IDs are regenerated on paste to avoid collisions

## Loop Detection

### Cycle Detection (`src/domain/workflow/services/loopDetection.ts`)

- `wouldCreateCycle(tools, wires, fromTool, toTool)` — Check if adding a wire creates a cycle
- Uses graph traversal to detect back edges
- Invoked in `EdgeManager.addWire()` before XML mutation
- Loop wires render as animated dashed red edges for 3 seconds, then auto-remove

## Common Patterns

### Updating Tool Config

```typescript
// In config panel component:
const handleChange = (
  value: T | undefined,
  emitPatch: XMLEmissionMap,
  shouldEmit: boolean
) => {
  const newConfig = {
    ...selectedTool.config,
    fieldName: value,
    _emit: emitPatch,
  };
  onToolConfigChange(toolId, newConfig);
};
```

### Adding a Tool

```typescript
const definition = getToolDefinition(toolType);
const newTool: Tool = {
  id: generateUniqueId(existingIds, 8),
  type: toolType,
  x,
  y,
  config: { ...definition.defaultConfig },
  sockets: [...definition.sockets],
};
xmlManager.addTool(newTool);
updateStateFromXML();
```

### Transaction Pattern (Batch Operations)

```typescript
history.begin(xmlManager.toXMLString(), "Paste");
// ... multiple xmlManager mutations ...
updateStateFromXML();
edgeManager.syncFromXML();
history.commit(xmlManager.toXMLString(), { label: "Paste" });
```

## Testing Best Practices

### Component Testing

- Use Testing Library queries: `getByRole`, `getByLabelText`, `getByText`
- Primitives have accessibility IDs: verify `aria-describedby`, `aria-invalid`, `aria-required`
- Mock `onChange` with `vi.fn()` and assert calls with `expect(onChange).toHaveBeenCalledWith(...)`
- Example: `src/components/primitives/__tests__/ConfigBoolean.test.tsx`

### State Testing

- Test Zustand stores in isolation: `src/state/__tests__/workflowStore.test.ts`
- Use `act()` from `@testing-library/react` for async state updates

## XML Structure

### Workflow XML Schema

```xml
<Workflow version="0.1.0" xmlns="https://docs.sigilweaver.com/schema/workflow">
  <Meta>
    <n>Workflow Name</n>
    <Description><![CDATA[...]]></Description>
    <Author>...</Author>
    <WorkflowId>uuid</WorkflowId>
    <Created>ISO timestamp</Created>
  </Meta>
  <Layout>
    <Container id="root" name="Root" x="0" y="0" width="1200" height="800">
      <Tool id="tool1" type="Input" x="100" y="100">
        <Config>
          <type>csv</type>
          <filePath>/path/to/file.csv</filePath>
          <options>
            <sep>,</sep>
            <header>0</header>
          </options>
        </Config>
        <Sockets>
          <Socket id="0" direction="output"/>
        </Sockets>
      </Tool>
    </Container>
  </Layout>
  <Wires>
    <Wire>
      <From tool="tool1" socket="0"/>
      <To tool="tool2" socket="0"/>
    </Wire>
  </Wires>
</Workflow>
```

### Config Emission Rules

- Only emit fields with non-default values
- Empty strings, `null`, `undefined` → omitted
- CSV tool: omit pandas default values (see `PANDAS_CSV_DEFAULTS` in `src/domain/dataSources/csv.ts`)
- Use `_emit` map to force/suppress emission per field

## Electron Integration

### File APIs

- `window.electronAPI` (from preload script) provides native file dialogs
- Primitives like `ConfigFile` warn when running in browser (no Electron context)
- Check `window.electronAPI` existence before using Electron-only features

### Menu Actions

- Menu bar defined in `electron/main.ts`
- Menu actions dispatched via IPC to React app
- Handle in `App.tsx` via `window.electronAPI.onMenuAction()`

## Anti-Patterns to Avoid

❌ **Don't** maintain state parallel to XML—always derive from `XMLWorkflowManager`
❌ **Don't** mutate Zustand store directly—use `XMLWorkflowManager` mutations + `updateStateFromXML()`
❌ **Don't** hardcode default values in primitives—pass `defaultValue` prop explicitly
❌ **Don't** emit unchanged fields to XML—rely on `shouldEmit` and `_emit` maps
❌ **Don't** use `getElementById` for config fields—primitives generate unique IDs via `useId()`
❌ **Don't** skip history checkpoints before XML mutations—always call `history.checkpoint()` or `history.begin()`

## Common Tasks

### Adding a Config Field to a Tool

1. Update `defaultConfig` in `src/data/tools.ts`
2. Add primitive component to tool's config panel
3. Pass `defaultValue` matching engine default
4. Wire `onChange` to update `tool.config` with `_emit` patch
5. Add test coverage for default/override scenarios

### Debugging XML Issues

1. Open XML viewer: click "View XML" in header
2. Check `XMLWorkflowManager` console logs for parse errors
3. Use `xmlManager.toXMLString()` to inspect current state
4. Verify `_emit` maps in `emitDecisions` Map (see `XMLWorkflowManager` internals)

### Fixing Edge Sync Issues

1. Check `EdgeManager.syncFromXML()` is called after XML mutations
2. Verify `edgeManager.updateTools(tools)` runs when tools change
3. Look for cycle detection warnings in console
4. Ensure edge IDs match wire encoding: `${fromTool}_${fromSocket}_${toTool}_${toSocket}`
