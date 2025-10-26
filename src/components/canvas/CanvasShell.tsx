import { getToolDefinition } from "@data/tools";
import { Tool, Wire } from "@domain/workflow/entities/workflow";
import { useClipboardStore } from "@state/clipboardStore";
import { useHistoryStore } from "@state/historyStore";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useSocketPreview } from "../../hooks/useSocketPreview";
import {
  alignHorizontally as doAlignH,
  alignVertically as doAlignV,
  distributeHorizontally as doDistH,
  distributeVertically as doDistV,
  type PositionUpdate,
} from "@utils/alignDistribute";
import { generateUniqueId } from "@utils/id";
import { calculateMenuPosition } from "@utils/menuPositioning";
import {
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import WorkflowNode from "../WorkflowNode";
import { CanvasControls } from "./CanvasControls";
import { CanvasDragAndDropLayer } from "./CanvasDragAndDropLayer";
import { CanvasMenus } from "./CanvasMenus";
import { CanvasMinimap } from "./CanvasMinimap";
import { CanvasPositionMenu } from "./CanvasPositionMenu";
import { CanvasSurface } from "./CanvasSurface";
import { useArrowKeyMovement } from "./hooks/useArrowKeyMovement";
import { useCanvasClipboard } from "./hooks/useCanvasClipboard";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasPaste } from "./hooks/useCanvasPaste";
import { useMinimapStyle } from "./hooks/useMinimapStyle";
import { useNodeColor } from "./hooks/useNodeColor";
import { useNodeResync } from "./hooks/useNodeResync";
import { useSnapToGrid } from "./hooks/useSnapToGrid";

export interface CanvasRef {
  fitView: () => void;
}

const nodeTypes = { workflow: WorkflowNode };

export const CanvasShell = forwardRef<CanvasRef>((_props, ref) => {
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();

  // Access Zustand stores
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const edges = useWorkflowStore((s) => s.edges);
  const addTool = useWorkflowStore((s) => s.addTool);
  const removeTool = useWorkflowStore((s) => s.removeTool);
  const updateTool = useWorkflowStore((s) => s.updateTool);
  const addWire = useWorkflowStore((s) => s.addWire);
  const removeWire = useWorkflowStore((s) => s.removeWire);
  const batchAddToolsAndWires = useWorkflowStore(
    (s) => s.batchAddToolsAndWires
  );
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const pushState = useHistoryStore((s) => s.pushState);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const setPreviewState = useUIStore((s) => s.setPreviewState);
  
  const { previewSocket } = useSocketPreview();

  // Handler functions (replace props with direct store calls)
  const handleAddTool = useCallback(
    (type: string, x: number, y: number, idOverride?: string) => {
      console.log("[CanvasShell] Adding tool:", type, "at", x, y);

      // Build tool object
      const newTool: Tool = {
        id: idOverride || generateUniqueId(new Set(tools.map((t) => t.id))),
        type,
        x,
        y,
        config: {},
        sockets: getToolDefinition(type)?.sockets || [],
      };

      pushState(tools, wires, workflowMeta);
      addTool(newTool);
    },
    [addTool, pushState, tools, wires, workflowMeta]
  );

  const handleRemoveTool = useCallback(
    (id: string) => {
      console.log("[CanvasShell] Removing tool:", id);
      pushState(tools, wires, workflowMeta);
      removeTool(id);
    },
    [removeTool, pushState, tools, wires, workflowMeta]
  );

  const handleToolMove = useCallback(
    (id: string, x: number, y: number) => {
      // Note: No snapshot for moves - too frequent. Snapshot saved on drag end.
      console.log("[CanvasShell] Moving tool:", id, "to", x, y);
      updateTool(id, { x, y });
    },
    [updateTool]
  );

  const handleAddWire = useCallback(
    (
      from: { tool: string; socket: number },
      to: { tool: string; socket: number }
    ) => {
      console.log("[CanvasShell] Adding wire:", from, "->", to);
      const wire: Wire = { from, to };
      pushState(tools, wires, workflowMeta);
      addWire(wire);
    },
    [addWire, pushState, tools, wires, workflowMeta]
  );

  const handleRemoveWire = useCallback(
    (id: string) => {
      console.log("[CanvasShell] Removing wire:", id);
      // Parse wire ID to extract from/to info
      // Format: "encodeURIComponent(from.tool)_from.socket_encodeURIComponent(to.tool)_to.socket"
      const parts = id.split("_");
      if (parts.length === 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
        const from = {
          tool: decodeURIComponent(parts[0]),
          socket: parseInt(parts[1], 10),
        };
        const to = {
          tool: decodeURIComponent(parts[2]),
          socket: parseInt(parts[3], 10),
        };
        pushState(tools, wires, workflowMeta);
        removeWire(from, to);
      } else {
        console.warn("[CanvasShell] Invalid wire ID format:", id);
      }
    },
    [removeWire, pushState, tools, wires, workflowMeta]
  );

  const handleBatchAdd = useCallback(
    (
      toolAdds: { id: string; type: string; x: number; y: number }[],
      wiresToAdd: {
        from: { tool: string; socket: number };
        to: { tool: string; socket: number };
      }[]
    ) => {
      console.log(
        "[CanvasShell] Batch adding:",
        toolAdds.length,
        "tools,",
        wiresToAdd.length,
        "wires"
      );

      // Convert simplified tool format to full Tool objects
      const fullTools: Tool[] = toolAdds.map((t) => ({
        id: t.id,
        type: t.type,
        x: t.x,
        y: t.y,
        config: {},
        sockets: getToolDefinition(t.type)?.sockets || [],
      }));

      const fullWires: Wire[] = wiresToAdd.map((w) => ({
        from: w.from,
        to: w.to,
      }));

      pushState(tools, wires, workflowMeta);
      batchAddToolsAndWires(fullTools, fullWires);
    },
    [batchAddToolsAndWires, pushState, tools, wires, workflowMeta]
  );

  const handleBeginTransaction = useCallback(() => {
    console.log("[CanvasShell] Begin transaction (drag start)");
    // Optional: Could set a flag here if needed for transaction tracking
  }, []);

  const handleCommitTransaction = useCallback(() => {
    console.log("[CanvasShell] Commit transaction (drag end)");
    pushState(tools, wires, workflowMeta);
  }, [pushState, tools, wires, workflowMeta]);

  const handleToolSelect = useCallback(
    (tool: Tool | null) => {
      console.log("[CanvasShell] Tool selected:", tool?.id || "none");
      setSelectedTool(tool);
    },
    [setSelectedTool]
  );

  // Keyboard scope: only active when this wrapper has focus
  const keyScopeRef = useRef<HTMLDivElement>(null);
  // Track pointer state via hook (for guarded resync)
  // Initialized after useNodesState below
  const isFirefox = useMemo(
    () =>
      typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent),
    []
  );
  // Track latest tools from store to avoid races when wiring after paste
  const latestToolsRef = useRef<Tool[]>(tools);
  useEffect(() => {
    latestToolsRef.current = tools;
  }, [tools]);
  const minimapButtonRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLDivElement>(null);
  const minimapVisible = useUIStore((s) => s.minimapVisible);
  const minimapPosition = useUIStore((s) => s.minimapPosition);
  const positionMenuOpen = useUIStore((s) => s.positionMenuOpen);
  const positionMenuCoords = useUIStore((s) => s.positionMenuCoords);
  const toggleMinimap = useUIStore((s) => s.toggleMinimap);
  const setMinimapPosition = useUIStore((s) => s.setMinimapPosition);
  const openPositionMenu = useUIStore((s) => s.openPositionMenu);
  const closePositionMenu = useUIStore((s) => s.closePositionMenu);
  const snapGrid: [number, number] = [20, 20];
  const { snapToGrid, toggleSnapToGrid, snap } = useSnapToGrid(snapGrid);
  useImperativeHandle(
    ref,
    () => ({ fitView: () => fitView({ duration: 800, padding: 0.1 }) }),
    [fitView]
  );
  const nodes: Node[] = useMemo(
    () =>
      tools.map((tool) => ({
        id: tool.id,
        type: "workflow",
        position: { x: tool.x, y: tool.y },
        data: {
          tool,
          definition: getToolDefinition(tool.type),
          onToolMove: handleToolMove,
        },
        deletable: true,
        selectable: true,
      })),
    [tools, handleToolMove]
  );
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  const isPointerDownRef = useNodeResync(nodes, setNodes);
  // resync handled by useNodeResync
  React.useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);
  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target && c.sourceHandle && c.targetHandle) {
        const fromSocket = parseInt(c.sourceHandle.replace("output-", ""), 10);
        const toSocket = parseInt(c.targetHandle.replace("input-", ""), 10);
        handleAddWire(
          { tool: c.source, socket: fromSocket },
          { tool: c.target, socket: toSocket }
        );
      }
    },
    [handleAddWire]
  );
  const onEdgesDelete = useCallback(
    (es: Edge[]) => {
      es.forEach((e) => handleRemoveWire(e.id));
    },
    [handleRemoveWire]
  );
  const onNodesDelete = useCallback(
    (ns: Node[]) => {
      ns.forEach((n) => handleRemoveTool(n.id));
      handleToolSelect(null);
    },
    [handleRemoveTool, handleToolSelect]
  );
  const onNodeClick = useCallback(
    (_e: React.MouseEvent, n: Node) => {
      const tool = tools.find((t) => t.id === n.id);
      if (tool) {
        handleToolSelect(tool);
        
        // Preview first output socket of the selected tool
        const definition = getToolDefinition(tool.type);
        const firstOutputSocket = definition?.sockets.find(s => s.direction === 'output');
        if (firstOutputSocket) {
          previewSocket(tool.id, firstOutputSocket.id, 'output');
        }
      }
    },
    [tools, handleToolSelect, previewSocket]
  );
  const onNodeContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent, n: Node) => {
      e.preventDefault();
      // Select only this node if it's not already part of a selection
      setNodes((ns) => {
        const alreadySelected = ns.find((nd) => nd.id === n.id)?.selected;
        if (alreadySelected) return ns; // keep multi-selection
        return ns.map((nd) => ({ ...nd, selected: nd.id === n.id }));
      });
      // Position menu at mouse cursor and set paste anchor
      const clientX =
        (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
      const clientY =
        (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setPasteAnchor(flowPos.x, flowPos.y);
      setActionsCoords({ x: clientX, y: clientY });
      setActionsOpen(true);
    },
    [setNodes, screenToFlowPosition]
  );
  const onPaneClick = useCallback(() => {
    closePositionMenu();
    handleToolSelect(null);
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
    // Clear preview when clicking away
    setPreviewState(null);
  }, [closePositionMenu, handleToolSelect, setNodes, setPreviewState]);
  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      // Update last mouse flow position to this point so Paste uses it
      const clientX =
        (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
      const clientY =
        (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setPasteAnchor(flowPos.x, flowPos.y);
      // Build a paste-only menu if clipboard exists
      const hasClipboard = !!useClipboardStore.getState().clipboard;
      if (!hasClipboard) return;
      setActionsCoords({ x: clientX, y: clientY });
      setActionsOpen(true);
    },
    [screenToFlowPosition]
  );
  const onNodeDragStart = useCallback(
    (_e: React.MouseEvent, _n: Node) => {
      handleBeginTransaction();
    },
    [handleBeginTransaction]
  );
  const onNodeDragStop = useCallback(
    (_e: React.MouseEvent, _n: Node) => {
      // Persist positions for all selected nodes (group move)
      const current = getNodes();
      current
        .filter((nd) => nd.selected)
        .forEach((nd) => {
          const s = snap(nd.position.x, nd.position.y);
          handleToolMove(nd.id, s.x, s.y);
        });
      handleCommitTransaction();
    },
    [getNodes, handleToolMove, snap, handleCommitTransaction]
  );
  const handleMinimapButtonContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (minimapButtonRef.current && !positionMenuOpen) {
        const rect = minimapButtonRef.current.getBoundingClientRect();
        const pos = calculateMenuPosition(
          rect,
          { width: 100, height: 160 },
          4,
          "bottom"
        );
        openPositionMenu({ x: pos.x, y: pos.y });
      } else if (positionMenuOpen) {
        closePositionMenu();
      }
    },
    [positionMenuOpen, openPositionMenu, closePositionMenu]
  );
  const handlePositionSelect = useCallback(
    (p: "top-left" | "top-right" | "bottom-left" | "bottom-right") =>
      setMinimapPosition(p),
    [setMinimapPosition]
  );
  const handleWheel = useCallback((_e: React.WheelEvent) => {}, []);
  // Actions menu (left-click)
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [actionsCoords, setActionsCoords] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  // Edge context menu state
  const [edgeMenuOpen, setEdgeMenuOpen] = React.useState(false);
  const [edgeMenuCoords, setEdgeMenuCoords] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [edgeMenuEdge, setEdgeMenuEdge] = React.useState<Edge | null>(null);
  const openActionsMenu = useCallback(() => {
    if (!actionsButtonRef.current) return;
    const rect = actionsButtonRef.current.getBoundingClientRect();
    const pos = calculateMenuPosition(
      rect,
      { width: 140, height: 160 },
      4,
      "bottom"
    );
    setActionsCoords({ x: pos.x, y: pos.y });
    setActionsOpen(true);
  }, []);
  const closeActionsMenu = useCallback(() => setActionsOpen(false), []);
  // Clipboard hook (copy/cut/delete/paste + anchor)
  const { doCopy, doCut, doDelete, doPaste, setPasteAnchor } =
    useCanvasClipboard({
      tools,
      wires,
      getNodes,
      snap,
      onBatchAdd: handleBatchAdd,
      onAddTool: handleAddTool,
      onAddWire: handleAddWire,
      onRemoveTool: handleRemoveTool,
      setNodes: (updater) => setNodes((ns) => updater(ns)),
      onToolSelect: handleToolSelect,
    });
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPasteAnchor(pos.x, pos.y);
    },
    [screenToFlowPosition, setPasteAnchor]
  );
  // Keep UI selection state in sync with app selection
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      if (selectedNodes.length === 1) {
        const first = selectedNodes[0];
        const tool = first
          ? (tools.find((t) => t.id === first.id) ?? null)
          : null;
        handleToolSelect(tool);
      } else {
        handleToolSelect(null);
      }
    },
    [tools, handleToolSelect]
  );
  // Show marquee only while actively dragging a selection
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        document.body.classList.add("sig-lasso-active");
      }
    };
    const onMouseUp = () => {
      document.body.classList.remove("sig-lasso-active");
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  // Clipboard hook now provides selection-aware actions; keep CanvasShell free of selection helpers
  // Alignment & distribution helpers
  const applyPositions = useCallback(
    (updates: PositionUpdate[]) => {
      if (!updates.length) return;
      handleBeginTransaction();
      updates.forEach((u) => handleToolMove(u.id, u.x, u.y));
      handleCommitTransaction();
    },
    [handleBeginTransaction, handleCommitTransaction, handleToolMove]
  );
  const alignHorizontally = useCallback(() => {
    const updates = doAlignH(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);
  const alignVertically = useCallback(() => {
    const updates = doAlignV(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);
  const distributeHorizontally = useCallback(() => {
    const updates = doDistH(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);
  const distributeVertically = useCallback(() => {
    const updates = doDistV(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);

  // Handle native paste event (works in Firefox). Prefer event.clipboardData over async clipboard.
  const onPaste = useCanvasPaste({
    setNodes,
    doPaste,
  });

  // Arrow key movement for selected nodes
  const moveSelectedNodes = useArrowKeyMovement({
    getNodes,
    snap,
    onToolMove: handleToolMove,
    onBeginTransaction: handleBeginTransaction,
    onCommitTransaction: handleCommitTransaction,
    gridSize: snapGrid,
  });

  // Esc clears selection; Ctrl/Cmd+C/X/V handle only when canvas wrapper has focus
  const onKeyDown = useCanvasKeyboard({
    isFirefox,
    setNodes,
    setEdges,
    onToolSelect: handleToolSelect,
    doCopy,
    doCut,
    doPaste,
    moveSelectedNodes,
  });
  const getNodeColor = useNodeColor(tools);
  const getMinimapStyle = useMinimapStyle(minimapPosition);
  // Edge menu items now built in CanvasMenus
  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setEdgeMenuEdge(edge);
    setEdgeMenuCoords({ x: e.clientX, y: e.clientY });
    setEdgeMenuOpen(true);
  }, []);
  return (
    <div
      ref={keyScopeRef}
      tabIndex={0}
      onPaste={onPaste}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.button === 0) {
          isPointerDownRef.current = true;
          const onUp = () => {
            isPointerDownRef.current = false;
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mouseup", onUp);
        }
        keyScopeRef.current?.focus();
      }}
      className="flex-1 h-full min-h-0"
      style={{ outline: "none" }}
    >
      <CanvasDragAndDropLayer
        onAddTool={handleAddTool}
        snap={snap}
        screenToFlowPosition={screenToFlowPosition}
      >
        <div className="flex-1 h-full min-h-0">
          <style>{`
  /* keep React Flow default selected styles visible */
  .react-flow__node.dragging{opacity:.8!important}
  .react-flow__attribution{display:none!important}
  /* Edge color states override */
  .react-flow__edge .react-flow__edge-path{stroke:var(--color-edge-default-stroke)!important}
  .react-flow__edge:hover .react-flow__edge-path,.react-flow__edge .react-flow__edge-path:hover{stroke:var(--color-edge-default-stroke-hover)!important}
  .react-flow__edge.selected .react-flow__edge-path{stroke:var(--color-edge-selected-stroke)!important}
  .react-flow__edge.selected:hover .react-flow__edge-path,.react-flow__edge.selected .react-flow__edge-path:hover{stroke:var(--color-edge-selected-stroke-hover)!important}
  .react-flow__edge.animated .react-flow__edge-path{stroke:var(--color-edge-animated-stroke)!important}
  .react-flow__edge.animated:hover .react-flow__edge-path,.react-flow__edge.animated .react-flow__edge-path:hover{stroke:var(--color-edge-animated-stroke-hover)!important}
  `}</style>
          <CanvasSurface
            nodes={flowNodes}
            edges={flowEdges}
            snapToGrid={snapToGrid}
            snapGrid={snapGrid}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onDrop={() => {}}
            onDragOver={() => {}}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onWheel={handleWheel}
            onMouseMove={onMouseMove}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
          >
            <CanvasControls
              minimapVisible={minimapVisible}
              minimapPosition={minimapPosition}
              snapToGrid={snapToGrid}
              onToggleMinimap={toggleMinimap}
              onToggleSnap={toggleSnapToGrid}
              onContextMenuMinimap={handleMinimapButtonContextMenu}
              minimapButtonRef={minimapButtonRef}
              actionsButtonRef={actionsButtonRef}
              onActionsClick={openActionsMenu}
            />
            <CanvasMinimap
              visible={minimapVisible}
              position={minimapPosition}
              nodeColor={getNodeColor}
              style={getMinimapStyle()}
            />
          </CanvasSurface>
        </div>
        <CanvasPositionMenu
          open={positionMenuOpen}
          coords={positionMenuCoords}
          currentPosition={minimapPosition}
          onSelect={handlePositionSelect}
          onClose={closePositionMenu}
        />
        <CanvasMenus
          actionsOpen={actionsOpen}
          actionsCoords={actionsCoords}
          onCloseActions={closeActionsMenu}
          hasSelection={getNodes().some((n) => n.selected)}
          multiSelection={getNodes().filter((n) => n.selected).length > 1}
          hasClipboard={!!useClipboardStore.getState().clipboard}
          onCopy={doCopy}
          onCut={doCut}
          onPaste={doPaste}
          onDelete={doDelete}
          onAlignH={alignHorizontally}
          onAlignV={alignVertically}
          onDistH={distributeHorizontally}
          onDistV={distributeVertically}
          edgeMenuOpen={edgeMenuOpen && !!edgeMenuEdge}
          edgeMenuCoords={edgeMenuCoords}
          onCloseEdgeMenu={() => setEdgeMenuOpen(false)}
          edge={edgeMenuEdge}
          tools={tools}
          wires={wires}
          onAddWire={handleAddWire}
          onRemoveWire={handleRemoveWire}
          onBeginTransaction={handleBeginTransaction}
          onCommitTransaction={handleCommitTransaction}
        />
      </CanvasDragAndDropLayer>
    </div>
  );
});
CanvasShell.displayName = "CanvasShell";
