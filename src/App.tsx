import React, { useState, useEffect } from 'react';
import ToolPalette from './components/ToolPalette';
import Canvas from './components/Canvas';
import { Workflow, Tool, Edge, ToolCategory } from './types/workflow';
import { generateWorkflowXML } from './utils/xmlGenerator';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('favorites');
  const [tools, setTools] = useState<Tool[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
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
        setEdges([]);
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
      hierarchy: {
        id: 'root',
        name: 'Root Container',
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
        tools: tools,
      },
      edges: edges,
    };

    const xml = generateWorkflowXML(workflow);
    
    if (window.electronAPI) {
      const fileName = await window.electronAPI.showSaveDialog(`${workflowMeta.name}.xml`);
      if (fileName) {
        await window.electronAPI.saveFile(xml, fileName);
        alert('Workflow exported successfully!');
      }
    } else {
      // Fallback for web version
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflowMeta.name}.xml`;
      a.click();
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

      const outgoingEdges = edges.filter((edge: Edge) => edge.from.tool === toolId);
      
      for (const edge of outgoingEdges) {
        const nextToolId = edge.to.tool;
        
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
    const newTool: Tool = {
      id: uuidv4(),
      type: toolType,
      x,
      y,
      config: {},
      inlets: [],
      outlets: [],
    };

    setTools((prev: Tool[]) => [...prev, newTool]);
  };

  const addEdge = (from: { tool: string; port: number }, to: { tool: string; port: number }) => {
    const newEdge: Edge = { from, to };
    setEdges((prev: Edge[]) => [...prev, newEdge]);
  };

  return (
    <div className="h-screen flex flex-col bg-workflow-bg">
      <ToolPalette 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      <Canvas 
        tools={tools}
        edges={edges}
        onAddTool={addTool}
        onAddEdge={addEdge}
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
