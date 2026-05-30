/**
 * Auto-layout utility for workflow DAGs.
 *
 * Enhanced Sugiyama-style layered layout with:
 * - Column assignment via longest-path (Kahn's algorithm)
 * - Socket-aware crossing minimization (barycenter or median heuristic)
 * - Adjacent exchange optimization for further crossing reduction
 * - Coordinate assignment with upstream, downstream, or balanced alignment
 * - Support for LR and TB layout directions
 * - Grid snapping and selected-only layout mode
 *
 * The crossing minimization considers socket positions on tools - e.g., if
 * two inputs connect to a Join's left and right sockets, the one connected
 * to the left (top) socket is placed above the one connected to the right
 * (bottom) socket.  This follows the Sugiyama framework without external
 * dependencies.
 */
import type { Tool, Wire } from '@domain/workflow/entities/workflow';

// -------------------------------------------------------------------
// Public types
// -------------------------------------------------------------------

export interface LayoutOptions {
  /** Horizontal gap between columns (default 280) */
  horizontalSpacing?: number;
  /** Vertical gap between rows within a column (default 120) */
  verticalSpacing?: number;
  /** Starting x coordinate (default 100) */
  startX?: number;
  /** Starting y coordinate (default 100) */
  startY?: number;

  /**
   * Layout direction (default `'LR'`).
   * - `'LR'`: left-to-right (DAG flows horizontally)
   * - `'TB'`: top-to-bottom (DAG flows vertically)
   *
   * In TB mode the layout is computed LR internally then x/y are swapped.
   */
  direction?: 'LR' | 'TB';

  /**
   * Crossing reduction heuristic (default `'barycenter'`).
   * - `'barycenter'`: averages neighbor positions - good general-purpose
   * - `'median'`: uses median of neighbor positions - more robust to outliers
   */
  crossingReduction?: 'barycenter' | 'median';

  /**
   * Maximum number of forward+backward sweep passes for crossing
   * minimization (default 24).  Sweeps stop early once the row ordering
   * stabilises, so in practice only a handful of passes run.
   */
  maxSweepPasses?: number;

  /**
   * Run adjacent-exchange optimization after each sweep column
   * (default `true`).  Greedily swaps adjacent pairs within a column
   * when the swap reduces edge crossings.
   */
  adjacentExchange?: boolean;

  /**
   * Vertical alignment strategy (default `'upstream'`).
   * - `'upstream'`: align each tool with its primary (first-socket)
   *    predecessor, keeping the main lineage straight
   * - `'downstream'`: align each tool with its primary (first-socket)
   *    successor, keeping the main lineage straight
   * - `'balanced'`: upstream alignment as the base, then root nodes
   *    are aligned with their primary successor - keeps interior
   *    lineages straight while source nodes track their output
   */
  alignment?: 'upstream' | 'downstream' | 'balanced';

  /**
   * Close unnecessary vertical gaps after alignment (default `false`).
   * When enabled, gaps larger than `2 × verticalSpacing` between adjacent
   * tools in a column are reduced to `verticalSpacing`.
   */
  compaction?: boolean;

  /**
   * If provided, only these tools are repositioned.  Non-selected tools
   * keep their current positions.  The subgraph of selected tools and
   * their internal wires is laid out starting from the bounding-box
   * origin of the selection.
   */
  selectedToolIds?: string[];

  /**
   * Snap final positions to a grid of this size in pixels.  Set to `0`
   * (default) to disable.  After snapping, Y-collisions within columns
   * are resolved so that no two tools overlap.
   */
  gridSnap?: number;
}

export interface LayoutResult {
  positions: Array<{ id: string; x: number; y: number }>;
}

// -------------------------------------------------------------------
// Defaults
// -------------------------------------------------------------------

interface ResolvedOptions {
  horizontalSpacing: number;
  verticalSpacing: number;
  startX: number;
  startY: number;
  direction: 'LR' | 'TB';
  crossingReduction: 'barycenter' | 'median';
  maxSweepPasses: number;
  adjacentExchange: boolean;
  alignment: 'upstream' | 'downstream' | 'balanced';
  compaction: boolean;
  gridSnap: number;
}

const DEFAULTS: ResolvedOptions = {
  horizontalSpacing: 280,
  verticalSpacing: 120,
  startX: 100,
  startY: 100,
  direction: 'LR',
  crossingReduction: 'barycenter',
  maxSweepPasses: 24,
  adjacentExchange: true,
  alignment: 'upstream',
  compaction: false,
  gridSnap: 0,
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
// Math helpers
// -------------------------------------------------------------------

/** Median of a numeric array.  Returns 0 for empty arrays. */
function medianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

// -------------------------------------------------------------------
// Crossing count helpers
// -------------------------------------------------------------------

/**
 * Count edge crossings between two specific adjacent tools in a column,
 * considering edges to both the previous and next columns.
 *
 * `toolAbove` is currently positioned above `toolBelow`.  A crossing
 * occurs when `toolAbove` connects to a neighbor BELOW one of
 * `toolBelow`'s neighbors (or vice-versa for the next column).
 *
 * Because only a single adjacent pair is being evaluated, the relative
 * positions of all other tools in the column remain unchanged - so the
 * crossing count from this pair comparison alone is sufficient to decide
 * whether the swap is beneficial.
 */
function crossingsForPair(
  toolAbove: string,
  toolBelow: string,
  prevCol: string[] | undefined,
  nextCol: string[] | undefined,
  outgoing: Map<string, EdgeInfo[]>,
  incoming: Map<string, EdgeInfo[]>,
  rowOf: Map<string, number>,
  depth: Map<string, number>,
  currentCol: number,
): number {
  let crossings = 0;

  // --- Edges to the immediately adjacent columns (standard Sugiyama) ---

  if (prevCol) {
    const prevSet = new Set(prevCol);
    const aboveIn = (incoming.get(toolAbove) ?? []).filter((e) =>
      prevSet.has(e.target),
    );
    const belowIn = (incoming.get(toolBelow) ?? []).filter((e) =>
      prevSet.has(e.target),
    );
    for (const ae of aboveIn) {
      for (const be of belowIn) {
        if ((rowOf.get(ae.target) ?? 0) > (rowOf.get(be.target) ?? 0))
          crossings++;
      }
    }
  }

  if (nextCol) {
    const nextSet = new Set(nextCol);
    const aboveOut = (outgoing.get(toolAbove) ?? []).filter((e) =>
      nextSet.has(e.target),
    );
    const belowOut = (outgoing.get(toolBelow) ?? []).filter((e) =>
      nextSet.has(e.target),
    );
    for (const ae of aboveOut) {
      for (const be of belowOut) {
        if ((rowOf.get(ae.target) ?? 0) > (rowOf.get(be.target) ?? 0))
          crossings++;
      }
    }
  }

  // --- Long edges (spanning non-adjacent columns) ---
  // These are invisible to the adjacent-column checks above but can
  // still cause visual wire crossings.  We detect them by comparing
  // the effective "virtual row" at the adjacent column boundary.
  // A long edge to column C from current column K passes through all
  // intermediate columns at an interpolated vertical position.  Two
  // long edges cross if their target ordering is inverted relative to
  // their source ordering.

  const aboveInLong = (incoming.get(toolAbove) ?? []).filter(
    (e) => depth.has(e.target) && (depth.get(e.target)!) < currentCol - 1,
  );
  const belowInLong = (incoming.get(toolBelow) ?? []).filter(
    (e) => depth.has(e.target) && (depth.get(e.target)!) < currentCol - 1,
  );
  for (const ae of aboveInLong) {
    for (const be of belowInLong) {
      if ((rowOf.get(ae.target) ?? 0) > (rowOf.get(be.target) ?? 0))
        crossings++;
    }
  }

  const aboveOutLong = (outgoing.get(toolAbove) ?? []).filter(
    (e) => depth.has(e.target) && (depth.get(e.target)!) > currentCol + 1,
  );
  const belowOutLong = (outgoing.get(toolBelow) ?? []).filter(
    (e) => depth.has(e.target) && (depth.get(e.target)!) > currentCol + 1,
  );
  for (const ae of aboveOutLong) {
    for (const be of belowOutLong) {
      if ((rowOf.get(ae.target) ?? 0) > (rowOf.get(be.target) ?? 0))
        crossings++;
    }
  }

  return crossings;
}

// -------------------------------------------------------------------
// Phase 1 - Build adjacency
// -------------------------------------------------------------------

function buildAdjacency(
  toolIds: Set<string>,
  wires: Wire[],
): {
  outgoing: Map<string, EdgeInfo[]>;
  incoming: Map<string, EdgeInfo[]>;
  inDegree: Map<string, number>;
  connectedTools: Set<string>;
} {
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

    outgoing.get(src)!.push({
      target: tgt,
      fromSocket: wire.from.socket,
      toSocket: wire.to.socket,
    });
    incoming.get(tgt)!.push({
      target: src,
      fromSocket: wire.from.socket,
      toSocket: wire.to.socket,
    });
    inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
    connectedTools.add(src);
    connectedTools.add(tgt);
  }

  return { outgoing, incoming, inDegree, connectedTools };
}

// -------------------------------------------------------------------
// Phase 2 - Column assignment (Kahn's topological sort, longest path)
// -------------------------------------------------------------------

function assignColumns(
  tools: Tool[],
  toolIds: Set<string>,
  outgoing: Map<string, EdgeInfo[]>,
  inDegree: Map<string, number>,
  connectedTools: Set<string>,
): {
  columns: Map<number, string[]>;
  depth: Map<string, number>;
  sortedCols: number[];
} {
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
      if (
        !depth.has(edge.target) ||
        candidateDepth > depth.get(edge.target)!
      ) {
        depth.set(edge.target, candidateDepth);
      }

      if (newDeg === 0) {
        queue.push(edge.target);
      }
    }
  }

  // Group by column
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
    const cycleCol =
      (columns.size > 0 ? Math.max(...columns.keys()) : 0) + 1;
    columns.set(cycleCol, cycleTools);
  }

  const sortedCols = [...columns.keys()].sort((a, b) => a - b);
  return { columns, depth, sortedCols };
}

// -------------------------------------------------------------------
// Phase 3 - Crossing minimization
// -------------------------------------------------------------------

/**
 * Small additive tiebreaker per column of distance between source and
 * target.  Ensures that tools connecting to the same row in different
 * columns are ordered by proximity - closer connections first - which
 * prevents long-edge crossings that the adjacent-column heuristic
 * cannot detect.
 *
 * The value is small enough (max ~0.03 for a 30-column graph) to never
 * override real row or socket-fraction differences.
 */
const COLUMN_DISTANCE_TIEBREAK = 0.001;

/**
 * Compute the priority value for a tool based on its neighbors,
 * using either barycenter (mean) or median strategy.
 *
 * A small column-distance tiebreaker is added so that edges spanning
 * multiple columns ("long edges") sort correctly even when all targets
 * share the same row index.
 *
 * Returns `null` when there are no valid neighbor positions, indicating
 * the caller should fall back to the tool's current row index.
 */
function computePriority(
  edges: EdgeInfo[] | undefined,
  depth: Map<string, number>,
  toolMap: Map<string, Tool>,
  rowOf: Map<string, number>,
  strategy: 'barycenter' | 'median',
  socketDirection: 'input' | 'output',
  socketField: 'fromSocket' | 'toSocket',
  currentCol: number,
): number | null {
  if (!edges || edges.length === 0) return null;

  const values: number[] = [];
  for (const edge of edges) {
    if (!depth.has(edge.target)) continue; // skip cycle participants
    const neighborTool = toolMap.get(edge.target);
    if (!neighborTool) continue;
    const colDistance = Math.abs(
      (depth.get(edge.target) ?? 0) - currentCol,
    );
    values.push(
      (rowOf.get(edge.target) ?? 0) +
        socketFraction(neighborTool, edge[socketField], socketDirection) +
        colDistance * COLUMN_DISTANCE_TIEBREAK,
    );
  }

  if (values.length === 0) return null;
  if (strategy === 'median') return medianValue(values);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Adjacent exchange: greedily swap adjacent pairs in a column when the
 * swap reduces the total crossing count with neighboring columns.
 *
 * The iteration is bounded to `2 × columnSize` rounds to prevent
 * pathological cases from looping indefinitely.
 */
function doAdjacentExchange(
  colTools: string[],
  prevCol: string[] | undefined,
  nextCol: string[] | undefined,
  outgoing: Map<string, EdgeInfo[]>,
  incoming: Map<string, EdgeInfo[]>,
  rowOf: Map<string, number>,
  depth: Map<string, number>,
  currentCol: number,
): void {
  let improved = true;
  let maxIters = colTools.length * 2;

  while (improved && maxIters-- > 0) {
    improved = false;
    for (let i = 0; i < colTools.length - 1; i++) {
      const a = colTools[i]!;
      const b = colTools[i + 1]!;

      const crossBefore = crossingsForPair(
        a,
        b,
        prevCol,
        nextCol,
        outgoing,
        incoming,
        rowOf,
        depth,
        currentCol,
      );

      // Try swap
      colTools[i] = b;
      colTools[i + 1] = a;
      rowOf.set(b, i);
      rowOf.set(a, i + 1);

      const crossAfter = crossingsForPair(
        b,
        a,
        prevCol,
        nextCol,
        outgoing,
        incoming,
        rowOf,
        depth,
        currentCol,
      );

      if (crossAfter >= crossBefore) {
        // Revert - swap didn't improve
        colTools[i] = a;
        colTools[i + 1] = b;
        rowOf.set(a, i);
        rowOf.set(b, i + 1);
      } else {
        improved = true;
      }
    }
  }
}

/**
 * Run crossing minimization sweeps over all columns.
 *
 * Each pass consists of a forward sweep (left-to-right, ordering by
 * predecessors) followed by a backward sweep (right-to-left, ordering
 * by successors).  After each column is sorted an optional adjacent
 * exchange pass further reduces crossings locally.
 */
function minimizeCrossings(
  columns: Map<number, string[]>,
  sortedCols: number[],
  outgoing: Map<string, EdgeInfo[]>,
  incoming: Map<string, EdgeInfo[]>,
  depth: Map<string, number>,
  toolMap: Map<string, Tool>,
  opts: ResolvedOptions,
): Map<string, number> {
  const rowOf = new Map<string, number>();
  for (const col of sortedCols) {
    columns.get(col)!.forEach((id, idx) => rowOf.set(id, idx));
  }

  const { crossingReduction: strategy, maxSweepPasses, adjacentExchange } = opts;

  /**
   * Snapshot the current row ordering as a string key so we can detect
   * convergence.  When two consecutive passes produce the same ordering
   * we've reached a fixed point and can stop early.
   */
  function snapshotOrder(): string {
    const parts: string[] = [];
    for (const col of sortedCols) {
      parts.push(columns.get(col)!.join(','));
    }
    return parts.join('|');
  }

  let prevSnapshot = '';

  for (let pass = 0; pass < maxSweepPasses; pass++) {
    // Forward sweep - order each column based on predecessors
    for (let ci = 1; ci < sortedCols.length; ci++) {
      const col = sortedCols[ci]!;
      const colTools = columns.get(col)!;

      const priorities = new Map<string, number>();
      for (const id of colTools) {
        const p = computePriority(
          incoming.get(id),
          depth,
          toolMap,
          rowOf,
          strategy,
          'output',
          'fromSocket',
          col,
        );
        priorities.set(id, p ?? (rowOf.get(id) ?? 0));
      }

      colTools.sort(
        (a, b) => (priorities.get(a) ?? 0) - (priorities.get(b) ?? 0),
      );
      colTools.forEach((id, idx) => rowOf.set(id, idx));

      if (adjacentExchange) {
        const prevCol = columns.get(sortedCols[ci - 1]!);
        const nextCol =
          ci + 1 < sortedCols.length
            ? columns.get(sortedCols[ci + 1]!)
            : undefined;
        doAdjacentExchange(
          colTools,
          prevCol,
          nextCol,
          outgoing,
          incoming,
          rowOf,
          depth,
          col,
        );
      }
    }

    // Backward sweep - order each column based on successors
    for (let ci = sortedCols.length - 2; ci >= 0; ci--) {
      const col = sortedCols[ci]!;
      const colTools = columns.get(col)!;

      const priorities = new Map<string, number>();
      for (const id of colTools) {
        const p = computePriority(
          outgoing.get(id),
          depth,
          toolMap,
          rowOf,
          strategy,
          'input',
          'toSocket',
          col,
        );
        priorities.set(id, p ?? (rowOf.get(id) ?? 0));
      }

      colTools.sort(
        (a, b) => (priorities.get(a) ?? 0) - (priorities.get(b) ?? 0),
      );
      colTools.forEach((id, idx) => rowOf.set(id, idx));

      if (adjacentExchange) {
        const prevCol =
          ci > 0 ? columns.get(sortedCols[ci - 1]!) : undefined;
        const nextCol = columns.get(sortedCols[ci + 1]!);
        doAdjacentExchange(
          colTools,
          prevCol,
          nextCol,
          outgoing,
          incoming,
          rowOf,
          depth,
          col,
        );
      }
    }

    // Check for convergence - stop early if ordering didn't change
    const snapshot = snapshotOrder();
    if (snapshot === prevSnapshot) break;
    prevSnapshot = snapshot;
  }

  return rowOf;
}

// -------------------------------------------------------------------
// Phase 4 - Coordinate assignment
// -------------------------------------------------------------------

/**
 * Upstream (left-to-right) coordinate assignment.
 *
 * Processes columns left-to-right.  Each tool's ideal Y is the Y of
 * the predecessor connected to its primary (first) input socket.  This
 * keeps the main lineage perfectly straight through merge nodes instead
 * of centering the tool between all predecessors.  Roots use their row
 * index from crossing minimization.  Collisions are resolved by pushing
 * tools downward to maintain minimum spacing.
 */
function assignUpstreamY(
  columns: Map<number, string[]>,
  sortedCols: number[],
  incoming: Map<string, EdgeInfo[]>,
  rowOf: Map<string, number>,
  toolMap: Map<string, Tool>,
  opts: ResolvedOptions,
): Map<string, number> {
  const finalY = new Map<string, number>();

  for (const col of sortedCols) {
    const colTools = columns.get(col)!;

    const idealYs: number[] = colTools.map((id) => {
      const inEdges = incoming.get(id);
      if (!inEdges || inEdges.length === 0) {
        return opts.startY + (rowOf.get(id) ?? 0) * opts.verticalSpacing;
      }

      // Collect predecessors with resolved Y positions and their socket
      // fractions on the current tool's input side.
      const predPositions: { y: number; frac: number }[] = [];
      const tool = toolMap.get(id);
      for (const edge of inEdges) {
        const y = finalY.get(edge.target);
        if (y !== undefined) {
          const frac = tool
            ? socketFraction(tool, edge.toSocket, 'input')
            : 0;
          predPositions.push({ y, frac });
        }
      }

      if (predPositions.length === 0) {
        return opts.startY + (rowOf.get(id) ?? 0) * opts.verticalSpacing;
      }

      // Align with the predecessor connected to the primary (first)
      // input socket - keeps the main lineage straight.
      predPositions.sort((a, b) => a.frac - b.frac);
      return predPositions[0]!.y;
    });

    // Resolve collisions - maintain crossing-minimization order
    for (let i = 1; i < idealYs.length; i++) {
      if (idealYs[i]! < idealYs[i - 1]! + opts.verticalSpacing) {
        idealYs[i] = idealYs[i - 1]! + opts.verticalSpacing;
      }
    }

    for (let i = 0; i < colTools.length; i++) {
      finalY.set(colTools[i]!, idealYs[i]!);
    }
  }

  return finalY;
}

/**
 * Downstream (right-to-left) coordinate assignment.
 *
 * Processes columns right-to-left.  Each tool's ideal Y is the Y of
 * the successor connected to its primary (first) output socket.  This
 * keeps the main lineage straight.  Leaves use their row index from
 * crossing minimization.
 */
function assignDownstreamY(
  columns: Map<number, string[]>,
  sortedCols: number[],
  outgoing: Map<string, EdgeInfo[]>,
  rowOf: Map<string, number>,
  toolMap: Map<string, Tool>,
  opts: ResolvedOptions,
): Map<string, number> {
  const finalY = new Map<string, number>();

  for (let ci = sortedCols.length - 1; ci >= 0; ci--) {
    const col = sortedCols[ci]!;
    const colTools = columns.get(col)!;

    const idealYs: number[] = colTools.map((id) => {
      const outEdges = outgoing.get(id);
      if (!outEdges || outEdges.length === 0) {
        return opts.startY + (rowOf.get(id) ?? 0) * opts.verticalSpacing;
      }

      // Collect successors with resolved Y positions and their socket
      // fractions on the current tool's output side.
      const succPositions: { y: number; frac: number }[] = [];
      const tool = toolMap.get(id);
      for (const edge of outEdges) {
        const y = finalY.get(edge.target);
        if (y !== undefined) {
          const frac = tool
            ? socketFraction(tool, edge.fromSocket, 'output')
            : 0;
          succPositions.push({ y, frac });
        }
      }

      if (succPositions.length === 0) {
        return opts.startY + (rowOf.get(id) ?? 0) * opts.verticalSpacing;
      }

      // Align with the successor connected to the primary (first)
      // output socket - keeps the main lineage straight.
      succPositions.sort((a, b) => a.frac - b.frac);
      return succPositions[0]!.y;
    });

    // Resolve collisions - maintain crossing-minimization order
    for (let i = 1; i < idealYs.length; i++) {
      if (idealYs[i]! < idealYs[i - 1]! + opts.verticalSpacing) {
        idealYs[i] = idealYs[i - 1]! + opts.verticalSpacing;
      }
    }

    for (let i = 0; i < colTools.length; i++) {
      finalY.set(colTools[i]!, idealYs[i]!);
    }
  }

  return finalY;
}

/**
 * Balanced coordinate assignment.
 *
 * Uses upstream alignment as the base (keeping lineages straight), then
 * adjusts root nodes (no predecessors) to align with their primary
 * successor.  This gives the best of both worlds: interior nodes stay
 * aligned with their upstream connections while source nodes are
 * positioned optimally relative to where their data flows.
 */
function assignBalancedY(
  columns: Map<number, string[]>,
  sortedCols: number[],
  outgoing: Map<string, EdgeInfo[]>,
  incoming: Map<string, EdgeInfo[]>,
  rowOf: Map<string, number>,
  toolMap: Map<string, Tool>,
  opts: ResolvedOptions,
): Map<string, number> {
  // Start from upstream alignment - keeps lineages straight
  const finalY = assignUpstreamY(columns, sortedCols, incoming, rowOf, toolMap, opts);

  // Adjust root nodes: align them with their primary successor
  // instead of row-index fallback.  Process left-to-right so roots
  // settle before dependent columns.
  for (const col of sortedCols) {
    const colTools = columns.get(col)!;
    let changed = false;

    for (const id of colTools) {
      const inEdges = incoming.get(id);
      if (inEdges && inEdges.length > 0) continue; // has predecessors - skip

      const outEdges = outgoing.get(id);
      if (!outEdges || outEdges.length === 0) continue; // isolated - skip

      // Find primary successor Y
      const tool = toolMap.get(id);
      const succPositions: { y: number; frac: number }[] = [];
      for (const edge of outEdges) {
        const y = finalY.get(edge.target);
        if (y !== undefined) {
          const frac = tool
            ? socketFraction(tool, edge.fromSocket, 'output')
            : 0;
          succPositions.push({ y, frac });
        }
      }
      if (succPositions.length > 0) {
        succPositions.sort((a, b) => a.frac - b.frac);
        finalY.set(id, succPositions[0]!.y);
        changed = true;
      }
    }

    // Re-enforce collision resolution if any root was adjusted
    if (changed) {
      const ys = colTools.map((id) => finalY.get(id)!);
      for (let i = 1; i < ys.length; i++) {
        if (ys[i]! < ys[i - 1]! + opts.verticalSpacing) {
          ys[i] = ys[i - 1]! + opts.verticalSpacing;
        }
      }
      for (let i = 0; i < colTools.length; i++) {
        finalY.set(colTools[i]!, ys[i]!);
      }
    }
  }

  return finalY;
}

/**
 * Dispatch to the chosen alignment strategy and build the final
 * position array.
 */
function assignCoordinates(
  columns: Map<number, string[]>,
  sortedCols: number[],
  outgoing: Map<string, EdgeInfo[]>,
  incoming: Map<string, EdgeInfo[]>,
  rowOf: Map<string, number>,
  toolMap: Map<string, Tool>,
  opts: ResolvedOptions,
): Array<{ id: string; x: number; y: number }> {
  let finalY: Map<string, number>;

  if (opts.alignment === 'downstream') {
    finalY = assignDownstreamY(columns, sortedCols, outgoing, rowOf, toolMap, opts);
  } else if (opts.alignment === 'upstream') {
    finalY = assignUpstreamY(columns, sortedCols, incoming, rowOf, toolMap, opts);
  } else {
    finalY = assignBalancedY(
      columns,
      sortedCols,
      outgoing,
      incoming,
      rowOf,
      toolMap,
      opts,
    );
  }

  // Compaction - close large vertical gaps within each column
  if (opts.compaction) {
    for (const col of sortedCols) {
      const colTools = columns.get(col)!;
      if (colTools.length <= 1) continue;

      for (let i = 1; i < colTools.length; i++) {
        const prevY = finalY.get(colTools[i - 1]!)!;
        const currY = finalY.get(colTools[i]!)!;
        const minAllowed = prevY + opts.verticalSpacing;
        // Shrink gaps larger than 2× the minimum spacing
        if (currY > minAllowed + opts.verticalSpacing) {
          finalY.set(colTools[i]!, minAllowed);
        }
      }
    }
  }

  // Build positions
  const positions: Array<{ id: string; x: number; y: number }> = [];
  for (const col of sortedCols) {
    for (const id of columns.get(col)!) {
      positions.push({
        id,
        x: opts.startX + col * opts.horizontalSpacing,
        y: finalY.get(id) ?? opts.startY,
      });
    }
  }

  return positions;
}

// -------------------------------------------------------------------
// Post-processing
// -------------------------------------------------------------------

/** Snap positions to a pixel grid and resolve any resulting collisions. */
function applyGridSnap(
  positions: Array<{ id: string; x: number; y: number }>,
  gridSnap: number,
  verticalSpacing: number,
): void {
  if (gridSnap <= 0) return;

  for (const pos of positions) {
    pos.x = Math.round(pos.x / gridSnap) * gridSnap;
    pos.y = Math.round(pos.y / gridSnap) * gridSnap;
  }

  // Resolve Y collisions created by snapping (same column = same x)
  const byX = new Map<number, typeof positions>();
  for (const pos of positions) {
    if (!byX.has(pos.x)) byX.set(pos.x, []);
    byX.get(pos.x)!.push(pos);
  }
  // Minimum post-snap spacing - the nearest grid multiple ≥ verticalSpacing
  const minGap = Math.max(gridSnap, Math.ceil(verticalSpacing / gridSnap) * gridSnap);
  for (const group of byX.values()) {
    group.sort((a, b) => a.y - b.y);
    for (let i = 1; i < group.length; i++) {
      if (group[i]!.y < group[i - 1]!.y + minGap) {
        group[i]!.y = group[i - 1]!.y + minGap;
      }
    }
  }
}

/** Swap x/y for TB direction. */
function applyDirectionTransform(
  positions: Array<{ id: string; x: number; y: number }>,
  direction: 'LR' | 'TB',
): void {
  if (direction !== 'TB') return;
  for (const pos of positions) {
    const tmp = pos.x;
    pos.x = pos.y;
    pos.y = tmp;
  }
}

// -------------------------------------------------------------------
// Main entry point
// -------------------------------------------------------------------

/**
 * Compute layout positions for all tools in a workflow DAG.
 *
 * 1. Build enriched adjacency maps (with socket info).
 * 2. Topological sort via Kahn's algorithm → column assignment.
 * 3. Crossing minimization via forward + backward sweeps with optional
 *    adjacent exchange.
 * 4. Coordinate assignment using the chosen alignment strategy.
 * 5. Optional post-processing (grid snap, direction transform).
 *
 * Disconnected tools go in a trailing column.  Cycle participants are
 * appended at the end (cycles shouldn't exist in valid workflows but
 * are handled gracefully).
 */
export function autoLayout(
  tools: Tool[],
  wires: Wire[],
  options: LayoutOptions = {},
): LayoutResult {
  const opts: ResolvedOptions = { ...DEFAULTS, ...options };

  if (tools.length === 0) return { positions: [] };

  if (tools.length === 1) {
    return {
      positions: [{ id: tools[0]!.id, x: opts.startX, y: opts.startY }],
    };
  }

  // Selected-only mode - layout a subgraph anchored at its bounding box
  let layoutTools = tools;
  let layoutWires = wires;
  if (options.selectedToolIds && options.selectedToolIds.length > 0) {
    const sel = new Set(options.selectedToolIds);
    layoutTools = tools.filter((t) => sel.has(t.id));
    layoutWires = wires.filter(
      (w) => sel.has(w.from.tool) && sel.has(w.to.tool),
    );
    if (layoutTools.length === 0) return { positions: [] };
    if (layoutTools.length === 1) {
      return {
        positions: [
          { id: layoutTools[0]!.id, x: opts.startX, y: opts.startY },
        ],
      };
    }
    // Anchor at original bounding-box origin
    opts.startX = Math.min(...layoutTools.map((t) => t.x));
    opts.startY = Math.min(...layoutTools.map((t) => t.y));
  }

  const toolIds = new Set(layoutTools.map((t) => t.id));
  const toolMap = new Map(layoutTools.map((t) => [t.id, t]));

  // Phase 1 - adjacency
  const { outgoing, incoming, inDegree, connectedTools } = buildAdjacency(
    toolIds,
    layoutWires,
  );

  // Phase 2 - column assignment
  const { columns, depth, sortedCols } = assignColumns(
    layoutTools,
    toolIds,
    outgoing,
    inDegree,
    connectedTools,
  );

  // Phase 3 - crossing minimization
  const rowOf = minimizeCrossings(
    columns,
    sortedCols,
    outgoing,
    incoming,
    depth,
    toolMap,
    opts,
  );

  // Phase 4 - coordinate assignment
  const positions = assignCoordinates(
    columns,
    sortedCols,
    outgoing,
    incoming,
    rowOf,
    toolMap,
    opts,
  );

  // Post-processing
  applyGridSnap(positions, opts.gridSnap, opts.verticalSpacing);
  applyDirectionTransform(positions, opts.direction);

  return { positions };
}
