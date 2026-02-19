/**
 * Interaction Tools — Agent ↔ User communication
 *
 * Tools that let the agent pause execution and ask the user a question
 * before proceeding. The agent loop blocks on the user's response, then
 * continues with the answer as the tool result.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { useAIStore } from '@state/aiStore';

/**
 * Ask the user a follow-up question.
 *
 * When invoked, this tool pauses the agent loop by returning a Promise
 * that only resolves once the user has answered. The UI renders the
 * question with selectable options (and optional freeform input).
 *
 * The answer string is returned to the agent as the tool result.
 */
export const askUser = tool({
  description:
    'Ask the user a clarifying question before proceeding. ' +
    'Use this when the request is ambiguous, requires a choice between interpretations, ' +
    'or you need information you cannot determine from the data. ' +
    'Provide 2-4 concise options when possible. The user can also type a custom answer.',
  inputSchema: z.object({
    question: z
      .string()
      .describe('The question to ask the user. Be concise and specific.'),
    options: z
      .array(
        z.object({
          label: z.string().describe('Short option text shown to the user.'),
          description: z
            .string()
            .optional()
            .describe('Optional explanation shown below the label.'),
          recommended: z
            .boolean()
            .optional()
            .describe(
              'Mark ONE option as your recommended default. ' +
              'The user can confirm with a single click.',
            ),
        }),
      )
      .min(0)
      .max(6)
      .optional()
      .describe(
        'Predefined answer options. Omit for open-ended questions. ' +
        'The user can always type a custom response regardless.',
      ),
    multiSelect: z
      .boolean()
      .optional()
      .describe(
        'When true, the user can select multiple options. ' +
        'Use for questions like "which columns to include?".',
      ),
  }),
  execute: async ({ question, options, multiSelect }) => {
    return new Promise<{ answer: string | string[] }>((resolve) => {
      useAIStore.getState().setPendingQuestion({
        question,
        options: (options ?? []).map((o) => (typeof o === 'string' ? { label: o } : o)),
        multiSelect: multiSelect ?? false,
        resolve: (answer: string | string[]) => {
          // Clear the pending question and resolve the promise
          useAIStore.getState().setPendingQuestion(null);
          resolve({ answer });
        },
      });
    });
  },
});
