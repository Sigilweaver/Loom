import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import ToolPalette from './components/ToolPalette';
import Canvas from './components/Canvas';
import XMLViewer from './components/XMLViewer';
import Header from './components/Header';
import Notification from './components/Notification';
import ConfigurationPanel from './components/ConfigurationPanel';
import { Tool, Wire, ToolCategory, WorkflowMeta } from './types/workflow';
import { ToolConfiguration } from './types/configuration';
import { XMLWorkflowManager } from './utils/XMLWorkflowManager';
import { getToolDefinition } from './data/tools';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('favorites');
  const [xmlManager] = useState<XMLWorkflowManager>(() => new XMLWorkflowManager());
  const [xmlViewerVisible, setXmlViewerVisible] = useState(false);
  
  // Derived state from XML
  const [tools, setTools] = useState<Tool[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [workflowMeta, setWorkflowMeta] = useState<WorkflowMeta>({
    name: 'New Workflow',
    description: 'A new workflow',
    author: 'Workflow Designer',
    workflowId: uuidv4(),
    created: new Date().toISOString(),
  });
  
  // Configuration state
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolConfigurations, setToolConfigurations] = useState<Map<string, ToolConfiguration>>(new Map());

  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showNotification = (message: string, type: 'error' | 'warning' | 'success' | 'info') => {
    setNotification({
      message,
      type,
      isVisible: true
    });
  };

  // Update derived state whenever XML changes
  const updateStateFromXML = () => {
    setTools(xmlManager.getTools());
    setWires(xmlManager.getWires());
    setWorkflowMeta(xmlManager.getMetadata());
  };

  // Initialize state from XML
  useEffect(() => {
    updateStateFromXML();
  }, []);

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  // Configuration functions
  const handleConfigurationChange = (toolId: string, config: ToolConfiguration) => {
    setToolConfigurations(prev => new Map(prev.set(toolId, config)));
    
    // Update tool config in tools array if needed
    setTools((prevTools: Tool[]) => 
      prevTools.map((tool: Tool) => 
        tool.id === toolId 
          ? { ...tool, config: { ...tool.config, ...config.parameters } }
          : tool
      )
    );
  };

  const handleToolSelect = (tool: Tool | null) => {
    setSelectedTool(tool);
  };

  // Workflow meta update function
  const handleWorkflowMetaChange = (meta: { name: string; description: string; author: string }) => {
    xmlManager.updateMetadata(meta);
    updateStateFromXML();
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
    setToolConfigurations(new Map());
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
          setToolConfigurations(new Map());

          const meta = xmlManager.getMetadata();
          showNotification(`Workflow "${meta.name}" imported successfully!`, 'success');
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
  };

  const addWire = (from: { tool: string; socket: number }, to: { tool: string; socket: number }) => {
    // Validate connection
    const fromTool = tools.find(t => t.id === from.tool);
    const toTool = tools.find(t => t.id === to.tool);
    
    if (!fromTool || !toTool) return;
    
    const fromSocket = fromTool.sockets.find(s => s.id === from.socket);
    const toSocket = toTool.sockets.find(s => s.id === to.socket);
    
    if (!fromSocket || !toSocket) return;
    
    // Ensure we're connecting output to input
    if (fromSocket.direction !== 'output' || toSocket.direction !== 'input') {
      showNotification('Invalid connection: Can only connect outputs to inputs', 'error');
      return;
    }
    
    // Check if target input already has a connection (unless it allows multiple)
    if (!toSocket.multiple) {
      const existingWire = wires.find(w => w.to.tool === to.tool && w.to.socket === to.socket);
      if (existingWire) {
        showNotification('Input already connected. Disconnect existing wire first.', 'warning');
        return;
      }
    }

    const newWire: Wire = { from, to };
    xmlManager.addWire(newWire);
    updateStateFromXML();
  };

  const removeWire = (wireId: string) => {
    // Parse the wire ID to extract connection info
    const parts = wireId.split('-');
    if (parts.length !== 4) return;
    
    const [fromTool, fromSocket, toTool, toSocket] = parts;
    
    xmlManager.removeWire(
      { tool: fromTool, socket: parseInt(fromSocket) },
      { tool: toTool, socket: parseInt(toSocket) }
    );
    updateStateFromXML();
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
    <div className="h-screen flex flex-col bg-workflow-bg">
      <Header
        onNewWorkflow={newWorkflow}
        onImportWorkflow={importWorkflow}
        onExportXML={exportWorkflow}
        onShowXMLViewer={() => setXmlViewerVisible(true)}
        onPreviewWorkflow={previewWorkflow}
        onShowNotification={showNotification}
        workflowMeta={workflowMeta}
        toolCount={tools.length}
        wireCount={wires.length}
      />
      
      <ToolPalette 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Configuration Panel - Left Side */}
        <ConfigurationPanel
          selectedTool={selectedTool}
          configuration={selectedTool ? toolConfigurations.get(selectedTool.id) || null : null}
          onConfigurationChange={handleConfigurationChange}
          onShowNotification={showNotification}
          workflowMeta={workflowMeta}
          onWorkflowMetaChange={handleWorkflowMetaChange}
        />
        
        <ReactFlowProvider>
          <Canvas 
            tools={tools}
            wires={wires}
            onAddTool={addTool}
            onAddWire={addWire}
            onRemoveWire={removeWire}
            onRemoveTool={removeTool}
            onToolSelect={handleToolSelect}
            onToolMove={moveTool}
          />
        </ReactFlowProvider>
        
        {/* XML Viewer Side Panel */}
        <XMLViewer
          isVisible={xmlViewerVisible}
          xmlContent={xmlManager.toXMLString()}
          onClose={() => setXmlViewerVisible(false)}
        />
      </div>

      {/* Notification System */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        duration={6000}
      />
    </div>
  );
}

export default App;
