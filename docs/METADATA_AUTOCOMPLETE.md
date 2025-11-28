# Metadata Endpoint for Autocomplete

## Overview

The `/api/workflow/tool/metadata` endpoint provides metadata for autocomplete suggestions in Monaco editors for Formula and Filter tools. It returns:
1. Available columns from input sockets (with names, types, nullable status)
2. Common Polars functions with snippets

## Backend Implementation

### Endpoint: `POST /api/workflow/tool/metadata`

**Request:**
```json
{
  "tool_id": "filter1",
  "workflow": { /* full workflow JSON */ }
}
```

**Response:**
```json
{
  "tool_id": "filter1",
  "columns": [
    {
      "name": "age",
      "dtype": "Int64",
      "nullable": true
    }
  ],
  "polars_functions": [
    {
      "name": "pl.col",
      "signature": "pl.col(name: str)",
      "description": "Reference a column by name",
      "snippet": "pl.col('${1:column_name}')"
    }
  ]
}
```

### How It Works

1. Executes upstream tools to get input data
2. Extracts schema from LazyFrames at input sockets
3. Returns column metadata + pre-defined Polars function list

**Key difference from `/tool/schema`:**
- Schema endpoint: Returns output schemas for tool configuration dropdowns
- Metadata endpoint: Returns input columns + Polars functions for Monaco autocomplete

## Frontend Integration

### 1. Import Types and Hook

```typescript
import { useMetadata } from '@/api/hooks';
import type { ColumnSchema, PolarsFunction } from '@/api/backend';
```

### 2. Fetch Metadata in Configuration Component

```typescript
export function FormulaConfiguration({ config, onChange, toolId, workflow }: Props) {
  const { metadata, loading, fetchMetadata, getColumns, getFunctions } = useMetadata();
  
  useEffect(() => {
    if (toolId && workflow) {
      fetchMetadata(toolId, workflow);
    }
  }, [toolId, workflow, fetchMetadata]);
  
  const columns = getColumns();
  const functions = getFunctions();
  
  // Pass to Monaco editor for autocomplete
  return (
    <CodeEditor
      value={config.expression as string || ''}
      onChange={handleExpressionChange}
      language="python"
      metadata={{ columns, functions }} // NEW
    />
  );
}
```

### 3. Pass Props from ConfigurationPanel

Update `ConfigurationPanel.tsx` to provide `toolId` and `workflow`:

```typescript
{tool.type === 'Formula' && (
  <FormulaConfiguration
    config={tool.config}
    onChange={handleConfigChange}
    toolId={tool.id}  // ADD
    workflow={WorkflowSerializer.toJSON(tools, wires, workflowMeta)} // ADD
  />
)}
```

## Monaco Editor Autocomplete

### Enhance CodeEditor Component

Add metadata-based completions to `CodeEditor.tsx`:

```typescript
interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  metadata?: {
    columns: ColumnSchema[];
    functions: PolarsFunction[];
  };
}

const handleEditorDidMount: OnMount = (editor, monaco) => {
  if (language === 'python' && metadata) {
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          // Column completions
          ...metadata.columns.map(col => ({
            label: `pl.col('${col.name}')`,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `pl.col('${col.name}')`,
            documentation: `Column: ${col.name} (${col.dtype})`,
            detail: col.dtype,
          })),
          
          // Polars function completions
          ...metadata.functions.map(fn => ({
            label: fn.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: fn.snippet.replace(/\$\{\d+:(\w+)\}/g, '$1'), // Simple snippet conversion
            documentation: fn.description,
            detail: fn.signature,
          })),
        ];
        
        return { suggestions };
      },
    });
  }
};
```

## Usage Pattern

### Filter Tool

```typescript
// FilterConfiguration.tsx
const { fetchMetadata, getColumns, getFunctions } = useMetadata();

useEffect(() => {
  fetchMetadata(tool.id, workflow);
}, [tool.id, workflow]);

// User types in Monaco:
// "pl.col('a" -> autocomplete shows: age
// "pl." -> autocomplete shows: pl.col, pl.lit, pl.when
// ".str." -> autocomplete shows: .str.to_uppercase, .str.contains, etc.
```

### Formula Tool

```typescript
// FormulaConfiguration.tsx
const { fetchMetadata, getColumns } = useMetadata();

useEffect(() => {
  fetchMetadata(tool.id, workflow);
}, [tool.id, workflow]);

// Same autocomplete experience
```

## Performance Considerations

- Metadata fetching re-executes upstream tools (same as schema endpoint)
- Cache results to avoid redundant calls when user types
- Consider debouncing metadata fetches on wire changes

```typescript
// Cache metadata to avoid re-fetching on every keystroke
const metadataCache = useRef<Map<string, MetadataResponse>>(new Map());

useEffect(() => {
  const cacheKey = `${tool.id}-${JSON.stringify(workflow.wires)}`;
  
  if (metadataCache.current.has(cacheKey)) {
    setMetadata(metadataCache.current.get(cacheKey));
  } else {
    fetchMetadata(tool.id, workflow).then(data => {
      metadataCache.current.set(cacheKey, data);
    });
  }
}, [tool.id, workflow.wires]);
```

## Future Enhancements

1. **Type-aware suggestions**: Filter suggestions based on column dtype
   - Show `.str.*` methods only for String columns
   - Show math ops only for numeric columns

2. **Context-aware completions**: Adjust suggestions based on cursor position
   - After `pl.col('age').` -> show column methods
   - After `pl.` -> show top-level Polars functions

3. **Dynamic function discovery**: Query Polars API for all available functions instead of hardcoding

4. **Hover tooltips**: Show full documentation when hovering over functions

## Testing

Backend tests verify:
- Endpoint returns correct structure
- Columns match input schema
- Polars functions include key items (pl.col, pl.lit, pl.when)

```bash
cd backend
source .venv/bin/activate
pytest tests/test_metadata_endpoint.py -v
```

Manual testing:
```bash
curl -X POST http://localhost:8000/api/workflow/tool/metadata \
  -H "Content-Type: application/json" \
  -d @test-workflow.json | python -m json.tool
```

## Implementation Checklist

Backend:
- [x] Add `/api/workflow/tool/metadata` endpoint
- [x] Add `get_tool_metadata()` to WorkflowExecutor
- [x] Add Polars function library to executor
- [x] Add tests for metadata endpoint

Frontend:
- [x] Add `MetadataResponse` and `PolarsFunction` types
- [x] Add `getToolMetadata()` API function
- [x] Add `useMetadata()` hook
- [ ] Update `CodeEditor` to accept metadata prop
- [ ] Register Monaco completion provider
- [ ] Update `FormulaConfiguration` to use metadata
- [ ] Update `FilterConfiguration` to use metadata
- [ ] Update `ConfigurationPanel` to pass toolId/workflow
- [ ] Add caching to avoid redundant fetches
