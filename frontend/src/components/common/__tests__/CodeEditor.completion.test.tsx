import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { CodeEditor } from '../CodeEditor';
import type { PolarsFunctionsResponse } from '../../../api/backend';
import type { languages } from 'monaco-editor';

// Mock data
const mockFunctions: PolarsFunctionsResponse = {
  table_level: [
    {
      name: 'pl.col',
      signature: 'pl.col(name: str)',
      description: 'Reference a column',
      snippet: "pl.col('${1}')",
      category: 'table',
    },
  ],
  column_methods: {
    all: [],
    string: [],
    numeric: [],
    datetime: [],
  },
};

// Global spy for the provider registration
const registerCompletionItemProviderSpy = vi.fn(() => ({ dispose: vi.fn() }));

// Override the mock from test-setup.ts
vi.mock('@monaco-editor/react', () => ({
  Editor: ({ onMount }: any) => {
    // Call onMount immediately with our mock monaco
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
          constructor(public startLineNumber: number, public startColumn: number, public endLineNumber: number, public endColumn: number) {}
        },
      };
      const mockEditor = {
        updateOptions: vi.fn(),
        createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
        onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
        getValue: () => '',
      };
      // Execute onMount asynchronously to simulate real behavior and allow render to finish
      setTimeout(() => onMount(mockEditor, mockMonaco), 0);
    }
    return <div data-testid="monaco-editor-mock" />;
  },
}));

describe('CodeEditor Completion Logic', () => {
  let provider: any;
  
  // Helper to setup the test environment and capture the provider
  const setupEditor = async () => {
    render(
      <ThemeProvider>
        <CodeEditor 
          value="" 
          onChange={() => {}} 
          polarsFunctions={mockFunctions}
          columns={[{ name: 'dummy', dtype: 'Int64', nullable: false }]}
        />
      </ThemeProvider>
    );

    // Wait for onMount to fire and register the provider
    await waitFor(() => {
      expect(registerCompletionItemProviderSpy).toHaveBeenCalled();
    });

    // Get the provider from the last call
    const call = registerCompletionItemProviderSpy.mock.calls[0];
    if (!call || call.length < 2) throw new Error('No call to registerCompletionItemProvider');
    provider = call[1];
    return provider;
  };

  // Helper to mock the model state
  const createMockModel = (lineContent: string, positionColumn: number) => {
    return {
      getLineContent: () => lineContent,
      getWordUntilPosition: () => {
        // Simple word extraction logic for testing
        const textBefore = lineContent.substring(0, positionColumn - 1);
        const match = textBefore.match(/[\w]+$/);
        const word = match ? match[0] : '';
        return {
          word,
          startColumn: positionColumn - word.length,
          endColumn: positionColumn,
        };
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles "pl" prefix correctly (General Context)', async () => {
    const provider = await setupEditor();
    const position = { lineNumber: 1, column: 3 }; // After "pl"
    const model = createMockModel('pl', 3);

    const result = provider.provideCompletionItems(model, position);
    const suggestions = result.suggestions;

    // Find pl.col suggestion
    const colSuggestion = suggestions.find((s: languages.CompletionItem) => s.label === 'pl.col');
    expect(colSuggestion).toBeDefined();

    // Verify insertText includes "pl." because we are replacing the word "pl"
    expect(colSuggestion.insertText).toBe("pl.col('${1}')");

    // Verify range covers "pl"
    expect(colSuggestion.range).toEqual({
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 1, // Start of "pl"
      endColumn: 3,   // End of "pl"
    });

    // Resulting edit: "pl" -> "pl.col('${1}')" (Correct)
  });

  it('handles "pl." prefix correctly (Dot Context)', async () => {
    const provider = await setupEditor();
    const position = { lineNumber: 1, column: 4 }; // After "pl."
    // Monaco's getWordUntilPosition usually stops at dot, so word is empty or just after dot
    const model = {
      getLineContent: () => 'pl.',
      getWordUntilPosition: () => ({
        word: '',
        startColumn: 4,
        endColumn: 4,
      }),
    };

    const result = provider.provideCompletionItems(model, position);
    const suggestions = result.suggestions;

    // Find col suggestion (stripped name)
    const colSuggestion = suggestions.find((s: languages.CompletionItem) => s.label === 'col');
    expect(colSuggestion).toBeDefined();

    // Verify insertText DOES NOT include "pl."
    expect(colSuggestion.insertText).toBe("col('${1}')");

    // Verify range is at cursor (empty)
    expect(colSuggestion.range).toEqual({
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 4,
      endColumn: 4,
    });

    // Resulting edit: "pl." + "col('${1}')" -> "pl.col('${1}')" (Correct)
  });

  it('handles "pl.c" prefix correctly (Dot + Char Context)', async () => {
    const provider = await setupEditor();
    const position = { lineNumber: 1, column: 5 }; // After "pl.c"
    // Word is "c"
    const model = {
      getLineContent: () => 'pl.c',
      getWordUntilPosition: () => ({
        word: 'c',
        startColumn: 4,
        endColumn: 5,
      }),
    };

    const result = provider.provideCompletionItems(model, position);
    const suggestions = result.suggestions;

    // Should still match "pl." context because of regex check on textBeforeCursor
    const colSuggestion = suggestions.find((s: languages.CompletionItem) => s.label === 'col');
    expect(colSuggestion).toBeDefined();

    // Verify insertText DOES NOT include "pl."
    expect(colSuggestion.insertText).toBe("col('${1}')");

    // Verify range covers "c"
    expect(colSuggestion.range).toEqual({
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 4, // Start of "c"
      endColumn: 5,   // End of "c"
    });

    // Resulting edit: "pl." + "c" -> "pl." + "col('${1}')" -> "pl.col('${1}')" (Correct)
  });

  it('handles "pl.col" prefix correctly (Full Match Context)', async () => {
    const provider = await setupEditor();
    const position = { lineNumber: 1, column: 7 }; // After "pl.col"
    // Word is "col"
    const model = {
      getLineContent: () => 'pl.col',
      getWordUntilPosition: () => ({
        word: 'col',
        startColumn: 4,
        endColumn: 7,
      }),
    };

    const result = provider.provideCompletionItems(model, position);
    const suggestions = result.suggestions;

    // Should still match "pl." context
    const colSuggestion = suggestions.find((s: languages.CompletionItem) => s.label === 'col');
    expect(colSuggestion).toBeDefined();

    expect(colSuggestion.insertText).toBe("col('${1}')");
    expect(colSuggestion.range).toEqual({
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 4,
      endColumn: 7,
    });
    
    // Resulting edit: "pl." + "col" -> "pl." + "col('${1}')" (Correct)
  });
});
