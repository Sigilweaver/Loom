import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import ToolPalette from './components/ToolPalette';
import Canvas from './components/Canvas';
import XMLViewer from './components/XMLViewer';
import Header from './components/Header';
import Notification from './components/Notification';
import { Workflow, Tool, Wire, ToolCategory } from './types/workflow';
import { generateWorkflowXML } from './utils/xmlGenerator';
import { getToolDefinition } from './data/tools';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('favorites');
  const [tools, setTools] = useState<Tool[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [xmlViewerVisible, setXmlViewerVisible] = useState(false);
  const [workflowMeta, setWorkflowMeta] = useState({
    name: 'New Workflow',
    description: 'A new workflow',
    author: 'Workflow Designer',
    workflowId: uuidv4(),
    created: new Date().toISOString(),
  });

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

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
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
    setTools([]);
    setWires([]);
    setWorkflowMeta({
      name: 'New Workflow',
      description: 'A new workflow',
      author: 'Workflow Designer',
      workflowId: uuidv4(),
      created: new Date().toISOString(),
    });
  };

    const exportWorkflow = async () => {
    const workflow: Workflow = {
      version: '1.0',
      xmlns: 'https://example.com/workflow-schema',
      meta: workflowMeta,
      layout: {
        id: 'root',
        name: 'Root Container',
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
        tools: tools,
      },
      wires: wires,
    };

    const xml = generateWorkflowXML(workflow);
    
    // Web app direct download
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowMeta.name}.xml`;
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

    setTools((prev: Tool[]) => [...prev, newTool]);
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
    setWires((prev: Wire[]) => [...prev, newWire]);
  };

  const removeWire = (wireId: string) => {
    // Parse the wire ID to extract connection info
    const parts = wireId.split('-');
    if (parts.length !== 4) return;
    
    const [fromTool, fromSocket, toTool, toSocket] = parts;
    
    setWires((prev: Wire[]) => 
      prev.filter(wire => 
        !(wire.from.tool === fromTool && 
          wire.from.socket === parseInt(fromSocket) && 
          wire.to.tool === toTool && 
          wire.to.socket === parseInt(toSocket))
      )
    );
  };

  const removeTool = (toolId: string) => {
    // Remove the tool
    setTools((prev: Tool[]) => prev.filter(tool => tool.id !== toolId));
    
    // Remove any wires connected to this tool
    setWires((prev: Wire[]) => 
      prev.filter(wire => 
        wire.from.tool !== toolId && wire.to.tool !== toolId
      )
    );
  };

  return (
    <div className="h-screen flex flex-col bg-workflow-bg">
      <Header
        onNewWorkflow={newWorkflow}
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
        <ReactFlowProvider>
          <Canvas 
            tools={tools}
            wires={wires}
            onAddTool={addTool}
            onAddWire={addWire}
            onRemoveWire={removeWire}
            onRemoveTool={removeTool}
            onToolMove={(toolId: string, x: number, y: number) => {
              setTools((prev: Tool[]) => prev.map((tool: Tool) => 
                tool.id === toolId ? { ...tool, x, y } : tool
              ));
            }}
          />
        </ReactFlowProvider>
        
        {/* XML Viewer Side Panel */}
        <XMLViewer
          isVisible={xmlViewerVisible}
          tools={tools}
          wires={wires}
          workflowMeta={workflowMeta}
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
