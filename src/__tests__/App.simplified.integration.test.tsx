import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useWorkflowStore } from '../state/workflowStore';
import { useUIStore } from '../state/uiStore';

// Mock XMLWorkflowManager
const mockXMLManager = {
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
};

vi.mock('../utils/XMLWorkflowManager', () => ({
  XMLWorkflowManager: vi.fn(() => mockXMLManager)
}));

// Mock HistoryManager
const mockHistoryManager = {
  checkpoint: vi.fn(),
  begin: vi.fn(),
  commit: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn()
};

vi.mock('../utils/HistoryManager', () => ({
  HistoryManager: vi.fn(() => mockHistoryManager)
}));

// Mock EdgeManager
const mockEdgeManager = {
  updateTools: vi.fn(),
  getEdgesFromXML: vi.fn(() => []),
  syncFromXML: vi.fn(),
  addWire: vi.fn(),
  removeWire: vi.fn(),
  destroy: vi.fn()
};

vi.mock('@domain/workflow/services/edgeManager', () => ({
  EdgeManager: vi.fn(() => mockEdgeManager)
}));

// Mock other utilities
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

// Mock components with callback support
vi.mock('../components/Header', () => ({
  default: ({ onNewWorkflow, onImportWorkflow, onExportXML, onShowXMLViewer, onPreviewWorkflow, workflowMeta }: any) => (
    <div data-testid="header">
      <button data-testid="new-workflow" onClick={onNewWorkflow}>New</button>
      <button data-testid="import-workflow" onClick={onImportWorkflow}>Import</button>
      <button data-testid="export-workflow" onClick={onExportXML}>Export</button>
      <button data-testid="show-xml-viewer" onClick={onShowXMLViewer}>XML Viewer</button>
      <button data-testid="preview-workflow" onClick={onPreviewWorkflow}>Preview</button>
      <span data-testid="workflow-name">{workflowMeta.name}</span>
    </div>
  )
}));

vi.mock('../components/ToolPalette', () => ({
  default: ({ activeTab, onTabChange }: any) => (
    <div data-testid="tool-palette">
      <button data-testid="tab-favorites" onClick={() => onTabChange('favorites')}>Favorites</button>
      <button data-testid="tab-inout" onClick={() => onTabChange('inout')}>Input/Output</button>
      <span data-testid="active-tab">{activeTab}</span>
    </div>
  )
}));

vi.mock('../components/ConfigurationPanel', () => ({
  default: ({ selectedTool, onWorkflowMetaChange }: any) => (
    <div data-testid="configuration-panel">
      <span data-testid="selected-tool-id">{selectedTool?.id || 'none'}</span>
      <button 
        data-testid="update-metadata" 
        onClick={() => onWorkflowMetaChange({ name: 'Updated Name', description: 'Updated Description', author: 'Updated Author' })}
      >
        Update Metadata
      </button>
    </div>
  )
}));

vi.mock('../components/Canvas', () => {
  const forwardRef = require('react').forwardRef;
  return {
    default: forwardRef((props: any, ref: any) => (
      <div data-testid="canvas" ref={ref}>
        <button 
          data-testid="canvas-add-tool" 
          onClick={() => props.onAddTool && props.onAddTool('Input', 100, 200)}
        >
          Add Tool
        </button>
        <button 
          data-testid="canvas-select-tool" 
          onClick={() => props.onToolSelect && props.onToolSelect({ id: 'tool-1', type: 'Input', x: 100, y: 200, config: {}, sockets: [] })}
        >
          Select Tool
        </button>
      </div>
    ))
  };
});

vi.mock('../components/XMLViewer', () => ({
  default: ({ isVisible, xmlContent, onClose }: any) => isVisible ? (
    <div data-testid="xml-viewer">
      <span data-testid="xml-content">{xmlContent}</span>
      <button data-testid="close-xml-viewer" onClick={onClose}>Close</button>
    </div>
  ) : null
}));

vi.mock('../components/Notification', () => ({
  default: ({ message, type, isVisible, onClose }: any) => isVisible ? (
    <div data-testid="notification" data-type={type}>
      <span data-testid="notification-message">{message}</span>
      <button data-testid="close-notification" onClick={onClose}>Close</button>
    </div>
  ) : null
}));

vi.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>
}));

describe('App Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset stores
    useWorkflowStore.setState({
      tools: [],
      wires: [],
      edges: [],
      workflowMeta: {
        name: 'Test Workflow',
        description: 'Test Description',
        author: 'Test Author',
        workflowId: 'test-id',
        created: '2025-09-01T00:00:00.000Z'
      },
      selectedTool: null
    });

    useUIStore.setState({
      notification: { message: '', type: 'info', isVisible: false, duration: 6000 }
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Mock file operations
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
    global.FileReader = class {
      onload: ((event: any) => void) | null = null;
      readAsText(_file: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: '<Workflow>Imported XML</Workflow>' } });
          }
        }, 0);
      }
    } as any;

    // Mock DOM methods
    const mockClick = vi.fn();
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    global.document.createElement = vi.fn((tag: string) => {
      if (tag === 'input') {
        return {
          type: '',
          accept: '',
          onchange: null,
          click: mockClick,
          files: null
        } as any;
      }
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: mockClick
        } as any;
      }
      return {} as any;
    });
    global.document.body.appendChild = mockAppendChild;
    global.document.body.removeChild = mockRemoveChild;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    test('renders all main components', () => {
      render(<App />);
      
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('tool-palette')).toBeInTheDocument();
      expect(screen.getByTestId('configuration-panel')).toBeInTheDocument();
      expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    test('initializes with correct workflow metadata', () => {
      render(<App />);
      
      expect(screen.getByTestId('workflow-name')).toHaveTextContent('Test Workflow');
    });

    test('starts with no tool selected', () => {
      render(<App />);
      
      expect(screen.getByTestId('selected-tool-id')).toHaveTextContent('none');
    });

    test('initializes XML manager and history', () => {
      render(<App />);
      
      expect(mockXMLManager.getTools).toHaveBeenCalled();
      expect(mockXMLManager.getWires).toHaveBeenCalled();
      expect(mockXMLManager.getMetadata).toHaveBeenCalled();
    });
  });

  describe('Workflow Operations', () => {
    test('creates new workflow', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('new-workflow'));
      
      expect(mockHistoryManager.checkpoint).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Before New');
      expect(mockXMLManager.newWorkflow).toHaveBeenCalled();
      expect(useWorkflowStore.getState().selectedTool).toBeNull();
    });

    test('exports workflow to file', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('export-workflow'));
      
      expect(mockXMLManager.toXMLString).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });

    test('shows preview notification', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('preview-workflow'));
      
      await waitFor(() => {
        expect(screen.getByTestId('notification')).toBeInTheDocument();
        expect(screen.getByTestId('notification-message')).toHaveTextContent(/Preview functionality/);
      });
    });
  });

  describe('Tool Selection and Canvas Integration', () => {
    test('adds tool through canvas', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-add-tool'));
      
      expect(mockHistoryManager.checkpoint).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Before Add Tool');
      expect(mockXMLManager.addTool).toHaveBeenCalledWith(expect.objectContaining({
        id: 'generated-id-123',
        type: 'Input',
        x: 100,
        y: 200
      }));
    });

    test('selects tool through canvas', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-select-tool'));
      
      expect(screen.getByTestId('selected-tool-id')).toHaveTextContent('tool-1');
      expect(useWorkflowStore.getState().selectedTool?.id).toBe('tool-1');
    });

    test('updates workflow metadata', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('update-metadata'));
      
      expect(mockXMLManager.updateMetadata).toHaveBeenCalledWith({
        name: 'Updated Name',
        description: 'Updated Description',
        author: 'Updated Author'
      });
    });
  });

  describe('UI Integration', () => {
    test('changes tool palette tab', async () => {
      render(<App />);
      
      expect(screen.getByTestId('active-tab')).toHaveTextContent('favorites');
      
      await user.click(screen.getByTestId('tab-inout'));
      
      expect(screen.getByTestId('active-tab')).toHaveTextContent('inout');
    });

    test('toggles XML viewer', async () => {
      render(<App />);
      
      expect(screen.queryByTestId('xml-viewer')).not.toBeInTheDocument();
      
      await user.click(screen.getByTestId('show-xml-viewer'));
      
      expect(screen.getByTestId('xml-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('xml-content')).toHaveTextContent('<Workflow>Test XML</Workflow>');
      
      await user.click(screen.getByTestId('close-xml-viewer'));
      
      expect(screen.queryByTestId('xml-viewer')).not.toBeInTheDocument();
    });

    test('handles notification display and dismissal', async () => {
      render(<App />);
      
      // Trigger a notification through preview
      await user.click(screen.getByTestId('preview-workflow'));
      
      await waitFor(() => {
        expect(screen.getByTestId('notification')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('close-notification'));
      
      expect(screen.queryByTestId('notification')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles XML import errors gracefully', async () => {
      // Mock FileReader to simulate error
      global.FileReader = class {
        onload: ((event: any) => void) | null = null;
        readAsText(_file: File) {
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: { result: 'Invalid XML Content' } });
            }
          }, 0);
        }
      } as any;

      mockXMLManager.loadFromXML.mockImplementation(() => {
        throw new Error('Invalid XML');
      });

      render(<App />);
      
      const mockFile = new File(['Invalid'], 'test.swwf');
      const input = { files: [mockFile] } as any;
      
      vi.mocked(global.document.createElement).mockReturnValue({
        ...input,
        type: '',
        accept: '',
        onchange: null,
        click: vi.fn(function(this: any) {
          if (this.onchange) {
            this.onchange({ target: input });
          }
        })
      } as any);

      await user.click(screen.getByTestId('import-workflow'));

      await waitFor(() => {
        expect(screen.getByTestId('notification')).toBeInTheDocument();
        expect(screen.getByTestId('notification-message')).toHaveTextContent(/Failed to import workflow/);
        expect(screen.getByTestId('notification')).toHaveAttribute('data-type', 'error');
      });
    });
  });
});
