/**
 * What one agent turn changed on the canvas, with an Undo for that turn.
 */

import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';
import type { ChatMessage } from '@state/aiStore';
import { useWorkflowStore } from '@state/workflowStore';
import { useHistoryStore } from '@state/historyStore';
import { turnUndoBlocker, undoTurn } from '../../ai/turnChanges';

interface TurnChangesCardProps {
  messageId: string;
  changes: NonNullable<ChatMessage['changes']>;
}

const MAX_LISTED = 6;

function Section({ label, sign, items }: { label: string; sign: string; items: string[] }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_LISTED);
  return (
    <div>
      <span className="font-medium text-theme-text-secondary">{label} ({items.length})</span>
      <ul className="ml-1">
        {shown.map((item, i) => (
          <li key={i} className="truncate font-mono" title={item}>{sign} {item}</li>
        ))}
        {items.length > MAX_LISTED && <li className="text-theme-text-tertiary">and {items.length - MAX_LISTED} more</li>}
      </ul>
    </div>
  );
}

const TurnChangesCard: React.FC<TurnChangesCardProps> = ({ messageId, changes }) => {
  // Re-render when the canvas or history changes so the Undo state is current.
  useWorkflowStore((s) => s.tools);
  useWorkflowStore((s) => s.wires);
  useHistoryStore((s) => s.past.length);
  const [undone, setUndone] = useState(false);
  const blocker = turnUndoBlocker(messageId);

  const wireParts = [
    changes.wiresAdded > 0 ? `${changes.wiresAdded} connection${changes.wiresAdded > 1 ? 's' : ''} added` : '',
    changes.wiresRemoved > 0 ? `${changes.wiresRemoved} connection${changes.wiresRemoved > 1 ? 's' : ''} removed` : '',
  ].filter(Boolean);

  return (
    <div className="rounded border border-theme-border-primary bg-theme-surface-page px-3 py-2 text-xs text-theme-text-primary space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">Canvas changes</span>
        <button
          type="button"
          onClick={() => setUndone(undoTurn(messageId))}
          disabled={undone || blocker !== null}
          title={undone ? 'Undone. Use Redo (Ctrl+Shift+Z) to restore.' : blocker ?? 'Undo every change from this turn'}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border border-theme-border-primary hover:bg-theme-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Undo2 className="w-3 h-3" />
          {undone ? 'Undone' : 'Undo'}
        </button>
      </div>
      <Section label="Added" sign="+" items={changes.added} />
      <Section label="Removed" sign="-" items={changes.removed} />
      <Section label="Changed" sign="~" items={changes.changed} />
      {wireParts.length > 0 && <div className="text-theme-text-secondary">{wireParts.join(', ')}</div>}
    </div>
  );
};

export default TurnChangesCard;
