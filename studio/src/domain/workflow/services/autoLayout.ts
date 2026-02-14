/**
 * Auto-layout utility for workflow DAGs.
 *
 * Produces a left-to-right layered layout using Kahn's algorithm for column
 * assignment, then a socket-aware barycenter heuristic for crossing
 * minimization within each column.
 *
 * The crossing minimization considers socket positions on tools — e.g., if
 * two inputs connect to a Join's left and right sockets, the one connected
 * to the left (top) socket is placed above the one connected to the right
 * (bottom) socket.  This follows the Sugiyama framework without external
 * dependencies.
 */
 import type { Tool, Wire } from '@domain/workflow/entities/workflow';

export interface LayoutOptions {
  /** Horizontal gap between columns (default 280) */
  horizontalSpacing?: number;
  /** Vertical gap between rows within a column (default 120) */
  verticalSpacing?: number;
  /** Starting x coordinate (default 100) */
  startX?: number;
  /** Starting y coordinate (default 100) */
  startY?: number;
}

export interface LayoutResult {
  positions: Array<{ id: string; x: number; y: number }>;
}

const DEFAULTS: Required<LayoutOptions> = {
  horizontalSpacing: 280,
  verticalSpacing: 120,
  startX: 100,
  startY: 100,
};

// -------------------------------------------------------------------
// Internal types
// -------------------------------------------------------------------

interface EdgeInfo {
  target: string;
  fromSocket: string;
  toSocket: string;
}

// -------------------------------------------------------------------
// Socket fraction helpers
// -------------------------------------------------------------------

/**
 * Fractional position of a socket among its same-direction siblings.
 *
 * For a tool with 3 output sockets, the fractions are 0, 1/3, 2/3.
 * This maps directly to the visual top-to-bottom socket order on a node.
 * Returns 0 when the tool has <=1 socket of the given direction.
 */
function socketFraction(
  tool: Tool,
  socketId: string,
  direction: 'input' | 'output',
): number {
  const sockets = tool.sockets.filter((s) => s.direction === direction);
  if (sockets.length <= 1) return 0;
  const idx = sockets.findIndex((s) => s.id === socketId);
  return idx >= 0 ? idx / sockets.length : 0;
}

// -------------------------------------------------------------------
// Main layout function
// -------------------------------------------------------------------

/**
 * Compute layout positions for all tools in a workflow DAG.
 *
 * 1. Build enriched adjacency maps (with socket info).
 * 2. Topological sort via Kahn's algorithm → column assignment.
 * 3. Crossing minimization via barycenter heuristic (forward + backward sweeps).
 * 4. Assign x/y coordinates from final column/row positions.
 *
 * Disconnected tools go in a trailing column. Cycle participants are appended
 * at the end (cycles shouldn't exist in valid workflows but are handled
 * gracefully).
 */
export function autoLayout(
  tools: Tool[],
  wires: Wire[],
  options: LayoutOptions = {},
): LayoutResult {
  const opts = { ...DEFAULTS, ...options };

  if (tools.length === 0) {
    return { positions: [] };
  }

  if (tools.length === 1) {
    return {
      positions: [{ id: tools[0]!.id, x: opts.startX, y: opts.startY }],
    };
  }

  const toolIds = new Set(tools.map((t) => t.id));
  const toolMap = new Map(tools.map((t) => [t.id, t]));

  // ------------------------------------------------------------------
  // Build adjacency maps (enriched with socket info)
  // ------------------------------------------------------------------
  const outgoing = new Map<string, EdgeInfo[]>();
  const incoming = new Map<string, EdgeInfo[]>();
  const inDegree = new Map<string, number>();
  const connectedTools = new Set<string>();

  for (const id of toolIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
    inDegree.set(id, 0);
  }

  for (const wire of wires) {
    const src = wire.from.tool;
    const tgt = wire.to.tool;
    if (!toolIds.has(src) || !toolIds.has(tgt)) continue;

    const edge: EdgeInfo = {
      target: tgt,
      fromSocket: wire.from.socket,
      toSocket: wire.to.socket,
    };
    outgoing.get(src)!.push(edge);
    incoming.get(tgt)!.push({
      target: src, // reversed for lookup convenience
      fromSocket: wire.from.socket,
      toSocket: wire.to.socket,
    });
    inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
    connectedTools.add(src);
    connectedTools.add(tgt);
  }

  // ------------------------------------------------------------------
  // Step 1: Column assignment via Kahn's algorithm
  // ------------------------------------------------------------------
  const depth = new Map<string, number>();
  const queue: string[] = [];

  for (const id of toolIds) {
    if (connectedTools.has(id) && inDegree.get(id) === 0) {
      queue.push(id);
      depth.set(id, 0);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const edge of outgoing.get(current)!) {
      const newDeg = (inDegree.get(edge.target) ?? 1) - 1;
      inDegree.set(edge.target, newDeg);

      const candidateDepth = (depth.get(current) ?? 0) + 1;
      if (!depth.has(edge.target) || candidateDepth > depth.get(edge.target)!) {
        depth.set(edge.target, candidateDepth);
      }

      if (newDeg === 0) {
        queue.push(edge.target);
      }
    }
  }

  // ------------------------------------------------------------------
  // Step 2: Group by column
  // ------------------------------------------------------------------
  const columns = new Map<number, string[]>();
  for (const id of sorted) {
    const col = depth.get(id) ?? 0;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(id);
  }

  // Handle disconnected tools and cycle participants
  const placed = new Set(sorted);
  const disconnected = tools
    .filter((t) => !connectedTools.has(t.id))
    .map((t) => t.id);
  const cycleTools = [...connectedTools].filter((id) => !placed.has(id));

  const maxCol = columns.size > 0 ? Math.max(...columns.keys()) : -1;
  if (disconnected.length > 0) {
    columns.set(maxCol + 1, disconnected);
  }
  if (cycleTools.length > 0) {
    const cycleCol = (columns.size > 0 ? Math.max(...columns.keys()) : 0) + 1;
    columns.set(cycleCol, cycleTools);
  }

  // ------------------------------------------------------------------
  // Step 3: Crossing minimization (barycenter heuristic)
  // ------------------------------------------------------------------
  const sortedCols = [...columns.keys()].sort((a, b) => a - b);

  // Row index for each tool within its column (updated during sweeps)
  const rowOf = new Map<string, number>();
  for (const col of sortedCols) {
    columns.get(col)!.forEach((id, idx) => rowOf.set(id, idx));
  }

  const NUM_PASSES = 2;

  for (let pass = 0; pass < NUM_PASSES; pass++) {
    // Forward sweep: order each column based on predecessors
    for (let ci = 1; ci < sortedCols.length; ci++) {
      const col = sortedCols[ci]!;
      const colTools = columns.get(col)!;

      const barycenters = new Map<string, number>();
      for (const id of colTools) {
        const inEdges = incoming.get(id);
        if (!inEdges || inEdges.length === 0) {
          barycenters.set(id, rowOf.get(id) ?? 0);
          continue;
        }

        // Barycenter = avg of predecessor row + output socket fraction
        // This ensures tools connected to higher output sockets (top of node)
        // are placed above those connected to lower output sockets.
        let sum = 0;
        let count = 0;
        for (const edge of inEdges) {
          if (!depth.has(edge.target)) continue; // skip cycle participants
          const srcTool = toolMap.get(edge.target);
          if (!srcTool) continue;
          sum +=
            (rowOf.get(edge.target) ?? 0) +
            socketFraction(srcTool, edge.fromSocket, 'output');
          count++;
        }
        barycenters.set(id, count > 0 ? sum / count : (rowOf.get(id) ?? 0));
      }

      colTools.sort(
        (a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0),
      );
      colTools.forEach((id, idx) => rowOf.set(id, idx));
    }

    // Backward sweep: order each column based on successors
    for (let ci = sortedCols.length - 2; ci >= 0; ci--) {
      const col = sortedCols[ci]!;
      const colTools = columns.get(col)!;

      const barycenters = new Map<string, number>();
      for (const id of colTools) {
        const outEdges = outgoing.get(id);
        if (!outEdges || outEdges.length === 0) {
          barycenters.set(id, rowOf.get(id) ?? 0);
          continue;
        }

        // Barycenter = avg of successor row + input socket fraction
        // This ensures tools connected to higher input sockets (top of node)
        // are placed above tools connected to lower input sockets.
        let sum = 0;
        let count = 0;
        for (const edge of outEdges) {
          if (!depth.has(edge.target)) continue;
          const tgtTool = toolMap.get(edge.target);
          if (!tgtTool) continue;
          sum +=
            (rowOf.get(edge.target) ?? 0) +
            socketFraction(tgtTool, edge.toSocket, 'input');
          count++;
        }
        barycenters.set(id, count > 0 ? sum / count : (rowOf.get(id) ?? 0));
      }

      colTools.sort(
        (a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0),
      );
      colTools.forEach((id, idx) => rowOf.set(id, idx));
    }
  }

  // ------------------------------------------------------------------
  // Step 4: Assign coordinates
  // ------------------------------------------------------------------
  const positions: Array<{ id: string; x: number; y: number }> = [];

  for (const col of sortedCols) {
    const colTools = columns.get(col)!;
    for (let row = 0; row < colTools.length; row++) {
      positions.push({
        id: colTools[row]!,
        x: opts.startX + col * opts.horizontalSpacing,
        y: opts.startY + row * opts.verticalSpacing,
      });
    }
  }

  return { positions };
}
