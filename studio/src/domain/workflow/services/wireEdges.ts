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
import { wouldCreateCycle } from '@domain/workflow/services/loopDetection';
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

function isSameWire(a: Wire, b: Wire): boolean {
  return (
    a.from.tool === b.from.tool &&
    a.from.socket === b.from.socket &&
    a.to.tool === b.to.tool &&
    a.to.socket === b.to.socket
  );
}

/** Build a single edge for a wire. `wires` is the complete wire list. */
export function wireToEdge(
  wire: Wire,
  wires: Wire[],
  edgeStyle: EdgeStyle
): Edge {
  const otherWires = wires.filter((w) => !isSameWire(w, wire));
  const isInvalid = wouldCreateCycle(otherWires, wire.from.tool, wire.to.tool);

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
  return wires.map((wire) => wireToEdge(wire, wires, edgeStyle));
}
