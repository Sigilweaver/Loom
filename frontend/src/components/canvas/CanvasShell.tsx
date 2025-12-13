import { getToolDefinition } from "@data/tools";
import { useClipboardStore } from "@state/clipboardStore";
import { useWorkflowStore } from "@state/workflowStore";
import {
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, {
  forwardRef,
  useCallback,
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
import { useCanvasAlignment } from "./hooks/useCanvasAlignment";
import { useCanvasClipboard } from "./hooks/useCanvasClipboard";
import { useCanvasConnection } from "./hooks/useCanvasConnection";
import { useCanvasContextMenu } from "./hooks/useCanvasContextMenu";
import { useCanvasDrag } from "./hooks/useCanvasDrag";
import { useCanvasHandlers } from "./hooks/useCanvasHandlers";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasLasso } from "./hooks/useCanvasLasso";
import { useCanvasMinimap } from "./hooks/useCanvasMinimap";
import { useCanvasPaste } from "./hooks/useCanvasPaste";
import { useCanvasSelection } from "./hooks/useCanvasSelection";
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

  // Keyboard scope: only active when this wrapper has focus
  const keyScopeRef = useRef<HTMLDivElement>(null);

  // Browser detection for Firefox paste handling
  const isFirefox = useMemo(
    () =>
      typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent),
    []
  );

  // Grid and snapping configuration
  const snapGrid: [number, number] = [20, 20];
  const { snapToGrid, toggleSnapToGrid, snap } = useSnapToGrid(snapGrid);

  // Expose fitView to parent via ref
  useImperativeHandle(
    ref,
    () => ({ fitView: () => fitView({ duration: 800, padding: 0.1 }) }),
    [fitView]
  );

  // === Core handlers hook ===
  const {
    tools,
    wires,
    handleAddTool,
    handleRemoveTool,
    handleToolMove,
    handleToolSelect,
    handleAddWire,
    handleRemoveWire,
    handleBatchAdd,
    handleBeginTransaction,
    handleCommitTransaction,
  } = useCanvasHandlers();

  // Get edges from workflow store
  const edges = useWorkflowStore((s) => s.edges);

  // === Build React Flow nodes from tools ===
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

  // === React Flow state ===
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Sync nodes when tools change (guarded by pointer state)
  const isPointerDownRef = useNodeResync(nodes, setNodes);

  // Sync edges when edges change
  React.useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  // === Clipboard hook ===
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

  // === Context menu hook ===
  const {
    actionsOpen,
    actionsCoords,
    openActionsMenuAt,
    closeActionsMenu,
    onNodeContextMenu,
    onPaneContextMenu,
    edgeMenuOpen,
    edgeMenuCoords,
    edgeMenuEdge,
    onEdgeContextMenu,
    closeEdgeMenu,
  } = useCanvasContextMenu({
    screenToFlowPosition,
    setNodes,
    setPasteAnchor,
  });

  // === Minimap hook ===
  const {
    minimapButtonRef,
    actionsButtonRef,
    minimapVisible,
    minimapPosition,
    positionMenuOpen,
    positionMenuCoords,
    toggleMinimap,
    handleMinimapButtonContextMenu,
    handlePositionSelect,
    openActionsMenu,
    closePositionMenu,
  } = useCanvasMinimap({
    onOpenActionsMenu: openActionsMenuAt,
  });

  // === Selection hook ===
  const { onNodeClick, onPaneClick, onSelectionChange } = useCanvasSelection({
    tools,
    setNodes,
    onToolSelect: handleToolSelect,
    onClosePositionMenu: closePositionMenu,
  });

  // === Connection hook ===
  const { onConnect, onEdgesDelete, onNodesDelete } = useCanvasConnection({
    onAddWire: handleAddWire,
    onRemoveWire: handleRemoveWire,
    onRemoveTool: handleRemoveTool,
    onToolSelect: handleToolSelect,
  });

  // === Drag hook ===
  const { onNodeDragStart, onNodeDragStop } = useCanvasDrag({
    getNodes,
    snap,
    onToolMove: handleToolMove,
    onBeginTransaction: handleBeginTransaction,
    onCommitTransaction: handleCommitTransaction,
  });

  // === Alignment hook ===
  const {
    alignHorizontally,
    alignVertically,
    distributeHorizontally,
    distributeVertically,
  } = useCanvasAlignment({
    getNodes,
    snap,
    onToolMove: handleToolMove,
    onBeginTransaction: handleBeginTransaction,
    onCommitTransaction: handleCommitTransaction,
  });

  // === Lasso selection visual state ===
  useCanvasLasso();

  // === Mouse tracking for paste anchor ===
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPasteAnchor(pos.x, pos.y);
    },
    [screenToFlowPosition, setPasteAnchor]
  );

  // === Paste event handler (Firefox compatibility) ===
  const onPaste = useCanvasPaste({
    setNodes,
    doPaste,
  });

  // === Arrow key movement ===
  const moveSelectedNodes = useArrowKeyMovement({
    getNodes,
    snap,
    onToolMove: handleToolMove,
    onBeginTransaction: handleBeginTransaction,
    onCommitTransaction: handleCommitTransaction,
    gridSize: snapGrid,
  });

  // === Keyboard handler ===
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

  // === Visual styling hooks ===
  const getNodeColor = useNodeColor(tools);
  const getMinimapStyle = useMinimapStyle(minimapPosition);

  // === No-op handler for wheel ===
  const handleWheel = useCallback((_e: React.WheelEvent) => {}, []);

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
          onCloseEdgeMenu={closeEdgeMenu}
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
