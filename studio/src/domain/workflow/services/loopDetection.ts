/**
 * Cycle detection for workflow DAG validation.
 *
 * Uses depth-first search with tri-color marking to detect back edges
 * (which indicate cycles) in the directed graph formed by tool connections.
 */
import { Tool, Wire } from '@domain/workflow/entities/workflow';

/** Cycle detection only needs tool identity, not position or config. */
type ToolRef = Pick<Tool, 'id'>;

/**
 * Node visit states for DFS cycle detection.
 * - UNVISITED: Node has not been processed yet
 * - VISITING: Node is currently in the DFS stack (ancestor of current path)
 * - VISITED: Node and all its descendants have been fully processed
 */
const enum VisitState {
  UNVISITED = 0,
  VISITING = 1,
  VISITED = 2,
}

/**
 * Detect if the workflow graph contains any cycles.
 *
 * A cycle means data would flow in a loop, which is invalid for
 * a DAG-based workflow execution model.
 *
 * @param tools - All tools in the workflow
 * @param wires - All wire connections between tools
 * @returns true if a cycle exists, false if the graph is acyclic
 */
export function detectCycles(tools: ToolRef[], wires: Wire[]): boolean {
  // Build adjacency list: toolId -> list of tools it connects TO
  const adjacencyList = new Map<string, string[]>();
  for (const tool of tools) {
    adjacencyList.set(tool.id, []);
  }

  for (const wire of wires) {
    const sourceToolId = wire.from.tool;
    const targetToolId = wire.to.tool;

    // Only add edge if both tools exist in the graph
    if (adjacencyList.has(sourceToolId) && adjacencyList.has(targetToolId)) {
      adjacencyList.get(sourceToolId)!.push(targetToolId);
    }
  }

  // Track visit state for each node
  const visitState = new Map<string, VisitState>();
  for (const tool of tools) {
    visitState.set(tool.id, VisitState.UNVISITED);
  }

  /**
   * DFS traversal that detects back edges (cycles).
   * A back edge exists if we encounter a node that is currently VISITING,
   * meaning it's an ancestor in our current DFS path.
   */
  function hasCycleFromNode(nodeId: string): boolean {
    visitState.set(nodeId, VisitState.VISITING);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighborId of neighbors) {
      const neighborState = visitState.get(neighborId);

      if (neighborState === VisitState.VISITING) {
        // Back edge found - neighbor is an ancestor in current path
        return true;
      }

      if (neighborState === VisitState.UNVISITED) {
        // Recurse into unvisited neighbor
        if (hasCycleFromNode(neighborId)) {
          return true;
        }
      }
      // If VISITED, skip - already fully processed, no cycle through this path
    }

    visitState.set(nodeId, VisitState.VISITED);
    return false;
  }

  // Check all connected components (handles disconnected subgraphs)
  for (const tool of tools) {
    if (visitState.get(tool.id) === VisitState.UNVISITED) {
      if (hasCycleFromNode(tool.id)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if adding a new wire would create a cycle.
 *
 * Used during wire creation to prevent users from creating invalid loops.
 *
 * @param tools - All tools in the workflow
 * @param wires - Existing wire connections
 * @param newFromTool - Source tool ID for the proposed wire
 * @param newToTool - Target tool ID for the proposed wire
 * @returns true if the new wire would create a cycle
 */
export function wouldCreateCycle(
  tools: ToolRef[],
  wires: Wire[],
  newFromTool: string,
  newToTool: string
): boolean {
  // Self-loop is always a cycle
  if (newFromTool === newToTool) {
    return true;
  }

  // Simulate adding the wire and check for cycles
  const tempWires: Wire[] = [
    ...wires,
    {
      from: { tool: newFromTool, socket: 'output' },
      to: { tool: newToTool, socket: 'input' },
    },
  ];

  return detectCycles(tools, tempWires);
}
