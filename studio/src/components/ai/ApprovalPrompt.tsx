/**
 * Approval prompt for a destructive agent edit (removing tools, replacing
 * the canvas). The agent's tool call waits until the user decides.
 */

import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface ApprovalPromptProps {
  title: string;
  details: string[];
  onDecide: (approved: boolean) => void;
}

const ApprovalPrompt: React.FC<ApprovalPromptProps> = ({ title, details, onDecide }) => (
  <div
    role="alertdialog"
    aria-labelledby="ai-approval-title"
    className="mx-4 my-3 rounded-lg border border-theme-status-warning-border bg-theme-surface-elevated overflow-hidden"
  >
    <div className="flex items-center gap-2 px-4 py-2.5 bg-theme-status-warning-bg border-b border-theme-status-warning-border">
      <ShieldAlert className="w-4 h-4 text-theme-status-warning-text flex-shrink-0" />
      <span id="ai-approval-title" className="text-xs font-medium text-theme-status-warning-text">
        Approve this change?
      </span>
    </div>
    <div className="px-4 pt-3 pb-2 text-sm text-theme-text-primary">{title}</div>
    {details.length > 0 && (
      <ul className="px-6 pb-2 text-xs list-disc text-theme-text-secondary space-y-0.5">
        {details.map((d, i) => <li key={i}>{d}</li>)}
      </ul>
    )}
    <div className="flex gap-2 px-4 pb-3 pt-1">
      <button
        onClick={() => onDecide(true)}
        className="px-3 py-1.5 text-xs font-medium rounded bg-theme-interactive-accent text-theme-text-on-accent hover:opacity-90"
      >
        Approve
      </button>
      <button
        onClick={() => onDecide(false)}
        className="px-3 py-1.5 text-xs font-medium rounded border border-theme-border-primary text-theme-text-primary hover:bg-theme-surface-hover"
      >
        Decline
      </button>
      <span className="ml-auto self-center text-[10px] text-theme-text-tertiary">
        Approved changes can be undone
      </span>
    </div>
  </div>
);

export default ApprovalPrompt;
