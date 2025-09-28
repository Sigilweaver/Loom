# Configuration Primitives Philosophy

This guide captures the shared mental model for wiring Sigilweaver's configuration primitives into real workflows. It focuses on consistency, clarity for operators, and simple XML emission semantics.

## Guiding Principles

- **Model defaults explicitly.** Every primitive accepts a `defaultValue`; pass the engine's real default so the UI can explain it and the primitive can suppress redundant XML.
- **Treat `undefined` as "use the engine default".** When a control produces `undefined`, the primitive will omit the attribute from the XML payload.
- **Emit only when behaviour changes.** Lean on `usePrimitiveEmission` so primitives evaluate `shouldEmit` automatically and you stay out of the bookkeeping business.
- **Deliver instant feedback.** Prefer inline helper text, validation messages, and hover hints to show operators what will happen when they deviate from defaults.
- **Optimise for keyboard and search.** The primitives purposely ship with strong accessibility support—keep search enabled where lists are long and make sure tab/arrow flows feel natural.

## Primitive Playbook

### `ConfigSelect`

- Convey the engine default by passing it via `defaultValue`. When no override is stored, the dropdown now shows the default option label instead of the placeholder.
- Keep the "reset" story simple: selecting the option that matches the default clears the override again; a placeholder entry remains available for bespoke messaging when you really need it.
- Supply `emptyOptionLabel` only when the field can return to an "unset" state that is _different_ from the default (for example, "Inherit from upstream tool").
- Use `searchable` when you have more than about eight options or when aliases/keywords make discovery easier. Provide `keywords` for fuzzy search hits.
- For required selects, omit `placeholder`/`emptyOptionLabel` and depend on the default/first option to guide the operator.

### `ConfigNumberRange`

- Store ranges as `{ start, end }` objects and allow partial ranges only when the backing engine accepts them. Use `allowPartial={false}` to force complete windows.
- Use `defaultValue` to express the engine's implicit span—undefined values collapse back to this default automatically.
- Prefer `debounceMs` for inputs that validate eagerly; flip to `validationMode="blur"` when operators need to tab through quickly.
- Clamp and validate early: `min/max`, `clampToBounds`, and `customValidator` keep ranges safe before they touch persistence.

### `ConfigBoolean`

- Pass the canonical engine default via `defaultValue`; letting the primitive coerce repeated "default" selections back to `undefined` keeps XML lean.
- Use the optional `description` to hint at the consequences of toggling the switch (e.g., performance, output shape).
- Disabled booleans double as documentation—include a short `description` explaining why the toggle is locked.

### `ConfigText`

- Take advantage of `variant="char"` when the engine expects a single character (such as delimiters); the primitive automatically enforces length 1.
- For pattern-heavy fields, supply a `validation` block with both regex and a human message. Set `allowEmpty` whenever "unset" maps to engine default behaviour.
- Use `presetOptions` to keep popular values one click away while still allowing freeform input.

### `ConfigFile`

- Always set `filters` and `accept` to prevent accidental file selection. The primitive automatically displays the browser warning when the workflow runs outside Electron.
- When pointing at the same config key with multiple contexts (CSV vs Excel), give each control a distinct `configKey` path so overrides never collide.

## Wiring Checklist

1. Identify the engine default and pass it through `defaultValue`.
2. Decide whether the control should emit only on change—if so, rely on the primitive's `onChange` signature (`value`, `emitPatch`, `shouldEmit`).
3. Surface helpful inline guidance: `description`, `inlineMessage`, and validation copy prevent guesswork.
4. Reflect current state back to the operator (e.g., summary chips in side panels) so they grasp overrides at a glance.
5. Add unit tests that cover both default behaviour and overridden scenarios; the primitives expose accessible markup, so use Testing Library queries.

Following this philosophy keeps configuration experiences predictable, expressive, and friendly to both operators and downstream XML consumers.
