import { useState, useEffect } from 'react';
import ToolPalette from './components/ToolPalette';
import Canvas from './components/Canvas';
import { Workflow, Tool, Wire, ToolCategory } from './types/workflow';
import { generateWorkflowXML } from './utils/xmlGenerator';
import { getToolDefinition } from './data/tools';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('favorites');
  const [tools, setTools] = useState<Tool[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [workflowMeta, setWorkflowMeta] = useState({
    name: 'New Workflow',
    description: 'A new workflow',
    author: 'Workflow Designer',
    workflowId: uuidv4(),
    created: new Date().toISOString(),
  });

  // Listen for menu actions from Electron
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onMenuAction((action: string, data?: any) => {
        handleMenuAction(action, data);
      });
    }
  }, []);

  const handleMenuAction = async (action: string, data?: any) => {
    console.log('Menu action:', action, data);
    switch (action) {
      case 'new-workflow':
        setTools([]);
        setWires([]);
        setWorkflowMeta({
          name: 'New Workflow',
          description: 'A new workflow',
          author: 'Workflow Designer',
          workflowId: uuidv4(),
          created: new Date().toISOString(),
        });
        break;
      case 'export-xml':
        await exportWorkflow();
        break;
      case 'save-workflow':
        await saveWorkflow();
        break;
      case 'run-workflow':
        console.log('Running workflow...');
        alert('Workflow execution not yet implemented');
        break;
      case 'validate-workflow':
        validateWorkflow();
        break;
    }
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
    
    if (window.electronAPI) {
      const fileName = await window.electronAPI.showSaveDialog(`${workflowMeta.name}.xml`);
      if (fileName) {
        await window.electronAPI.saveFile(xml, fileName);
        alert('Workflow exported successfully!');
      }
    } else {
      // Web version - download XML file
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflowMeta.name}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const saveWorkflow = async () => {
    // For now, same as export XML
    await exportWorkflow();
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
      {/* Web Export Button for non-Electron environments */}
      {!window.electronAPI && (
        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Workflow Designer</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTools([]);
                setWires([]);
                setWorkflowMeta({
                  name: 'New Workflow',
                  description: 'A new workflow',
                  author: 'Workflow Designer',
                  workflowId: uuidv4(),
                  created: new Date().toISOString(),
                });
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              New
            </button>
            <button
              onClick={exportWorkflow}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              Export XML
            </button>
            <button
              onClick={validateWorkflow}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
            >
              Validate
            </button>
          </div>
        </div>
      )}
      
      <ToolPalette 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
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
    </div>
  );
}

export default App;
