// Moved from src/utils/loopDetection.ts (Phase 1 restructure)
import { Tool, Wire } from '@domain/workflow/entities/workflow';

export function detectCycles(tools: Tool[], wires: Wire[]): boolean {
  const graph = new Map<string, string[]>();
  tools.forEach(t => graph.set(t.id, []));
  wires.forEach(w => { const from = w.from.tool; const to = w.to.tool; if (graph.has(from) && graph.has(to)) graph.get(from)!.push(to); });
  const colors = new Map<string, number>(); tools.forEach(t => colors.set(t.id, 0));
  function dfs(id: string): boolean { colors.set(id, 1); for (const n of graph.get(id) || []) { const c = colors.get(n); if (c === 1) return true; if (c === 0 && dfs(n)) return true; } colors.set(id, 2); return false; }
  for (const t of tools) { if (colors.get(t.id) === 0 && dfs(t.id)) return true; }
  return false;
}

export function wouldCreateCycle(tools: Tool[], wires: Wire[], newFromTool: string, newToTool: string): boolean {
  if (newFromTool === newToTool) return true;
  const tempWires: Wire[] = [...wires, { from: { tool: newFromTool, socket: 'output' }, to: { tool: newToTool, socket: 'input' } }];
  return detectCycles(tools, tempWires);
}

export function detectCyclesOptimized(tools: Tool[], wires: Wire[]): boolean {
  const nodeCount = tools.length; const edgeCount = wires.length;
  if (nodeCount < 10) return detectCycles(tools, wires);
  if (edgeCount < nodeCount * 1.5) return detectCycles(tools, wires);
  return detectCycles(tools, wires);
}
