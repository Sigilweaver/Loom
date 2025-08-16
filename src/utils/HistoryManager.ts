export type HistoryEntry = {
  xml: string;
  label?: string;
  ts: number;
};

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private pendingBegin: HistoryEntry | null = null;

  constructor(initialXml?: string, label?: string) {
    if (initialXml) {
      this.checkpoint(initialXml, label ?? 'Initial');
    }
  }

  begin(currentXml: string, label?: string) {
    // Start a transaction by capturing baseline; clear redo stack for new branch
    this.pendingBegin = { xml: currentXml, ts: Date.now(), ...(label ? { label } : {}) } as HistoryEntry;
    this.redoStack = [];
  }

  commit(currentXml: string, meta?: { label?: string }) {
    // If no transaction, treat as checkpoint
    if (!this.pendingBegin) {
      this.checkpoint(currentXml, meta?.label);
      return;
    }
    // Push the baseline (pre-change) so undo returns to it
    this.undoStack.push(this.pendingBegin);
    this.pendingBegin = null;
    // After commit, we are at currentXml (working state). Redo stack cleared already in begin().
  }

  checkpoint(currentXml: string, label?: string) {
    // Push current snapshot to undo stack as a state we can go back to
    this.undoStack.push({ xml: currentXml, ts: Date.now(), ...(label ? { label } : {}) } as HistoryEntry);
    this.redoStack = [];
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo(currentXml: string): HistoryEntry | null {
    if (!this.canUndo()) return null;
    const target = this.undoStack.pop()!;
    // Current becomes a redo entry
    this.redoStack.push({ xml: currentXml, ts: Date.now() });
    // Cancel any pending txn
    this.pendingBegin = null;
    return target;
  }

  redo(currentXml: string): HistoryEntry | null {
    if (!this.canRedo()) return null;
    const target = this.redoStack.pop()!;
    // Current becomes an undo entry
    this.undoStack.push({ xml: currentXml, ts: Date.now() });
    // Cancel any pending txn
    this.pendingBegin = null;
    return target;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.pendingBegin = null;
  }

  size() { return { undo: this.undoStack.length, redo: this.redoStack.length }; }
}
