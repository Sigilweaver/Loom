import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@contexts/ThemeContext';
import { FilterConfiguration } from '../FilterConfiguration';
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

describe('FilterConfiguration', () => {
  const mockOnChange = vi.fn();
  const mockFetchMetadata = vi.fn();
  const mockFetchFunctions = vi.fn();

  const defaultConfig: ToolConfig = {
    expression: '',
    _emit: {},
  };

  const defaultTools: Tool[] = [
    {
      id: 'tool-1',
      type: 'Filter',
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
    it('renders filter configuration UI', () => {
      renderWithTheme(
        <FilterConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('Filter Expression')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Config Value Display', () => {
    it('displays existing expression value', () => {
      const configWithValue: ToolConfig = {
        expression: "pl.col('age') > 18",
        _emit: {},
      };

      renderWithTheme(
        <FilterConfiguration
          config={configWithValue}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue("pl.col('age') > 18");
    });

    it('displays empty string when expression is undefined', () => {
      const configWithUndefined: ToolConfig = {
        _emit: {},
      };

      renderWithTheme(
        <FilterConfiguration
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
  });

  describe('User Interactions', () => {
    it('calls onChange when expression changes', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <FilterConfiguration
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

    it('updates _emit map when expression changes', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <FilterConfiguration
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
        expression: 'existing_expr',
        someOtherField: 'value',
        _emit: { someOtherField: true, expression: false },
      };

      renderWithTheme(
        <FilterConfiguration
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
      expect(lastCall._emit.someOtherField).toBe(true);
      expect(lastCall._emit.expression).toBe(true);
    });

    it('handles rapid expression changes', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <FilterConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      await user.type(editor, 'abc');

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Metadata Fetching', () => {
    it('fetches metadata on mount', async () => {
      renderWithTheme(
        <FilterConfiguration
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
        <FilterConfiguration
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
          <FilterConfiguration
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
        <FilterConfiguration
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
          <FilterConfiguration
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

    it('passes correct workflow data to fetchMetadata', async () => {
      renderWithTheme(
        <FilterConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      await waitFor(() => {
        expect(mockFetchMetadata).toHaveBeenCalledWith(
          'tool-1',
          expect.any(Object)
        );
      });
    });

    it('passes columns to CodeEditor when metadata is available', () => {
      const mockMetadata = {
        tool_id: 'tool-1',
        columns: [
          { name: 'age', dtype: 'Int64', nullable: false },
          { name: 'status', dtype: 'String', nullable: true },
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
        <FilterConfiguration
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

    it('handles null metadata gracefully', () => {
      renderWithTheme(
        <FilterConfiguration
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
        <FilterConfiguration
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
        <FilterConfiguration
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
        column_methods: {
          all: [
            {
              name: '.is_not_null',
              signature: '.is_not_null()',
              description: 'Check if not null',
              snippet: '.is_not_null()',
              category: 'all',
            },
          ],
          string: [],
          numeric: [],
          datetime: [],
          list: [],
        },
      };

      vi.mocked(hooks.usePolarsFunctions).mockReturnValue({
        functions: mockFunctions,
        loading: false,
        error: null,
        fetchFunctions: mockFetchFunctions,
      });

      renderWithTheme(
        <FilterConfiguration
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
    it('handles undefined expression', () => {
      const configWithUndefined: ToolConfig = {
        _emit: {},
      };

      renderWithTheme(
        <FilterConfiguration
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

    it('handles complex boolean expressions', () => {
      const complexExpression = "(pl.col('a') > 10) & (pl.col('b') < 20) | (pl.col('c') == 'test')";
      const configWithComplex: ToolConfig = {
        expression: complexExpression,
        _emit: {},
      };

      renderWithTheme(
        <FilterConfiguration
          config={configWithComplex}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(complexExpression);
    });

    it('handles expressions with special characters', () => {
      const specialExpression = "pl.col('name').str.contains('O\\'Brien')";
      const configWithSpecial: ToolConfig = {
        expression: specialExpression,
        _emit: {},
      };

      renderWithTheme(
        <FilterConfiguration
          config={configWithSpecial}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(specialExpression);
    });

    it('handles multiline expressions', () => {
      const multilineExpression = `(pl.col('age') > 18) & 
(pl.col('status') == 'active') &
(pl.col('score') > 50)`;

      const configWithMultiline: ToolConfig = {
        expression: multilineExpression,
        _emit: {},
      };

      renderWithTheme(
        <FilterConfiguration
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

    it('handles very long expressions', () => {
      const longExpression = 'pl.col("field")' + ' & pl.col("another")'.repeat(50);
      const configWithLong: ToolConfig = {
        expression: longExpression,
        _emit: {},
      };

      renderWithTheme(
        <FilterConfiguration
          config={configWithLong}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(longExpression);
    });
  });

  describe('Integration with Workflow', () => {
    it('handles multiple wire connections correctly', async () => {
      const wiresWithMultiple: Wire[] = [
        {
          from: { tool: 'tool-0', socket: 'output' },
          to: { tool: 'tool-1', socket: 'input' },
        },
        {
          from: { tool: 'tool-2', socket: 'output' },
          to: { tool: 'tool-3', socket: 'input' },
        },
      ];

      renderWithTheme(
        <FilterConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={wiresWithMultiple}
          workflowMeta={defaultMeta}
        />
      );

      await waitFor(() => {
        expect(mockFetchMetadata).toHaveBeenCalled();
      });
    });

    it('works with empty workflow', () => {
      renderWithTheme(
        <FilterConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={[]}
          wires={[]}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('Filter Expression')).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('unmounts cleanly', () => {
      const { unmount } = renderWithTheme(
        <FilterConfiguration
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

    it('handles rapid remounting', () => {
      const { unmount } = renderWithTheme(
        <FilterConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      unmount();

      // Remount after unmount
      const { unmount: unmount2 } = renderWithTheme(
        <FilterConfiguration
          config={defaultConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(() => unmount2()).not.toThrow();
    });
  });
});
