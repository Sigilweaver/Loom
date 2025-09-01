import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { XMLWorkflowManager } from '../utils/XMLWorkflowManager';
import { HistoryManager } from '../utils/HistoryManager';
import { useWorkflowStore } from '../state/workflowStore';
import { useUIStore } from '../state/uiStore';

// Mock heavy dependencies
vi.mock('../utils/XMLWorkflowManager');
vi.mock('../utils/HistoryManager');
vi.mock('../utils/XMLClipboard', () => ({
  buildClipboardFragment: vi.fn(() => '<MockFragment/>'),
  applyClipboardFragment: vi.fn(() => ['new-tool-1', 'new-tool-2'])
}));

// Mock React Flow Provider and components
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="react-flow-provider">{children}</div>
}));

// Mock complex UI components
vi.mock('./components/Canvas', () => ({
  default: vi.fn(({ onAddTool, onToolSelect, onAddWire, onRemoveWire, onRemoveTool, onToolMove, onBatchAdd, onBuildCopyFragment, onPasteXMLAt, onBeginTransaction, onCommitTransaction }) => (
    <div data-testid="canvas">
      <button 
        data-testid="canvas-add-tool" 
        onClick={() => onAddTool('Input', 100, 200)}
      >
        Add Tool
      </button>
      <button 
        data-testid="canvas-select-tool" 
        onClick={() => onToolSelect({ id: 'tool-1', type: 'Input', x: 100, y: 200, config: {}, sockets: [] })}
      >
        Select Tool
      </button>
      <button 
        data-testid="canvas-add-wire" 
        onClick={() => onAddWire({ tool: 'tool-1', socket: 1 }, { tool: 'tool-2', socket: 1 })}
      >
        Add Wire
      </button>
      <button 
        data-testid="canvas-remove-wire" 
        onClick={() => onRemoveWire('wire-1')}
      >
        Remove Wire
      </button>
      <button 
        data-testid="canvas-remove-tool" 
        onClick={() => onRemoveTool('tool-1')}
      >
        Remove Tool
      </button>
      <button 
        data-testid="canvas-move-tool" 
        onClick={() => onToolMove('tool-1', 300, 400)}
      >
        Move Tool
      </button>
      <button 
        data-testid="canvas-batch-add" 
        onClick={() => onBatchAdd([{ id: 'batch-1', type: 'Input', x: 50, y: 50 }], [])}
      >
        Batch Add
      </button>
      <button 
        data-testid="canvas-copy" 
        onClick={() => onBuildCopyFragment(['tool-1'])}
      >
        Copy
      </button>
      <button 
        data-testid="canvas-paste" 
        onClick={() => onPasteXMLAt({ x: 200, y: 200 }, '<MockFragment/>')}
      >
        Paste
      </button>
      <button 
        data-testid="canvas-begin-transaction" 
        onClick={() => onBeginTransaction()}
      >
        Begin Transaction
      </button>
      <button 
        data-testid="canvas-commit-transaction" 
        onClick={() => onCommitTransaction()}
      >
        Commit Transaction
      </button>
    </div>
  ))
}));

vi.mock('./components/Header', () => ({
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

vi.mock('./components/ToolPalette', () => ({
  default: ({ activeTab, onTabChange }: any) => (
    <div data-testid="tool-palette">
      <button data-testid="tab-favorites" onClick={() => onTabChange('favorites')}>Favorites</button>
      <button data-testid="tab-inout" onClick={() => onTabChange('inout')}>Input/Output</button>
      <span data-testid="active-tab">{activeTab}</span>
    </div>
  )
}));

vi.mock('./components/ConfigurationPanel', () => ({
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

vi.mock('./components/XMLViewer', () => ({
  default: ({ isVisible, xmlContent, onClose }: any) => isVisible ? (
    <div data-testid="xml-viewer">
      <span data-testid="xml-content">{xmlContent}</span>
      <button data-testid="close-xml-viewer" onClick={onClose}>Close</button>
    </div>
  ) : null
}));

vi.mock('./components/Notification', () => ({
  default: ({ message, type, isVisible, onClose }: any) => isVisible ? (
    <div data-testid="notification" data-type={type}>
      <span data-testid="notification-message">{message}</span>
      <button data-testid="close-notification" onClick={onClose}>Close</button>
    </div>
  ) : null
}));

vi.mock('./contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>
}));

// Mock data tools
vi.mock('./data/tools', () => ({
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

// Mock ID generation
vi.mock('./utils/id', () => ({
  generateUniqueId: vi.fn(() => 'generated-id-123')
}));

// Mock loop detection
vi.mock('./domain/workflow/services/loopDetection', () => ({
  wouldCreateCycle: vi.fn(() => false)
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

vi.mock('./domain/workflow/services/edgeManager', () => ({
  EdgeManager: vi.fn(() => mockEdgeManager)
}));

describe('App Integration Tests', () => {
  let mockXMLManager: any;
  let mockHistoryManager: any;
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

    // Setup XMLWorkflowManager mock
    mockXMLManager = {
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

    // Setup HistoryManager mock
    mockHistoryManager = {
      checkpoint: vi.fn(),
      begin: vi.fn(),
      commit: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    };

    vi.mocked(XMLWorkflowManager).mockImplementation(() => mockXMLManager);
    vi.mocked(HistoryManager).mockImplementation(() => mockHistoryManager);

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
    global.document.createElement = vi.fn((tag) => {
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
      
      expect(XMLWorkflowManager).toHaveBeenCalled();
      expect(HistoryManager).toHaveBeenCalled();
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

    test('imports workflow from file', async () => {
      render(<App />);
      
      const mockFile = new File(['<Workflow>Imported</Workflow>'], 'test.swwf', { type: 'application/xml' });
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
        expect(mockHistoryManager.checkpoint).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Before Import');
        expect(mockXMLManager.loadFromXML).toHaveBeenCalledWith('<Workflow>Imported XML</Workflow>');
      });
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

    test('removes tool through canvas', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-remove-tool'));
      
      expect(mockHistoryManager.checkpoint).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Before Delete Tool');
      expect(mockXMLManager.removeTool).toHaveBeenCalledWith('tool-1');
    });

    test('moves tool through canvas', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-move-tool'));
      
      expect(mockXMLManager.updateToolPosition).toHaveBeenCalledWith('tool-1', 300, 400);
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

  describe('Wire Management', () => {
    beforeEach(() => {
      // Setup tools for wire operations
      mockXMLManager.getTools.mockReturnValue([
        {
          id: 'tool-1',
          type: 'Input',
          sockets: [{ id: 1, direction: 'output', multiple: false }]
        },
        {
          id: 'tool-2', 
          type: 'Filter',
          sockets: [{ id: 1, direction: 'input', multiple: false }]
        }
      ]);
    });

    test('adds wire through canvas', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-add-wire'));
      
      expect(mockEdgeManager.addWire).toHaveBeenCalledWith({
        from: { tool: 'tool-1', socket: 1 },
        to: { tool: 'tool-2', socket: 1 }
      });
      expect(mockHistoryManager.checkpoint).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Before Connect');
    });

    test('removes wire through canvas', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-remove-wire'));
      
      expect(mockEdgeManager.removeWire).toHaveBeenCalledWith('wire-1');
      expect(mockHistoryManager.checkpoint).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Before Disconnect');
    });

    test('validates wire connections', async () => {
      // Setup invalid connection (input to input)
      mockXMLManager.getTools.mockReturnValue([
        {
          id: 'tool-1',
          type: 'Input',
          sockets: [{ id: 1, direction: 'input', multiple: false }]
        },
        {
          id: 'tool-2',
          type: 'Filter', 
          sockets: [{ id: 1, direction: 'input', multiple: false }]
        }
      ]);

      render(<App />);
      
      await user.click(screen.getByTestId('canvas-add-wire'));
      
      await waitFor(() => {
        expect(screen.getByTestId('notification')).toBeInTheDocument();
        expect(screen.getByTestId('notification-message')).toHaveTextContent(/Invalid connection/);
      });
      expect(mockEdgeManager.addWire).not.toHaveBeenCalled();
    });
  });

  describe('Clipboard Operations', () => {
    test('handles copy operation', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-copy'));
      
      expect(mockXMLManager.toXMLString).toHaveBeenCalled();
    });

    test('handles paste operation', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-paste'));
      
      expect(mockHistoryManager.begin).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Paste');
      expect(mockHistoryManager.commit).toHaveBeenCalled();
    });

    test('handles batch add operation', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-batch-add'));
      
      expect(mockHistoryManager.begin).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Paste');
      expect(mockXMLManager.addTool).toHaveBeenCalledWith(expect.objectContaining({
        id: 'batch-1',
        type: 'Input',
        x: 50,
        y: 50
      }));
    });
  });

  describe('History Management', () => {
    test('handles transaction operations', async () => {
      render(<App />);
      
      await user.click(screen.getByTestId('canvas-begin-transaction'));
      expect(mockHistoryManager.begin).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', 'Move Nodes');
      
      await user.click(screen.getByTestId('canvas-commit-transaction'));
      expect(mockHistoryManager.commit).toHaveBeenCalledWith('<Workflow>Test XML</Workflow>', { label: 'Move Nodes' });
    });

    test('handles undo with Ctrl+Z', async () => {
      mockHistoryManager.undo.mockReturnValue({ xml: '<Workflow>Undo XML</Workflow>' });
      
      render(<App />);
      
      await user.keyboard('{Control>}z{/Control}');
      
      expect(mockHistoryManager.undo).toHaveBeenCalled();
      expect(mockXMLManager.loadFromXML).toHaveBeenCalledWith('<Workflow>Undo XML</Workflow>');
    });

    test('handles redo with Ctrl+Shift+Z', async () => {
      mockHistoryManager.redo.mockReturnValue({ xml: '<Workflow>Redo XML</Workflow>' });
      
      render(<App />);
      
      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
      
      expect(mockHistoryManager.redo).toHaveBeenCalled();
      expect(mockXMLManager.loadFromXML).toHaveBeenCalledWith('<Workflow>Redo XML</Workflow>');
    });

    test('ignores undo/redo when typing in input', async () => {
      render(
        <div>
          <App />
          <input data-testid="text-input" />
        </div>
      );
      
      const input = screen.getByTestId('text-input');
      await user.click(input);
      await user.keyboard('{Control>}z{/Control}');
      
      expect(mockHistoryManager.undo).not.toHaveBeenCalled();
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

    test('handles history operation errors', async () => {
      mockHistoryManager.undo.mockReturnValue({ xml: 'Invalid XML' });
      mockXMLManager.loadFromXML.mockImplementation(() => {
        throw new Error('History restore failed');
      });
      
      // Spy on console.error to verify error logging
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<App />);
      
      await user.keyboard('{Control>}z{/Control}');
      
      expect(consoleSpy).toHaveBeenCalledWith('History restore failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    test('handles wire creation errors', async () => {
      mockEdgeManager.addWire.mockImplementation(() => {
        throw new Error('Wire creation failed');
      });

      mockXMLManager.getTools.mockReturnValue([
        {
          id: 'tool-1',
          type: 'Input',
          sockets: [{ id: 1, direction: 'output', multiple: false }]
        },
        {
          id: 'tool-2',
          type: 'Filter',
          sockets: [{ id: 1, direction: 'input', multiple: false }]
        }
      ]);

      render(<App />);
      
      await user.click(screen.getByTestId('canvas-add-wire'));
      
      await waitFor(() => {
        expect(screen.getByTestId('notification')).toBeInTheDocument();
        expect(screen.getByTestId('notification-message')).toHaveTextContent(/Failed to create connection/);
      });
    });
  });

  describe('Cleanup', () => {
    test('cleans up edge manager on unmount', () => {
      const { unmount } = render(<App />);
      
      unmount();
      
      expect(mockEdgeManager.destroy).toHaveBeenCalled();
    });

    test('removes keyboard event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(<App />);
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});
