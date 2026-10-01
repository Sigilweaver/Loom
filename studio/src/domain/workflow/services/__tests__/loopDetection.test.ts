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
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 'output' }, to: { tool: 'B', socket: 'input' } },
      { from: { tool: 'B', socket: 'output' }, to: { tool: 'C', socket: 'input' } },
    ];
    expect(wouldCreateCycle(wires, 'C', 'A')).toBe(true);
  });

  it('wouldCreateCycle rejects self loops', () => {
    expect(wouldCreateCycle([], 'A', 'A')).toBe(true);
  });

  it('wouldCreateCycle allows a wire unrelated to an existing cycle', () => {
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 'output' }, to: { tool: 'B', socket: 'input' } },
      { from: { tool: 'B', socket: 'output' }, to: { tool: 'A', socket: 'input' } },
    ];
    expect(wouldCreateCycle(wires, 'C', 'D')).toBe(false);
    expect(wouldCreateCycle(wires, 'A', 'C')).toBe(false);
  });

  it('wouldCreateCycle follows long paths', () => {
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 'output' }, to: { tool: 'B', socket: 'input' } },
      { from: { tool: 'B', socket: 'output' }, to: { tool: 'C', socket: 'input' } },
      { from: { tool: 'C', socket: 'output' }, to: { tool: 'D', socket: 'input' } },
    ];
    expect(wouldCreateCycle(wires, 'D', 'A')).toBe(true);
    expect(wouldCreateCycle(wires, 'A', 'D')).toBe(false);
  });
});
