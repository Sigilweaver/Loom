import { describe, it, expect } from 'vitest';
import { detectCycles, wouldCreateCycle } from '../loopDetection';
import type { Tool, Wire } from '@domain/workflow/entities/workflow';

const tool = (id: string): Tool => ({ id, type: 'Dummy', x: 0, y: 0, config: {}, sockets: [] });

describe('loopDetection', () => {
  it('detectCycles returns false for acyclic graph', () => {
    const tools: Tool[] = [tool('A'), tool('B'), tool('C')];
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 'output' }, to: { tool: 'B', socket: 'input' } },
      { from: { tool: 'B', socket: 'output' }, to: { tool: 'C', socket: 'input' } },
    ];
    expect(detectCycles(tools, wires)).toBe(false);
  });

  it('detectCycles returns true for cyclic graph', () => {
    const tools: Tool[] = [tool('A'), tool('B'), tool('C')];
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 'output' }, to: { tool: 'B', socket: 'input' } },
      { from: { tool: 'B', socket: 'output' }, to: { tool: 'C', socket: 'input' } },
      { from: { tool: 'C', socket: 'output' }, to: { tool: 'A', socket: 'input' } },
    ];
    expect(detectCycles(tools, wires)).toBe(true);
  });

  it('wouldCreateCycle detects a potential new cycle', () => {
    const tools: Tool[] = [tool('A'), tool('B'), tool('C')];
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 'output' }, to: { tool: 'B', socket: 'input' } },
      { from: { tool: 'B', socket: 'output' }, to: { tool: 'C', socket: 'input' } },
    ];
    expect(wouldCreateCycle(tools, wires, 'C', 'A')).toBe(true);
  });
});
