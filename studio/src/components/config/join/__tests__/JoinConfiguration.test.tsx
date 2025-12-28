import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JoinConfiguration } from '../JoinConfiguration';
import { Tool, Wire, WorkflowMeta, ToolConfig } from '@domain/workflow/entities/workflow';

// Mock the hooks
vi.mock('@api/hooks', () => ({
  useMetadata: vi.fn(() => ({
    metadata: null,
    columns: [],
    fetchMetadata: vi.fn(),
    loading: false,
    error: null,
  })),
}));

// Mock WorkflowSerializer
vi.mock('@domain/workflow/services/WorkflowSerializer', () => ({
  WorkflowSerializer: {
    extractUpstreamSubgraph: vi.fn(() => ({ tools: [], wires: [] })),
    toJSON: vi.fn(() => '{}'),
  },
}));

describe('JoinConfiguration', () => {
  const defaultConfig: ToolConfig = {
    joinType: 'inner',
    leftKeys: [],
    rightKeys: [],
  };

  const defaultProps = {
    config: defaultConfig,
    onChange: vi.fn(),
    toolId: 'join1',
    tools: [] as Tool[],
    wires: [] as Wire[],
    workflowMeta: {
      workflowId: 'test',
      name: 'Test',
      description: '',
      author: '',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    } as WorkflowMeta,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders info section', () => {
    render(<JoinConfiguration {...defaultProps} />);
    expect(screen.getByText('Join Tool')).toBeInTheDocument();
    expect(screen.getByText(/Combines two datasets/)).toBeInTheDocument();
  });

  it('shows connection warning when no inputs connected', () => {
    render(<JoinConfiguration {...defaultProps} />);
    expect(screen.getByText(/Connect both inputs/)).toBeInTheDocument();
  });

  it('shows left connection warning when only right connected', () => {
    const wires: Wire[] = [
      {
        from: { tool: 'input1', socket: 'output' },
        to: { tool: 'join1', socket: 'input-right' },
      },
    ];
    render(<JoinConfiguration {...defaultProps} wires={wires} />);
    expect(screen.getByText(/Connect the Left/)).toBeInTheDocument();
  });

  it('shows right connection warning when only left connected', () => {
    const wires: Wire[] = [
      {
        from: { tool: 'input1', socket: 'output' },
        to: { tool: 'join1', socket: 'input-left' },
      },
    ];
    render(<JoinConfiguration {...defaultProps} wires={wires} />);
    expect(screen.getByText(/Connect the Right/)).toBeInTheDocument();
  });

  it('always shows a blank row for adding new keys', () => {
    const wires: Wire[] = [
      {
        from: { tool: 'input1', socket: 'output' },
        to: { tool: 'join1', socket: 'input-left' },
      },
      {
        from: { tool: 'input2', socket: 'output' },
        to: { tool: 'join1', socket: 'input-right' },
      },
    ];
    render(<JoinConfiguration {...defaultProps} wires={wires} />);
    
    // Should have one blank row (2 dropdowns)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(2);
  });

  it('shows populated rows plus one blank row', () => {
    const config: ToolConfig = {
      joinType: 'inner',
      leftKeys: ['id'],
      rightKeys: ['user_id'],
    };
    
    const wires: Wire[] = [
      {
        from: { tool: 'input1', socket: 'output' },
        to: { tool: 'join1', socket: 'input-left' },
      },
      {
        from: { tool: 'input2', socket: 'output' },
        to: { tool: 'join1', socket: 'input-right' },
      },
    ];
    render(<JoinConfiguration {...defaultProps} config={config} wires={wires} />);
    
    // Should have 2 rows (1 populated + 1 blank) = 4 dropdowns
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(4);
  });

  it('renders suffix input with default value', () => {
    render(<JoinConfiguration {...defaultProps} />);
    const suffixInput = screen.getByPlaceholderText('_right');
    expect(suffixInput).toBeInTheDocument();
    expect(suffixInput).toHaveValue('_right');
  });

  it('calls onChange when suffix is changed', () => {
    const onChange = vi.fn();
    render(<JoinConfiguration {...defaultProps} onChange={onChange} />);
    
    const suffixInput = screen.getByPlaceholderText('_right');
    fireEvent.change(suffixInput, { target: { value: '_r' } });
    fireEvent.blur(suffixInput);
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rightSuffix: '_r',
      })
    );
  });

  it('renders key pair dropdowns when inputs connected', () => {
    const wires: Wire[] = [
      {
        from: { tool: 'input1', socket: 'output' },
        to: { tool: 'join1', socket: 'input-left' },
      },
      {
        from: { tool: 'input2', socket: 'output' },
        to: { tool: 'join1', socket: 'input-right' },
      },
    ];
    render(<JoinConfiguration {...defaultProps} wires={wires} />);
    
    // Should have column headers
    expect(screen.getByText('Left Column')).toBeInTheDocument();
    expect(screen.getByText('Right Column')).toBeInTheDocument();
    
    // Should have two dropdowns (left and right)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(2);
  });

  it('shows warning when key counts mismatch', () => {
    const config: ToolConfig = {
      joinType: 'inner',
      leftKeys: ['id'],
      rightKeys: [],
    };
    
    const wires: Wire[] = [
      {
        from: { tool: 'input1', socket: 'output' },
        to: { tool: 'join1', socket: 'input-left' },
      },
      {
        from: { tool: 'input2', socket: 'output' },
        to: { tool: 'join1', socket: 'input-right' },
      },
    ];
    
    render(<JoinConfiguration {...defaultProps} config={config} wires={wires} />);
    expect(screen.getByText(/must have the same count/)).toBeInTheDocument();
  });
});
