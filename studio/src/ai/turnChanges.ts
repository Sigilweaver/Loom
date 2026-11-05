/**
 * Per-turn change summaries and turn-level undo.
 *
 * Each agent turn records the workflow before it ran. When the turn changed
 * the workflow, the pre-turn snapshot is pushed to history (so Ctrl+Z undoes
 * the whole turn) and a summary of what changed is attached to the turn's
 * chat message. The chat offers "Undo" for that turn only while the canvas
 * still matches the state the turn left behind and the turn's snapshot is
 * the next undo step, so the button can never undo someone else's edit.
 */

import type { Tool, Wire, WorkflowMeta } from '@domain/workflow/entities/workflow';
import { useWorkflowStore } from '@state/workflowStore';
import { useHistoryStore } from '@state/historyStore';

export interface TurnChanges {
  added: string[];
  removed: string[];
  changed: string[];
  wiresAdded: number;
  wiresRemoved: number;
}

interface WorkflowState {
  tools: Tool[];
  wires: Wire[];
  meta: WorkflowMeta;
}

export function serializeWorkflow(tools: Tool[], wires: Wire[], meta: WorkflowMeta): string {
  return JSON.stringify({ tools, wires, meta });
}

function label(t: Tool): string {
  return `${t.type} [${t.id}]${t.comment ? ` (${t.comment})` : ''}`;
}

/** Positions are layout, not content; ignore them when comparing. */
function content(t: Tool): string {
  return JSON.stringify({ type: t.type, config: t.config, comment: t.comment ?? null });
}

function wireKey(w: Wire): string {
  return `${w.from.tool}.${w.from.socket}>${w.to.tool}.${w.to.socket}`;
}

export function diffWorkflows(before: WorkflowState, after: WorkflowState): TurnChanges {
  const beforeById = new Map(before.tools.map((t) => [t.id, t]));
  const afterById = new Map(after.tools.map((t) => [t.id, t]));
  const beforeWires = new Set(before.wires.map(wireKey));
  const afterWires = new Set(after.wires.map(wireKey));
  return {
    added: after.tools.filter((t) => !beforeById.has(t.id)).map(label),
    removed: before.tools.filter((t) => !afterById.has(t.id)).map(label),
    changed: after.tools
      .filter((t) => beforeById.has(t.id) && content(beforeById.get(t.id)!) !== content(t))
      .map(label),
    wiresAdded: [...afterWires].filter((k) => !beforeWires.has(k)).length,
    wiresRemoved: [...beforeWires].filter((k) => !afterWires.has(k)).length,
  };
}

export function hasChanges(c: TurnChanges): boolean {
  return c.added.length + c.removed.length + c.changed.length + c.wiresAdded + c.wiresRemoved > 0;
}

/** Undo bookkeeping for turns of this session, keyed by chat message id. */
interface TurnUndoRecord {
  before: string;
  after: string;
}
const undoRecords = new Map<string, TurnUndoRecord>();

export function recordTurnUndo(messageId: string, before: WorkflowState, after: WorkflowState): void {
  undoRecords.set(messageId, {
    before: serializeWorkflow(before.tools, before.wires, before.meta),
    after: serializeWorkflow(after.tools, after.wires, after.meta),
  });
}

/** Why a turn cannot be undone from the chat, or null when it can. */
export function turnUndoBlocker(messageId: string): string | null {
  const record = undoRecords.get(messageId);
  if (!record) return 'Undo from the chat is available for changes made since Studio started. Use Undo (Ctrl+Z) instead.';
  const { tools, wires, workflowMeta } = useWorkflowStore.getState();
  if (serializeWorkflow(tools, wires, workflowMeta) !== record.after) {
    return 'The workflow changed after this turn. Use Undo (Ctrl+Z) to step back.';
  }
  const past = useHistoryStore.getState().past;
  const top = past[past.length - 1];
  if (!top || serializeWorkflow(top.tools, top.wires, top.meta) !== record.before) {
    return 'This turn is no longer the latest undo step. Use Undo (Ctrl+Z) to step back.';
  }
  return null;
}

/** Undo one turn's changes through history (so Redo restores them). */
export function undoTurn(messageId: string): boolean {
  if (turnUndoBlocker(messageId)) return false;
  const snapshot = useHistoryStore.getState().undo();
  if (!snapshot) return false;
  useWorkflowStore.getState().loadWorkflow(snapshot.tools, snapshot.wires, snapshot.meta);
  undoRecords.delete(messageId);
  return true;
}

/** @internal Test helper. */
export function clearTurnUndoRecords(): void {
  undoRecords.clear();
}
