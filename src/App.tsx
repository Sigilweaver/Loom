import { useState, useEffect, useMemo, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import ToolPalette from './components/ToolPalette';
import Canvas, { CanvasRef } from './components/Canvas';
import XMLViewer from './components/XMLViewer';
import Header from './components/Header';
import Notification from './components/Notification';
import ConfigurationPanel from './components/ConfigurationPanel';
import { ThemeProvider } from './contexts/ThemeContext';
import { Tool, Wire, ToolCategory } from './domain/workflow/entities/workflow';
import { ToolConfiguration } from './types/configuration';
import { XMLWorkflowManager } from './utils/XMLWorkflowManager';
import { EdgeManager } from '@domain/workflow/services/edgeManager';
import { getToolDefinition } from './data/tools';
import { getConnectionType } from './config/connectionTypes';
import { v4 as uuidv4 } from 'uuid';
import { useWorkflowStore } from '@state/workflowStore';
import { useUIStore, startNotificationAutoHide } from '@state/uiStore';
import { wouldCreateCycle } from '@domain/workflow/services/loopDetection';

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('favorites');
  const [xmlManager] = useState<XMLWorkflowManager>(() => new XMLWorkflowManager());
  const [xmlViewerVisible, setXmlViewerVisible] = useState(false);
  
  // Derived state from XML
  const tools = useWorkflowStore(s => s.tools);
  const wires = useWorkflowStore(s => s.wires);
  const workflowMeta = useWorkflowStore(s => s.workflowMeta);
  const edges = useWorkflowStore(s => s.edges);
  const selectedTool = useWorkflowStore(s => s.selectedTool);
  const toolConfigurations = useWorkflowStore(s => s.toolConfigurations);
  const setFromXML = useWorkflowStore(s => s.setFromXML);
  const setEdges = useWorkflowStore(s => s.setEdges);
  const setSelectedTool = useWorkflowStore(s => s.setSelectedTool);
  const setToolConfigurations = useWorkflowStore(s => s.setToolConfigurations);
  const updateWorkflowMetaLocal = useWorkflowStore(s => s.updateWorkflowMeta);
  
  // Edge manager for optimistic updates
  const edgeManager = useMemo(() => new EdgeManager(
    xmlManager,
    (updater) => {
      // Apply functional update using current store edges
      const current = useWorkflowStore.getState().edges;
      const next = updater(current);
      setEdges(next);
    },
    []
  ), [xmlManager, setEdges]);
  
  // Update edgeManager with current tools whenever tools change
  useEffect(() => {
    edgeManager.updateTools(tools);
  }, [edgeManager, tools]);
  
  // Canvas ref for calling fitView
  const canvasRef = useRef<CanvasRef>(null);
  
  // Configuration state
  // selectedTool & toolConfigurations now from store

  // UI notifications via store
  const notification = useUIStore(s => s.notification);
  const showNotification = useUIStore(s => s.showNotification);
  const hideNotification = useUIStore(s => s.hideNotification);
  useEffect(() => { startNotificationAutoHide(); }, []);

  // Update derived state whenever XML changes (excluding edges - managed separately)
  const updateStateFromXML = () => {
    setFromXML(xmlManager.getTools(), xmlManager.getWires(), xmlManager.getMetadata());
  };

  // Rebuild tool configurations from XML data
  const rebuildToolConfigurations = () => {
    const tools = xmlManager.getTools();
    const newConfigurations = new Map<string, ToolConfiguration>();

    tools.forEach(tool => {
      if (tool.config && Object.keys(tool.config).length > 0) {
        // Extract Category and Type from config
        // const category = tool.config.Category;
        const type = tool.config.Type;
        
        // Create a copy of config without Category and Type for parameters
        const parameters = { ...tool.config };
        delete parameters.Category;
        delete parameters.Type;

        // Only create configuration if we have meaningful parameters or connection type
        if (type || Object.keys(parameters).length > 0) {
          const configuration: ToolConfiguration = {
            toolId: tool.id,
            toolType: tool.type,
            connectionType: typeof type === 'string' ? type : '',
            parameters,
            isValid: true, // Assume valid since it came from XML
            errors: []
          };
          
          newConfigurations.set(tool.id, configuration);
        }
      }
    });

    setToolConfigurations(newConfigurations);
  };

  // Get configuration for a tool, creating it from XML data if not in map
  const getToolConfiguration = (tool: Tool): ToolConfiguration | null => {
    // First check if we have it in the map
    const existingConfig = toolConfigurations.get(tool.id);
    if (existingConfig) {
      return existingConfig;
    }

    // If not in map but tool has config in XML, create configuration
    if (tool.config && Object.keys(tool.config).length > 0) {
      const type = tool.config.Type;
      
      // Create a copy of config without Category and Type for parameters
      const parameters = { ...tool.config };
      delete parameters.Category;
      delete parameters.Type;

      if (type || Object.keys(parameters).length > 0) {
        return {
          toolId: tool.id,
          toolType: tool.type,
          connectionType: typeof type === 'string' ? type : '',
          parameters,
          isValid: true,
          errors: []
        };
      }
    }

    return null;
  };

  // Initialize state from XML
  useEffect(() => {
    updateStateFromXML();
    rebuildToolConfigurations(); // Load configurations from initial XML
    // Initialize edges from XML
    setEdges(edgeManager.getEdgesFromXML());
    
    // Cleanup EdgeManager on unmount
    return () => {
      edgeManager.destroy();
    };
  }, []);

  // hideNotification now from store

  // Configuration functions
  const handleConfigurationChange = (toolId: string, config: ToolConfiguration) => {
  const newMap = new Map(toolConfigurations);
  newMap.set(toolId, config);
  setToolConfigurations(newMap);
    
    // Find the connection type to get its category (File/Database)
    const connectionType = config.connectionType ? getConnectionType(config.connectionType) : null;
    
    // Update tool config in tools array and XML
  // Update in local store mirror (XML is source of truth; we rebuild from XML below)
  // We'll rely on updateStateFromXML after xmlManager update
    
    // Update the XML with the new configuration including Category and Type
    const configWithMeta = {
      ...config.parameters,
      ...(connectionType && { Category: connectionType.category === 'file' ? 'File' : 'Database' }),
      ...(config.connectionType && { Type: config.connectionType })
    };
    xmlManager.updateToolConfiguration(toolId, configWithMeta);
  };

  const handleToolSelect = (tool: Tool | null) => {
    setSelectedTool(tool);
  };

  // Workflow meta update function
  const handleWorkflowMetaChange = (meta: { name: string; description: string; author: string }) => {
    // Update local state immediately for responsive UI
  updateWorkflowMetaLocal(meta);
    
    // Update XML in background
    xmlManager.updateMetadata(meta);
  };

  // Listen for menu actions from Electron
  useEffect(() => {
    // Remove Electron menu listener for pure web app
    // if (window.electronAPI) {
    //   window.electronAPI.onMenuAction((action: string, data?: any) => {
    //     handleMenuAction(action, data);
    //   });
    // }
  }, []);

  const newWorkflow = () => {
    xmlManager.newWorkflow();
    updateStateFromXML();
    setSelectedTool(null);
    setToolConfigurations(new Map()); // New workflow has no configurations
    // Reset edges
    setEdges(edgeManager.getEdgesFromXML());
  };

  const importWorkflow = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const xmlContent = e.target?.result as string;
          xmlManager.loadFromXML(xmlContent);
          updateStateFromXML();
          setSelectedTool(null);
          rebuildToolConfigurations(); // Rebuild configurations from imported XML
          // Reset edges from new XML
          setEdges(edgeManager.getEdgesFromXML());

          const meta = xmlManager.getMetadata();
          showNotification(`Workflow "${meta.name}" imported successfully!`, 'success');
          
          // Fit the view to show the entire imported workflow
          setTimeout(() => {
            canvasRef.current?.fitView();
          }, 100);
        } catch (error) {
          console.error('Error importing workflow:', error);
          showNotification('Failed to import workflow. Please check the XML format.', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportWorkflow = async () => {
    const xml = xmlManager.toXMLString();
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowMeta.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewWorkflow = () => {
    // Preview functionality - show a modal or side panel with workflow results preview
    showNotification('Preview functionality will show expected workflow output and flow analysis. Coming soon!', 'info');
  };

  const addTool = (toolType: string, x: number, y: number) => {
    const definition = getToolDefinition(toolType);
    if (!definition) return;

    const newTool: Tool = {
      id: uuidv4(),
      type: toolType,
      x,
      y,
      config: { ...definition.defaultConfig },
      sockets: [...definition.sockets],
    };

    xmlManager.addTool(newTool);
    updateStateFromXML();
    // Sync edges after tool addition to ensure consistency
    edgeManager.syncFromXML();
  };

  const addWire = (from: { tool: string; socket: number }, to: { tool: string; socket: number }) => {
    const fromTool = tools.find(t => t.id === from.tool);
    const toTool = tools.find(t => t.id === to.tool);
    if (!fromTool || !toTool) return;
    const fromSocket = fromTool.sockets.find(s => s.id === from.socket);
    const toSocket = toTool.sockets.find(s => s.id === to.socket);
    if (!fromSocket || !toSocket) return;
    if (fromSocket.direction !== 'output' || toSocket.direction !== 'input') { showNotification('Invalid connection: Can only connect outputs to inputs', 'error'); return; }
    if (!toSocket.multiple) {
      const existingWire = wires.find(w => w.to.tool === to.tool && w.to.socket === to.socket);
      if (existingWire) { showNotification('Input already connected. Disconnect existing wire first.', 'warning'); return; }
    }
    const createsCycle = wouldCreateCycle(tools, wires, from.tool, to.tool);
    const newWire: Wire = { from, to };
    try {
      edgeManager.addWire(newWire);
      updateStateFromXML();
      if (createsCycle) {
        const fromName = getToolDefinition(fromTool.type)?.name || 'Unknown';
        const toName = getToolDefinition(toTool.type)?.name || 'Unknown';
        showNotification(`Connection "${fromName}" to "${toName}" creates a loop.`, 'warning');
        const edgeId = `${encodeURIComponent(from.tool)}_${from.socket}_${encodeURIComponent(to.tool)}_${to.socket}`;
        setTimeout(() => { removeWire(edgeId); }, 3000);
      }
    } catch (error) { showNotification('Failed to create connection', 'error'); }
  };

  const removeWire = (wireId: string) => {
    try {
      edgeManager.removeWire(wireId);
      // Update wires state for validation logic (but not edges - EdgeManager handles that)
      updateStateFromXML();
    } catch (error) {
      showNotification('Failed to remove connection', 'error');
    }
  };

  const removeTool = (toolId: string) => {
    xmlManager.removeTool(toolId);
    updateStateFromXML();
  };

  const moveTool = (toolId: string, x: number, y: number) => {
    xmlManager.updateToolPosition(toolId, x, y);
    updateStateFromXML();
  };

  return (
    <ThemeProvider>
      <div className="h-screen flex flex-col bg-theme-surface-page">
        <Header
          onNewWorkflow={newWorkflow}
          onImportWorkflow={importWorkflow}
          onExportXML={exportWorkflow}
          onShowXMLViewer={() => setXmlViewerVisible(true)}
          onPreviewWorkflow={previewWorkflow}
          onShowNotification={showNotification}
          workflowMeta={workflowMeta}
        />
        
        <ToolPalette 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
        
        <div className="flex-1 flex overflow-hidden">
          {/* Configuration Panel - Left Side */}
          <ConfigurationPanel
            selectedTool={selectedTool}
            configuration={selectedTool ? getToolConfiguration(selectedTool) : null}
            onConfigurationChange={handleConfigurationChange}
            onShowNotification={showNotification}
            workflowMeta={workflowMeta}
            onWorkflowMetaChange={handleWorkflowMetaChange}
          />
          
          <ReactFlowProvider>
            <div className="flex-1 flex">
              <Canvas 
                ref={canvasRef}
                tools={tools}
                wires={wires}
                edges={edges}
                onAddTool={addTool}
                onAddWire={addWire}
                onRemoveWire={removeWire}
                onRemoveTool={removeTool}
                onToolSelect={handleToolSelect}
                onToolMove={moveTool}
              />
              
              {/* XML Viewer Side Panel */}
              {xmlViewerVisible && (
                <XMLViewer
                  isVisible={xmlViewerVisible}
                  xmlContent={xmlManager.toXMLString()}
                  onClose={() => setXmlViewerVisible(false)}
                />
              )}
            </div>
          </ReactFlowProvider>
        </div>

        {/* Notification System */}
        <Notification
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={hideNotification}
          duration={notification.duration}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
