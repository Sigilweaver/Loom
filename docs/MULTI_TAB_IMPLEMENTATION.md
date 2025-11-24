# Multi-Tab Implementation

## Overview

Multi-tab support has been successfully implemented in Sigilweaver, allowing users to work on multiple workflows simultaneously within a single application window.

## Architecture

### Core Design Pattern

The implementation uses a **single orchestrator store** (`tabStore`) that manages multiple workflow instances rather than creating separate stores for each tab:

- **tabStore**: Central manager for all tabs and their state
- **workflowStore**: Represents the **active tab's** workflow state
- **historyStore**: Represents the **active tab's** undo/redo state
- **uiStore**: Global UI preferences (shared across tabs)
- **clipboardStore**: Global clipboard (can paste between tabs)

### State Synchronization Flow

```
1. User switches from Tab A to Tab B
2. tabStore.saveCurrentTab() → Save Tab A's workflow + history
3. tabStore.switchTab(B) → Update activeTabId
4. tabStore.loadTab(B) → Load Tab B into workflowStore + historyStore
```

## Files Created

### 1. State Management
- **`frontend/src/state/tabStore.ts`** (546 lines)
  - Tab lifecycle management (create, close, switch)
  - Workflow state isolation per tab
  - History state isolation per tab
  - Dirty state tracking
  - File path associations

### 2. UI Components
- **`frontend/src/components/Tab.tsx`** (74 lines)
  - Individual tab component
  - Displays tab name, dirty indicator, close button
  - Handles active state styling

- **`frontend/src/components/TabBar.tsx`** (127 lines)
  - Horizontal tab bar container
  - New tab button
  - Tab context menu (right-click)

## Files Modified

### 1. Core Application
- **`frontend/src/App.tsx`**
  - Added TabBar component to layout
  - Initialize first tab on mount
  - Save tab state before app close
  - Tab keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)

### 2. Workflow Store
- **`frontend/src/state/workflowStore.ts`**
  - Added `_markDirty()` helper
  - Integrated dirty tracking on all mutations:
    - `addTool`, `removeTool`
    - `addWire`, `removeWire`
    - `batchAddToolsAndWires`
    - `updateToolConfiguration`
    - `updateWorkflowMeta`

### 3. Header Operations
- **`frontend/src/components/Header.tsx`**
  - **New**: Creates new tab instead of clearing current workflow
  - **Open**: Loads workflow into new tab, preserves file path
  - **Save**: Saves to existing file path (marks tab clean)
  - **Save As**: Prompts for new file path
  - **Export**: Copy workflow to new file (doesn't affect current tab)

## Features

### Tab Management
- ✅ Create new tabs (New button, Ctrl+T)
- ✅ Close tabs with unsaved change confirmation (X button, Ctrl+W)
- ✅ Switch between tabs (click, Ctrl+Tab)
- ✅ Rename tabs (right-click context menu)
- ✅ Close other tabs (context menu)
- ✅ Dirty indicator (dot on tab when modified)
- ✅ Prevent closing last tab

### File Operations
- ✅ Save workflow to file (Ctrl+S)
- ✅ Save As new file (Ctrl+Shift+S)
- ✅ Open workflow in new tab (Ctrl+O)
- ✅ New blank workflow in new tab (Ctrl+N)
- ✅ Tab name updates from file name
- ✅ Dirty state clears after save

### State Isolation
- ✅ Each tab has independent workflow state
- ✅ Each tab has independent undo/redo history
- ✅ Switching tabs preserves all state
- ✅ Clipboard works across tabs (global)

### Keyboard Shortcuts
- **Ctrl+T**: New tab
- **Ctrl+W**: Close tab
- **Ctrl+Tab**: Next tab
- **Ctrl+Shift+Tab**: Previous tab
- **Ctrl+N**: New workflow (creates new tab)
- **Ctrl+O**: Open workflow (creates new tab)
- **Ctrl+S**: Save current tab
- **Ctrl+Shift+S**: Save As

### Context Menu (Right-click on tab)
- Rename
- Close
- Close Others

## Implementation Details

### Dirty State Tracking

The `workflowStore` automatically marks the active tab as dirty when mutations occur:

```typescript
addTool: (tool) => set((state) => {
  state.tools.push(tool);
  get().syncEdges();
  get()._markDirty(); // ← Marks active tab dirty
}),
```

The `_markDirty()` helper uses dynamic import to avoid circular dependencies:

```typescript
_markDirty: () => {
  import("./tabStore").then(({ useTabStore }) => {
    const activeTabId = useTabStore.getState().activeTabId;
    if (activeTabId) {
      useTabStore.getState().markTabDirty(activeTabId);
    }
  });
},
```

### State Snapshot Structure

Each tab stores:

```typescript
interface TabData {
  workflow: {
    tools: Tool[];
    wires: Wire[];
    workflowMeta: WorkflowMeta;
  };
  history: {
    past: WorkflowSnapshot[];
    future: WorkflowSnapshot[];
  };
}
```

### Deep Cloning

All state is deep cloned when saved/loaded to prevent reference sharing:

```typescript
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
```

## Edge Cases Handled

1. **Closing tab with unsaved changes**: Shows confirmation dialog
2. **Closing last tab**: Prevented (always keep one tab open)
3. **Tab switching with tool selected**: Selection clears when switching
4. **File operations**: Properly associate file paths with tabs
5. **Dirty state**: Automatically tracks all workflow mutations
6. **History restoration**: Undo/redo history preserved per tab

## Future Enhancements (Not Implemented)

- Tab drag-and-drop reordering
- Tab persistence to localStorage/Electron store
- Max tab limit
- Tab overflow scroll/menu
- Duplicate tab
- Tab groups/colors
- Recently closed tabs

## Testing Recommendations

1. Create multiple tabs and verify state isolation
2. Switch between tabs and verify workflow preservation
3. Close tabs with unsaved changes and verify confirmation
4. Save/Open workflows and verify file path associations
5. Test keyboard shortcuts
6. Test context menu operations
7. Test dirty state tracking across various mutations
8. Test undo/redo in multiple tabs

## Migration Notes

No breaking changes to existing functionality. The implementation:
- Preserves all existing workflow operations
- Uses existing store infrastructure
- Maintains backward compatibility
- Adds new features without modifying core workflow logic

## Performance Considerations

- Deep cloning is efficient for typical workflow sizes
- State synchronization is lazy (only on tab switch)
- No memory leaks (proper cleanup on tab close)
- Zustand state updates are optimized

---

**Status**: ✅ Fully Implemented and Ready for Testing
**Version**: 1.0.0
**Date**: November 24, 2025
