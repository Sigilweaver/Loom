// Moved from src/utils/EdgeManager.ts (Phase 1 restructure)
import { Edge, MarkerType } from '@xyflow/react';
import { Wire, Tool } from '@domain/workflow/entities/workflow';
import { XMLWorkflowManager } from '../../../utils/XMLWorkflowManager';
import { wouldCreateCycle } from './loopDetection';
import { getThemeColor } from '../../../utils/themeColors';

export class EdgeManager {
  private xmlManager: XMLWorkflowManager;
  private setEdges: (updater: (prev: Edge[]) => Edge[]) => void;
  private tools: Tool[];
  private syncTimeout: NodeJS.Timeout | null = null;

  constructor(xmlManager: XMLWorkflowManager, setEdges: (updater: (prev: Edge[]) => Edge[]) => void, tools: Tool[]) {
    this.xmlManager = xmlManager;
    this.setEdges = setEdges;
    this.tools = tools;
  }

  private createEdgeId(wire: Wire): string {
    return `${encodeURIComponent(wire.from.tool)}_${wire.from.socket}_${encodeURIComponent(wire.to.tool)}_${wire.to.socket}`;
  }

  private parseEdgeId(edgeId: string) {
    const parts = edgeId.split('_');
    if (parts.length !== 4) return null;
  const [p0,p1,p2,p3] = parts;
  if (p0 == null || p1 == null || p2 == null || p3 == null) return null;
  try { return { fromTool: decodeURIComponent(p0), fromSocket: parseInt(p1), toTool: decodeURIComponent(p2), toSocket: parseInt(p3) }; } catch { return null; }
  }

  private createEdgeFromWire(wire: Wire, forceError?: boolean): Edge {
    const currentWires = this.xmlManager.getWires().filter(w => this.createEdgeId(w) !== this.createEdgeId(wire));
    const wouldLoop = wouldCreateCycle(this.tools, currentWires, wire.from.tool, wire.to.tool);
    const isError = forceError || wouldLoop;
    const strokeColor = isError ? getThemeColor('--color-edge-invalid-stroke') : getThemeColor('--color-edge-default-stroke');
    return { id: this.createEdgeId(wire), source: wire.from.tool, target: wire.to.tool, sourceHandle: `output-${wire.from.socket}`, targetHandle: `input-${wire.to.socket}`, type: 'default', style: { stroke: strokeColor, strokeWidth: 2, strokeDasharray: isError ? '5,5' : undefined, cursor: 'pointer' }, markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor }, data: { isError, errorType: isError ? (wouldLoop ? 'cycle' : 'forced') : undefined }, deletable: true, selectable: true, focusable: true, animated: isError };
  }

  addWire(wire: Wire): void {
    const newEdge = this.createEdgeFromWire(wire);
  this.setEdges(prev => [...prev, newEdge]);
    try { this.xmlManager.addWire(wire); this.scheduleSync(); } catch (e) { console.error('Failed to add wire to XML:', e); this.setEdges(p => p.filter(edge => edge.id !== newEdge.id)); throw e; }
  }

  removeWire(edgeId: string): void {
  this.setEdges(prev => prev.filter(edge => edge.id !== edgeId));
    const parsed = this.parseEdgeId(edgeId);
    if (parsed) {
      try { this.xmlManager.removeWire({ tool: parsed.fromTool, socket: parsed.fromSocket }, { tool: parsed.toTool, socket: parsed.toSocket }); this.scheduleSync(); }
      catch (e) { console.error('Failed to remove wire from XML:', e); const xmlWires = this.xmlManager.getWires(); const correspondingWire = xmlWires.find(w => this.createEdgeId(w) === edgeId); if (correspondingWire) { const restoredEdge = this.createEdgeFromWire(correspondingWire); this.setEdges(prev => [...prev, restoredEdge]); } throw e; }
    }
  }

  private reconcileEdges(xmlWires: Wire[], currentEdges: Edge[]): Edge[] {
    const xmlEdgeIds = new Set(xmlWires.map(w => this.createEdgeId(w)));
    const currentEdgeIds = new Set(currentEdges.map(e => e.id));
    const validEdges = currentEdges.filter(edge => xmlEdgeIds.has(edge.id));
    const missingWires = xmlWires.filter(w => !currentEdgeIds.has(this.createEdgeId(w)));
    const missingEdges = missingWires.map(wire => this.createEdgeFromWire(wire));
    return [...validEdges, ...missingEdges];
  }

  private scheduleSync(): void { if (this.syncTimeout) clearTimeout(this.syncTimeout); this.syncTimeout = setTimeout(() => { this.syncFromXML(); }, 150); }

  syncFromXML(): void {
    const xmlWires = this.xmlManager.getWires();
    this.setEdges(currentEdges => {
      const reconciled = this.reconcileEdges(xmlWires, currentEdges);
      const needsUpdate = reconciled.length !== currentEdges.length || reconciled.some(edge => !currentEdges.find(ce => ce.id === edge.id));
      return needsUpdate ? reconciled : currentEdges;
    });
  }

  getEdgesFromXML(): Edge[] { return this.xmlManager.getWires().map(wire => this.createEdgeFromWire(wire)); }
  updateTools(tools: Tool[]): void { this.tools = tools; this.syncFromXML(); }
  destroy(): void { if (this.syncTimeout) clearTimeout(this.syncTimeout); }
}
