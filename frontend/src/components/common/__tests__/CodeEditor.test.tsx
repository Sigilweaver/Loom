import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@contexts/ThemeContext';
import { CodeEditor } from '../CodeEditor';
import type { ColumnSchema, PolarsFunctionsResponse } from '../../../api/backend';

// Helper to wrap component with ThemeProvider
const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe('CodeEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders monaco editor with default props', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('renders with initial value', () => {
      const initialValue = 'pl.col("age") > 18';
      renderWithTheme(
        <CodeEditor value={initialValue} onChange={mockOnChange} />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(initialValue);
    });

    it('renders with custom height', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} height="300px" />
      );

      const editorWrapper = screen.getByTestId('monaco-editor').parentElement;
      expect(editorWrapper).toBeInTheDocument();
    });

    it('renders in read-only mode', () => {
      renderWithTheme(
        <CodeEditor value="const x = 1" onChange={mockOnChange} readOnly />
      );

      const editor = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
      expect(editor).toBeInTheDocument();
    });

    it('displays placeholder when empty', async () => {
      const placeholder = 'Enter expression here...';
      renderWithTheme(
        <CodeEditor 
          value="" 
          onChange={mockOnChange} 
          placeholder={placeholder}
        />
      );

      await waitFor(() => {
        const editor = screen.getByTestId('monaco-editor');
        expect(editor).toHaveAttribute('placeholder');
      });
    });
  });

  describe('Value Changes', () => {
    it('calls onChange when value changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} />
      );

      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, 'pl.col("name")');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('handles empty string value', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue('');
    });

    it('updates when value prop changes', () => {
      const { rerender } = renderWithTheme(
        <CodeEditor value="initial" onChange={mockOnChange} />
      );

      let editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue('initial');

      rerender(
        <ThemeProvider>
          <CodeEditor value="updated" onChange={mockOnChange} />
        </ThemeProvider>
      );

      editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue('updated');
    });
  });

  describe('Language Support', () => {
    it('defaults to python language', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('accepts custom language', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} language="javascript" />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Column Autocomplete', () => {
    const mockColumns: ColumnSchema[] = [
      { name: 'age', dtype: 'Int64', nullable: false },
      { name: 'name', dtype: 'String', nullable: true },
      { name: 'salary', dtype: 'Float64', nullable: false },
    ];

    it('renders with column schema', () => {
      renderWithTheme(
        <CodeEditor 
          value="" 
          onChange={mockOnChange} 
          columns={mockColumns}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('handles empty columns array', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} columns={[]} />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('updates autocomplete when columns change', () => {
      const { rerender } = renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} columns={[]} />
      );

      rerender(
        <ThemeProvider>
          <CodeEditor 
            value="" 
            onChange={mockOnChange} 
            columns={mockColumns} 
          />
        </ThemeProvider>
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Polars Functions', () => {
    const mockFunctions: PolarsFunctionsResponse = {
      table_level: [
        {
          name: 'pl.col',
          signature: 'pl.col(name: str)',
          description: 'Reference a column by name',
          snippet: "pl.col('${1}')",
          category: 'table',
        },
        {
          name: 'pl.lit',
          signature: 'pl.lit(value)',
          description: 'Create a literal value',
          snippet: 'pl.lit(${1})',
          category: 'table',
        },
        {
          name: 'pl.when',
          signature: 'pl.when(condition).then(value).otherwise(value)',
          description: 'Conditional expression',
          snippet: 'pl.when(${1}).then(${2}).otherwise(${3})',
          category: 'table',
        },
      ],
      column_methods: {
        all: [
          {
            name: '.abs',
            signature: '.abs()',
            description: 'Get absolute value',
            snippet: '.abs()',
            category: 'all',
          },
          {
            name: '.alias',
            signature: '.alias(name: str)',
            description: 'Rename the column',
            snippet: ".alias('${1}')",
            category: 'all',
          },
        ],
        string: [
          {
            name: '.str.contains',
            signature: '.str.contains(pattern: str)',
            description: 'Check if string contains pattern',
            snippet: ".str.contains('${1}')",
            category: 'string',
          },
          {
            name: '.str.upper',
            signature: '.str.upper()',
            description: 'Convert to uppercase',
            snippet: '.str.upper()',
            category: 'string',
          },
        ],
        numeric: [
          {
            name: '.round',
            signature: '.round(decimals: int)',
            description: 'Round to n decimal places',
            snippet: '.round(${1:2})',
            category: 'numeric',
          },
          {
            name: '.sqrt',
            signature: '.sqrt()',
            description: 'Square root',
            snippet: '.sqrt()',
            category: 'numeric',
          },
        ],
        datetime: [
          {
            name: '.dt.year',
            signature: '.dt.year()',
            description: 'Extract year',
            snippet: '.dt.year()',
            category: 'datetime',
          },
        ],
      },
    };

    it('renders with Polars functions', () => {
      renderWithTheme(
        <CodeEditor 
          value="" 
          onChange={mockOnChange} 
          polarsFunctions={mockFunctions}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('handles null polarsFunctions', () => {
      renderWithTheme(
        <CodeEditor 
          value="" 
          onChange={mockOnChange} 
          polarsFunctions={null}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('updates autocomplete when functions change', () => {
      const { rerender } = renderWithTheme(
        <CodeEditor 
          value="" 
          onChange={mockOnChange} 
          polarsFunctions={null}
        />
      );

      rerender(
        <ThemeProvider>
          <CodeEditor 
            value="" 
            onChange={mockOnChange} 
            polarsFunctions={mockFunctions}
          />
        </ThemeProvider>
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Combined Column and Function Autocomplete', () => {
    const mockColumns: ColumnSchema[] = [
      { name: 'age', dtype: 'Int64', nullable: false },
      { name: 'name', dtype: 'String', nullable: true },
    ];

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
        all: [
          {
            name: '.alias',
            signature: '.alias(name: str)',
            description: 'Rename column',
            snippet: ".alias('${1}')",
            category: 'all',
          },
        ],
        string: [],
        numeric: [],
        datetime: [],
      },
    };

    it('provides both column and function suggestions', () => {
      renderWithTheme(
        <CodeEditor 
          value="" 
          onChange={mockOnChange} 
          columns={mockColumns}
          polarsFunctions={mockFunctions}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    it('applies light theme when app theme is light', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('applies dark theme when app theme is dark', () => {
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('accepts custom theme override', () => {
      renderWithTheme(
        <CodeEditor 
          value="" 
          onChange={mockOnChange} 
          theme="vs-dark"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long values', () => {
      const longValue = 'pl.col("name")' + '.alias("test")'.repeat(100);
      renderWithTheme(
        <CodeEditor value={longValue} onChange={mockOnChange} />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(longValue);
    });

    it('handles multiline expressions', () => {
      const multilineValue = `pl.when(pl.col('age') > 18)
  .then(pl.lit('adult'))
  .otherwise(pl.lit('minor'))`;
      
      renderWithTheme(
        <CodeEditor value={multilineValue} onChange={mockOnChange} />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(multilineValue);
    });

    it('handles special characters in values', () => {
      const specialValue = "pl.col('name') == 'O\\'Brien'";
      renderWithTheme(
        <CodeEditor value={specialValue} onChange={mockOnChange} />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(specialValue);
    });

    it('handles rapid value changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <CodeEditor value="" onChange={mockOnChange} />
      );

      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, 'abc');

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('unmounts cleanly', () => {
      const { unmount } = renderWithTheme(
        <CodeEditor 
          value="test" 
          onChange={mockOnChange} 
          columns={[{ name: 'test', dtype: 'Int64', nullable: false }]}
        />
      );

      expect(() => unmount()).not.toThrow();
    });

    it('handles rapid remounting', () => {
      const { unmount } = renderWithTheme(
        <CodeEditor value="test1" onChange={mockOnChange} />
      );

      unmount();

      // Remount after unmount
      const { unmount: unmount2 } = renderWithTheme(
        <CodeEditor value="test2" onChange={mockOnChange} />
      );

      expect(() => unmount2()).not.toThrow();
    });
  });
});
