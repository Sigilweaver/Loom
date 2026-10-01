import { useClipboardStore } from "@state/clipboardStore";
import {
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { forwardRef, useCallback } from "react";
import WorkflowNode from "@components/workflow/WorkflowNode";
import AutoConnectPreviewEdge from "./AutoConnectPreviewEdge";
import { CanvasControls } from "./CanvasControls";
import { EmptyCanvasHint } from "./EmptyCanvasHint";
import { CanvasDragAndDropLayer } from "./CanvasDragAndDropLayer";
import { CanvasMenus } from "./CanvasMenus";
import { CanvasMinimap } from "./CanvasMinimap";
import { CanvasPositionMenu } from "./CanvasPositionMenu";
import { CanvasSurface } from "./CanvasSurface";
import { CanvasToolSelectionMenu } from "./CanvasToolSelectionMenu";
import { useArrowKeyMovement } from "./hooks/useArrowKeyMovement";
import { useBrowserDetection } from "./hooks/useBrowserDetection";
import { useCanvasAlignment } from "./hooks/useCanvasAlignment";
import { useCanvasClipboard } from "./hooks/useCanvasClipboard";
import { useCanvasConnection } from "./hooks/useCanvasConnection";
import { useCanvasConnectEnd } from "./hooks/useCanvasConnectEnd";
import { useCanvasContextMenu } from "./hooks/useCanvasContextMenu";
import { useCanvasDrag } from "./hooks/useCanvasDrag";
import { useCanvasEdgeSync } from "./hooks/useCanvasEdgeSync";
import { useCanvasFocus } from "./hooks/useCanvasFocus";
import { useCanvasHandlers } from "./hooks/useCanvasHandlers";
import {
  useCanvasImperativeHandle,
  type CanvasRef,
} from "./hooks/useCanvasImperativeHandle";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasLasso } from "./hooks/useCanvasLasso";
import { useCanvasMinimap } from "./hooks/useCanvasMinimap";
import { useCanvasMouseTracking } from "./hooks/useCanvasMouseTracking";
import { useCanvasNodes } from "./hooks/useCanvasNodes";
import { useCanvasPaste } from "./hooks/useCanvasPaste";
import { useCanvasSelection } from "./hooks/useCanvasSelection";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useCanvasWheelHandler } from "./hooks/useCanvasWheelHandler";
import { useMinimapStyle } from "./hooks/useMinimapStyle";
import { useNodeColor } from "./hooks/useNodeColor";
import { useNodeResync } from "./hooks/useNodeResync";
import { useWorkflowEdges } from "./hooks/useWorkflowEdges";
import { useSnapToGrid } from "./hooks/useSnapToGrid";

export type { CanvasRef };

const nodeTypes = { workflow: WorkflowNode };

export const CanvasShell = forwardRef<CanvasRef>((_props, ref) => {
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();

  // Grid and snapping configuration
  const snapGrid: [number, number] = [20, 20];
  const { snapToGrid, toggleSnapToGrid, snap } = useSnapToGrid(snapGrid);

  // Browser capabilities detection
  const { isFirefox } = useBrowserDetection();

  // Expose fitView to parent via ref
  useCanvasImperativeHandle({ ref, fitView });

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

  // Edges are derived from wires at render time (see useWorkflowEdges)
  const edges = useWorkflowEdges();

  // === Build React Flow nodes from tools ===
  const nodes = useCanvasNodes({ tools, onToolMove: handleToolMove });

  // === React Flow state ===
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Sync nodes when tools change (guarded by pointer state)
  const isPointerDownRef = useNodeResync(nodes, setNodes);

  // Sync edges when edges change
  useCanvasEdgeSync({ edges, setEdges });

  // === Wrapper for setNodes to match expected type ===
  const setNodesWrapper = useCallback(
    (updater: (ns: Node[]) => Node[]) => setNodes(updater),
    [setNodes]
  );

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
      setNodes: setNodesWrapper,
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
    toolSelectionOpen: contextMenuToolSelectionOpen,
    toolSelectionCoords: contextMenuToolSelectionCoords,
    closeToolSelectionMenu,
  } = useCanvasContextMenu({
    screenToFlowPosition,
    setNodes,
    setPasteAnchor,
  });

  // Handler for tool selection from right-click menu
  const handleToolSelectionFromContextMenu = useCallback((toolType: string) => {
    // The paste anchor is set by the context menu handler
    // We can get it from the clipboard hook's ref via the doPaste mechanism
    // For now, we'll use the screenToFlowPosition at the menu coords
    if (contextMenuToolSelectionCoords) {
      const flowPos = screenToFlowPosition(contextMenuToolSelectionCoords);
      handleAddTool(toolType, flowPos.x, flowPos.y);
    }
    closeToolSelectionMenu();
  }, [contextMenuToolSelectionCoords, screenToFlowPosition, handleAddTool, closeToolSelectionMenu]);

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
  const { onConnect: baseOnConnect, onEdgesDelete, onNodesDelete } = useCanvasConnection({
    onAddWire: handleAddWire,
    onRemoveWire: handleRemoveWire,
    onRemoveTool: handleRemoveTool,
    onToolSelect: handleToolSelect,
  });

  // === Connect end hook (tool selection menu on canvas drop) ===
  const {
    onConnectStart,
    onConnectEnd,
    onConnectionMade,
    menuOpen: toolSelectionMenuOpen,
    menuCoords: toolSelectionMenuCoords,
    filterDirection: toolSelectionFilterDirection,
    onToolSelect: handleToolSelectionFromMenu,
    onMenuClose: handleToolSelectionMenuClose,
  } = useCanvasConnectEnd({
    tools,
    onAddTool: handleAddTool,
    onAddWire: handleAddWire,
  });

  // Wrap onConnect to notify when connection is made
  const onConnect = useCallback((connection: Connection) => {
    onConnectionMade();
    baseOnConnect(connection);
  }, [onConnectionMade, baseOnConnect]);

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
    autoLayout,
  } = useCanvasAlignment({
    onToolMove: handleToolMove,
    onBeginTransaction: handleBeginTransaction,
    onCommitTransaction: handleCommitTransaction,
  });

  // === Lasso selection visual state ===
  useCanvasLasso();

  // === Mouse tracking for paste anchor ===
  const onMouseMove = useCanvasMouseTracking({
    screenToFlowPosition,
    setPasteAnchor,
  });

  // === Paste event handler (Firefox compatibility) ===
  const onPaste = useCanvasPaste({
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

  // === Wheel handler ===
  const handleWheel = useCanvasWheelHandler();

  // === Viewport synchronization ===
  const { onMove } = useCanvasViewport();

  // === Focus and pointer management ===
  const { keyScopeRef, onMouseDown, onTouchStart } = useCanvasFocus({ isPointerDownRef });

  return (
    <div
      ref={keyScopeRef}
      tabIndex={0}
      onPaste={onPaste}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className="flex-1 h-full min-h-0"
      style={{ outline: "none" }}
    >
      <CanvasDragAndDropLayer
        onAddTool={handleAddTool}
        snap={snap}
        screenToFlowPosition={screenToFlowPosition}
      >
        <div className="relative flex-1 h-full min-h-0">
          <EmptyCanvasHint toolCount={tools.length} />
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
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
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
            onMove={onMove}
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
            <AutoConnectPreviewEdge />
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
          hasClipboard={!!useClipboardStore.getState().clipboard}
          onCopy={doCopy}
          onCut={doCut}
          onPaste={doPaste}
          onDelete={doDelete}
          onAutoLayout={autoLayout}
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
        <CanvasToolSelectionMenu
          open={toolSelectionMenuOpen}
          coords={toolSelectionMenuCoords}
          filterDirection={toolSelectionFilterDirection}
          onSelectTool={handleToolSelectionFromMenu}
          onClose={handleToolSelectionMenuClose}
        />
        <CanvasToolSelectionMenu
          open={contextMenuToolSelectionOpen}
          coords={contextMenuToolSelectionCoords}
          onSelectTool={handleToolSelectionFromContextMenu}
          onClose={closeToolSelectionMenu}
        />
      </CanvasDragAndDropLayer>
    </div>
  );
});
CanvasShell.displayName = "CanvasShell";
