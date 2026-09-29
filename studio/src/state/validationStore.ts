import { create } from "zustand";
import { getToolDefinition } from "@data/tools";
import {
  describeSummary,
  summarizeIssues,
  validateWorkflow,
  type ValidationIssue,
  type ValidationSummary,
} from "@domain/workflow/services/workflowValidation";
import { useUIStore } from "./uiStore";
import { useWorkflowStore } from "./workflowStore";

/**
 * Results of the "Validate workflow" action.
 *
 * Validation is on demand: nothing is flagged on the canvas until the user
 * asks. Once run, results stay live (see useValidationSync) so problems clear
 * as the user fixes them, until the user dismisses them.
 */
interface ValidationState {
  /** True once validation has been run and results are being shown. */
  active: boolean;
  issues: ValidationIssue[];
  /** Issues grouped by tool id, for canvas badges. */
  issuesByTool: Record<string, ValidationIssue[]>;
  /** Validate the current workflow and start showing results. */
  run: () => ValidationSummary;
  /** Re-validate the current workflow if results are being shown. */
  refresh: () => void;
  /** Stop showing results. */
  dismiss: () => void;
}

const toolLabel = (tool: { type: string }) => getToolDefinition(tool.type)?.name ?? tool.type;

function evaluate() {
  const { tools, wires } = useWorkflowStore.getState();
  const issues = validateWorkflow(tools, wires, { toolLabel });
  const issuesByTool: Record<string, ValidationIssue[]> = {};
  for (const issue of issues) {
    if (!issue.toolId) continue;
    (issuesByTool[issue.toolId] ??= []).push(issue);
  }
  return { issues, issuesByTool };
}

export const useValidationStore = create<ValidationState>()((set, get) => ({
  active: false,
  issues: [],
  issuesByTool: {},

  run: () => {
    const result = evaluate();
    set({ active: true, ...result });
    return summarizeIssues(result.issues);
  },

  refresh: () => {
    if (!get().active) return;
    set(evaluate());
  },

  dismiss: () => set({ active: false, issues: [], issuesByTool: {} }),
}));

/**
 * The user-facing "Validate workflow" action: run validation, open the
 * Problems tab and report the outcome in a notification.
 */
export function runWorkflowValidation(): ValidationSummary {
  const summary = useValidationStore.getState().run();
  const ui = useUIStore.getState();
  ui.setBottomPaneOpen(true);
  ui.setActiveBottomTab("problems");

  if (summary.errors === 0 && summary.warnings === 0) {
    ui.showNotification("No problems found. This workflow is ready to run.", "success");
  } else {
    ui.showNotification(
      `Found ${describeSummary(summary)}. See the Problems tab for details.`,
      summary.errors > 0 ? "error" : "warning"
    );
  }
  return summary;
}
