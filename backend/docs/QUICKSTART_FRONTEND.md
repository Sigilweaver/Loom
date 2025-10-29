# Quick Start Example: First Frontend Integration

This is a **copy-paste ready** example showing how to use the backend from your frontend.

## Step 1: Create a Simple Workflow

```typescript
// frontend/src/api/backend.ts

const API_BASE = "http://localhost:8000/api";

export async function getToolSchema(toolId: string, workflow: Workflow) {
  const response = await fetch(`${API_BASE}/tool/schema`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool_id: toolId,
      workflow: workflow
    })
  });
  
  if (!response.ok) {
    throw new Error(`Schema fetch failed: ${response.statusText}`);
  }
  
  return await response.json();
}

export async function previewTool(toolId: string, workflow: Workflow, limit = 100) {
  const response = await fetch(`${API_BASE}/tool/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool_id: toolId,
      workflow: workflow,
      preview_limit: limit
    })
  });
  
  if (!response.ok) {
    throw new Error(`Preview failed: ${response.statusText}`);
  }
  
  return await response.json();
}
```

## Step 2: Build Filter Tool Configuration UI

```typescript
// frontend/src/components/FilterToolConfig.tsx

import { useEffect, useState } from 'react';
import { getToolSchema } from '../api/backend';

interface FilterConfigProps {
  tool: Tool;
  workflow: Workflow;
  onConfigChange: (config: any) => void;
}

export function FilterToolConfig({ tool, workflow, onConfigChange }: FilterConfigProps) {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [operator, setOperator] = useState('>');
  const [value, setValue] = useState('');

  // Fetch schema from upstream tools
  useEffect(() => {
    async function loadSchema() {
      try {
        setLoading(true);
        const result = await getToolSchema(tool.id, workflow);
        
        // Find the input socket's schema (usually socket 0)
        const inputSocketId = tool.sockets.find(s => s.direction === 'input')?.id;
        if (inputSocketId !== undefined) {
          // Get schema from output of upstream tool
          // (This requires knowing which tool feeds this one - from wires)
          const upstreamTool = findUpstreamTool(workflow, tool.id, inputSocketId);
          if (upstreamTool) {
            const upstreamSchema = await getToolSchema(upstreamTool.id, workflow);
            const upstreamOutput = Object.values(upstreamSchema.outputs)[0];
            setColumns(upstreamOutput.data_schema.columns);
          }
        }
      } catch (error) {
        console.error('Failed to load schema:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadSchema();
  }, [tool.id, workflow]);

  const handleBuildExpression = () => {
    // Build Polars expression
    const expression = `pl.col('${selectedColumn}') ${operator} ${value}`;
    onConfigChange({ expression });
  };

  if (loading) return <div>Loading columns...</div>;

  return (
    <div className="filter-config">
      <h3>Filter Rows</h3>
      
      {/* Column dropdown - populated from backend schema */}
      <div>
        <label>Column:</label>
        <select 
          value={selectedColumn} 
          onChange={(e) => setSelectedColumn(e.target.value)}
        >
          <option value="">Select column...</option>
          {columns.map(col => (
            <option key={col.name} value={col.name}>
              {col.name} ({col.dtype})
            </option>
          ))}
        </select>
      </div>

      {/* Operator dropdown - type-aware based on column type */}
      <div>
        <label>Operator:</label>
        <select value={operator} onChange={(e) => setOperator(e.target.value)}>
          {getOperatorsForType(
            columns.find(c => c.name === selectedColumn)?.dtype
          ).map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>

      {/* Value input */}
      <div>
        <label>Value:</label>
        <input 
          type="text" 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter value..."
        />
      </div>

      <button onClick={handleBuildExpression}>
        Apply Filter
      </button>

      {/* Show raw expression */}
      <div className="expression-preview">
        Expression: <code>pl.col('{selectedColumn}') {operator} {value}</code>
      </div>
    </div>
  );
}

function getOperatorsForType(dtype?: string) {
  if (!dtype) return ['>', '<', '==', '!='];
  
  if (dtype.includes('Int') || dtype.includes('Float')) {
    return ['>', '<', '>=', '<=', '==', '!='];
  }
  if (dtype === 'String') {
    return ['==', '!=', '.contains()', '.starts_with()', '.ends_with()'];
  }
  return ['==', '!='];
}

function findUpstreamTool(workflow: Workflow, toolId: string, inputSocketId: number) {
  // Find wire that connects to this tool's input socket
  const wire = workflow.wires.find(w => 
    w.to.tool === toolId && w.to.socket === inputSocketId
  );
  
  if (!wire) return null;
  
  return workflow.tools.find(t => t.id === wire.from.tool);
}
```

## Step 3: Add Preview Button

```typescript
// frontend/src/components/ToolPreview.tsx

import { useState } from 'react';
import { previewTool } from '../api/backend';

interface ToolPreviewProps {
  tool: Tool;
  workflow: Workflow;
}

export function ToolPreview({ tool, workflow }: ToolPreviewProps) {
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    try {
      setLoading(true);
      const result = await previewTool(tool.id, workflow, 100);
      
      // Get the first output socket's data
      const firstOutput = Object.values(result.outputs)[0];
      setPreviewData(firstOutput);
    } catch (error) {
      console.error('Preview failed:', error);
      alert(`Preview failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-preview">
      <button onClick={handlePreview} disabled={loading}>
        {loading ? 'Loading...' : 'Preview Data'}
      </button>

      {previewData && (
        <div className="preview-table">
          <h4>Preview Results ({previewData.row_count} rows)</h4>
          
          <table>
            <thead>
              <tr>
                {previewData.data_schema.columns.map(col => (
                  <th key={col.name}>
                    {col.name}
                    <span className="col-type">({col.dtype})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.data.map((row, idx) => (
                <tr key={idx}>
                  {previewData.data_schema.columns.map(col => (
                    <td key={col.name}>{row[col.name]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

## Step 4: Testing with cURL

Before integrating with frontend, test the API directly:

```bash
# 1. Create a test workflow JSON file
cat > test-workflow.json << 'EOF'
{
  "meta": {
    "name": "Test Workflow",
    "description": "Test",
    "author": "Test",
    "workflowId": "test-1",
    "created": "2024-01-01"
  },
  "tools": [
    {
      "id": "input1",
      "type": "Input",
      "x": 0,
      "y": 0,
      "config": {
        "category": "file",
        "type": "csv",
        "source": "/path/to/your/data.csv",
        "csvMode": "scan"
      },
      "sockets": [
        {"id": 0, "direction": "output", "type": "polars-lazy"}
      ]
    }
  ],
  "wires": []
}
EOF

# 2. Test schema endpoint
curl -X POST http://localhost:8000/api/tool/schema \
  -H "Content-Type: application/json" \
  -d @test-workflow.json

# Expected response:
# {
#   "tool_id": "input1",
#   "outputs": {
#     "0": {
#       "data_schema": {
#         "columns": [
#           {"name": "id", "dtype": "Int64", "nullable": true},
#           {"name": "name", "dtype": "String", "nullable": true},
#           ...
#         ]
#       }
#     }
#   }
# }

# 3. Test preview endpoint
curl -X POST http://localhost:8000/api/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_id": "input1",
    "workflow": ...,
    "preview_limit": 10
  }'
```

## Step 5: Integration Checklist

- [ ] Backend running on `http://localhost:8000`
- [ ] Can call schema endpoint and get column list
- [ ] Can call preview endpoint and get sample data
- [ ] Frontend uses schema to populate dropdowns
- [ ] Filter tool config UI works
- [ ] Preview button shows data in table
- [ ] Wire connections trigger schema refresh
- [ ] Expression builder uses available columns

## Troubleshooting

**CORS errors:**
Backend already configured to allow all origins in development. Check that backend is running on correct port.

**Schema not loading:**
Check browser console for errors. Verify workflow JSON structure matches backend models.

**Empty column list:**
Make sure upstream tool is connected via wire. Schema endpoint needs full workflow context.

**Preview fails:**
Check that file paths in Input tool config are absolute and accessible to backend.

## Next Steps

Once this basic integration works:
1. Add schema visualization on tool nodes
2. Build expression editor with syntax highlighting
3. Add type-aware validations
4. Implement Select tool config (column checklist)
5. Build Formula tool with column autocomplete

You now have everything needed to build rich, data-aware tool configuration UIs! 🎉
