/**
 * Comprehensive tests for Monaco editor completion provider logic
 * 
 * Tests all completion contexts:
 * 1. General context (empty/beginning) - shows columns wrapped in pl.col() and functions
 * 2. "pl." context - shows table-level functions (col, lit, when)
 * 3. "pl.col('..." context - shows column names inside quotes
 * 4. "pl.col('name')." context - shows column methods based on column dtype
 * 5. Operator context - shows comparison/logical operators after closing paren
 * 
 * Each test validates:
 * - Correct suggestions are provided
 * - insertText is correct for the context
 * - Range covers the correct characters
 * - Type-specific methods appear based on column dtype
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { CodeEditor } from '../CodeEditor';
import type { PolarsFunctionsResponse, ColumnSchema } from '../../../api/backend';
import type { languages, CancellationToken, editor, Position } from 'monaco-editor';
import type { OnMount } from '@monaco-editor/react';

// Comprehensive mock data matching backend response
const mockFunctions: PolarsFunctionsResponse = {
  table_level: [
    {
      name: 'pl.col',
      signature: 'pl.col(name: str)',
      description: 'Reference a column by name',
      snippet: "pl.col('${1:column_name}')",
      category: 'selection',
    },
    {
      name: 'pl.lit',
      signature: 'pl.lit(value)',
      description: 'Create a literal value',
      snippet: 'pl.lit(${1:value})',
      category: 'literals',
    },
    {
      name: 'pl.when',
      signature: 'pl.when(condition).then(value).otherwise(value)',
      description: 'Conditional expression (if-then-else)',
      snippet: 'pl.when(${1:condition}).then(${2:value}).otherwise(${3:value})',
      category: 'conditional',
    },
  ],
  column_methods: {
    all: [
      {
        name: '.is_null',
        signature: '.is_null()',
        description: 'Check if value is null',
        snippet: '.is_null()',
        category: 'null_handling',
      },
      {
        name: '.is_not_null',
        signature: '.is_not_null()',
        description: 'Check if value is not null',
        snippet: '.is_not_null()',
        category: 'null_handling',
      },
      {
        name: '.alias',
        signature: '.alias(name: str)',
        description: 'Rename the column',
        snippet: ".alias('${1:name}')",
        category: 'transformation',
      },
      {
        name: '.cast',
        signature: '.cast(dtype)',
        description: 'Convert to different data type',
        snippet: '.cast(pl.${1:Float64})',
        category: 'type_conversion',
      },
    ],
    string: [
      {
        name: '.str.to_uppercase',
        signature: '.str.to_uppercase()',
        description: 'Convert to uppercase',
        snippet: '.str.to_uppercase()',
        category: 'string_manipulation',
      },
      {
        name: '.str.to_lowercase',
        signature: '.str.to_lowercase()',
        description: 'Convert to lowercase',
        snippet: '.str.to_lowercase()',
        category: 'string_manipulation',
      },
      {
        name: '.str.contains',
        signature: '.str.contains(pattern: str)',
        description: 'Check if string contains pattern',
        snippet: ".str.contains('${1:pattern}')",
        category: 'string_search',
      },
      {
        name: '.str.split',
        signature: ".str.split(by: 'IntoExpr', *, inclusive: 'bool' = False) -> 'Expr'",
        description: 'Split the string by a substring',
        snippet: ".str.split('${1:by}')",
        category: 'string_split',
      },
    ],
    numeric: [
      {
        name: '.abs',
        signature: '.abs()',
        description: 'Absolute value',
        snippet: '.abs()',
        category: 'math',
      },
      {
        name: '.round',
        signature: '.round(decimals: int)',
        description: 'Round to decimal places',
        snippet: '.round(${1:2})',
        category: 'math',
      },
      {
        name: '.sqrt',
        signature: '.sqrt()',
        description: 'Square root',
        snippet: '.sqrt()',
        category: 'math',
      },
    ],
    datetime: [
      {
        name: '.dt.year',
        signature: '.dt.year()',
        description: 'Extract year',
        snippet: '.dt.year()',
        category: 'datetime_components',
      },
      {
        name: '.dt.month',
        signature: '.dt.month()',
        description: 'Extract month',
        snippet: '.dt.month()',
        category: 'datetime_components',
      },
    ],
    list: [
      {
        name: '.list.first',
        signature: '.list.first()',
        description: 'Get the first element of the list',
        snippet: '.list.first()',
        category: 'list_element',
      },
      {
        name: '.list.last',
        signature: '.list.last()',
        description: 'Get the last element of the list',
        snippet: '.list.last()',
        category: 'list_element',
      },
      {
        name: '.list.len',
        signature: '.list.len()',
        description: 'Get the length of the list',
        snippet: '.list.len()',
        category: 'list_aggregation',
      },
      {
        name: '.list.get',
        signature: '.list.get(index: int)',
        description: 'Get element at index',
        snippet: '.list.get(${1:0})',
        category: 'list_element',
      },
      {
        name: '.list.join',
        signature: ".list.join(separator: str = '')",
        description: 'Join list elements into a string',
        snippet: ".list.join('${1:,}')",
        category: 'list_combine',
      },
    ],
  },
};

// Mock columns with different data types
const mockColumns: ColumnSchema[] = [
  { name: 'id', dtype: 'Int64', nullable: false },
  { name: 'name', dtype: 'String', nullable: true },
  { name: 'age', dtype: 'Int64', nullable: false },
  { name: 'salary', dtype: 'Float64', nullable: true },
  { name: 'created_at', dtype: 'Datetime', nullable: false },
  { name: 'is_active', dtype: 'Boolean', nullable: false },
];

// Global spy for the provider registration
const registerCompletionItemProviderSpy = vi.fn(() => ({ dispose: vi.fn() }));

// Override the mock from test-setup.ts with our custom implementation
vi.mock('@monaco-editor/react', () => ({
  Editor: ({ onMount }: { onMount?: OnMount }) => {
    if (onMount) {
      const mockMonaco = {
        editor: {
          defineTheme: vi.fn(),
          setTheme: vi.fn(),
          createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
        },
        languages: {
          registerCompletionItemProvider: registerCompletionItemProviderSpy,
          CompletionItemKind: { Function: 1, Field: 2, Method: 3, Operator: 4 },
          CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        },
        Range: class {
          constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number
          ) {}
        },
        KeyCode: {
          Space: 10,
        },
      } as Parameters<OnMount>[1];
      const mockEditor = {
        updateOptions: vi.fn(),
        createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
        onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
        getValue: () => '',
        addCommand: vi.fn(),
        trigger: vi.fn(),
      } as unknown as Parameters<OnMount>[0];
      setTimeout(() => onMount(mockEditor, mockMonaco), 0);
    }
    return <div data-testid="monaco-editor-mock" />;
  },
  loader: { init: () => new Promise(() => {}) },
}));

describe('CodeEditor Completion Provider', () => {
  let provider: languages.CompletionItemProvider;
  const mockContext = { triggerKind: 0 } as languages.CompletionContext;
  const mockToken = { 
    isCancellationRequested: false, 
    onCancellationRequested: vi.fn() 
  } as unknown as CancellationToken;

  // Helper to create mock model with specific line content
  const createMockModel = (lineContent: string, _positionColumn: number): editor.ITextModel => {
    return {
      getLineContent: () => lineContent,
      getWordUntilPosition: (position: Position) => {
        const textBefore = lineContent.substring(0, position.column - 1);
        const match = textBefore.match(/[\w]+$/);
        const word = match ? match[0] : '';
        return {
          word,
          startColumn: position.column - word.length,
          endColumn: position.column,
        };
      },
    } as unknown as editor.ITextModel;
  };

  // Helper to setup editor and capture provider
  const setupEditor = async (
    columns: ColumnSchema[] = mockColumns,
    functions: PolarsFunctionsResponse | null = mockFunctions
  ) => {
    render(
      <ThemeProvider>
        <CodeEditor
          value=""
          onChange={() => {}}
          columns={columns}
          polarsFunctions={functions}
        />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(registerCompletionItemProviderSpy).toHaveBeenCalled();
    });

    const call = registerCompletionItemProviderSpy.mock.calls[0] as
      | [string, languages.CompletionItemProvider]
      | undefined;
    if (!call) throw new Error('No call to registerCompletionItemProvider');
    provider = call[1];
    return provider;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Context 1: General Context (empty/beginning)', () => {
    it('shows columns wrapped in pl.col() at empty input', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 1 } as Position;
      const model = createMockModel('', 1);

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have column suggestions
      const columnSuggestions = suggestions.filter(
        (s: languages.CompletionItem) => s.kind === 2 // Field
      );
      expect(columnSuggestions.length).toBe(mockColumns.length);

      // Each column should be wrapped in pl.col()
      const idSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'id'
      );
      expect(idSuggestion).toBeDefined();
      expect(idSuggestion!.insertText).toBe("pl.col('id')");
    });

    it('shows Polars functions with full prefix in general context', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 1 } as Position;
      const model = createMockModel('', 1);

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have function suggestions
      const colFunc = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'pl.col'
      );
      expect(colFunc).toBeDefined();
      expect(colFunc!.insertText).toBe("pl.col('${1:column_name}')");

      const litFunc = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'pl.lit'
      );
      expect(litFunc).toBeDefined();
      expect(litFunc!.insertText).toBe('pl.lit(${1:value})');
    });

    it('sorts columns before functions', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 1 } as Position;
      const model = createMockModel('', 1);

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Column sortText should start with 0_, function with 1_
      const idSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'id'
      );
      const colFunc = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'pl.col'
      );

      expect(idSuggestion?.sortText).toMatch(/^0_/);
      expect(colFunc?.sortText).toMatch(/^1_/);
    });
  });

  describe('Context 2: After "pl." - Table-level functions', () => {
    it('shows stripped function names after "pl."', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 4 } as Position;
      const model = {
        getLineContent: () => 'pl.',
        getWordUntilPosition: () => ({ word: '', startColumn: 4, endColumn: 4 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have stripped names (no "pl." prefix)
      const colSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'col'
      );
      expect(colSuggestion).toBeDefined();
      expect(colSuggestion!.insertText).toBe("col('${1:column_name}')");
    });

    it('handles partial typing after "pl." (e.g., "pl.co")', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 6 } as Position;
      const model = {
        getLineContent: () => 'pl.co',
        getWordUntilPosition: () => ({ word: 'co', startColumn: 4, endColumn: 6 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should still match pl. context and replace "co"
      const colSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'col'
      );
      expect(colSuggestion).toBeDefined();
      expect(colSuggestion!.range).toEqual({
        startLineNumber: 1,
        endLineNumber: 1,
        startColumn: 4,
        endColumn: 6,
      });
    });

    it('provides fallback functions when polarsFunctions is null', async () => {
      await setupEditor(mockColumns, null);
      const position = { lineNumber: 1, column: 4 } as Position;
      const model = {
        getLineContent: () => 'pl.',
        getWordUntilPosition: () => ({ word: '', startColumn: 4, endColumn: 4 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have fallback suggestions
      expect(suggestions.length).toBeGreaterThan(0);
      const colSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'col'
      );
      expect(colSuggestion).toBeDefined();
    });
  });

  describe('Context 3: Inside pl.col() quotes - Column names', () => {
    it('shows column names inside pl.col("...")', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 9 } as Position;
      const model = {
        getLineContent: () => 'pl.col("',
        getWordUntilPosition: () => ({ word: '', startColumn: 9, endColumn: 9 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have all column names
      expect(suggestions.length).toBe(mockColumns.length);
      
      // Each should insert just the name (no pl.col wrapper)
      const nameSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'name'
      );
      expect(nameSuggestion).toBeDefined();
      expect(nameSuggestion!.insertText).toBe('name');
      expect(nameSuggestion!.detail).toBe('Column: String');
    });

    it('shows column names with single quotes pl.col(\'...\')', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 9 } as Position;
      const model = {
        getLineContent: () => "pl.col('",
        getWordUntilPosition: () => ({ word: '', startColumn: 9, endColumn: 9 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      expect(suggestions.length).toBe(mockColumns.length);
    });

    it('shows nullable info in documentation', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 9 } as Position;
      const model = {
        getLineContent: () => "pl.col('",
        getWordUntilPosition: () => ({ word: '', startColumn: 9, endColumn: 9 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Nullable column should show "(nullable)"
      const nameSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'name'
      );
      expect(nameSuggestion?.documentation).toContain('(nullable)');

      // Non-nullable column should not
      const idSuggestion = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'id'
      );
      expect(idSuggestion?.documentation).not.toContain('(nullable)');
    });
  });

  describe('Context 4: After pl.col("name"). - Column methods', () => {
    it('shows "all" methods for any column type', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 16 } as Position;
      const model = {
        getLineContent: () => "pl.col('id').",
        getWordUntilPosition: () => ({ word: '', startColumn: 16, endColumn: 16 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have "all" methods
      const isNullMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'is_null'
      );
      expect(isNullMethod).toBeDefined();
      expect(isNullMethod!.insertText).toBe('is_null()');
    });

    it('shows string methods for String columns', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 18 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').",
        getWordUntilPosition: () => ({ word: '', startColumn: 18, endColumn: 18 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have string methods
      const upperMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.to_uppercase'
      );
      expect(upperMethod).toBeDefined();

      const containsMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.contains'
      );
      expect(containsMethod).toBeDefined();
    });

    it('shows numeric methods for Int64 columns', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 17 } as Position;
      const model = {
        getLineContent: () => "pl.col('age').",
        getWordUntilPosition: () => ({ word: '', startColumn: 17, endColumn: 17 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have numeric methods
      const absMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'abs'
      );
      expect(absMethod).toBeDefined();

      const roundMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'round'
      );
      expect(roundMethod).toBeDefined();
    });

    it('shows numeric methods for Float64 columns', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 20 } as Position;
      const model = {
        getLineContent: () => "pl.col('salary').",
        getWordUntilPosition: () => ({ word: '', startColumn: 20, endColumn: 20 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have numeric methods
      const sqrtMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'sqrt'
      );
      expect(sqrtMethod).toBeDefined();
    });

    it('shows datetime methods for Datetime columns', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 24 } as Position;
      const model = {
        getLineContent: () => "pl.col('created_at').",
        getWordUntilPosition: () => ({ word: '', startColumn: 24, endColumn: 24 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have datetime methods
      const yearMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'dt.year'
      );
      expect(yearMethod).toBeDefined();

      const monthMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'dt.month'
      );
      expect(monthMethod).toBeDefined();
    });

    it('does NOT show type-specific methods for wrong column types', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 16 } as Position;
      // Int64 column
      const model = {
        getLineContent: () => "pl.col('id').",
        getWordUntilPosition: () => ({ word: '', startColumn: 16, endColumn: 16 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should NOT have string methods for numeric column
      const strMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.to_uppercase'
      );
      expect(strMethod).toBeUndefined();

      // Should NOT have datetime methods for numeric column
      const dtMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'dt.year'
      );
      expect(dtMethod).toBeUndefined();
    });

    it('sorts "all" methods before type-specific methods', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 18 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').",
        getWordUntilPosition: () => ({ word: '', startColumn: 18, endColumn: 18 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      const allMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'is_null'
      );
      const stringMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.to_uppercase'
      );

      expect(allMethod?.sortText).toMatch(/^0_/);
      expect(stringMethod?.sortText).toMatch(/^1_/);
    });
  });

  describe('Context 3b: Method chaining - pl.col().method().', () => {
    it('shows methods after chained method call', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 40 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').str.to_lowercase().",
        getWordUntilPosition: () => ({ word: '', startColumn: 40, endColumn: 40 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have "all" methods
      const isNullMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'is_null'
      );
      expect(isNullMethod).toBeDefined();

      // Should have string methods because .str. is in the chain
      const containsMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.contains'
      );
      expect(containsMethod).toBeDefined();
    });

    it('detects .str. chain and provides string methods', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 40 } as Position;
      const model = {
        getLineContent: () => "pl.col('id').str.to_uppercase().",  // id is Int64 but .str. chain
        getWordUntilPosition: () => ({ word: '', startColumn: 40, endColumn: 40 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have string methods because .str. is in the chain (even if column is Int64)
      const strMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.to_lowercase'
      );
      expect(strMethod).toBeDefined();
    });

    it('detects .dt. chain and provides datetime methods', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 35 } as Position;
      const model = {
        getLineContent: () => "pl.col('id').dt.year().",  // id is Int64 but .dt. chain
        getWordUntilPosition: () => ({ word: '', startColumn: 35, endColumn: 35 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have datetime methods because .dt. is in the chain
      const dtMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'dt.month'
      );
      expect(dtMethod).toBeDefined();
    });

    it('handles deeply nested method chains', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 60 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').str.to_lowercase().str.contains('a').",
        getWordUntilPosition: () => ({ word: '', startColumn: 60, endColumn: 60 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should still provide methods after deep chain
      const aliasMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'alias'
      );
      expect(aliasMethod).toBeDefined();
    });

    it('handles column names with spaces in method chains', async () => {
      const spacedColumns: ColumnSchema[] = [
        { name: 'Winning Numbers', dtype: 'String', nullable: true },
      ];
      await setupEditor(spacedColumns, mockFunctions);
      
      const position = { lineNumber: 1, column: 55 } as Position;
      const model = {
        getLineContent: () => "pl.col('Winning Numbers').str.to_lowercase().",
        getWordUntilPosition: () => ({ word: '', startColumn: 55, endColumn: 55 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should provide string methods for the chain
      const containsMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.contains'
      );
      expect(containsMethod).toBeDefined();
    });

    it('does NOT show operators when ending with ).', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 40 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').str.to_lowercase().",
        getWordUntilPosition: () => ({ word: '', startColumn: 40, endColumn: 40 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should NOT have operators
      const eqOp = suggestions.find(
        (s: languages.CompletionItem) => s.label === '=='
      );
      expect(eqOp).toBeUndefined();
    });
  });

  describe('Context 3c: List method chains - pl.col().list.', () => {
    it('shows list methods after .list. chain', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 45 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').str.split(' ').list.",
        getWordUntilPosition: () => ({ word: '', startColumn: 45, endColumn: 45 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have list methods
      const firstMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'list.first'
      );
      expect(firstMethod).toBeDefined();

      const lenMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'list.len'
      );
      expect(lenMethod).toBeDefined();
    });

    it('shows list methods after split().list.get()', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 55 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').str.split(' ').list.get(0).",
        getWordUntilPosition: () => ({ word: '', startColumn: 55, endColumn: 55 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should still have list methods after a list method
      const lastMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'list.last'
      );
      expect(lastMethod).toBeDefined();
    });

    it('provides list.join for string concatenation', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 45 } as Position;
      const model = {
        getLineContent: () => "pl.col('name').str.split(' ').list.",
        getWordUntilPosition: () => ({ word: '', startColumn: 45, endColumn: 45 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      const joinMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'list.join'
      );
      expect(joinMethod).toBeDefined();
      expect(joinMethod!.insertText).toContain("join");
    });
  });

  describe('Context 5: After closing paren/quote - Operators', () => {
    it('shows operators after closing parenthesis', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 17 } as Position;
      const model = {
        getLineContent: () => "pl.col('age') ",
        getWordUntilPosition: () => ({ word: '', startColumn: 17, endColumn: 17 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have comparison operators
      const eqOp = suggestions.find(
        (s: languages.CompletionItem) => s.label === '=='
      );
      expect(eqOp).toBeDefined();
      expect(eqOp!.insertText).toBe(' == ');

      const gtOp = suggestions.find(
        (s: languages.CompletionItem) => s.label === '>'
      );
      expect(gtOp).toBeDefined();
    });

    it('shows logical operators', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 17 } as Position;
      const model = {
        getLineContent: () => "pl.col('age') ",
        getWordUntilPosition: () => ({ word: '', startColumn: 17, endColumn: 17 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      const andOp = suggestions.find(
        (s: languages.CompletionItem) => s.label === '&'
      );
      expect(andOp).toBeDefined();
      expect(andOp!.insertText).toBe(' & ');

      const orOp = suggestions.find(
        (s: languages.CompletionItem) => s.label === '|'
      );
      expect(orOp).toBeDefined();
    });

    it('shows arithmetic operators', async () => {
      await setupEditor();
      const position = { lineNumber: 1, column: 17 } as Position;
      const model = {
        getLineContent: () => "pl.col('age') ",
        getWordUntilPosition: () => ({ word: '', startColumn: 17, endColumn: 17 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      const addOp = suggestions.find(
        (s: languages.CompletionItem) => s.label === '+'
      );
      expect(addOp).toBeDefined();

      const mulOp = suggestions.find(
        (s: languages.CompletionItem) => s.label === '*'
      );
      expect(mulOp).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty columns array', async () => {
      render(
        <ThemeProvider>
          <CodeEditor
            value=""
            onChange={() => {}}
            columns={[]}
            polarsFunctions={mockFunctions}
          />
        </ThemeProvider>
      );

      // Should not register completion provider with no columns
      await new Promise(resolve => setTimeout(resolve, 50));
      // The provider should not be registered when columns is empty
      // (based on the implementation logic)
    });

    it('handles unknown column types gracefully', async () => {
      const unknownTypeColumns: ColumnSchema[] = [
        { name: 'custom', dtype: 'CustomType', nullable: false },
      ];
      await setupEditor(unknownTypeColumns, mockFunctions);
      
      const position = { lineNumber: 1, column: 20 } as Position;
      const model = {
        getLineContent: () => "pl.col('custom').",
        getWordUntilPosition: () => ({ word: '', startColumn: 20, endColumn: 20 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should still have "all" methods
      const allMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'is_null'
      );
      expect(allMethod).toBeDefined();

      // Should NOT have type-specific methods
      const strMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.to_uppercase'
      );
      expect(strMethod).toBeUndefined();
    });

    it('handles column names with special characters', async () => {
      const specialColumns: ColumnSchema[] = [
        { name: 'user_id', dtype: 'Int64', nullable: false },
        { name: 'first-name', dtype: 'String', nullable: true },
        { name: 'Total Amount', dtype: 'Float64', nullable: false },
      ];
      await setupEditor(specialColumns, mockFunctions);

      const position = { lineNumber: 1, column: 9 } as Position;
      const model = {
        getLineContent: () => "pl.col('",
        getWordUntilPosition: () => ({ word: '', startColumn: 9, endColumn: 9 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have all columns including ones with special chars
      expect(suggestions.length).toBe(3);
      
      const spaceName = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'Total Amount'
      );
      expect(spaceName).toBeDefined();
    });

    it('shows methods for columns with spaces in name', async () => {
      const specialColumns: ColumnSchema[] = [
        { name: 'Total Amount', dtype: 'Float64', nullable: false },
      ];
      await setupEditor(specialColumns, mockFunctions);

      const position = { lineNumber: 1, column: 26 } as Position;
      const model = {
        getLineContent: () => "pl.col('Total Amount').",
        getWordUntilPosition: () => ({ word: '', startColumn: 26, endColumn: 26 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have numeric methods for Float64
      const roundMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'round'
      );
      expect(roundMethod).toBeDefined();
    });

    it('shows methods for columns with hyphens in name', async () => {
      const specialColumns: ColumnSchema[] = [
        { name: 'first-name', dtype: 'String', nullable: false },
      ];
      await setupEditor(specialColumns, mockFunctions);

      const position = { lineNumber: 1, column: 23 } as Position;
      const model = {
        getLineContent: () => "pl.col('first-name').",
        getWordUntilPosition: () => ({ word: '', startColumn: 23, endColumn: 23 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have string methods for String
      const upperMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.to_uppercase'
      );
      expect(upperMethod).toBeDefined();
    });

    it('handles multiline expressions', async () => {
      await setupEditor();
      const position = { lineNumber: 2, column: 5 } as Position;
      const model = {
        getLineContent: () => '    ',
        getWordUntilPosition: () => ({ word: '', startColumn: 5, endColumn: 5 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should provide general context suggestions
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('recognizes Utf8 as string type', async () => {
      const utf8Columns: ColumnSchema[] = [
        { name: 'text', dtype: 'Utf8', nullable: false },
      ];
      await setupEditor(utf8Columns, mockFunctions);

      const position = { lineNumber: 1, column: 18 } as Position;
      const model = {
        getLineContent: () => "pl.col('text').",
        getWordUntilPosition: () => ({ word: '', startColumn: 18, endColumn: 18 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have string methods for Utf8 type
      const strMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'str.to_uppercase'
      );
      expect(strMethod).toBeDefined();
    });

    it('recognizes Date as datetime type', async () => {
      const dateColumns: ColumnSchema[] = [
        { name: 'birth_date', dtype: 'Date', nullable: false },
      ];
      await setupEditor(dateColumns, mockFunctions);

      const position = { lineNumber: 1, column: 24 } as Position;
      const model = {
        getLineContent: () => "pl.col('birth_date').",
        getWordUntilPosition: () => ({ word: '', startColumn: 24, endColumn: 24 }),
      } as unknown as editor.ITextModel;

      const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
      const suggestions = result?.suggestions ?? [];

      // Should have datetime methods for Date type
      const dtMethod = suggestions.find(
        (s: languages.CompletionItem) => s.label === 'dt.year'
      );
      expect(dtMethod).toBeDefined();
    });

    it('handles various UInt/Int types as numeric', async () => {
      const numericColumns: ColumnSchema[] = [
        { name: 'small', dtype: 'Int8', nullable: false },
        { name: 'medium', dtype: 'Int32', nullable: false },
        { name: 'unsigned', dtype: 'UInt64', nullable: false },
        { name: 'float32', dtype: 'Float32', nullable: false },
      ];
      await setupEditor(numericColumns, mockFunctions);

      for (const col of numericColumns) {
        const colNameLen = col.name.length;
        const position = { lineNumber: 1, column: 10 + colNameLen + 3 } as Position;
        const model = {
          getLineContent: () => `pl.col('${col.name}').`,
          getWordUntilPosition: () => ({ 
            word: '', 
            startColumn: 10 + colNameLen + 3, 
            endColumn: 10 + colNameLen + 3 
          }),
        } as unknown as editor.ITextModel;

        const result = await provider.provideCompletionItems(model, position, mockContext, mockToken);
        const suggestions = result?.suggestions ?? [];

        // Should have numeric methods
        const absMethod = suggestions.find(
          (s: languages.CompletionItem) => s.label === 'abs'
        );
        expect(absMethod).toBeDefined();
      }
    });
  });

  describe('Trigger Characters', () => {
    it('registers correct trigger characters', async () => {
      await setupEditor();
      
      // The provider should be registered for 'python' language
      expect(registerCompletionItemProviderSpy).toHaveBeenCalledWith(
        'python',
        expect.objectContaining({
          triggerCharacters: expect.arrayContaining(['.', '(', "'", '"']),
        })
      );
    });
  });
});
