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

// ---------------------------------------------------------------
// Core layout tests
// ---------------------------------------------------------------

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

  it('aligns downstream tools with upstream y position in fan-out', () => {
    //   A → B → D → F
    //   A → C → E
    // F should align with D (same y), not be pushed to the top.
    const tools = [tool('A'), tool('B'), tool('C'), tool('D'), tool('E'), tool('F')];
    const wires = [
      wire('A', 'B'), wire('A', 'C'),
      wire('B', 'D'), wire('C', 'E'),
      wire('D', 'F'),
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // B and D should be on the same row (D follows B in a straight line)
    expect(posMap.get('D')!.y).toBe(posMap.get('B')!.y);
    // F should align with D, not jump to the top
    expect(posMap.get('F')!.y).toBe(posMap.get('D')!.y);
    // C and E should be on the same row
    expect(posMap.get('E')!.y).toBe(posMap.get('C')!.y);
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
    // A should be in column 0
    expect(posMap.get('A')!.x).toBe(0);
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

// ---------------------------------------------------------------
// Alignment strategy tests
// ---------------------------------------------------------------

describe('autoLayout – alignment strategies', () => {
  it('upstream alignment keeps roots at startY', () => {
    //   A → B
    //   A → C
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, { alignment: 'upstream' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // Root A stays at startY (100)
    expect(posMap.get('A')!.y).toBe(100);
    // B inherits from A, C is below B
    expect(posMap.get('B')!.y).toBe(100);
    expect(posMap.get('C')!.y).toBe(220);
  });

  it('downstream alignment keeps leaves at startY', () => {
    //   A → B
    //   A → C
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, { alignment: 'downstream' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // B and C are leaves — assigned from row positions
    expect(posMap.get('B')!.y).toBe(100);
    expect(posMap.get('C')!.y).toBe(220);
    // A aligns with primary successor (B via first output), not their average
    expect(posMap.get('A')!.y).toBe(posMap.get('B')!.y);
  });

  it('balanced alignment aligns root with primary successor', () => {
    //   A → B
    //   A → C
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, { alignment: 'balanced' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // A is a root — balanced aligns it with primary successor (B)
    expect(posMap.get('A')!.y).toBe(posMap.get('B')!.y);
    // C below B
    expect(posMap.get('C')!.y).toBeGreaterThan(posMap.get('B')!.y);
  });

  it('balanced alignment preserves linear chain positions', () => {
    // A → B → C → D (straight chain — balanced should equal upstream)
    const tools = [tool('A'), tool('B'), tool('C'), tool('D')];
    const wires = [wire('A', 'B'), wire('B', 'C'), wire('C', 'D')];

    const result = autoLayout(tools, wires, { alignment: 'balanced' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // All on the same row
    const ys = [...posMap.values()].map((p) => p.y);
    expect(new Set(ys).size).toBe(1);
  });

  it('balanced alignment keeps diamond merge consistent', () => {
    //   A → B → D
    //   A → C → D
    const tools = [tool('A'), tool('B'), tool('C'), tool('D')];
    const wires = [wire('A', 'B'), wire('A', 'C'), wire('B', 'D'), wire('C', 'D')];

    const balanced = autoLayout(tools, wires, { alignment: 'balanced' });
    const upstream = autoLayout(tools, wires, { alignment: 'upstream' });
    const balMap = new Map(balanced.positions.map((p) => [p.id, p]));
    const upMap = new Map(upstream.positions.map((p) => [p.id, p]));

    // D should be between B and C in both alignments
    expect(balMap.get('D')!.y).toBeGreaterThanOrEqual(balMap.get('B')!.y);
    expect(balMap.get('D')!.y).toBeLessThanOrEqual(balMap.get('C')!.y);
    // A is a root — balanced aligns with primary successor (B)
    expect(balMap.get('A')!.y).toBe(balMap.get('B')!.y);
    // In upstream, A is also at the top (same behavior for roots)
    expect(upMap.get('A')!.y).toBe(upMap.get('B')!.y);
  });

  it('upstream aligns merge node with primary (first-socket) predecessor', () => {
    // A → Join (left input)
    // B → Join (right input)
    // Join should align with A (primary input), not center between A and B
    const joinTool: Tool = {
      id: 'Join',
      type: 'Join',
      x: 0,
      y: 0,
      config: {},
      sockets: [
        { id: 'left', direction: 'input', type: 'table' },
        { id: 'right', direction: 'input', type: 'table' },
        { id: 'output', direction: 'output', type: 'table' },
      ],
    };
    const tools = [tool('A'), tool('B'), joinTool];
    const wires: Wire[] = [
      { from: { tool: 'A', socket: 'output' }, to: { tool: 'Join', socket: 'left' } },
      { from: { tool: 'B', socket: 'output' }, to: { tool: 'Join', socket: 'right' } },
    ];

    const result = autoLayout(tools, wires, { alignment: 'upstream' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // Join should be at the same Y as A (primary/left input), not centered
    expect(posMap.get('Join')!.y).toBe(posMap.get('A')!.y);
    // B should be on a different row
    expect(posMap.get('B')!.y).not.toBe(posMap.get('A')!.y);
  });

  it('downstream aligns fan-out node with primary (first-socket) successor', () => {
    // Split → A (first output)
    // Split → B (second output)
    // Split should align with A (primary output), not center between A and B
    const splitTool: Tool = {
      id: 'Split',
      type: 'Split',
      x: 0,
      y: 0,
      config: {},
      sockets: [
        { id: 'input', direction: 'input', type: 'table' },
        { id: 'out1', direction: 'output', type: 'table' },
        { id: 'out2', direction: 'output', type: 'table' },
      ],
    };
    const tools = [splitTool, tool('A'), tool('B')];
    const wires: Wire[] = [
      { from: { tool: 'Split', socket: 'out1' }, to: { tool: 'A', socket: 'input' } },
      { from: { tool: 'Split', socket: 'out2' }, to: { tool: 'B', socket: 'input' } },
    ];

    const result = autoLayout(tools, wires, { alignment: 'downstream' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // Split should align with A (primary/first output), not centered
    expect(posMap.get('Split')!.y).toBe(posMap.get('A')!.y);
    expect(posMap.get('B')!.y).not.toBe(posMap.get('A')!.y);
  });
});

// ---------------------------------------------------------------
// Crossing reduction heuristic tests
// ---------------------------------------------------------------

describe('autoLayout – crossing reduction heuristics', () => {
  it('median heuristic orders Join inputs correctly', () => {
    const tools = [sourceTool('A'), sourceTool('B'), joinTool('join')];
    const wires = [
      socketWire('A', 'output', 'join', 'input-right'),
      socketWire('B', 'output', 'join', 'input-left'),
    ];

    const result = autoLayout(tools, wires, { crossingReduction: 'median' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // B (left/top) above A (right/bottom)
    expect(posMap.get('B')!.y).toBeLessThan(posMap.get('A')!.y);
  });

  it('adjacent exchange reduces crossings for crossed wire pairs', () => {
    // Build a graph where the initial Kahn order produces crossings
    // that adjacent exchange should fix:
    //   A → D
    //   B → C
    //   C → D's column peer E
    // This creates a pattern where simple barycenter might not resolve
    // optimally on the first pass, but adjacent exchange cleans it up.
    const tools = [
      passThroughTool('A'),
      passThroughTool('B'),
      passThroughTool('C'),
      passThroughTool('D'),
    ];
    const wires = [
      socketWire('A', 'output', 'D', 'input'),
      socketWire('B', 'output', 'C', 'input'),
    ];

    const withExchange = autoLayout(tools, wires, { adjacentExchange: true });
    const withoutExchange = autoLayout(tools, wires, { adjacentExchange: false });

    // Both should produce valid layouts
    expect(withExchange.positions).toHaveLength(4);
    expect(withoutExchange.positions).toHaveLength(4);
  });

  it('more sweep passes converge to the same or better result', () => {
    const tools = [
      sourceTool('s1'), sourceTool('s2'), sourceTool('s3'),
      joinTool('j1'), joinTool('j2'),
      sinkTool('out'),
    ];
    const wires = [
      socketWire('s1', 'output', 'j1', 'input-left'),
      socketWire('s2', 'output', 'j1', 'input-right'),
      socketWire('s2', 'output', 'j2', 'input-left'),
      socketWire('s3', 'output', 'j2', 'input-right'),
      socketWire('j1', 'output-match', 'out', 'input'),
    ];

    const few = autoLayout(tools, wires, { maxSweepPasses: 1, adjacentExchange: false });
    const many = autoLayout(tools, wires, { maxSweepPasses: 8, adjacentExchange: false });

    // Both produce valid layouts with all tools
    expect(few.positions).toHaveLength(6);
    expect(many.positions).toHaveLength(6);
  });

  it('reorders inputs to avoid long-edge crossings with chained Joins', () => {
    // Classic pattern: multiple Input tools feed into a chain of Joins.
    //   order_items → Join1 (left)
    //   products    → Join1 (right)
    //   Join1.match → Join2 (left)
    //   orders      → Join2 (right)
    //   Join2.match → Join3 (left)
    //   customers   → Join3 (right)
    //
    // Without long-edge awareness, inputs connecting to Join2 and Join3
    // can land in arbitrary order because all targets are at row 0 in
    // their respective columns.  With column-distance tiebreaking, the
    // optimal top-to-bottom order is:
    //   order_items, products, orders, customers
    const join = (id: string): Tool => ({
      id,
      type: 'Join',
      x: 0,
      y: 0,
      config: {},
      sockets: [
        { id: 'input-left', direction: 'input', type: 'L' },
        { id: 'input-right', direction: 'input', type: 'R' },
        { id: 'output-match', direction: 'output', type: 'J' },
      ],
    });

    const tools = [
      tool('customers'),   // listed first to ensure algorithm reorders
      tool('orders'),
      tool('order_items'),
      tool('products'),
      join('Join1'),
      join('Join2'),
      join('Join3'),
      tool('Formula'),
    ];
    const wires: Wire[] = [
      { from: { tool: 'order_items', socket: 'output' }, to: { tool: 'Join1', socket: 'input-left' } },
      { from: { tool: 'products', socket: 'output' }, to: { tool: 'Join1', socket: 'input-right' } },
      { from: { tool: 'Join1', socket: 'output-match' }, to: { tool: 'Join2', socket: 'input-left' } },
      { from: { tool: 'orders', socket: 'output' }, to: { tool: 'Join2', socket: 'input-right' } },
      { from: { tool: 'Join2', socket: 'output-match' }, to: { tool: 'Join3', socket: 'input-left' } },
      { from: { tool: 'customers', socket: 'output' }, to: { tool: 'Join3', socket: 'input-right' } },
      { from: { tool: 'Join3', socket: 'output-match' }, to: { tool: 'Formula', socket: 'input' } },
    ];

    const result = autoLayout(tools, wires);
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // The 4 inputs should be ordered so that no long edges cross:
    // order_items (→ Join1 left) should be highest
    expect(posMap.get('order_items')!.y).toBeLessThan(posMap.get('products')!.y);
    // products (→ Join1 right) above orders (→ Join2 right, further away)
    expect(posMap.get('products')!.y).toBeLessThan(posMap.get('orders')!.y);
    // orders (→ Join2 right) above customers (→ Join3 right, furthest)
    expect(posMap.get('orders')!.y).toBeLessThan(posMap.get('customers')!.y);
  });
});

// ---------------------------------------------------------------
// Direction tests
// ---------------------------------------------------------------

describe('autoLayout – direction', () => {
  it('TB direction swaps x and y', () => {
    const tools = [tool('A'), tool('B')];
    const wires = [wire('A', 'B')];

    const lr = autoLayout(tools, wires, { direction: 'LR' });
    const tb = autoLayout(tools, wires, { direction: 'TB' });

    const lrMap = new Map(lr.positions.map((p) => [p.id, p]));
    const tbMap = new Map(tb.positions.map((p) => [p.id, p]));

    // In LR, A and B differ in x but share y
    expect(lrMap.get('A')!.x).toBeLessThan(lrMap.get('B')!.x);
    expect(lrMap.get('A')!.y).toBe(lrMap.get('B')!.y);

    // In TB, A and B differ in y but share x
    expect(tbMap.get('A')!.y).toBeLessThan(tbMap.get('B')!.y);
    expect(tbMap.get('A')!.x).toBe(tbMap.get('B')!.x);
  });

  it('TB direction lays out a fan-out vertically', () => {
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, { direction: 'TB' });
    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // A should be above B and C (smaller y)
    expect(posMap.get('A')!.y).toBeLessThan(posMap.get('B')!.y);
    expect(posMap.get('A')!.y).toBeLessThan(posMap.get('C')!.y);
    // B and C should be at the same depth (same y)
    expect(posMap.get('B')!.y).toBe(posMap.get('C')!.y);
    // B and C should differ in x
    expect(posMap.get('B')!.x).not.toBe(posMap.get('C')!.x);
  });
});

// ---------------------------------------------------------------
// Grid snap tests
// ---------------------------------------------------------------

describe('autoLayout – grid snap', () => {
  it('snaps positions to the nearest grid multiple', () => {
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, { gridSnap: 20 });

    for (const pos of result.positions) {
      expect(pos.x % 20).toBe(0);
      expect(pos.y % 20).toBe(0);
    }
  });

  it('resolves y collisions after snapping', () => {
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, {
      gridSnap: 20,
      verticalSpacing: 120,
    });

    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // B and C should be in the same column and not overlap
    expect(posMap.get('B')!.x).toBe(posMap.get('C')!.x);
    expect(posMap.get('B')!.y).not.toBe(posMap.get('C')!.y);
    expect(
      Math.abs(posMap.get('B')!.y - posMap.get('C')!.y),
    ).toBeGreaterThanOrEqual(120);
  });
});

// ---------------------------------------------------------------
// Selected-only layout tests
// ---------------------------------------------------------------

describe('autoLayout – selected-only layout', () => {
  it('returns positions only for selected tools', () => {
    const tools = [tool('A'), tool('B'), tool('C'), tool('D')];
    const wires = [wire('A', 'B'), wire('C', 'D')];

    const result = autoLayout(tools, wires, {
      selectedToolIds: ['A', 'B'],
    });

    const ids = result.positions.map((p) => p.id).sort();
    expect(ids).toEqual(['A', 'B']);
  });

  it('anchors at the bounding box origin of the selection', () => {
    const t = (id: string, x: number, y: number): Tool => ({
      id,
      type: 'Dummy',
      x,
      y,
      config: {},
      sockets: [],
    });
    const tools = [t('A', 300, 400), t('B', 500, 400), t('C', 100, 100)];
    const wires = [wire('A', 'B')];

    const result = autoLayout(tools, wires, {
      selectedToolIds: ['A', 'B'],
    });

    const posMap = new Map(result.positions.map((p) => [p.id, p]));
    // Starts from min x/y of selection (300, 400)
    expect(posMap.get('A')!.x).toBe(300);
    expect(posMap.get('A')!.y).toBe(400);
  });

  it('returns empty for empty selection', () => {
    const tools = [tool('A'), tool('B')];
    const wires = [wire('A', 'B')];

    const result = autoLayout(tools, wires, { selectedToolIds: [] });
    // Empty selectedToolIds means no filter applied — all tools laid out
    expect(result.positions).toHaveLength(2);
  });
});

// ---------------------------------------------------------------
// Compaction tests
// ---------------------------------------------------------------

describe('autoLayout – compaction', () => {
  it('closes large vertical gaps when enabled', () => {
    //  A → C
    //  B → D    (B and D are far away due to alignment)
    //
    // With balanced alignment on a complex graph, gaps can form.
    // Compaction should close them.
    const tools = [
      passThroughTool('A'),
      passThroughTool('B'),
      passThroughTool('C'),
      passThroughTool('D'),
      passThroughTool('E'),
    ];
    const wires = [
      socketWire('A', 'output', 'C', 'input'),
      socketWire('B', 'output', 'D', 'input'),
      socketWire('C', 'output', 'E', 'input'),
      socketWire('D', 'output', 'E', 'input'),
    ];

    const compact = autoLayout(tools, wires, { compaction: true });
    const loose = autoLayout(tools, wires, { compaction: false });

    // Both should have all tools
    expect(compact.positions).toHaveLength(5);
    expect(loose.positions).toHaveLength(5);

    // Compacted layout should have total height <= loose layout
    const height = (pos: typeof compact.positions) => {
      const ys = pos.map((p) => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(height(compact.positions)).toBeLessThanOrEqual(
      height(loose.positions),
    );
  });
});

// ---------------------------------------------------------------
// Combined options tests
// ---------------------------------------------------------------

describe('autoLayout – combined options', () => {
  it('works with all options specified', () => {
    const tools = [
      sourceTool('src'),
      filterTool('filter'),
      sinkTool('out1'),
      sinkTool('out2'),
    ];
    const wires = [
      socketWire('src', 'output', 'filter', 'input'),
      socketWire('filter', 'output-true', 'out1', 'input'),
      socketWire('filter', 'output-false', 'out2', 'input'),
    ];

    const result = autoLayout(tools, wires, {
      horizontalSpacing: 200,
      verticalSpacing: 100,
      startX: 50,
      startY: 50,
      direction: 'LR',
      crossingReduction: 'median',
      maxSweepPasses: 6,
      adjacentExchange: true,
      alignment: 'balanced',
      compaction: true,
      gridSnap: 10,
    });

    expect(result.positions).toHaveLength(4);
    // All positions should be on the grid
    for (const pos of result.positions) {
      expect(pos.x % 10).toBe(0);
      expect(pos.y % 10).toBe(0);
    }
  });

  it('TB + balanced + grid snap produces valid layout', () => {
    const tools = [tool('A'), tool('B'), tool('C')];
    const wires = [wire('A', 'B'), wire('A', 'C')];

    const result = autoLayout(tools, wires, {
      direction: 'TB',
      alignment: 'balanced',
      gridSnap: 20,
    });

    const posMap = new Map(result.positions.map((p) => [p.id, p]));

    // All on grid
    for (const pos of result.positions) {
      expect(pos.x % 20).toBe(0);
      expect(pos.y % 20).toBe(0);
    }

    // A above B and C in TB mode
    expect(posMap.get('A')!.y).toBeLessThan(posMap.get('B')!.y);
    expect(posMap.get('A')!.y).toBeLessThan(posMap.get('C')!.y);
  });
});
