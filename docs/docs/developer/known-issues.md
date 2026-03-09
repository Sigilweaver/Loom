---
sidebar_position: 2
---

# Known Issues

Current limitations, platform quirks, and workarounds.

This is a living document. Things get fixed, new issues appear. Check [GitHub Issues](https://github.com/Sigilweaver/Sigilweaver/issues) for the most current list.

---

## Platform-Specific

### Linux

**X11 support**

- **Status**: Not tested, not a priority
- **Workaround**: Use XWayland or native Wayland
- **Notes**: Most modern Linux distros default to Wayland now

### Windows

**SmartScreen warnings on install**

- **Issue**: Windows flags unsigned executables as potentially harmful
- **Root cause**: No code signing certificate yet
- **Workaround**: Click "More info" → "Run anyway"
- **Future**: Will get code signing before v1.0

**Path length limits**

- **Issue**: Windows has a 260 character path limit (unless registry-enabled)
- **Workaround**: Keep workflow files close to root (e.g., `C:\Data\` not `C:\Users\...\OneDrive\...\`)
- **Notes**: Rare in practice, but affects deeply nested project structures

### macOS

**Gatekeeper/notarization**

- **Issue**: macOS blocks apps from "unidentified developers"
- **Root cause**: No Apple Developer certificate yet
- **Workaround**: Right-click → Open → Open anyway
- **Future**: Will get notarization before v1.0

**Apple Silicon (M1/M2/M3)**

- **Status**: Builds are generated but limited testing
- **Known**: Works via Rosetta 2, native ARM builds in progress
- **Notes**: Report issues if you encounter them

---

## Tool-Specific

### Filter Tool

**Complex nested expressions**

- **Issue**: Very deeply nested Polars expressions can be slow to validate
- **Workaround**: Break complex filters into multiple Filter tools
- **Notes**: Execution is fine, it's just the real-time validation

### Formula Tool

**No autocomplete for chained methods**

- **Issue**: Autocomplete shows `.str.` methods but not what's after
- **Example**: `pl.col("name").str.` suggests methods, but `pl.col("name").str.contains()` doesn't suggest `.alias()`
- **Workaround**: Refer to Polars docs for method chains
- **Notes**: Monaco autocomplete is tricky to extend

### Join Tool

**Many-to-many join performance**

- **Issue**: Joining two large tables on non-unique keys can explode row count
- **Notes**: This is how joins work, not a bug, but the UI doesn't warn you
- **Future**: Add row count estimates before execution

### Input Tool

**Large file preview delays**

- **Issue**: Opening a multi-GB file takes noticeable time for initial preview
- **Root cause**: Need to scan file for schema inference
- **Workaround**: Be patient, or use smaller sample files during development
- **Notes**: Execution uses lazy evaluation, so the actual pipeline is fast

---

## General

**Undo/redo across tabs**

- **Issue**: Undo history is per-tab, but it can feel disorienting when switching
- **Notes**: This is by design (each tab is independent), but some users expect global undo

**Large workflows (100+ nodes)**

- **Issue**: Canvas performance degrades with very large workflows
- **Root cause**: React re-renders, Xyflow limitations
- **Workaround**: Break large workflows into smaller sub-workflows
- **Future**: Investigate virtualization and rendering optimizations

**Memory usage**

- **Issue**: Electron + Chromium + bundled Python can use significant RAM
- **Typical**: 500MB-1GB for normal use
- **Peak**: Can spike higher during large data operations
- **Notes**: This is the Electron tax. Desktop apps have memory to spare.

---

## Browser Mode (Development Only)

The app can run in a browser for frontend development, but with limitations:

**No native file access**

- **Issue**: Browser security prevents reading/writing local files
- **Workaround**: File picker works, but paths may not resolve correctly
- **Notes**: Use Electron mode for actual workflows

**No backend bundling**

- **Issue**: Browser mode connects to a separate backend process
- **Notes**: Fine for UI development, not for testing full workflows

---

## Reporting New Issues

When reporting issues:

1. **Check existing issues** first
2. **Include environment**: OS, version, architecture (x64/ARM)
3. **Steps to reproduce**: What exactly you did
4. **Expected vs actual**: What should have happened vs what did
5. **Workflow file**: If relevant, attach (sanitize sensitive data first)
6. **Logs**: Check DevTools console (Ctrl+Shift+I)

Good bug reports get fixed faster.

---

## Security Notes

**Arbitrary code execution**

- **Reality**: Formula and Filter tools evaluate Polars expressions on the backend
- **Implication**: A malicious workflow file could execute arbitrary Python
- **Mitigation**: Only open workflow files you trust (same as any script)
- **Notes**: This is inherent to the design. The tool is for technical users who understand the risk

**Data stays local**

- **Reality**: All processing happens on your machine
- **No telemetry**: No data sent anywhere
- **Your data, your responsibility**: Back it up, secure it appropriately

---

Next: Return to [Developer Guide](./) or explore [Architecture](./architecture/overview).
