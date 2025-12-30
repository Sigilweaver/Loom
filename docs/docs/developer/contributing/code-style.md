---
sidebar_position: 5
---

# Code Style

Formatting and style conventions. Most of these are enforced by tooling—follow the tools rather than memorizing rules.

## Automated Formatting

### Backend (Python)

```bash
# Format code
ruff format app/

# Lint and auto-fix
ruff check --fix app/

# Type check
mypy app/
```

Configuration lives in `pyproject.toml`. Ruff handles:
- Import sorting
- Line length (88 chars)
- Quote style (double)
- Trailing commas

### Frontend (TypeScript)

```bash
# Format and lint
npm run lint:fix

# Type check
npm run type-check
```

Configuration lives in `.eslintrc` and `tsconfig.json`. ESLint + Prettier handle:
- Import sorting
- Line length (100 chars)
- Quote style (single)
- Semicolons (required)
- Trailing commas (ES5)

## Naming Conventions

### Python

```python
# Modules: lowercase_with_underscores
my_tool.py

# Classes: PascalCase
class FilterTool:

# Functions/methods: lowercase_with_underscores
async def execute(self):
async def get_output_schema(self):

# Variables: lowercase_with_underscores
input_schema = ...
tool_config = ...

# Constants: UPPERCASE_WITH_UNDERSCORES
DEFAULT_PREVIEW_LIMIT = 100
```

### TypeScript

```typescript
// Files: PascalCase for components, camelCase for utilities
FilterConfig.tsx
workflowStore.ts

// Components: PascalCase
export function FilterConfig() {}

// Functions: camelCase
function handleChange() {}

// Variables: camelCase
const selectedTool = ...

// Constants: UPPERCASE_WITH_UNDERSCORES
const DEFAULT_LIMIT = 100;

// Types/Interfaces: PascalCase
interface ToolConfig {}
type SocketDirection = 'input' | 'output';
```

## Import Organization

### Python

```python
# Standard library
import logging
from pathlib import Path
from typing import Any

# Third-party
import polars as pl
from fastapi import APIRouter

# Local
from app.domain.tools.base import BaseTool
from app.api.models.common import DataSchema
```

Ruff sorts these automatically.

### TypeScript

```typescript
// React
import { useState, useEffect } from 'react';

// Third-party
import { v4 as uuidv4 } from 'uuid';

// Internal (@/ paths)
import { useWorkflowStore } from '@/state/workflowStore';
import { Tool } from '@/domain/workflow/entities/workflow';

// Relative
import { MyHelper } from './helpers';
```

## Comments

### When to Comment

```python
# Explain WHY, not WHAT
# The expression parser doesn't handle nested parentheses correctly,
# so we pre-process to flatten them.
expression = flatten_parens(expression)

# Document non-obvious business logic
# Polars requires at least one column in output; if user deselects all,
# we include the first column to avoid empty schema errors.
if not selected_columns:
    selected_columns = [input_schema.columns[0].name]
```

### When Not to Comment

```python
# Bad - states the obvious
# Increment counter
counter += 1

# Bad - should be a better variable name
# Get the user's age
x = user_data["age"]

# Good - self-documenting code
user_age = user_data["age"]
```

### Docstrings

```python
async def execute(
    self,
    config: dict[str, Any],
    inputs: dict[str, pl.LazyFrame]
) -> dict[str, pl.LazyFrame]:
    """
    Execute the filter transformation.

    Args:
        config: Tool configuration with 'expression' key
        inputs: Dict mapping socket ID to LazyFrame

    Returns:
        Dict with 'output-true' and 'output-false' LazyFrames

    Raises:
        ToolError: If expression is invalid
    """
```

Use docstrings for public APIs. Internal helpers can skip them if the signature is clear.

## File Organization

### Python Module

```python
"""Module docstring - one line description."""

# Imports (organized as above)

# Constants
DEFAULT_LIMIT = 100

# Exceptions (if module-specific)
class MyToolError(Exception):
    pass

# Main class/function
class MyTool:
    ...

# Helper functions (private, underscore prefix)
def _parse_expression(expr: str) -> ...:
    ...
```

### TypeScript Component

```typescript
// Imports

// Types (if component-specific)
interface Props {
  tool: Tool;
}

// Constants
const DEFAULT_VALUE = 0;

// Component
export function MyComponent({ tool }: Props) {
  // Hooks
  // Handlers
  // Render
}

// Helpers (if component-specific)
function formatValue(value: number): string {
  return value.toFixed(2);
}
```

## Error Messages

Write error messages for the user, not the developer:

```python
# Bad
raise ToolError("NoneType has no attribute 'columns'")

# Good
raise ToolError("No input connected. Connect a data source to the input socket.")

# Bad
raise ValidationError("Invalid regex")

# Good
raise ValidationError(
    f"Invalid filter expression: '{expression}'. "
    "Check for unmatched parentheses or invalid column names."
)
```

## Line Length

- Python: 88 characters (Black default)
- TypeScript: 100 characters

Break long lines logically:

```python
# Good
result = some_function(
    first_argument,
    second_argument,
    third_argument,
)

# Good
long_condition = (
    first_thing
    and second_thing
    and third_thing
)
```

```typescript
// Good
const result = someFunction(
  firstArgument,
  secondArgument,
  thirdArgument
);

// Good
const isValid =
  hasRequiredField &&
  passesValidation &&
  meetsCondition;
```

## Commit Messages

```
# Format
<type>: <description>

# Types
feat: Add new feature
fix: Bug fix
docs: Documentation only
refactor: Code change that neither fixes nor adds
test: Adding or updating tests
chore: Maintenance tasks

# Examples
feat: Add Pivot tool implementation
fix: Handle empty input in Filter tool
docs: Add backend patterns guide
refactor: Extract schema logic to helper
test: Add edge cases for Formula tool
```

Keep the first line under 72 characters. Add a blank line and more detail if needed.

## Pre-Commit Checks

Before committing, run:

```bash
# Backend
cd backend
ruff format app/
ruff check --fix app/
mypy app/
pytest

# Frontend
cd frontend
npm run lint:fix
npm run type-check
npm test
```

Or use the script:

```bash
./scripts/test.sh
```

If this passes, your code meets style requirements.

---

Next: [Testing Philosophy](../testing/philosophy).
