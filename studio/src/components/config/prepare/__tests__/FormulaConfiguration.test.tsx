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
    operations: [],
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
    it('renders formula configuration UI with header', () => {
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

      expect(screen.getByText('Formula')).toBeInTheDocument();
      expect(screen.getByText(/Create or transform columns/)).toBeInTheDocument();
    });

    it('shows empty state with add operation button when no operations', () => {
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

      expect(screen.getByText('No operations defined yet')).toBeInTheDocument();
      expect(screen.getByText('Add operation')).toBeInTheDocument();
    });

    it('renders add operation button', () => {
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

      const addBtn = screen.getByText('Add operation');
      expect(addBtn).toBeInTheDocument();
    });
  });

  describe('Legacy Config Migration', () => {
    it('migrates legacy single-operation config to new format', () => {
      const legacyConfig: ToolConfig = {
        column_name: 'total',
        expression: "pl.col('price') * pl.col('qty')",
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={legacyConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      // Should show the migrated operation (in advanced mode since it's legacy)
      expect(screen.getByText('total')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when add operation is clicked', async () => {
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

      const addBtn = screen.getByText('Add operation');
      await user.click(addBtn);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall.operations).toBeDefined();
      expect(lastCall.operations.length).toBe(1);
    });
  });

  describe('Multi-Operation', () => {
    it('renders multiple operations as cards', () => {
      const multiOpConfig: ToolConfig = {
        operations: [
          {
            id: 'op-1',
            operationId: '',
            sourceColumn: '',
            params: {},
            columnName: 'total',
            columnNameEdited: true,
            mode: 'advanced',
            expression: "pl.col('a') + pl.col('b')",
          },
          {
            id: 'op-2',
            operationId: '',
            sourceColumn: '',
            params: {},
            columnName: 'doubled',
            columnNameEdited: true,
            mode: 'advanced',
            expression: "pl.col('total') * 2",
          },
        ],
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={multiOpConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('total')).toBeInTheDocument();
      expect(screen.getByText('doubled')).toBeInTheDocument();
      // Position badges
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows add operation button below existing operations', () => {
      const singleOpConfig: ToolConfig = {
        operations: [
          {
            id: 'op-1',
            operationId: '',
            sourceColumn: '',
            params: {},
            columnName: 'total',
            columnNameEdited: true,
            mode: 'advanced',
            expression: "pl.col('a')",
          },
        ],
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={singleOpConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('Add operation')).toBeInTheDocument();
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
          to: { tool: 'tool-1', socket: 'input' },
        },
        {
          from: { tool: 'tool-0', socket: 'output' },
          to: { tool: 'tool-2', socket: 'input' },
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
          to: { tool: 'tool-4', socket: 'input' },
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

      expect(mockFetchMetadata).not.toHaveBeenCalled();
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
  });

  describe('Edge Cases', () => {
    it('handles empty operations array', () => {
      const emptyConfig: ToolConfig = {
        operations: [],
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={emptyConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('No operations defined yet')).toBeInTheDocument();
    });

    it('handles config with no operations or legacy fields', () => {
      const bareConfig: ToolConfig = {
        _emit: {},
      };

      renderWithTheme(
        <FormulaConfiguration
          config={bareConfig}
          onChange={mockOnChange}
          toolId="tool-1"
          tools={defaultTools}
          wires={defaultWires}
          workflowMeta={defaultMeta}
        />
      );

      expect(screen.getByText('No operations defined yet')).toBeInTheDocument();
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
