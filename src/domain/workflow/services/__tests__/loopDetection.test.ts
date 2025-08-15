import { describe, it, expect } from 'vitest';
import { detectCycles, wouldCreateCycle } from '../loopDetection';
import type { Tool, Wire } from '@domain/workflow/entities/workflow';

const tool = (id: string): Tool => ({ id, type: 'Dummy', x: 0, y: 0, config: {}, sockets: [] });

describe('loopDetection', () => {
  it('detectCycles returns false for acyclic graph', () => {
    const tools: Tool[] = [tool('A'), tool('B'), tool('C')];
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 0 }, to: { tool: 'B', socket: 0 } },
      { from: { tool: 'B', socket: 0 }, to: { tool: 'C', socket: 0 } },
    ];
    expect(detectCycles(tools, wires)).toBe(false);
  });

  it('detectCycles returns true for cyclic graph', () => {
    const tools: Tool[] = [tool('A'), tool('B'), tool('C')];
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 0 }, to: { tool: 'B', socket: 0 } },
      { from: { tool: 'B', socket: 0 }, to: { tool: 'C', socket: 0 } },
      { from: { tool: 'C', socket: 0 }, to: { tool: 'A', socket: 0 } },
    ];
    expect(detectCycles(tools, wires)).toBe(true);
  });

  it('wouldCreateCycle detects a potential new cycle', () => {
    const tools: Tool[] = [tool('A'), tool('B'), tool('C')];
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 0 }, to: { tool: 'B', socket: 0 } },
      { from: { tool: 'B', socket: 0 }, to: { tool: 'C', socket: 0 } },
    ];
    expect(wouldCreateCycle(tools, wires, 'C', 'A')).toBe(true);
  });
});
