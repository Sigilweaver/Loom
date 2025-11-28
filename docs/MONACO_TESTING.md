# Monaco Editor and Tool Configuration Testing

## Overview

This document describes the comprehensive test suite created for the Monaco editor integration and tool-specific configuration components (Formula and Filter).

## Test Files Created

### 1. CodeEditor Component Tests
**File**: `frontend/src/components/common/__tests__/CodeEditor.test.tsx`

**Coverage**: 26 tests across 9 test suites

#### Test Categories:

- **Basic Rendering** (5 tests)
  - Default props rendering
  - Initial value display
  - Custom height support
  - Read-only mode
  - Placeholder functionality

- **Value Changes** (3 tests)
  - onChange callback functionality
  - Empty string handling
  - Dynamic value updates

- **Language Support** (2 tests)
  - Python default language
  - Custom language support

- **Column Autocomplete** (3 tests)
  - Column schema rendering
  - Empty columns handling
  - Dynamic column updates

- **Polars Functions** (3 tests)
  - Function loading and display
  - Null functions handling
  - Dynamic function updates

- **Combined Autocomplete** (1 test)
  - Column and function suggestions together

- **Theme Integration** (3 tests)
  - Light theme application
  - Dark theme application
  - Custom theme override

- **Edge Cases** (4 tests)
  - Very long values
  - Multiline expressions
  - Special characters
  - Rapid value changes

- **Cleanup** (2 tests)
  - Component unmounting
  - Rapid remounting

### 2. FormulaConfiguration Component Tests
**File**: `frontend/src/components/__tests__/FormulaConfiguration.test.tsx`

**Coverage**: 24 tests across 8 test suites

#### Test Categories:

- **Initial Rendering** (5 tests)
  - Formula tool UI display
  - Column name input
  - Expression editor
  - Examples section
  - Tips section

- **Config Value Display** (2 tests)
  - Existing column name value
  - Existing expression value

- **User Interactions** (3 tests)
  - Column name changes with emission tracking
  - Expression changes with emission tracking
  - Preserving existing emission values

- **Metadata Fetching** (4 tests)
  - Metadata fetch on mount
  - Metadata fetch on wire connection changes
  - Avoiding unnecessary refetches
  - Column passing to CodeEditor

- **Polars Functions** (3 tests)
  - Function fetch on mount
  - Avoiding redundant fetches
  - Function passing to CodeEditor

- **Edge Cases** (4 tests)
  - Undefined column_name handling
  - Undefined expression handling
  - Complex expressions with special characters
  - Multiline expressions

- **Required Field Indicators** (2 tests)
  - Column name required marker
  - Expression required marker

- **Cleanup** (1 test)
  - Component unmounting

### 3. FilterConfiguration Component Tests
**File**: `frontend/src/components/__tests__/FilterConfiguration.test.tsx`

**Coverage**: 33 tests across 9 test suites

#### Test Categories:

- **Initial Rendering** (4 tests)
  - Filter tool UI display
  - Expression editor
  - Examples section
  - Output sockets information

- **Config Value Display** (2 tests)
  - Existing expression value
  - Empty string for undefined expression

- **User Interactions** (4 tests)
  - Expression changes with emission tracking
  - Emission map updates
  - Preserving existing emission values
  - Rapid expression changes

- **Metadata Fetching** (6 tests)
  - Metadata fetch on mount
  - Metadata fetch on wire connection changes
  - Avoiding unnecessary refetches
  - Correct workflow data passing
  - Column passing to CodeEditor
  - Null metadata handling

- **Polars Functions** (3 tests)
  - Function fetch on mount
  - Avoiding redundant fetches
  - Function passing to CodeEditor

- **Expression Examples** (5 tests)
  - Comparison operators example
  - String equality example
  - Multiple conditions example
  - String contains example
  - Null check example

- **Edge Cases** (5 tests)
  - Undefined expression handling
  - Complex boolean expressions
  - Special characters in expressions
  - Multiline expressions
  - Very long expressions

- **Integration with Workflow** (2 tests)
  - Multiple wire connections
  - Empty workflow handling

- **Cleanup** (2 tests)
  - Component unmounting
  - Rapid remounting

## Test Infrastructure Updates

### Monaco Editor Mock
**File**: `frontend/src/test-setup.ts`

Added comprehensive Monaco Editor mocking that simulates:
- Editor mounting lifecycle
- Value changes
- Theme management
- Autocomplete provider registration
- Decoration collections
- Disposal patterns

The mock renders a textarea with `data-testid="monaco-editor"` for testing purposes while maintaining the Monaco API surface.

## Key Testing Patterns

### 1. Theme Provider Wrapping
All component tests wrap the component under test with `ThemeProvider` to ensure proper theme context:

```typescript
const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};
```

### 2. API Hook Mocking
Tests mock the `useMetadata` and `usePolarsFunctions` hooks to control:
- Loading states
- Error states
- Data availability
- Fetch triggering

### 3. Emission Tracking
Tests verify that the `_emit` map is correctly updated when configuration values change, ensuring proper serialization behavior.

### 4. Optimized Metadata Fetching
Tests verify that metadata is only refetched when:
- Component mounts
- Wire connections to the specific tool change
- Wire connections to other tools do NOT trigger refetch (optimization)

### 5. Type Safety
All test mocks use proper TypeScript types from the domain layer:
- `Tool` structure with `x`, `y`, `config`, `sockets`
- `Wire` structure without `id` field
- `WorkflowMeta` with required fields
- `PolarsFunction` with `category` field
- `MetadataResponse` with `tool_id` field

## Running the Tests

```bash
# Run all Monaco-related tests
npm test -- src/components/common/__tests__/CodeEditor.test.tsx \
             src/components/__tests__/FormulaConfiguration.test.tsx \
             src/components/__tests__/FilterConfiguration.test.tsx

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Test Results

All 83 tests pass successfully:
- ✓ CodeEditor: 26 tests
- ✓ FormulaConfiguration: 24 tests
- ✓ FilterConfiguration: 33 tests

## Future Enhancements

Potential areas for additional testing:

1. **Integration Tests**
   - Full workflow execution with Formula/Filter tools
   - End-to-end autocomplete behavior
   - Theme switching during editing

2. **Performance Tests**
   - Large column schema handling
   - Long expression editing
   - Rapid configuration changes

3. **Accessibility Tests**
   - Keyboard navigation in Monaco editor
   - Screen reader compatibility
   - Focus management

4. **Visual Regression Tests**
   - Monaco theme rendering
   - Configuration UI layout
   - Example code display

## Best Practices Demonstrated

1. **Isolation**: Each test is independent and doesn't rely on global state
2. **Clarity**: Test names clearly describe what is being tested
3. **Coverage**: Edge cases and error conditions are tested
4. **Maintainability**: Tests use helper functions and avoid duplication
5. **Type Safety**: All tests are fully typed with no `any` types
6. **Real-world Scenarios**: Tests simulate actual user interactions and workflows

## Related Documentation

- [Frontend Integration Guide](../backend/docs/FRONTEND_INTEGRATION.md)
- [Formula Tool MVP](../backend/docs/FORMULA_MVP.md)
- [Testing Strategy](TESTING_STRATEGY.md)
