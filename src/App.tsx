import { useState, useEffect } from 'react';
import ToolPalette from './components/ToolPalette';
import Canvas from './components/Canvas';
import XMLViewer from './components/XMLViewer';
import Header from './components/Header';
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

  const validateWorkflow = () => {
    // Basic validation - check for cycles
    const hasLoops = detectLoops();
    if (hasLoops) {
      alert('Warning: Workflow contains loops!');
    } else {
      alert('Workflow validation passed!');
    }
  };

  const detectLoops = (): boolean => {
    // Simple cycle detection using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (toolId: string): boolean => {
      visited.add(toolId);
      recursionStack.add(toolId);

      const outgoingWires = wires.filter((wire: Wire) => wire.from.tool === toolId);
      
      for (const wire of outgoingWires) {
        const nextToolId = wire.to.tool;
        
        if (!visited.has(nextToolId)) {
          if (hasCycle(nextToolId)) {
            return true;
          }
        } else if (recursionStack.has(nextToolId)) {
          return true;
        }
      }

      recursionStack.delete(toolId);
      return false;
    };

    for (const tool of tools) {
      if (!visited.has(tool.id)) {
        if (hasCycle(tool.id)) {
          return true;
        }
      }
    }

    return false;
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
      alert('Invalid connection: Can only connect outputs to inputs');
      return;
    }
    
    // Check if target input already has a connection (unless it allows multiple)
    if (!toSocket.multiple) {
      const existingWire = wires.find(w => w.to.tool === to.tool && w.to.socket === to.socket);
      if (existingWire) {
        alert('Input already connected. Disconnect existing wire first.');
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

  return (
    <div className="h-screen flex flex-col bg-workflow-bg">
      <Header
        onNewWorkflow={newWorkflow}
        onExportXML={exportWorkflow}
        onShowXMLViewer={() => setXmlViewerVisible(true)}
        onValidateWorkflow={validateWorkflow}
        workflowMeta={workflowMeta}
        toolCount={tools.length}
        wireCount={wires.length}
      />
      
      <ToolPalette 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Canvas 
          tools={tools}
          wires={wires}
          onAddTool={addTool}
          onAddWire={addWire}
          onRemoveWire={removeWire}
          onToolMove={(toolId: string, x: number, y: number) => {
            setTools((prev: Tool[]) => prev.map((tool: Tool) => 
              tool.id === toolId ? { ...tool, x, y } : tool
            ));
          }}
        />
        
        {/* XML Viewer Side Panel */}
        <XMLViewer
          isVisible={xmlViewerVisible}
          tools={tools}
          wires={wires}
          workflowMeta={workflowMeta}
          onClose={() => setXmlViewerVisible(false)}
        />
      </div>
    </div>
  );
}

export default App;
