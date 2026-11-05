/**
 * Approval for destructive agent edits.
 *
 * Removing tools or replacing the canvas is undoable, but the user should
 * see it coming. When "Ask before destructive edits" is on, the tool call
 * waits here until the user approves or declines in the chat.
 */

import { useAIStore } from '@state/aiStore';

export interface ApprovalRequest {
  title: string;
  details: string[];
}

/** Text returned to the model when the user declines. */
export function declinedResult(title: string): { success: false; error: string } {
  return {
    success: false,
    error: `The user declined: ${title}. Nothing was changed. Do not retry the same edit; ask the user what they want instead.`,
  };
}

/**
 * Resolve true when the edit may proceed: approvals are off, or the user
 * approved. Rejects with an AbortError if the turn is cancelled meanwhile.
 */
export function requestApproval(request: ApprovalRequest, abortSignal?: AbortSignal): Promise<boolean> {
  if (!useAIStore.getState().confirmDestructiveEdits) return Promise.resolve(true);

  return new Promise<boolean>((resolve, reject) => {
    const onAbort = () => {
      useAIStore.getState().setPendingApproval(null);
      reject(Object.assign(new Error('Approval cancelled'), { name: 'AbortError' }));
    };
    if (abortSignal?.aborted) {
      onAbort();
      return;
    }
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    useAIStore.getState().setPendingApproval({
      ...request,
      resolve: (approved) => {
        abortSignal?.removeEventListener('abort', onAbort);
        useAIStore.getState().setPendingApproval(null);
        resolve(approved);
      },
    });
  });
}
