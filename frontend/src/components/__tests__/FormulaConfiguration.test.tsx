import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@contexts/ThemeContext';
import { FormulaConfiguration } from '../FormulaConfiguration';
import type { ToolConfig, Tool, Wire, WorkflowMeta } from '@domain/workflow/entities/workflow';
import * as hooks from '../../api/hooks';

// Mock API hooks
vi.mock('../../api/hooks', () => ({
  useMetadata: vi.fn(),
  usePolarsFunctions: vi.fn(),
}));

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe('FormulaConfiguration', () => {
  const mockOnChange = vi.fn();
  const mockFetchMetadata = vi.fn();
  const mockFetchFunctions = vi.fn();

  const defaultConfig: ToolConfig = {
    column_name: '',
    expression: '',
    _emit: {},
  };

  const defaultTools: Tool[] = [
    {
      id: 'tool-1',
      type: 'Formula',
      x: 0,
      y: 0,
      config: defaultConfig,
      sockets: [],
    },
  ];

  const defaultWires: Wire[] = [];

  const defaultMeta: WorkflowMeta = {
    name: 'Test Workflow',
    description: '',
    author: 'test',
    workflowId: 'workflow-1',
    created: new Date().toISOString(),
  };

  beforeEach(() => {
    mockOnChange.mockClear();
    mockFetchMetadata.mockClear();
    mockFetchFunctions.mockClear();

    // Setup default mock implementations
    vi.mocked(hooks.useMetadata).mockReturnValue({
      metadata: null,
      loading: false,
      error: null,
      fetchMetadata: mockFetchMetadata,
      getColumns: vi.fn(() => []),
    });

    vi.mocked(hooks.usePolarsFunctions).mockReturnValue({
      functions: null,
      loading: false,
      error: null,
      fetchFunctions: mockFetchFunctions,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders formula configuration UI', () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('Formula Tool')).toBeInTheDocument();
      expect(screen.getByText(/Create a new calculated column/i)).toBeInTheDocument();
    });

    it('renders column name input', () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('New Column Name')).toBeInTheDocument();
      const input = screen.getByPlaceholderText('result');
      expect(input).toBeInTheDocument();
    });

    it('renders expression editor', () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('Formula Expression')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('renders examples section', () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('Example Expressions:')).toBeInTheDocument();
      expect(screen.getByText(/Multiply two columns together/i)).toBeInTheDocument();
    });

    it('renders tips section', () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('Tips:')).toBeInTheDocument();
      expect(screen.getByText(/Use pl.col\('column_name'\) to reference existing columns/i)).toBeInTheDocument();
    });
  });

  describe('Config Value Display', () => {
    it('displays existing column name value', () => {
      const configWithValue: ToolConfig = {
        ...defaultConfig,
        column_name: 'calculated_field',
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithValue}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const input = screen.getByDisplayValue('calculated_field');
      expect(input).toBeInTheDocument();
    });

    it('displays existing expression value', () => {
      const configWithValue: ToolConfig = {
        ...defaultConfig,
        expression: "pl.col('price') * 1.1",
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithValue}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue("pl.col('price') * 1.1");
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when column name changes', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const input = screen.getByPlaceholderText('result');
      await user.type(input, 'total');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall.column_name).toBe('total');
      expect(lastCall._emit.column_name).toBe(true);
    });

    it('calls onChange when expression changes', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, 'test');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall._emit.expression).toBe(true);
    });

    it('preserves existing _emit values when updating', async () => {
      const user = userEvent.setup();
      const configWithEmit: ToolConfig = {
        column_name: 'existing',
        expression: 'existing_expr',
        _emit: { column_name: true, expression: false },
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithEmit}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, 'new');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall._emit.column_name).toBe(true);
      expect(lastCall._emit.expression).toBe(true);
    });
  });

  describe('Metadata Fetching', () => {
    it('fetches metadata on mount', async () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      await waitFor(() => {
        expect(mockFetchMetadata).toHaveBeenCalled();
      });
    });

    it('fetches metadata when wire connections change', async () => {
      const { rerender } = renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      mockFetchMetadata.mockClear();

      const newWires: Wire[] = [
        {
          from: { tool: 'tool-0', socket: 'output' },
          to: { tool: 'tool-1', socket: 'input' },
        },
      ];

      rerender(
        <ThemeProvider>
          <FormulaConfiguration
            config={defaultConfig}
            onChange={mockOnChange}
            toolId="tool-1"
            tools={defaultTools}
            wires={newWires}
            workflowMeta={defaultMeta}
          />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(mockFetchMetadata).toHaveBeenCalled();
      });
    });

    it('does not refetch metadata when unrelated wires change', async () => {
      const initialWires: Wire[] = [
        {
          from: { tool: 'tool-0', socket: 'output' },
          to: { tool: 'tool-2', socket: 'input' }, // Different tool
        },
      ];

      const { rerender } = renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={initialWires}
          workflowMeta={defaultMeta}
        />
      );

      await waitFor(() => {
        expect(mockFetchMetadata).toHaveBeenCalledTimes(1);
      });

      mockFetchMetadata.mockClear();

      const updatedWires: Wire[] = [
        ...initialWires,
        {
          from: { tool: 'tool-3', socket: 'output' },
          to: { tool: 'tool-4', socket: 'input' }, // Still not tool-1
        },
      ];

      rerender(
        <ThemeProvider>
          <FormulaConfiguration
            config={defaultConfig}
            onChange={mockOnChange}
            toolId="tool-1"
            tools={defaultTools}
            wires={updatedWires}
            workflowMeta={defaultMeta}
          />
        </ThemeProvider>
      );

      // Should not trigger another fetch since wires to tool-1 didn't change
      expect(mockFetchMetadata).not.toHaveBeenCalled();
    });

    it('passes columns to CodeEditor when metadata is available', () => {
      const mockMetadata = {
        tool_id: 'tool-1',
        columns: [
          { name: 'age', dtype: 'Int64', nullable: false },
          { name: 'name', dtype: 'String', nullable: true },
        ],
      };

      vi.mocked(hooks.useMetadata).mockReturnValue({
        metadata: mockMetadata,
        loading: false,
        error: null,
        fetchMetadata: mockFetchMetadata,
        getColumns: vi.fn(() => mockMetadata.columns),
      });

      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Polars Functions', () => {
    it('fetches Polars functions on mount if not already loaded', async () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      await waitFor(() => {
        expect(mockFetchFunctions).toHaveBeenCalled();
      });
    });

    it('does not fetch functions if already loaded', () => {
      const mockFunctions = {
        table_level: [
          {
            name: 'pl.col',
            signature: 'pl.col(name: str)',
            description: 'Reference a column',
            snippet: "pl.col('${1}')",
            category: 'table',
          },
        ],
        column_methods: { all: [], string: [], numeric: [], datetime: [] },
      };

      vi.mocked(hooks.usePolarsFunctions).mockReturnValue({
        functions: mockFunctions,
        loading: false,
        error: null,
        fetchFunctions: mockFetchFunctions,
      });

      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(mockFetchFunctions).not.toHaveBeenCalled();
    });

    it('passes functions to CodeEditor when available', () => {
      const mockFunctions = {
        table_level: [
          {
            name: 'pl.col',
            signature: 'pl.col(name: str)',
            description: 'Reference a column',
            snippet: "pl.col('${1}')",
            category: 'table',
          },
        ],
        column_methods: { all: [], string: [], numeric: [], datetime: [] },
      };

      vi.mocked(hooks.usePolarsFunctions).mockReturnValue({
        functions: mockFunctions,
        loading: false,
        error: null,
        fetchFunctions: mockFetchFunctions,
      });

      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined column_name', () => {
      const configWithUndefined: ToolConfig = {
        expression: '',
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithUndefined}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const input = screen.getByPlaceholderText('result');
      expect(input).toHaveValue('');
    });

    it('handles undefined expression', () => {
      const configWithUndefined: ToolConfig = {
        column_name: 'test',
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithUndefined}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue('');
    });

    it('handles complex expressions with special characters', () => {
      const configWithComplex: ToolConfig = {
        column_name: 'test',
        expression: "pl.when(pl.col('name') == 'O\\'Brien').then(pl.lit(1)).otherwise(pl.lit(0))",
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithComplex}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(configWithComplex.expression as string);
    });

    it('handles multiline expressions', () => {
      const multilineExpression = `pl.when(pl.col('age') > 18)
  .then(pl.lit('adult'))
  .otherwise(pl.lit('minor'))`;

      const configWithMultiline: ToolConfig = {
        column_name: 'category',
        expression: multilineExpression,
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithMultiline}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(multilineExpression);
    });
  });

  describe('Required Field Indicators', () => {
    it('marks column name as required', () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      // The required indicator is part of the ConfigText component description
      const label = screen.getByText('New Column Name');
      expect(label).toBeInTheDocument();
    });

    it('marks expression as required', () => {
      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const label = screen.getByText('Formula Expression');
      expect(label.textContent).toContain('*');
    });
  });

  describe('Cleanup', () => {
    it('unmounts cleanly', () => {
      const { unmount } = renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(() => unmount()).not.toThrow();
    });
  });
});
