import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock the entire App dependencies to see if it can render
vi.mock('../utils/XMLWorkflowManager', () => ({
  XMLWorkflowManager: vi.fn(() => ({
    getTools: vi.fn(() => []),
    getWires: vi.fn(() => []),
    getMetadata: vi.fn(() => ({
      name: 'Test Workflow',
      description: 'Test Description',
      author: 'Test Author',
      workflowId: 'test-id',
      created: '2025-09-01T00:00:00.000Z'
    })),
    toXMLString: vi.fn(() => '<Workflow>Test XML</Workflow>'),
    newWorkflow: vi.fn(),
    loadFromXML: vi.fn(),
    addTool: vi.fn(),
    removeTool: vi.fn(),
    updateToolPosition: vi.fn(),
    updateMetadata: vi.fn()
  }))
}));

vi.mock('../utils/HistoryManager', () => ({
  HistoryManager: vi.fn(() => ({
    checkpoint: vi.fn(),
    begin: vi.fn(),
    commit: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn()
  }))
}));

vi.mock('@domain/workflow/services/edgeManager', () => ({
  EdgeManager: vi.fn(() => ({
    updateTools: vi.fn(),
    getEdgesFromXML: vi.fn(() => []),
    syncFromXML: vi.fn(),
    addWire: vi.fn(),
    removeWire: vi.fn(),
    destroy: vi.fn()
  }))
}));

vi.mock('../utils/XMLClipboard', () => ({
  buildClipboardFragment: vi.fn(() => '<MockFragment/>'),
  applyClipboardFragment: vi.fn(() => ['new-tool-1', 'new-tool-2'])
}));

vi.mock('../data/tools', () => ({
  getToolDefinition: vi.fn((type) => ({
    type,
    name: `${type} Tool`,
    icon: 'icon',
    category: 'inout',
    defaultConfig: { setting: 'default' },
    sockets: [
      { id: 1, direction: 'output', multiple: false },
      { id: 2, direction: 'input', multiple: false }
    ]
  }))
}));

vi.mock('../utils/id', () => ({
  generateUniqueId: vi.fn(() => 'generated-id-123')
}));

vi.mock('@domain/workflow/services/loopDetection', () => ({
  wouldCreateCycle: vi.fn(() => false)
}));

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="react-flow-provider">{children}</div>
}));

// Mock all the components
vi.mock('../components/ToolPalette', () => ({
  default: () => <div data-testid="tool-palette">Tool Palette</div>
}));

vi.mock('../components/Canvas', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { forwardRef } = require('react');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: forwardRef((_props: any, ref: any) => (
      <div data-testid="canvas" ref={ref}>Canvas</div>
    ))
  };
});

vi.mock('../components/XMLViewer', () => ({
  default: () => <div data-testid="xml-viewer">XML Viewer</div>
}));

vi.mock('../components/Header', () => ({
  default: () => <div data-testid="header">Header</div>
}));

vi.mock('../components/Notification', () => ({
  default: () => <div data-testid="notification">Notification</div>
}));

vi.mock('../components/ConfigurationPanel', () => ({
  default: () => <div data-testid="configuration-panel">Configuration Panel</div>
}));

vi.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>
}));

describe('App Basic Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  test('renders main components', () => {
    render(<App />);
    
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('tool-palette')).toBeInTheDocument();
    expect(screen.getByTestId('configuration-panel')).toBeInTheDocument();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();
  });
});
