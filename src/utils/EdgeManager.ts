import { Edge, MarkerType } from '@xyflow/react';
import { Wire } from '../types/workflow';
import { XMLWorkflowManager } from './XMLWorkflowManager';

export class EdgeManager {
  private xmlManager: XMLWorkflowManager;
  private setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  private syncTimeout: NodeJS.Timeout | null = null;

  constructor(xmlManager: XMLWorkflowManager, setEdges: React.Dispatch<React.SetStateAction<Edge[]>>) {
    this.xmlManager = xmlManager;
    this.setEdges = setEdges;
  }

  // Create edge ID with safe encoding
  private createEdgeId(wire: Wire): string {
    return `${encodeURIComponent(wire.from.tool)}_${wire.from.socket}_${encodeURIComponent(wire.to.tool)}_${wire.to.socket}`;
  }

  // Parse edge ID safely
  private parseEdgeId(edgeId: string): { fromTool: string; fromSocket: number; toTool: string; toSocket: number } | null {
    const parts = edgeId.split('_');
    if (parts.length !== 4) return null;
    
    try {
      return {
        fromTool: decodeURIComponent(parts[0]),
        fromSocket: parseInt(parts[1]),
        toTool: decodeURIComponent(parts[2]),
        toSocket: parseInt(parts[3])
      };
    } catch {
      return null;
    }
  }

  // Create React Flow edge from wire
  private createEdgeFromWire(wire: Wire): Edge {
    return {
      id: this.createEdgeId(wire),
      source: wire.from.tool,
      target: wire.to.tool,
      sourceHandle: `output-${wire.from.socket}`,
      targetHandle: `input-${wire.to.socket}`,
      type: 'default',
      style: { 
        stroke: '#4f46e5', 
        strokeWidth: 2,
        cursor: 'pointer'
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4f46e5',
      },
      deletable: true,
      selectable: true,
      focusable: true,
    };
  }

  // Add wire with optimistic UI update
  addWire(wire: Wire): void {
    // Phase 1: Immediate UI update (optimistic)
    const newEdge = this.createEdgeFromWire(wire);
    this.setEdges(prev => [...prev, newEdge]);
    
    try {
      // Phase 2: XML update
      this.xmlManager.addWire(wire);
      
      // Phase 3: Schedule sync verification
      this.scheduleSync();
    } catch (error) {
      // Rollback on XML error
      console.error('Failed to add wire to XML:', error);
      this.setEdges(prev => prev.filter(edge => edge.id !== newEdge.id));
      throw error;
    }
  }

  // Remove wire with optimistic UI update
  removeWire(edgeId: string): void {
    // Phase 1: Immediate UI update (optimistic)
    this.setEdges(prev => prev.filter(edge => edge.id !== edgeId));
    
    // Phase 2: XML update
    const parsed = this.parseEdgeId(edgeId);
    if (parsed) {
      try {
        this.xmlManager.removeWire(
          { tool: parsed.fromTool, socket: parsed.fromSocket },
          { tool: parsed.toTool, socket: parsed.toSocket }
        );
        
        // Phase 3: Schedule sync verification
        this.scheduleSync();
      } catch (error) {
        console.error('Failed to remove wire from XML:', error);
        // Re-add edge on XML error
        const xmlWires = this.xmlManager.getWires();
        const correspondingWire = xmlWires.find(wire => this.createEdgeId(wire) === edgeId);
        if (correspondingWire) {
          const restoredEdge = this.createEdgeFromWire(correspondingWire);
          this.setEdges(prev => [...prev, restoredEdge]);
        }
        throw error;
      }
    }
  }

  // Reconcile edges with XML state
  private reconcileEdges(xmlWires: Wire[], currentEdges: Edge[]): Edge[] {
    const xmlEdgeIds = new Set(xmlWires.map(wire => this.createEdgeId(wire)));
    const currentEdgeIds = new Set(currentEdges.map(edge => edge.id));
    
    // Remove edges that don't exist in XML
    const validEdges = currentEdges.filter(edge => xmlEdgeIds.has(edge.id));
    
    // Add missing edges from XML
    const missingWires = xmlWires.filter(wire => !currentEdgeIds.has(this.createEdgeId(wire)));
    const missingEdges = missingWires.map(wire => this.createEdgeFromWire(wire));
    
    return [...validEdges, ...missingEdges];
  }

  // Schedule debounced sync verification
  private scheduleSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.syncFromXML();
    }, 150); // 150ms debounce
  }

  // Force sync from XML (eventual consistency)
  syncFromXML(): void {
    const xmlWires = this.xmlManager.getWires();
    
    this.setEdges(currentEdges => {
      const reconciledEdges = this.reconcileEdges(xmlWires, currentEdges);
      
      // Only update if there are actual differences
      const needsUpdate = reconciledEdges.length !== currentEdges.length ||
        reconciledEdges.some(edge => !currentEdges.find(ce => ce.id === edge.id));
      
      return needsUpdate ? reconciledEdges : currentEdges;
    });
  }

  // Get all edges from XML (for initial load)
  getEdgesFromXML(): Edge[] {
    const xmlWires = this.xmlManager.getWires();
    return xmlWires.map(wire => this.createEdgeFromWire(wire));
  }

  // Cleanup
  destroy(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
  }
}
