# Frontend Integration Guide

## What the Backend Provides for Frontend Development

The backend exposes three critical endpoints that enable the frontend to continue building the workflow UI:

### 1. **Schema Endpoint** - Get Column Information Without Execution

**What it does:** Returns column names and types for any tool in the workflow without executing the entire workflow.

**Why frontend needs this:** When a user connects tools in the workflow builder, the UI needs to show available columns for downstream tool configuration (e.g., populating dropdown lists, validating column references).

**Endpoint:**
```http
POST /api/tool/schema
{
  "tool_id": "filter1",
  "workflow": { /* full workflow JSON */ }
}
```

**Response:**
```json
{
  "tool_id": "filter1",
  "outputs": {
    "1": {
      "data_schema": {
        "columns": [
          {
            "name": "id",
            "dtype": "Int64",
            "nullable": true
          },
          {
            "name": "name",
            "dtype": "String",
            "nullable": true
          },
          {
            "name": "age",
            "dtype": "Int64",
            "nullable": true
          }
        ],
        "row_count": null,
        "file_size_bytes": null
      }
    }
  }
}
```

**Frontend use cases:**
- User adds a Filter tool -> fetch schema from upstream Input tool -> populate column dropdown in Filter config UI
- User adds a Formula tool -> fetch schema -> show available columns for expression builder
- User adds a Select tool -> fetch schema -> show checkboxes for available columns
- User connects a wire -> validate that referenced columns exist

### 2. **Tool Preview Endpoint** - Execute Single Tool with Sample Data

**What it does:** Executes a specific tool and all its dependencies, returning preview data (limited rows).

**Why frontend needs this:** Users want to see sample data at each step to verify their workflow is correct.

**Endpoint:**
```http
POST /api/tool/execute
{
  "tool_id": "filter1",
  "workflow": { /* full workflow JSON */ },
  "preview_limit": 100
}
```

**Response:**
```json
{
  "results": {
    "filter1": {
      "1": {
        "columns": ["id", "name", "age", "salary", "department"],
        "data": [
          {"id": 3, "name": "Charlie", "age": 35, "salary": 70000.0, "department": "Sales"},
          {"id": 4, "name": "David", "age": 40, "salary": 80000.0, "department": "Engineering"}
        ],
        "row_count": 2
      }
    }
  }
}
```

**Frontend use cases:**
- User clicks "Preview" button on a tool -> show sample data in a table
- User modifies tool configuration -> re-fetch preview to see changes
- User wants to verify filter expression works correctly

### 3. **Workflow Execution Endpoint** - Execute Complete Workflow

**What it does:** Executes entire workflow (or up to a specific tool) and returns all results.

**Endpoint:**
```http
POST /api/workflow/execute
{
  "workflow": { /* full workflow JSON */ },
  "target_tool_id": null,  // null = execute all
  "preview_limit": 100
}
```

## Schema Propagation Example

Here's how schema flows through a workflow:

```
Input Tool (Load CSV)
  ↓ Outputs: {id, name, age, salary, department}
  
Filter Tool (age > 30)
  ↓ Outputs: {id, name, age, salary, department}  ← Schema unchanged
  
Select Tool (keep name, age, salary)
  ↓ Outputs: {name, age, salary}  ← Schema updated
  
Formula Tool (add bonus column)
  ↓ Outputs: {name, age, salary, bonus}  ← Schema updated
```

The frontend can call `POST /api/tool/schema` for any tool to get its output schema without executing the workflow.

## Frontend Development Workflow

### Step 1: User Adds Input Tool

```typescript
// User selects CSV file
const workflow = {
  tools: [
    {
      id: "input1",
      type: "Input",
      config: {
        category: "file",
        type: "csv",
        source: "/path/to/data.csv"
      }
    }
  ],
  wires: []
};

// Frontend calls schema endpoint
const response = await fetch("/api/tool/schema", {
  method: "POST",
  body: JSON.stringify({
    tool_id: "input1",
    workflow: workflow
  })
});

const { outputs } = await response.json();
const columns = outputs["0"].data_schema.columns;
// columns = [
//   {name: "id", dtype: "Int64", nullable: true},
//   {name: "name", dtype: "String", nullable: true},
//   ...
// ]
```

### Step 2: User Adds Filter Tool

```typescript
// User connects Input -> Filter
workflow.tools.push({
  id: "filter1",
  type: "Filter",
  config: {}  // Config not set yet
});
workflow.wires.push({
  from: { tool: "input1", socket: 0 },
  to: { tool: "filter1", socket: 0 }
});

// Frontend needs to populate expression builder
// Fetch schema to show available columns
const response = await fetch("/api/tool/schema", {
  method: "POST",
  body: JSON.stringify({
    tool_id: "filter1",
    workflow: workflow
  })
});

const { outputs } = await response.json();
const inputColumns = outputs["1"].data_schema.columns;

// Now frontend can:
// - Show column dropdown with [id, name, age, salary, department]
// - Show type-appropriate operators (>, <, = for numeric, contains for string)
// - Build expression: "age > 30"
```

### Step 3: User Previews Tool

```typescript
// User clicks "Preview" button
const response = await fetch("/api/tool/execute", {
  method: "POST",
  body: JSON.stringify({
    tool_id: "filter1",
    workflow: workflow,
    preview_limit: 100
  })
});

const { results } = await response.json();
const previewData = results["filter1"]["1"];

// Show in table:
// columns: [id, name, age, salary, department]
// data: [{id: 3, name: "Charlie", ...}, ...]
```

## Type System

The backend uses Polars data types that match your TypeScript enum:

| Backend (Polars) | Frontend (TypeScript) | Description |
|-----------------|---------------------|-------------|
| `Int64` | `Int64` | 64-bit integer |
| `Float64` | `Float64` | 64-bit float |
| `String` | `String` | UTF-8 string |
| `Boolean` | `Boolean` | Boolean |
| `Date` | `Date` | Date (no time) |
| `Datetime` | `Datetime` | Date + time |

## What Frontend Can Build Now

With these endpoints available, the frontend can:

**Tool Configuration UIs**
- Populate column dropdowns based on upstream tool schemas
- Show type-aware operators (numeric vs string)
- Validate column references before execution

**Expression Builders**
- Show available columns with types
- Suggest appropriate functions based on column type
- Build Polars expressions like `pl.col('age') > 30`

**Data Preview**
- Show sample data at any point in workflow
- Update preview as user modifies tool configuration
- Help users debug their workflows

**Schema Visualization**
- Show column badges on tool nodes
- Indicate schema changes (columns added/removed)
- Highlight type mismatches

## Next Steps for Frontend

1. **Implement Schema Fetching**
   - When user connects a wire, fetch schema for downstream tool
   - Cache schemas to avoid redundant requests
   - Update UI when schema changes

2. **Build Tool Configuration Panels**
   - Filter tool: column dropdown + expression builder
   - Select tool: column checklist
   - Formula tool: expression builder with available columns

3. **Add Preview Feature**
   - "Preview" button on each tool
   - Show results in modal or side panel
   - Update preview when config changes

4. **Wire Validation**
   - Check that source socket exists before connecting
   - Validate type compatibility (if needed)
   - Show error if invalid connection

## Testing the API

The backend is running on `http://localhost:8000`. You can test with:

```bash
# Start backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload

# Test schema endpoint
curl -X POST http://localhost:8000/api/tool/schema \
  -H "Content-Type: application/json" \
  -d @test-workflow.json
```

API documentation available at: http://localhost:8000/docs
