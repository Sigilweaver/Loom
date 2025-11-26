# Testing Strategy

## Philosophy: "Test the Bones, Not the Skin"

Sigilweaver's testing philosophy prioritizes testing **core business logic** and **data transformations** over UI presentation. This approach recognizes that during active development, the UI ("skin") changes frequently, while the underlying data processing engine ("bones") must remain stable and correct.

### What We Test Heavily

**Backend (Python) - 1,745 lines of test code across 8 test files:**
- **Execution Engine** (`test_execution.py`): Graph topology, execution order, cycle detection, dependency resolution
- **Tool Implementations** (`test_formula.py`, `test_filter.py`, `test_output.py`, `test_parquet.py`): Data transformations, schema inference, config validation
- **Data Sources** (`test_datasources.py`): File type detection, datasource factory, format support
- **Integration Workflows** (`test_integration.py`): End-to-end workflows demonstrating frontend requirements (schema propagation, preview data)
- **Data Models** (`test_models.py`): Pydantic validation, serialization/deserialization

**Frontend (TypeScript) - 9,835 lines of test code across ~173 test files:**
- **Domain Logic** (`src/domain/**/__tests__/`):
  - `WorkflowSerializer.test.ts`: JSON serialization/deserialization, round-trip integrity, validation
  - `loopDetection.test.ts`: Cycle detection algorithms, graph validation
- **State Management** (`src/state/__tests__/`):
  - `workflowStore.test.ts`: Tool/wire CRUD operations, workflow loading, edge synchronization
  - `historyStore.test.ts`: Undo/redo stack management, state snapshots
  - `clipboardStore.test.ts`: Copy/paste operations, multi-tool clipboard
  - `uiStore.test.ts`: UI state (minimap, snap-to-grid, notifications)
  - `store-integration.test.ts`: Cross-store interactions
- **Utility Functions** (`src/utils/__tests__/`):
  - `HistoryManager.test.ts`: Generic undo/redo implementation
  - `id.test.ts`: ID generation and validation
  - `alignDistribute.test.ts`: Canvas alignment algorithms
  - `menuPositioning.test.ts`: Context menu placement
  - `themeColors.test.ts`: Theme color resolution
- **Configuration Primitives** (`src/components/primitives/__tests__/`):
  - `ConfigText.test.tsx`: Text input validation, emission logic
  - `ConfigSelect.test.tsx`: Dropdown selection, multi-select
  - `ConfigNumberRange.test.tsx`: Numeric validation, range constraints
  - `ConfigBoolean.test.tsx`: Checkbox state management
- **Theme System** (`src/themes/__tests__/`):
  - `theme.integrity.test.ts`: Theme structure validation
  - `theme.brand.constants.test.ts`: Brand color consistency

### What We Test Lightly

- **React Component Rendering**: Limited to critical components (`ToolPalette`, `DataTable`, `LogViewer`)
- **UI Layout**: Not systematically tested - visual polish is iterative
- **Styling**: No snapshot tests for CSS/Tailwind classes
- **Electron Integration**: Manual testing only (file dialogs, IPC)
- **Visual Appearance**: Verified manually during development

### Why This Approach?

1. **Stability Where It Matters**: Data transformations and workflow execution must be bulletproof - these are hard to debug in production
2. **Flexibility Where Needed**: UI can evolve rapidly without breaking tests
3. **Development Velocity**: Avoids brittle snapshot tests that break on every UI tweak
4. **ROI Focus**: More value from testing graph algorithms than button colors
5. **Early-Stage Pragmatism**: UI polish comes later; correctness comes first

## Testing Infrastructure

### Backend (pytest)

**Framework**: pytest 7.4+ with pytest-asyncio for async tool execution

**Test Organization**:
```
backend/tests/
├── conftest.py              # Fixtures (FastAPI client, sample CSV)
├── fixtures/
│   └── sample.csv           # Shared test data
├── test_execution.py        # Execution graph tests
├── test_formula.py          # Formula tool tests
├── test_filter.py           # Filter tool tests
├── test_output.py           # Output tool tests
├── test_parquet.py          # Parquet datasource tests
├── test_datasources.py      # Datasource factory tests
├── test_integration.py      # E2E workflow tests
└── test_models.py           # Pydantic model tests
```

**Running Backend Tests**:
```bash
# All tests
./scripts/test_backend.sh
# or from backend/
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific file
pytest tests/test_formula.py -v

# Specific test
pytest tests/test_formula.py::test_formula_arithmetic -v
```

**Key Backend Test Patterns**:

1. **Tool Execution Tests**: Verify correct data transformations
```python
@pytest.mark.asyncio
async def test_formula_arithmetic():
    tool = FormulaTool()
    df = pl.LazyFrame({"price": [10, 20, 30], "quantity": [2, 3, 4]})
    config = {
        "column_name": "total",
        "expression": "pl.col('price') * pl.col('quantity')",
    }
    result = await tool.execute(config, {0: df})
    output = result[1].collect()
    assert output["total"].to_list() == [20, 60, 120]
```

2. **Schema Propagation Tests**: Ensure schema inference works without execution
```python
async def test_formula_schema_inference():
    tool = FormulaTool()
    input_schema = DataSchema(columns=[...])
    config = {"column_name": "total", "expression": "..."}
    result = await tool.get_output_schema(config, {0: input_schema})
    assert "total" in [col.name for col in result[1].columns]
```

3. **Graph Topology Tests**: Validate execution order and cycle detection
```python
def test_cycle_detection():
    workflow = Workflow(tools=[...], wires=[...])  # A -> B -> C -> A
    graph = ExecutionGraph(workflow)
    with pytest.raises(ValidationError, match="cycle"):
        graph.execution_order()
```

### Frontend (Vitest)

**Framework**: Vitest 1.0+ with React Testing Library for component tests

**Test Organization**:
```
frontend/src/
├── domain/workflow/services/__tests__/
│   ├── WorkflowSerializer.test.ts
│   ├── WorkflowSerializer.integration.test.ts
│   └── loopDetection.test.ts
├── state/__tests__/
│   ├── workflowStore.test.ts
│   ├── workflowStore.crud.test.ts
│   ├── historyStore.test.ts
│   ├── clipboardStore.test.ts
│   ├── uiStore.test.ts
│   ├── uiStore.defaults.test.ts
│   └── store-integration.test.ts
├── utils/__tests__/
│   ├── HistoryManager.test.ts
│   ├── id.test.ts
│   ├── alignDistribute.test.ts
│   ├── menuPositioning.test.ts
│   └── themeColors.test.ts
├── components/
│   ├── __tests__/                    # Component tests (light coverage)
│   │   ├── ToolPalette.accessibility.test.tsx
│   │   ├── DataTable.test.tsx
│   │   └── LogViewer.test.tsx
│   └── primitives/__tests__/         # Config component tests (heavy coverage)
│       ├── ConfigText.test.tsx
│       ├── ConfigSelect.test.tsx
│       ├── ConfigNumberRange.test.tsx
│       └── ConfigBoolean.test.tsx
├── themes/__tests__/
│   ├── theme.integrity.test.ts
│   └── theme.brand.constants.test.ts
└── api/__tests__/
    ├── backend.test.ts
    └── backend.integration.test.ts
```

**Running Frontend Tests**:
```bash
# All unit tests (excludes integration)
./scripts/test_frontend.sh
# or from frontend/
npm test

# Integration tests only
./scripts/test_integration.sh
# or from frontend/
npm run test:integration

# All tests (unit + integration)
npm run test:all

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Specific file
npm test -- src/domain/workflow/services/__tests__/WorkflowSerializer.test.ts
```

**Key Frontend Test Patterns**:

1. **Domain Logic Tests**: Pure TypeScript, no React
```typescript
it('should serialize workflow to JSON', () => {
  const tools = [createTestTool("tool1", "csv")];
  const wires = [createTestWire("tool1", 0, "tool2", 0)];
  const json = WorkflowSerializer.toJSON(tools, wires, meta);
  const parsed = JSON.parse(json);
  expect(parsed.tools).toHaveLength(1);
});
```

2. **State Management Tests**: Zustand store operations
```typescript
test('addTool updates state correctly', () => {
  const tool = createTestTool();
  useWorkflowStore.getState().addTool(tool);
  const state = useWorkflowStore.getState();
  expect(state.tools).toContainEqual(tool);
});
```

3. **Config Component Tests**: User input validation and emission
```typescript
it('emits trimmed values when valid', async () => {
  const handleChange = vi.fn();
  render(<ConfigText value="" onChange={handleChange} trim />);
  fireEvent.change(input, { target: { value: "  Hello  " } });
  await waitFor(() => {
    expect(handleChange).toHaveBeenCalledWith("Hello", {...}, true);
  });
});
```

## Test Coverage Goals

### Backend Coverage (Current: ~85%)
- **High Priority (>90%)**:
  - Tool implementations (`app/domain/tools/implementations/`)
  - Execution engine (`app/domain/execution/`)
  - Datasource implementations (`app/domain/datasources/`)
- **Medium Priority (>70%)**:
  - API routes (`app/api/routes/`)
  - Utility functions (`app/utils/`)
- **Low Priority (<50%)**:
  - Config files (`app/config.py`)
  - Type mappings (`app/utils/type_mapping.py`)

### Frontend Coverage (Current: ~65%)
- **High Priority (>80%)**:
  - Domain logic (`src/domain/`)
  - State stores (`src/state/`)
  - Utility functions (`src/utils/`)
- **Medium Priority (>60%)**:
  - Config primitives (`src/components/primitives/`)
  - API client (`src/api/`)
- **Low Priority (<40%)**:
  - UI components (`src/components/`)
  - Electron integration (`electron/`)

## Continuous Integration

**GitHub Actions** (`.github/workflows/test.yml`):
- Runs on every push and pull request
- Backend: pytest with coverage reports
- Frontend: vitest with coverage reports
- Fails build if critical tests fail

**Pre-commit Checks** (Manual, via scripts):
```bash
# Verify all tests pass
./scripts/test.sh

# Backend only
./scripts/test_backend.sh

# Frontend only  
./scripts/test_frontend.sh
```

## Test Data Management

**Backend**: Fixtures in `backend/tests/fixtures/`
- `sample.csv`: Standard test dataset (5 rows, mixed types)
- Temporary files: pytest's `tmp_path` fixture for output tests

**Frontend**: Inline test data
- Mock tools/wires/workflows created in test files
- No external fixtures (keeps tests self-contained)

## When to Write Tests

### Always Write Tests For:
1. **New Tool Implementations**: Execution logic, schema inference, config validation
2. **State Management Changes**: Store mutations, cross-store interactions
3. **Domain Logic**: Serialization, graph algorithms, utility functions
4. **Bug Fixes**: Add regression test before fixing

### Optional Tests For:
1. **UI Components**: Only if critical or complex (e.g., DataTable pagination)
2. **Styling Changes**: Manual verification sufficient
3. **One-off Scripts**: Development tools don't need tests

## Test Maintenance

### Red Flags (Tests to Fix/Remove):
- **Flaky Tests**: Intermittent failures indicate timing issues or missing test isolation
- **Brittle Snapshot Tests**: Break on every UI change - avoid or use sparingly
- **Overlapping Coverage**: Multiple tests for same logic - consolidate
- **Dead Tests**: Tests for removed features - delete immediately

### Refactoring Tests:
- **Extract Test Helpers**: Reuse tool/wire/workflow creation logic
- **Use Fixtures**: Backend pytest fixtures for shared setup
- **Mock External Dependencies**: Don't test Polars internals, just our usage
- **Keep Tests Fast**: Avoid slow I/O when possible (prefer in-memory operations)

## Future Improvements

**Post v1.0 (After Launch)**:
1. **E2E Tests**: Playwright/Cypress for full user workflows (create workflow → execute → export)
2. **Performance Benchmarks**: Test execution speed on large datasets
3. **Accessibility Tests**: Automated WCAG 2.1 AA compliance checks
4. **Visual Regression**: Screenshot comparison for critical UI components
5. **Load Testing**: Backend stress tests with concurrent requests

**Long-Term**:
1. **Property-Based Testing**: Hypothesis (Python) / fast-check (TS) for edge cases
2. **Mutation Testing**: Verify test quality with mutation coverage
3. **Contract Testing**: API contract tests between frontend/backend
4. **Chaos Engineering**: Test error recovery and resilience

## Resources

**Backend Testing**:
- [pytest documentation](https://docs.pytest.org/)
- [pytest-asyncio documentation](https://pytest-asyncio.readthedocs.io/)
- [Polars testing patterns](https://pola-rs.github.io/polars/py-polars/html/reference/testing.html)

**Frontend Testing**:
- [Vitest documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Zustand testing guide](https://docs.pmnd.rs/zustand/guides/testing)

**Test Design**:
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) (many unit, few integration, minimal E2E)
- [Given-When-Then](https://martinfowler.com/bliki/GivenWhenThen.html) pattern for test structure
- [Arrange-Act-Assert](https://automationpanda.com/2020/07/07/arrange-act-assert-a-pattern-for-writing-good-tests/) pattern
