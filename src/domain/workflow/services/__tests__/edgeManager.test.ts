import { describe, it, expect } from 'vitest';
import { EdgeManager } from '../edgeManager';
import type { XMLWorkflowManager } from '../../../../utils/XMLWorkflowManager';
import type { Wire, Tool } from '@domain/workflow/entities/workflow';
import type { Edge } from '@xyflow/react';

class StubXMLWorkflowManager {
  private wires: Wire[] = [];
  addWire(wire: Wire) { this.wires.push(wire); }
  removeWire(from: { tool: string; socket: number }, to: { tool: string; socket: number }) {
    this.wires = this.wires.filter(w => !(w.from.tool === from.tool && w.from.socket === from.socket && w.to.tool === to.tool && w.to.socket === to.socket));
  }
  getWires(): Wire[] { return this.wires; }
}

const tool = (id: string): Tool => ({ id, type: 'Dummy', x: 0, y: 0, config: {}, sockets: [] });

describe('EdgeManager', () => {
  it('creates normal edge then cycle edge', () => {
    const xml = new StubXMLWorkflowManager();
    let edges: Edge[] = [];
    const setEdges = (updater: (prev: Edge[]) => Edge[]) => { edges = updater(edges); };
  // Cast stub to XMLWorkflowManager for testing (only subset used)
  const manager = new EdgeManager(xml as unknown as XMLWorkflowManager, setEdges, [tool('A'), tool('B')]);

    manager.addWire({ from: { tool: 'A', socket: 0 }, to: { tool: 'B', socket: 0 } });
    expect(edges.length).toBe(1);
  expect(edges[0]?.data?.isError).toBeFalsy();

    manager.addWire({ from: { tool: 'B', socket: 0 }, to: { tool: 'A', socket: 0 } });
    expect(edges.length).toBe(2);
    const cycleEdge = edges.find(e => e.source === 'B' && e.target === 'A');
    expect(cycleEdge?.data?.isError).toBe(true);
    expect(cycleEdge?.data?.errorType).toBe('cycle');
  });
});
