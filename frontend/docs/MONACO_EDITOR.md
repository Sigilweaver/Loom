# Monaco Editor Implementation

## Overview

Monaco Editor (the code editor that powers VS Code) has been integrated into Sigilweaver for enhanced code editing experiences, particularly for Python expressions in the Formula tool.

## Architecture

### Plugin: `vite-plugin-monaco-editor`

We use `vite-plugin-monaco-editor` to handle web worker bundling automatically. This resolves the typical Vite + Monaco challenges:

- Worker file serving in dev vs production
- Path resolution in Electron packaged apps
- CSP (Content Security Policy) compatibility

### Configuration

**vite.config.ts**:
```typescript
// @ts-ignore - CJS module in ESM context
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

plugins: [
  react(),
  // @ts-ignore - CJS module interop issue
  (monacoEditorPlugin.default || monacoEditorPlugin)({
    languageWorkers: ['editorWorkerService', 'typescript', 'json'],
  }),
  // ... other plugins
]
```

**Note**: The `vite-plugin-monaco-editor` package is CommonJS, so we need the `.default` fallback for proper ESM interop in Vite.

**Language Workers Included**:
- `editorWorkerService` - Core editor services (always required)
- `typescript` - TypeScript/JavaScript syntax highlighting & IntelliSense
- `json` - JSON syntax highlighting

To add more languages (e.g., Python), add them to the `languageWorkers` array.

## Components

### CodeEditor (`src/components/common/CodeEditor.tsx`)

Reusable Monaco Editor wrapper component with sensible defaults for Sigilweaver.

**Props**:
```typescript
interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;         // Default: 'python'
  readOnly?: boolean;        // Default: false
  height?: string;           // Default: '200px'
  theme?: string;            // Optional override (auto-detected from app theme)
  placeholder?: string;      // Optional placeholder text
}
```

**Theme Integration**:
The editor automatically detects the current app theme and maps to appropriate Monaco themes:
- `light` / `high-contrast` → `vs` (Monaco light theme)
- `sigilweaver` / `dark` → `vs-dark` (Monaco dark theme)

Background colors are handled via CSS to ensure proper integration:
- Light themes: Use Monaco's white background
- Dark themes: Transparent background to inherit theme color

**Features**:
- Minimap disabled by default (cleaner for small editors)
- Line numbers enabled
- Word wrap enabled
- Automatic layout (resizes with container)
- Placeholder support for empty editors
- Optimized scrollbar settings

**Usage Example**:
```typescript
import { CodeEditor } from '@/components/common/CodeEditor';

// Basic usage - theme auto-detected
<CodeEditor
  value={code}
  onChange={setCode}
  language="python"
  height="200px"
  placeholder="Enter your expression..."
/>

// With theme override
<CodeEditor
  value={code}
  onChange={setCode}
  language="markdown"
  theme="vs"  // Force light theme
/>
```

## Current Implementation

Monaco Editor is now integrated in the following components:

### 1. Formula Configuration (`FormulaConfiguration.tsx`)
Python expression editing for creating calculated columns.

**Language**: `python`  
**Height**: `150px`  
**Features**: Syntax highlighting for Polars expressions

### 2. Filter Configuration (`FilterConfiguration.tsx`)
Python expression editing for filtering rows.

**Language**: `python`  
**Height**: `120px`  
**Features**: Syntax highlighting for boolean Polars expressions

### 3. Workflow Configuration (`WorkflowConfiguration.tsx`)
Markdown editing for workflow descriptions with live preview toggle.

**Language**: `markdown`  
**Height**: `150px`  
**Features**: Markdown syntax highlighting, preview/edit mode toggle

**Benefits over previous implementations**:
- Better keyboard navigation (Ctrl+Z/Ctrl+Y work properly)
- Multi-cursor support
- Find & replace (Ctrl+F)
- Proper syntax highlighting
- Better accessibility
- Consistent editing experience across all tools

## Testing

### Development Mode
```bash
cd frontend
npm run dev
# In another terminal:
npm run electron
```

Test the Formula tool - verify:
- Editor loads without console errors
- Syntax highlighting works
- Typing is responsive
- No lag or performance issues

### Production Build
```bash
./scripts/build.sh
# Or just frontend:
cd frontend
npm run build:web && npm run build:linux
```

Install the AppImage and verify Monaco works in the packaged app.

## Performance Considerations

### Bundle Size
Monaco Editor adds ~3MB to the bundle (minified). This is acceptable for a desktop app, but monitor total bundle size.

**Current approach**: Monaco is imported directly (not lazy loaded)
**Future optimization**: If bundle size becomes an issue, consider:
```typescript
const CodeEditor = lazy(() => import('@/components/common/CodeEditor'));
```

### Language Workers
Only include workers for languages you actually use. Each worker adds to bundle size:
- `editorWorkerService`: ~500KB (required)
- `typescript`: ~1.5MB
- `json`: ~100KB
- `python`: ~200KB (if added)

## Troubleshooting

### Workers Not Loading in Production

**Symptom**: Editor works in dev but not in packaged app
**Solution**: Verify `vite-plugin-monaco-editor` is properly configured. Check browser console for 404s on worker files.

### CSP Errors in Electron

**Symptom**: Console shows "Refused to create worker" or CSP violations
**Solution**: `@monaco-editor/react` handles this automatically. If issues persist, check Electron's CSP configuration in `electron/main.ts`.

### Performance Issues

**Symptom**: Typing lag or slow rendering
**Solutions**:
1. Reduce editor height (smaller viewports perform better)
2. Disable features: `minimap`, `folding`, `glyphMargin`
3. Consider switching to CodeMirror 6 for simple use cases

### Theme Not Applied

**Symptom**: Editor appears in light theme despite `theme="vs-dark"`
**Solution**: Ensure `theme` prop is passed to `<Editor>` component. Monaco has built-in themes:
- `vs` - Light theme
- `vs-dark` - Dark theme (default)
- `hc-black` - High contrast dark
- `hc-light` - High contrast light

Custom themes can be defined using `monaco.editor.defineTheme()` in the `onMount` handler.

## Future Enhancements

### Custom Sigilweaver Theme
Define a custom Monaco theme matching Sigilweaver's design system:

```typescript
monaco.editor.defineTheme('sigilweaver', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280' },
    { token: 'keyword', foreground: 'a78bfa' },
    // ... more token rules
  ],
  colors: {
    'editor.background': '#18181b',
    'editor.foreground': '#e4e4e7',
    // ... more color overrides
  }
});
```

### Python IntelliSense
For better Python editing, consider adding:
- Polars-specific autocompletion (e.g., `pl.col()`, `pl.lit()`)
- Schema-aware column name suggestions
- Expression validation via backend API

### Additional Use Cases
Monaco Editor can be used for:
- **WorkflowViewer**: JSON editing with validation
- **Code Preview**: Displaying generated Python code with syntax highlighting
- **Custom SQL tools**: If SQL support is added
- **Settings/Configuration**: Editing JSON configs with schema validation

## References

- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)
- [vite-plugin-monaco-editor](https://github.com/vdesjs/vite-plugin-monaco-editor)
