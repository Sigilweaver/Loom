import type { Node } from '@xyflow/react';

export type PositionUpdate = { id: string; x: number; y: number };

/**
 * Snap helper signature used by align/distribute functions
 */
export type SnapFn = (x: number, y: number) => { x: number; y: number };

/**
 * Align all selected nodes to the same Y (horizontal alignment)
 */
export function alignHorizontally(nodes: Node[], snap: SnapFn): PositionUpdate[] {
  const sel = nodes.filter(n => n.selected);
  if (sel.length < 2) return [];
  const avgY = sel.reduce((acc, n) => acc + n.position.y, 0) / sel.length;
  return sel.map(n => {
    const s = snap(n.position.x, avgY);
    return { id: n.id, x: s.x, y: s.y };
  });
}

/**
 * Align all selected nodes to the same X (vertical alignment)
 */
export function alignVertically(nodes: Node[], snap: SnapFn): PositionUpdate[] {
  const sel = nodes.filter(n => n.selected);
  if (sel.length < 2) return [];
  const avgX = sel.reduce((acc, n) => acc + n.position.x, 0) / sel.length;
  return sel.map(n => {
    const s = snap(avgX, n.position.y);
    return { id: n.id, x: s.x, y: s.y };
  });
}

/**
 * Distribute selected nodes evenly between min/max X (keeps min/max endpoints)
 */
export function distributeHorizontally(nodes: Node[], snap: SnapFn): PositionUpdate[] {
  const sel = nodes.filter(n => n.selected).sort((a,b)=>a.position.x-b.position.x);
  const count = sel.length;
  if (count < 3) return [];
  const minX = sel[0]!.position.x;
  const maxX = sel[count-1]!.position.x;
  const step = (maxX - minX) / (count - 1);
  return sel.map((n, idx) => {
    const targetX = minX + step * idx;
    const s = snap(targetX, n.position.y);
    return { id: n.id, x: s.x, y: s.y };
  });
}

/**
 * Distribute selected nodes evenly between min/max Y (keeps min/max endpoints)
 */
export function distributeVertically(nodes: Node[], snap: SnapFn): PositionUpdate[] {
  const sel = nodes.filter(n => n.selected).sort((a,b)=>a.position.y-b.position.y);
  const count = sel.length;
  if (count < 3) return [];
  const minY = sel[0]!.position.y;
  const maxY = sel[count-1]!.position.y;
  const step = (maxY - minY) / (count - 1);
  return sel.map((n, idx) => {
    const targetY = minY + step * idx;
    const s = snap(n.position.x, targetY);
    return { id: n.id, x: s.x, y: s.y };
  });
}
