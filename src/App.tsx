import { useState, useEffect, useMemo, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import ToolPalette from './components/ToolPalette';
import Canvas, { CanvasRef } from './components/Canvas';
import XMLViewer from './components/XMLViewer';
import Header from './components/Header';
import Notification from './components/Notification';
import ConfigurationPanel from './components/ConfigurationPanel';
import { ThemeProvider } from './contexts/ThemeContext';
import { Tool, Wire, ToolCategory, ToolConfig } from './domain/workflow/entities/workflow';
import { XMLWorkflowManager } from './utils/XMLWorkflowManager';
import { HistoryManager } from './utils/HistoryManager';
import { buildClipboardFragment, applyClipboardFragment } from './utils/XMLClipboard';
import { EdgeManager } from '@domain/workflow/services/edgeManager';
import { getToolDefinition } from './data/tools';
import { generateUniqueId } from './utils/id';
import { useWorkflowStore } from '@state/workflowStore';
import { useUIStore, startNotificationAutoHide } from '@state/uiStore';
import { wouldCreateCycle } from '@domain/workflow/services/loopDetection';

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('favorites');
  const [xmlManager] = useState<XMLWorkflowManager>(() => new XMLWorkflowManager());
  const [history] = useState<HistoryManager>(() => new HistoryManager());
  const [xmlViewerVisible, setXmlViewerVisible] = useState(false);
  
  // Derived state from XML
  const tools = useWorkflowStore(s => s.tools);
  const wires = useWorkflowStore(s => s.wires);
  const workflowMeta = useWorkflowStore(s => s.workflowMeta);
  const edges = useWorkflowStore(s => s.edges);
  const selectedTool = useWorkflowStore(s => s.selectedTool);
  const setFromXML = useWorkflowStore(s => s.setFromXML);
  const setEdges = useWorkflowStore(s => s.setEdges);
  const setSelectedTool = useWorkflowStore(s => s.setSelectedTool);
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

  // UI notifications via store
  const notification = useUIStore(s => s.notification);
  const showNotification = useUIStore(s => s.showNotification);
  const hideNotification = useUIStore(s => s.hideNotification);
  useEffect(() => { startNotificationAutoHide(); }, []);

  // Update derived state whenever XML changes (excluding edges - managed separately)
  const updateStateFromXML = () => {
    setFromXML(xmlManager.getTools(), xmlManager.getWires(), xmlManager.getMetadata());
  };

  // Initialize state from XML
  useEffect(() => {
    updateStateFromXML();
    // Initialize edges from XML
    setEdges(edgeManager.getEdgesFromXML());
    // Initialize history with initial XML snapshot
    try {
      history.checkpoint(xmlManager.toXMLString(), 'Initial');
    } catch (err) {
      // Non-fatal: history may not be initialized in some environments
      console.warn('Initial history checkpoint failed', err);
    }
    
    // Cleanup EdgeManager on unmount
    return () => {
      edgeManager.destroy();
    };
  }, []);

  // Global undo/redo shortcuts (when not typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;
      const isUndo = (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey;
      const isRedo = ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey)
        || ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey));
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      const currentXml = xmlManager.toXMLString();
      const entry = isUndo ? history.undo(currentXml) : history.redo(currentXml);
      if (entry) {
        try {
          xmlManager.loadFromXML(entry.xml);
          updateStateFromXML();
          edgeManager.syncFromXML();
          setSelectedTool(null);
        } catch (err) {
          console.error('History restore failed:', err);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history, xmlManager, edgeManager, setSelectedTool]);

  // hideNotification now from store

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

  // Tool configuration update function
  const handleToolConfigChange = (toolId: string, config: ToolConfig) => {
    const preXml = xmlManager.toXMLString();
    history.checkpoint(preXml, 'Before Config Change');
    
    // Update XML with new configuration
    xmlManager.updateToolConfiguration(toolId, config);
    
    // Update local state
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
    const preXml = xmlManager.toXMLString();
    history.checkpoint(preXml, 'Before New');
    xmlManager.newWorkflow();
    updateStateFromXML();
    setSelectedTool(null);
    // Reset edges
    setEdges(edgeManager.getEdgesFromXML());
  };

  const importWorkflow = () => {
    const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.swwf';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
    reader.onload = (e) => {
        try {
          const xmlContent = e.target?.result as string;
          const preXml = xmlManager.toXMLString();
          history.checkpoint(preXml, 'Before Import');
          xmlManager.loadFromXML(xmlContent);
          updateStateFromXML();
          setSelectedTool(null);
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
    // Build readable yet filesystem-safe name preserving spaces with underscores
    const buildSafeName = (name: string) => {
      const base = (name || 'Workflow');
      // Replace disallowed characters with underscores; remove ASCII control chars via code-point filter
      const withoutControls = Array.from(base).map(ch => {
        const cp = ch.codePointAt(0) ?? 0;
        return cp >= 0x20 ? ch : '_';
      }).join('');
      let safe = withoutControls.replace(/[<>:"/\\|?*]/g, '_');
      safe = safe.replace(/\s+/g, ' ').replace(/\s*_\s*/g, '_').trim();
      if (!safe || /^\.+$/.test(safe)) safe = 'workflow';
      if (safe.length > 120) safe = safe.slice(0, 120).trim();
      return safe;
    };
    const baseName = buildSafeName(workflowMeta.name);
    const a = document.createElement('a');
    a.href = url;
    // Use .swwf (Sigilweaver Workflow) extension
    a.download = `${baseName}.swwf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewWorkflow = () => {
    // Preview functionality - show a modal or side panel with workflow results preview
    showNotification('Preview functionality will show expected workflow output and flow analysis. Coming soon!', 'info');
  };

  // Batch add for paste operations: add tools first, then wires, and sync once
  const batchAddToolsAndWires = (
    toolAdds: { id: string; type: string; x: number; y: number }[],
    wiresToAdd: Wire[]
  ) => {
    try {
  const preXml = xmlManager.toXMLString();
  history.begin(preXml, 'Paste');
      // Add tools
      for (const ta of toolAdds) {
        const definition = getToolDefinition(ta.type);
        if (!definition) continue;
        const newTool: Tool = {
          id: ta.id,
          type: ta.type,
          x: ta.x,
          y: ta.y,
          config: { ...definition.defaultConfig },
          sockets: [...definition.sockets],
        };
        xmlManager.addTool(newTool);
      }
      // Add wires directly via EdgeManager (avoid UI validation races)
      for (const w of wiresToAdd) {
        try {
          edgeManager.addWire(w);
        } catch {
          // ignore individual failures during batch to avoid blocking the rest
        }
      }
      // Sync state once at the end
      updateStateFromXML();
      edgeManager.syncFromXML();
  history.commit(xmlManager.toXMLString(), { label: 'Paste' });
    } catch (e) {
      showNotification('Failed to paste tools/wires', 'error');
    }
  };

  const addTool = (toolType: string, x: number, y: number, idOverride?: string) => {
    const definition = getToolDefinition(toolType);
    if (!definition) return;

  const preXml = xmlManager.toXMLString();
  history.checkpoint(preXml, 'Before Add Tool');
  const newTool: Tool = {
      id: idOverride ?? generateUniqueId(new Set(tools.map(t => t.id)), 8),
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

  // XML clipboard: build a fragment for selected tools
  const buildCopyFragment = (selectedIds: string[]): string => {
    try {
  const xml = xmlManager.toXMLString();
  return buildClipboardFragment(xml, selectedIds);
    } catch {
      return '';
    }
  };

  // XML clipboard: paste a fragment at anchor and update state/history
  const pasteFragmentAt = async (anchor: { x: number; y: number }, fragment: string): Promise<string[]> => {
    if (!fragment) return [];
    try {
      const preXml = xmlManager.toXMLString();
      history.begin(preXml, 'Paste');
  const newIds = applyClipboardFragment(xmlManager, fragment, anchor);
      updateStateFromXML();
      edgeManager.syncFromXML();
      history.commit(xmlManager.toXMLString(), { label: 'Paste' });
      return newIds;
    } catch (e) {
      showNotification('Failed to paste fragment', 'error');
      return [];
    }
  };

  const addWire = (from: { tool: string; socket: number }, to: { tool: string; socket: number }) => {
    // Use XML as source-of-truth to avoid races with store state during replace/remove+add sequences
    const xmlTools = xmlManager.getTools();
    const xmlWires = xmlManager.getWires();
    const fromTool = xmlTools.find(t => t.id === from.tool);
    const toTool = xmlTools.find(t => t.id === to.tool);
    if (!fromTool || !toTool) return;
    const fromSocket = fromTool.sockets.find(s => s.id === from.socket);
    const toSocket = toTool.sockets.find(s => s.id === to.socket);
    if (!fromSocket || !toSocket) return;
    if (fromSocket.direction !== 'output' || toSocket.direction !== 'input') { showNotification('Invalid connection: Can only connect outputs to inputs', 'error'); return; }
    if (!toSocket.multiple) {
      const existingWire = xmlWires.find(w => w.to.tool === to.tool && w.to.socket === to.socket);
      if (existingWire) { showNotification('Input already connected. Disconnect existing wire first.', 'warning'); return; }
    }
    const createsCycle = wouldCreateCycle(xmlTools, xmlWires, from.tool, to.tool);
    const newWire: Wire = { from, to };
    try {
      const preXml = xmlManager.toXMLString();
      edgeManager.addWire(newWire);
      updateStateFromXML();
      history.checkpoint(preXml, 'Before Connect');
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
      const preXml = xmlManager.toXMLString();
      edgeManager.removeWire(wireId);
      // Update wires state for validation logic (but not edges - EdgeManager handles that)
      updateStateFromXML();
      history.checkpoint(preXml, 'Before Disconnect');
    } catch (error) {
      showNotification('Failed to remove connection', 'error');
    }
  };

  const removeTool = (toolId: string) => {
  const preXml = xmlManager.toXMLString();
  xmlManager.removeTool(toolId);
    updateStateFromXML();
  history.checkpoint(preXml, 'Before Delete Tool');
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
            workflowMeta={workflowMeta}
            toolCount={tools.length}
            wireCount={wires.length}
            onWorkflowMetaChange={handleWorkflowMetaChange}
            onToolConfigChange={handleToolConfigChange}
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
                onBatchAdd={batchAddToolsAndWires}
                onBeginTransaction={() => history.begin(xmlManager.toXMLString(), 'Move Nodes')}
                onCommitTransaction={() => history.commit(xmlManager.toXMLString(), { label: 'Move Nodes' })}
                onBuildCopyFragment={buildCopyFragment}
                onPasteXMLAt={pasteFragmentAt}
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
