import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { Wire } from '@domain/workflow/entities/workflow';
import {
  INVALID_EDGE_CLASS,
  edgeTypeForStyle,
  wireEdgeId,
  wireToEdge,
  wiresToEdges,
} from '../wireEdges';

const wire = (from: string, to: string): Wire => ({
  from: { tool: from, socket: 'output' },
  to: { tool: to, socket: 'input' },
});

const pathOptionsOf = (edge: Edge) => (edge as Edge & { pathOptions?: unknown }).pathOptions;

describe('wireEdges', () => {
  it('maps wires to edges with handle ids and stable ids', () => {
    const wires = [wire('A', 'B')];

    const [edge] = wiresToEdges(wires, 'bezier');

    expect(edge).toBeDefined();
    expect(edge!.id).toBe(wireEdgeId(wires[0]!));
    expect(edge!.source).toBe('A');
    expect(edge!.target).toBe('B');
    expect(edge!.sourceHandle).toBe('output-output');
    expect(edge!.targetHandle).toBe('input-input');
    expect(edge!.deletable).toBe(true);
    expect(edge!.selectable).toBe(true);
  });

  it('builds edge ids that can be parsed back into a wire', () => {
    expect(wireEdgeId(wire('tool_a', 'tool_b'))).toBe('tool_a_output_tool_b_input');
    expect(wireEdgeId(wire('a b', 'c'))).toBe('a%20b_output_c_input');
  });

  it('does not bake theme colors into edge state', () => {
    const [edge] = wiresToEdges([wire('A', 'B')], 'bezier');
    expect(edge!.style?.stroke).toBeUndefined();
    expect(edge!.className).toBeUndefined();
  });

  it('follows the edge style setting', () => {
    const wires = [wire('A', 'B')];

    expect(edgeTypeForStyle('bezier')).toBe('default');
    expect(edgeTypeForStyle('step')).toBe('step');
    expect(wiresToEdges(wires, 'bezier')[0]!.type).toBe('default');
    expect(wiresToEdges(wires, 'straight')[0]!.type).toBe('straight');
    expect(pathOptionsOf(wiresToEdges(wires, 'smoothstep')[0]!)).toEqual({
      borderRadius: 20,
    });
    expect(pathOptionsOf(wiresToEdges(wires, 'step')[0]!)).toBeUndefined();
  });

  it('flags edges that close a cycle as invalid', () => {
    const wires = [wire('A', 'B'), wire('B', 'C'), wire('C', 'A')];

    const edges = wiresToEdges(wires, 'bezier');

    for (const edge of edges) {
      expect(edge.className).toBe(INVALID_EDGE_CLASS);
      expect(edge.animated).toBe(true);
      expect(edge.data).toEqual({ isError: true, errorType: 'cycle' });
    }
  });

  it('leaves acyclic edges valid', () => {
    const wires = [wire('A', 'B'), wire('B', 'C')];

    const edges = wiresToEdges(wires, 'bezier');

    for (const edge of edges) {
      expect(edge.className).toBeUndefined();
      expect(edge.animated).toBe(false);
      expect(edge.data).toEqual({ isError: false, errorType: undefined });
    }
  });

  it('evaluates a single wire against the full wire list', () => {
    const wires = [wire('A', 'B'), wire('B', 'A')];
    expect(wireToEdge(wires[0]!, wires, 'bezier').className).toBe(INVALID_EDGE_CLASS);
    expect(wireToEdge(wires[0]!, [wires[0]!], 'bezier').className).toBeUndefined();
  });

  it('returns no edges for no wires', () => {
    expect(wiresToEdges([], 'bezier')).toEqual([]);
  });
});
