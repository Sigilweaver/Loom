/**
 * Derives React Flow edges from workflow wires.
 *
 * Edges are a view concern: they depend on the user's edge style preference
 * and on graph validity, so they are computed at render time instead of being
 * stored alongside the workflow. Colors are never baked in here; the canvas
 * stylesheet resolves them from the active theme via CSS variables and the
 * `edge-invalid` class.
 */
import type { Edge } from '@xyflow/react';
import type { Wire } from '@domain/workflow/entities/workflow';
import type { AppSettings } from '../../../types/settings';

export type EdgeStyle = AppSettings['ui']['edgeStyle'];

/** Class name applied to edges that participate in an invalid (cyclic) connection. */
export const INVALID_EDGE_CLASS = 'edge-invalid';

/** Stable React Flow edge id for a wire. */
export function wireEdgeId(wire: Wire): string {
  return `${encodeURIComponent(wire.from.tool)}_${wire.from.socket}_${encodeURIComponent(wire.to.tool)}_${wire.to.socket}`;
}

/** Map the settings edge style to a React Flow edge type (bezier is 'default'). */
export function edgeTypeForStyle(style: EdgeStyle): string {
  return style === 'bezier' ? 'default' : style;
}

/** Find all edges within strongly connected components in O(V + E).
 *
 * Iterative Kosaraju traversals avoid overflowing the call stack on large
 * imported workflows. An edge belongs to a cycle exactly when its endpoints
 * share a component (including a self-loop). Bridges into or out of a cyclic
 * component remain valid.
 */
function cyclicWires(wires: Wire[]): Set<Wire> {
  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();
  for (const { from, to } of wires) {
    if (!downstream.has(from.tool)) downstream.set(from.tool, []);
    if (!downstream.has(to.tool)) downstream.set(to.tool, []);
    if (!upstream.has(from.tool)) upstream.set(from.tool, []);
    if (!upstream.has(to.tool)) upstream.set(to.tool, []);
    downstream.get(from.tool)!.push(to.tool);
    upstream.get(to.tool)!.push(from.tool);
  }

  const seen = new Set<string>();
  const finishOrder: string[] = [];
  for (const start of downstream.keys()) {
    if (seen.has(start)) continue;
    seen.add(start);
    const stack = [{ node: start, next: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = downstream.get(frame.node)!;
      if (frame.next === neighbors.length) {
        finishOrder.push(frame.node);
        stack.pop();
        continue;
      }
      const neighbor = neighbors[frame.next++]!;
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        stack.push({ node: neighbor, next: 0 });
      }
    }
  }

  const components = new Map<string, number>();
  for (let index = finishOrder.length - 1; index >= 0; index--) {
    const start = finishOrder[index]!;
    if (components.has(start)) continue;
    components.set(start, index);
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop()!;
      for (const neighbor of upstream.get(node)!) {
        if (!components.has(neighbor)) {
          components.set(neighbor, index);
          stack.push(neighbor);
        }
      }
    }
  }

  return new Set(wires.filter(({ from, to }) => components.get(from.tool) === components.get(to.tool)));
}

/** Build a single edge for a wire. `wires` is the complete wire list. */
export function wireToEdge(
  wire: Wire,
  wires: Wire[],
  edgeStyle: EdgeStyle
): Edge {
  // Include a proposed wire even when the caller has not inserted it yet.
  const graphWires = wires.includes(wire) ? wires : [...wires, wire];
  return renderWireEdge(wire, edgeStyle, cyclicWires(graphWires).has(wire));
}

function renderWireEdge(wire: Wire, edgeStyle: EdgeStyle, isInvalid: boolean): Edge {
  return {
    id: wireEdgeId(wire),
    source: wire.from.tool,
    target: wire.to.tool,
    sourceHandle: `output-${wire.from.socket}`,
    targetHandle: `input-${wire.to.socket}`,
    type: edgeTypeForStyle(edgeStyle),
    ...(edgeStyle === 'smoothstep' && { pathOptions: { borderRadius: 20 } }),
    style: {
      strokeWidth: 2,
      ...(isInvalid && { strokeDasharray: '5,5' }),
      cursor: 'pointer',
    },
    ...(isInvalid && { className: INVALID_EDGE_CLASS }),
    data: { isError: isInvalid, errorType: isInvalid ? 'cycle' : undefined },
    deletable: true,
    selectable: true,
    focusable: true,
    animated: isInvalid,
  };
}

/** Build the edge list for a whole workflow. */
export function wiresToEdges(
  wires: Wire[],
  edgeStyle: EdgeStyle
): Edge[] {
  const invalidWires = cyclicWires(wires);
  return wires.map((wire) => renderWireEdge(wire, edgeStyle, invalidWires.has(wire)));
}
