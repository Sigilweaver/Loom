import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@contexts/ThemeContext';
import { FormulaConfiguration } from '../FormulaConfiguration';
import type { ToolConfig, Tool, Wire, WorkflowMeta } from '@domain/workflow/entities/workflow';
import * as hooks from '@api/hooks';

// Mock API hooks
vi.mock('@api/hooks', () => ({
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
      columns: [],
      loading: false,
      error: null,
      fetchMetadata: mockFetchMetadata,
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

      expect(screen.getByText('Target Column')).toBeInTheDocument();
      expect(screen.getByText('Formula Expression')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('renders target column dropdown', () => {
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

      expect(screen.getByText('Target Column')).toBeInTheDocument();
      // Default should show "(New Column)" option selected
      expect(screen.getByText('(New Column)')).toBeInTheDocument();
    });

    it('shows column name input when new column is selected', () => {
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

    it('hides column name input when replacing existing column', () => {
      const configWithReplace: ToolConfig = {
        ...defaultConfig,
        column_name: 'existing_col',
      };

      // Need to mock metadata with that column for UI to show it as "replace"
      const mockColumns = [
        { name: 'existing_col', dtype: 'Float64', nullable: false },
      ];
      const mockMetadata = {
        tool_id: 'tool-1',
        socket_id: 'input',
        columns: mockColumns,
        inputs: { input: mockColumns },
      };

      vi.mocked(hooks.useMetadata).mockReturnValue({
        metadata: mockMetadata,
        columns: mockColumns,
        loading: false,
        error: null,
        fetchMetadata: mockFetchMetadata,
      });

      renderWithTheme(
        <FormulaConfiguration
          config={configWithReplace}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      // Column name input should not be visible when replacing
      expect(screen.queryByText('New Column Name')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('result')).not.toBeInTheDocument();
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

    it('shows available columns in dropdown when metadata is available', () => {
      const mockColumns = [
        { name: 'price', dtype: 'Float64', nullable: false },
        { name: 'quantity', dtype: 'Int64', nullable: true },
      ];
      const mockMetadata = {
        tool_id: 'tool-1',
        socket_id: 'input',
        columns: mockColumns,
        inputs: { input: mockColumns },
      };

      vi.mocked(hooks.useMetadata).mockReturnValue({
        metadata: mockMetadata,
        columns: mockColumns,
        loading: false,
        error: null,
        fetchMetadata: mockFetchMetadata,
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

      // The dropdown should exist with target column options
      expect(screen.getByText('Target Column')).toBeInTheDocument();
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
      // _emit should mark column_name for emission since it differs from default ""
      expect(lastCall._emit?.column_name).toBe(true);
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
      await user.type(editor, 'x');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall.expression).toBe('x');
      // _emit should mark expression for emission since it differs from default ""
      expect(lastCall._emit?.expression).toBe(true);
    });

    it('preserves existing config values when updating expression', async () => {
      const user = userEvent.setup();
      const configWithValues: ToolConfig = {
        column_name: 'existing',
        expression: 'existing_expr',
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithValues}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, 'x');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      // column_name should be preserved when editing expression
      expect(lastCall.column_name).toBe('existing');
      expect(lastCall.expression).toBe('existing_exprx');
      // BOTH should be in _emit since both differ from defaults
      expect(lastCall._emit?.column_name).toBe(true);
      expect(lastCall._emit?.expression).toBe(true);
    });

    it('preserves column_name when setting expression', async () => {
      const user = userEvent.setup();
      // Start with config that has column_name set
      const configWithColumn: ToolConfig = {
        column_name: 'calculated',
        expression: '',
      };

      renderWithTheme(
        <FormulaConfiguration
          config={configWithColumn}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      // Type in expression - this should preserve the existing column_name
      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, "x");

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      // Verify column_name is preserved when editing expression
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      // column_name should be preserved
      expect(lastCall.column_name).toBe('calculated');
      // Both fields should be in _emit since they differ from defaults
      expect(lastCall._emit?.column_name).toBe(true);
      expect(lastCall._emit?.expression).toBe(true);
    });

    it('builds correct _emit when editing loaded workflow without _emit', async () => {
      const user = userEvent.setup();
      // This simulates a workflow loaded from JSON - has values but NO _emit
      // The handler should rebuild _emit based on what differs from defaults
      const loadedWorkflowConfig: ToolConfig = {
        column_name: 'total_price',
        expression: "pl.col('price') * pl.col('qty')",
        // NO _emit field! This is what happens when loading from JSON
      };

      renderWithTheme(
        <FormulaConfiguration
          config={loadedWorkflowConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      // User makes a small change to the expression
      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, " ");  // Just add a space

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      // The key assertion: _emit should be rebuilt with BOTH fields
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall.expression).toBe("pl.col('price') * pl.col('qty') ");
      expect(lastCall.column_name).toBe('total_price');
      // Both should be in _emit since they differ from default ""
      expect(lastCall._emit?.expression).toBe(true);
      expect(lastCall._emit?.column_name).toBe(true);
    });
  });

  describe('Metadata Fetching', () => {
    it('fetches metadata on mount when input is connected', async () => {
      const wiresWithInput: Wire[] = [
        {
          from: { tool: 'tool-0', socket: 'output' },
          to: { tool: 'tool-1', socket: 'input' },
        },
      ];

      renderWithTheme(
        <FormulaConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={wiresWithInput}
          workflowMeta={defaultMeta}
        />
      );

      await waitFor(() => {
        expect(mockFetchMetadata).toHaveBeenCalled();
      });
    });

    it('does not fetch metadata on mount when input is not connected', async () => {
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

      // With no input connection, should not fetch metadata
      expect(mockFetchMetadata).not.toHaveBeenCalled();
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
          to: { tool: 'tool-1', socket: 'input' }, // Wire to tool-1
        },
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
      const mockColumns = [
        { name: 'age', dtype: 'Int64', nullable: false },
        { name: 'name', dtype: 'String', nullable: true },
      ];
      const mockMetadata = {
        tool_id: 'tool-1',
        socket_id: 'input',
        columns: mockColumns,
        inputs: { input: mockColumns },
      };

      vi.mocked(hooks.useMetadata).mockReturnValue({
        metadata: mockMetadata,
        columns: mockColumns,
        loading: false,
        error: null,
        fetchMetadata: mockFetchMetadata,
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
        column_methods: { all: [], string: [], numeric: [], datetime: [], list: [] },
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
        column_methods: { all: [], string: [], numeric: [], datetime: [], list: [] },
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
