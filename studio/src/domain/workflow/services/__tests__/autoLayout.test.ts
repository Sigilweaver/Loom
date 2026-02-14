import { describe, it, expect } from 'vitest';
import { autoLayout } from '../autoLayout';
import type { Tool, Wire } from '@domain/workflow/entities/workflow';

const tool = (id: string): Tool => ({
  id,
  type: 'Dummy',
  x: 0,
  y: 0,
  config: {},
  sockets: [],
});

const wire = (from: string, to: string): Wire => ({
  from: { tool: from, socket: 'output' },
  to: { tool: to, socket: 'input' },
});

describe('autoLayout', () => {
  it('returns empty positions for empty input', () => {
    const result = autoLayout([], []);
    expect(result.positions).toEqual([]);
  });

  it('places a single tool at the start position', () => {
    const result = autoLayout([tool('A')], []);
    expect(result.positions).toEqual([
      { id: 'A', x: 100, y: 100 },
    ]);
  });

  it('places a single tool with custom start position', () => {
    const result = autoLayout([tool('A')], [], { startX: 50, startY: 200 });
    expect(result.positions).toEqual([
      { id: 'A', x: 50, y: 200 },
    ]);
  });

  it('lays out a linear chain left to right', () => {
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('B', 'C')];

    const result = autoLayout(tools, wires);

    const posMap = new Map(result.positions.map((p) => [p.id, p]));
    // A should be leftmost, C rightmost
    expect(posMap.get('A')!.x).toBeLessThan(posMap.get('B')!.x);
    expect(posMap.get('B')!.x).toBeLessThan(posMap.get('C')!.x);
    // All on the same row
    expect(posMap.get('A')!.y).toBe(posMap.get('B')!.y);
    expect(posMap.get('B')!.y).toBe(posMap.get('C')!.y);
  });

  it('uses default spacing for columns', () => {
    const tools = [tool('A'), tool('B')];
    const wires = [wire('A', 'B')];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // Default horizontalSpacing is 280, startX is 100
    expect(posMap.get('A')).toEqual({ id: 'A', x: 100, y: 100 });
    expect(posMap.get('B')).toEqual({ id: 'B', x: 380, y: 100 });
  });

  it('stacks parallel tools vertically in the same column', () => {
    //   A → B
    //   A → C
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // B and C should be in the same column (both depth 1)
    expect(posMap.get('B')!.x).toBe(posMap.get('C')!.x);
    // B and C should have different Y
    expect(posMap.get('B')!.y).not.toBe(posMap.get('C')!.y);
  });

  it('respects custom spacing', () => {
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, {
      horizontalSpacing: 200,
      verticalSpacing: 80,
      startX: 0,
      startY: 0,
    });

    const posMap = new Map(result.positions.map((p) => [p.id, p]));
    expect(posMap.get('A')).toEqual({ id: 'A', x: 0, y: 0 });
    // B at column 1, row 0
    expect(posMap.get('B')!.x).toBe(200);
    // C at column 1, row 1
    expect(posMap.get('C')!.x).toBe(200);
    // Vertical spacing between B and C
    expect(Math.abs(posMap.get('C')!.y - posMap.get('B')!.y)).toBe(80);
  });

  it('assigns deepest possible column for diamond patterns', () => {
    //   A → B → D
    //   A → C → D
    const tools = [tool('A'), tool('B'), tool('C'), tool('D')];
    const wires = [
      wire('A', 'B'),
      wire('A', 'C'),
      wire('B', 'D'),
      wire('C', 'D'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // D should be at depth 2 (furthest right), not depth 1
    expect(posMap.get('A')!.x).toBeLessThan(posMap.get('B')!.x);
    expect(posMap.get('B')!.x).toBeLessThan(posMap.get('D')!.x);
    expect(posMap.get('B')!.x).toBe(posMap.get('C')!.x);
  });

  it('handles disconnected tools', () => {
    const tools = [tool('A'), tool('B'), tool('X')];
    const wires = [wire('A', 'B')];

    const result = autoLayout(tools, wires);

    // All three should have positions
    expect(result.positions).toHaveLength(3);
    const ids = result.positions.map((p) => p.id).sort();
    expect(ids).toEqual(['A', 'B', 'X']);
  });

  it('handles entirely disconnected workflows (no wires)', () => {
    const tools = [tool('A'), tool('B'), tool('C')];

    const result = autoLayout(tools, []);

    expect(result.positions).toHaveLength(3);
    // All disconnected, should all be in the same column
    const xs = result.positions.map((p) => p.x);
    expect(new Set(xs).size).toBe(1);
    // Each should have a different y
    const ys = result.positions.map((p) => p.y);
    expect(new Set(ys).size).toBe(3);
  });

  it('handles multiple independent subgraphs', () => {
    //   A → B    C → D
    const tools = [tool('A'), tool('B'), tool('C'), tool('D')];
    const wires = [wire('A', 'B'), wire('C', 'D')];

    const result = autoLayout(tools, wires);

    expect(result.positions).toHaveLength(4);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // Both A and C are sources (depth 0)
    expect(posMap.get('A')!.x).toBe(posMap.get('C')!.x);
    // Both B and D are depth 1
    expect(posMap.get('B')!.x).toBe(posMap.get('D')!.x);
  });

  it('ignores wires referencing non-existent tools', () => {
    const tools = [tool('A'), tool('B')];
    const wires = [wire('A', 'B'), wire('A', 'Z')]; // Z doesn't exist

    const result = autoLayout(tools, wires);

    expect(result.positions).toHaveLength(2);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));
    expect(posMap.get('A')!.x).toBeLessThan(posMap.get('B')!.x);
  });

  it('positions all tools even in the presence of cycles', () => {
    // A → B → C → A (cycle)
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('B', 'C'), wire('C', 'A')];

    const result = autoLayout(tools, wires);

    // All tools should get positions (graceful degradation)
    expect(result.positions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------
// Socket-aware crossing minimization tests
// ---------------------------------------------------------------

/** Tool with a single output socket (like Input). */
const sourceTool = (id: string): Tool => ({
  id,
  type: 'Input',
  x: 0,
  y: 0,
  config: {},
  sockets: [{ id: 'output', direction: 'output' }],
});

/** Tool with a single input socket (like Output). */
const sinkTool = (id: string): Tool => ({
  id,
  type: 'Output',
  x: 0,
  y: 0,
  config: {},
  sockets: [{ id: 'input', direction: 'input' }],
});

/** Tool with one input and one output (like Select, Sort, etc.). */
const passThroughTool = (id: string): Tool => ({
  id,
  type: 'Select',
  x: 0,
  y: 0,
  config: {},
  sockets: [
    { id: 'input', direction: 'input' },
    { id: 'output', direction: 'output' },
  ],
});

/** Join tool with L/R inputs and L/J/R outputs. */
const joinTool = (id: string): Tool => ({
  id,
  type: 'Join',
  x: 0,
  y: 0,
  config: {},
  sockets: [
    { id: 'input-left', direction: 'input', type: 'L' },
    { id: 'input-right', direction: 'input', type: 'R' },
    { id: 'output-left', direction: 'output', type: 'L' },
    { id: 'output-match', direction: 'output', type: 'J' },
    { id: 'output-right', direction: 'output', type: 'R' },
  ],
});

/** Filter tool with T/F outputs. */
const filterTool = (id: string): Tool => ({
  id,
  type: 'Filter',
  x: 0,
  y: 0,
  config: {},
  sockets: [
    { id: 'input', direction: 'input' },
    { id: 'output-true', direction: 'output', type: 'T' },
    { id: 'output-false', direction: 'output', type: 'F' },
  ],
});

/** Union tool with two inputs and one output. */
const unionTool = (id: string): Tool => ({
  id,
  type: 'Union',
  x: 0,
  y: 0,
  config: {},
  sockets: [
    { id: 'input-primary', direction: 'input' },
    { id: 'input-secondary', direction: 'input' },
    { id: 'output', direction: 'output' },
  ],
});

/** Wire with explicit socket names. */
const socketWire = (
  from: string,
  fromSocket: string,
  to: string,
  toSocket: string,
): Wire => ({
  from: { tool: from, socket: fromSocket },
  to: { tool: to, socket: toSocket },
});

describe('autoLayout – crossing minimization', () => {
  it('orders inputs to match Join socket positions (left above right)', () => {
    //   inputA ──→ Join(input-right)   ← bottom socket
    //   inputB ──→ Join(input-left)    ← top socket
    // Expect: inputB (left/top) above inputA (right/bottom)
    const tools = [sourceTool('inputA'), sourceTool('inputB'), joinTool('join')];
    const wires = [
      socketWire('inputA', 'output', 'join', 'input-right'),
      socketWire('inputB', 'output', 'join', 'input-left'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    expect(posMap.get('inputB')!.y).toBeLessThan(posMap.get('inputA')!.y);
  });

  it('orders outputs from Join to match socket positions (L above J above R)', () => {
    //   Join(output-left)  ──→ selL
    //   Join(output-match) ──→ selJ
    //   Join(output-right) ──→ selR
    const tools = [
      sourceTool('src'),
      joinTool('join'),
      passThroughTool('selR'),
      passThroughTool('selJ'),
      passThroughTool('selL'),
    ];
    const wires = [
      socketWire('src', 'output', 'join', 'input-left'),
      socketWire('join', 'output-right', 'selR', 'input'),
      socketWire('join', 'output-match', 'selJ', 'input'),
      socketWire('join', 'output-left', 'selL', 'input'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    expect(posMap.get('selL')!.y).toBeLessThan(posMap.get('selJ')!.y);
    expect(posMap.get('selJ')!.y).toBeLessThan(posMap.get('selR')!.y);
  });

  it('orders Filter outputs: true above false', () => {
    //   Filter(output-true)  ──→ trueTarget
    //   Filter(output-false) ──→ falseTarget
    const tools = [
      sourceTool('src'),
      filterTool('filter'),
      sinkTool('falseTarget'),
      sinkTool('trueTarget'),
    ];
    const wires = [
      socketWire('src', 'output', 'filter', 'input'),
      socketWire('filter', 'output-true', 'trueTarget', 'input'),
      socketWire('filter', 'output-false', 'falseTarget', 'input'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    expect(posMap.get('trueTarget')!.y).toBeLessThan(posMap.get('falseTarget')!.y);
  });

  it('handles the full Join workflow example without crossings', () => {
    //  Input1 ──→ Join(input-right)
    //  Input2 ──→ Join(input-left)
    //  Join(output-left)  ──→ Select1 ──→ Summarize ──→ Union
    //  Join(output-match) ──→ Select2 ─────────────────→ Union
    //  Join(output-right) ──→ Sort    ──→ Output
    const tools = [
      sourceTool('input1'),
      sourceTool('input2'),
      joinTool('join'),
      passThroughTool('select1'),
      passThroughTool('select2'),
      passThroughTool('sort'),
      passThroughTool('summarize'),
      sinkTool('output'),
      unionTool('union'),
    ];
    const wires = [
      socketWire('input1', 'output', 'join', 'input-right'),
      socketWire('input2', 'output', 'join', 'input-left'),
      socketWire('join', 'output-left', 'select1', 'input'),
      socketWire('join', 'output-match', 'select2', 'input'),
      socketWire('join', 'output-right', 'sort', 'input'),
      socketWire('select1', 'output', 'summarize', 'input'),
      socketWire('sort', 'output', 'output', 'input'),
      socketWire('select2', 'output', 'union', 'input-primary'),
      socketWire('summarize', 'output', 'union', 'input-secondary'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // Inputs: input2 (→ left socket) should be above input1 (→ right socket)
    expect(posMap.get('input2')!.y).toBeLessThan(posMap.get('input1')!.y);

    // Join outputs: select1 (left) above select2 (match) above sort (right)
    expect(posMap.get('select1')!.y).toBeLessThan(posMap.get('select2')!.y);
    expect(posMap.get('select2')!.y).toBeLessThan(posMap.get('sort')!.y);

    // Downstream: summarize (from select1, top branch) above output (from sort, bottom branch)
    expect(posMap.get('summarize')!.y).toBeLessThan(posMap.get('output')!.y);
  });

  it('preserves order for tools with single sockets (no crossing info)', () => {
    //   A → B → D
    //   A → C → D
    // Both B and C have single sockets so barycenter degenerates to row position.
    // Order should be stable (B before C as provided by Kahn traversal).
    const tools = [
      passThroughTool('A'),
      passThroughTool('B'),
      passThroughTool('C'),
      passThroughTool('D'),
    ];
    const wires = [
      socketWire('A', 'output', 'B', 'input'),
      socketWire('A', 'output', 'C', 'input'),
      socketWire('B', 'output', 'D', 'input'),
      socketWire('C', 'output', 'D', 'input'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // B and C in same column, D in next
    expect(posMap.get('B')!.x).toBe(posMap.get('C')!.x);
    expect(posMap.get('B')!.x).toBeLessThan(posMap.get('D')!.x);
  });

  it('handles mixed socket tools in a complex graph', () => {
    //  src1 ──→ Filter ──(true)──→ Join(input-left)
    //  src2 ──→ Filter ──(false)─→ Join(input-right)
    //
    // But wired in reverse order to test reordering:
    //  src1 → filter(true) → join(input-right)
    //  src2 → filter(false) → join(input-left)
    //
    // The backward sweep should reorder: the tool connected to
    // join(input-left / top) should be above the one connected to
    // join(input-right / bottom). The filter outputs should also match.
    const tools = [
      sourceTool('src'),
      filterTool('filter'),
      joinTool('join'),
      passThroughTool('trueTarget'),
      passThroughTool('falseTarget'),
    ];
    const wires = [
      socketWire('src', 'output', 'filter', 'input'),
      socketWire('filter', 'output-true', 'trueTarget', 'input'),
      socketWire('filter', 'output-false', 'falseTarget', 'input'),
      socketWire('trueTarget', 'output', 'join', 'input-right'),
      socketWire('falseTarget', 'output', 'join', 'input-left'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // The wires must cross somewhere (true→right, false→left).
    // The backward sweep from the Join dominates: falseTarget connects to
    // join(input-left / top socket) so it ends up above trueTarget
    // (which connects to input-right / bottom socket).
    // The crossing is pushed to earlier in the graph (between filter and targets).
    expect(posMap.get('falseTarget')!.y).toBeLessThan(posMap.get('trueTarget')!.y);

    // Both in the same column
    expect(posMap.get('trueTarget')!.x).toBe(posMap.get('falseTarget')!.x);
  });
});
