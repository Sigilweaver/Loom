---
sidebar_position: 2
---

# Adding Tools

Adding a new tool is the most common contribution to Sigilweaver. This guide walks through the complete process: Server (where the transformation happens) and Studio (where the UI lives).

## Overview

A tool requires changes in two places:

| Location | What | Why |
|----------|------|-----|
| Server | `BaseTool` implementation | Actual data transformation |
| Studio | Tool definition + config panel | UI and user configuration |

The `type` string must match exactly between them. If Server has `@register_tool("MyTool")`, Studio needs `type: 'MyTool'`.

## Step 1: Server Implementation

Create a new file in `server/app/domain/tools/implementations/`:

```python
# server/app/domain/tools/implementations/my_tool.py

from typing import Any
import polars as pl

from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.api.models.common import DataSchema


@register_tool("MyTool")
class MyTool(BaseTool):
    """Brief description of what this tool does."""
    
    # engine defaults to "sigilweaver/polars" from BaseTool.
    # Override for non-Polars tools: engine = "contrib/dbt"

    async def execute(
        self,
        config: dict[str, Any],
        inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """Execute the transformation."""
        lf = inputs["input"]  # Input from socket "input"
        
        # Your transformation logic (keep it lazy!)
        min_age = config.get("min_age", 0)
        result = lf.filter(pl.col("age") > min_age)
        
        return {"output": result}  # Output to socket "output"

    async def get_output_schema(
        self,
        config: dict[str, Any],
        input_schemas: dict[str, DataSchema]
    ) -> dict[str, DataSchema]:
        """Return output schema without execution."""
        # For filters, schema passes through unchanged
        return {"output": input_schemas["input"]}
    
    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate configuration. Return error messages."""
        errors = []
        if config.get("min_age", 0) < 0:
            errors.append("min_age cannot be negative")
        return errors
```

### Register the Tool

Add an import to `server/app/domain/tools/implementations/__init__.py`:

```python
from app.domain.tools.implementations.my_tool import MyTool
```

And add it to the `__all__` list in the same file. The import triggers the `@register_tool` decorator, adding it to the registry.

### Key Server Rules

1. **Keep it lazy.** Never call `.collect()` in tools. The executor handles materialization.

2. **Socket IDs are strings.** Match them exactly with the Studio definition.

3. **Schema propagation matters.** `get_output_schema()` enables column dropdowns in the UI without running the whole pipeline.

4. **Validate config.** Return helpful error messages for invalid configurations.

## Step 2: Studio Definition

Add the tool to `studio/src/data/tools.ts`:

```typescript
import { Wrench } from 'lucide-react';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ... existing tools
  {
    type: 'MyTool',           // Must match @register_tool("MyTool")
    name: 'My Tool',          // Display name in UI
    icon: Wrench,             // Lucide icon component
    category: 'preparation',  // inout | preparation | join | aggregate
    defaultConfig: {
      min_age: 0,
    },
    sockets: [
      { id: 'input', direction: 'input' },
      { id: 'output', direction: 'output' },
    ],
  },
];
```

### Create a Config Panel

If your tool needs custom configuration UI, create a config panel in the appropriate category directory:

```typescript
// studio/src/components/config/prepare/MyToolConfiguration.tsx

import { useToolConfiguration } from '@/hooks/useToolConfiguration';
import { CommonSockets } from '@domain/workflow/constants/socketIds';

interface Props {
  toolId: string;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function MyToolConfiguration({ toolId, config, onChange, tools, wires, workflowMeta }: Props) {
  const { columns, loading, hasInput, updateField } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Minimum Age</span>
        <input
          type="number"
          value={config.min_age ?? 0}
          onChange={(e) => updateField('min_age', Number(e.target.value))}
          className="mt-1 block w-full rounded border px-3 py-2"
          disabled={!hasInput || loading}
        />
      </label>
    </div>
  );
}
```

Then register it in `studio/src/data/toolConfigComponents.tsx`:

```typescript
import { MyToolConfiguration } from '@/components/config/prepare/MyToolConfiguration';

// Add to the TOOL_CONFIG_REGISTRY:
export const TOOL_CONFIG_REGISTRY: Record<string, ToolConfigEntry> = {
  // ... existing entries
  MyTool: { component: MyToolConfiguration },
};
```

### Simple Tools

For tools with simple config (just a text input or toggle), you may not need a custom panel. The generic config panel can handle basic fields.

## Step 3: Write Tests

### Server Tests

Create `server/tests/test_my_tool.py`:

```python
import pytest
import polars as pl

from app.domain.tools.implementations.my_tool import MyTool


@pytest.fixture
def sample_df():
    return pl.LazyFrame({
        "name": ["Alice", "Bob", "Charlie"],
        "age": [25, 35, 45]
    })


@pytest.mark.asyncio
async def test_my_tool_filters_correctly(sample_df):
    tool = MyTool()
    config = {"min_age": 30}
    result = await tool.execute(config, {"input": sample_df})
    
    df = result["output"].collect()
    assert len(df) == 2
    assert set(df["name"].to_list()) == {"Bob", "Charlie"}


@pytest.mark.asyncio
async def test_my_tool_schema_passthrough(sample_df):
    tool = MyTool()
    input_schema = DataSchema(columns=[
        ColumnInfo(name="name", dtype="String", nullable=True),
        ColumnInfo(name="age", dtype="Int64", nullable=False),
    ])
    
    result = await tool.get_output_schema(
        {"min_age": 30},
        {"input": input_schema}
    )
    
    assert result["output"] == input_schema


@pytest.mark.asyncio
async def test_my_tool_validates_config():
    tool = MyTool()
    errors = await tool.validate_config({"min_age": -5})
    assert len(errors) == 1
    assert "negative" in errors[0]
```

### Studio Tests

Create `studio/src/components/config/prepare/__tests__/MyToolConfiguration.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MyToolConfiguration } from '../MyToolConfiguration';

describe('MyToolConfiguration', () => {
  const defaultProps = {
    toolId: 'test-1',
    config: { min_age: 10 },
    onChange: vi.fn(),
    tools: [],
    wires: [],
    workflowMeta: { name: 'Test', defaultEngine: 'sigilweaver/polars' },
  };

  it('renders current value', () => {
    render(<MyToolConfiguration {...defaultProps} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(10);
  });

  it('calls onChange when value changes', () => {
    const onChange = vi.fn();
    render(<MyToolConfiguration {...defaultProps} onChange={onChange} />);
    
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } });
    expect(onChange).toHaveBeenCalled();
  });
});
```

## Step 4: Verify Everything Works

```bash
# Server tests
cd server && uv run pytest tests/test_my_tool.py -v

# Studio tests
cd studio && npm test MyToolConfig

# Full test suite
./scripts/test.py

# Manual testing
./scripts/dev.py
# Then drag your tool onto the canvas and verify it works
```

## Common Patterns

### Multiple Inputs

For tools like Join that take multiple inputs:

```python
# Backend
sockets = [
    { id: 'left', direction: 'input' },
    { id: 'right', direction: 'input' },
    { id: 'output', direction: 'output' },
]

async def execute(self, config, inputs):
    left_lf = inputs["left"]
    right_lf = inputs["right"]
    # Join logic...
```

### Multiple Outputs

For tools like Filter that split data:

```python
# Backend
sockets = [
    { id: 'input', direction: 'input' },
    { id: 'output-true', direction: 'output', type: 'T' },
    { id: 'output-false', direction: 'output', type: 'F' },
]

async def execute(self, config, inputs):
    lf = inputs["input"]
    true_result = lf.filter(condition)
    false_result = lf.filter(~condition)
    return {
        "output-true": true_result,
        "output-false": false_result,
    }
```

### Schema Changes

For tools that add or remove columns:

```python
async def get_output_schema(self, config, input_schemas):
    schema = input_schemas["input"]
    # Add a new column
    new_columns = schema.columns + [
        ColumnInfo(name="new_col", dtype="Float64", nullable=True)
    ]
    return {"output": DataSchema(columns=new_columns)}
```

## Checklist

Before submitting a PR for a new tool:

- [ ] Backend implementation with `@register_tool`
- [ ] Registered in `__init__.py`
- [ ] Frontend definition in `tools.ts`
- [ ] Config panel (if needed)
- [ ] Server tests
- [ ] Studio tests (if config panel)
- [ ] Manual testing via UI
- [ ] All existing tests still pass

---

Next: [Studio Patterns](./studio) or [Server Patterns](./server) for more detailed conventions.
