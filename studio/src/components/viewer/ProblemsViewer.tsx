import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useValidationStore } from "@state/validationStore";
import { useWorkflowStore } from "@state/workflowStore";
import { describeSummary, summarizeIssues, type ValidationIssue } from "@domain/workflow/services/workflowValidation";

interface ProblemsViewerProps {
  /** Re-run validation (the same action as the Validate button). */
  onValidate: () => void;
}

const ProblemsViewer = ({ onValidate }: ProblemsViewerProps) => {
  const active = useValidationStore((s) => s.active);
  const issues = useValidationStore((s) => s.issues);
  const dismiss = useValidationStore((s) => s.dismiss);
  const { setNodes, fitView } = useReactFlow();

  const revealTool = useCallback(
    (toolId: string) => {
      setNodes((nodes) => nodes.map((node) => ({ ...node, selected: node.id === toolId })));
      // Select through the store too so the configuration panel opens even if
      // the canvas has not re-emitted its selection yet.
      const tool = useWorkflowStore.getState().tools.find((t) => t.id === toolId);
      if (tool) useWorkflowStore.getState().setSelectedTool(tool);
      void fitView({ nodes: [{ id: toolId }], duration: 300, maxZoom: 1.25, padding: 1.5 });
    },
    [setNodes, fitView]
  );

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-theme-text-secondary">
        <ShieldCheck className="w-6 h-6" aria-hidden="true" />
        <p>Check this workflow for unconnected inputs, missing settings and loops.</p>
        <button
          type="button"
          onClick={onValidate}
          className="px-3 py-1.5 rounded text-sm font-medium border border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary hover:bg-theme-bg-hover transition-colors"
        >
          Validate workflow
        </button>
      </div>
    );
  }

  const summary = summarizeIssues(issues);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-theme-text-secondary" role="status">
          {issues.length === 0 ? "No problems found." : `${describeSummary(summary)} found.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onValidate}
            className="px-2 py-1 text-xs rounded border border-theme-border-primary text-theme-text-primary hover:bg-theme-bg-hover transition-colors"
          >
            Re-check
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-2 py-1 text-xs rounded border border-theme-border-primary text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-hover transition-colors"
            title="Hide problem markers on the canvas"
          >
            Dismiss
          </button>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="flex items-center justify-center flex-1 gap-2 text-sm text-theme-status-success-text">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          <span>This workflow is ready to run.</span>
        </div>
      ) : (
        <ul className="flex-1 overflow-auto border rounded divide-y border-theme-border-secondary divide-theme-border-secondary bg-theme-surface-elevated">
          {issues.map((issue) => (
            <ProblemRow key={issue.id} issue={issue} onReveal={revealTool} />
          ))}
        </ul>
      )}
    </div>
  );
};

const ProblemRow = ({
  issue,
  onReveal,
}: {
  issue: ValidationIssue;
  onReveal: (toolId: string) => void;
}) => {
  const Icon = issue.severity === "error" ? AlertCircle : AlertTriangle;
  const tone = issue.severity === "error" ? "text-theme-status-error-text" : "text-theme-status-warning-text";
  const content = (
    <>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} aria-label={issue.severity} />
      <span className="flex-1 text-sm text-theme-text-primary">{issue.message}</span>
      {issue.toolLabel && (
        <span className="text-xs shrink-0 text-theme-text-secondary">{issue.toolLabel}</span>
      )}
    </>
  );

  return (
    <li>
      {issue.toolId ? (
        <button
          type="button"
          onClick={() => onReveal(issue.toolId!)}
          className="flex items-start w-full gap-2 px-3 py-2 text-left transition-colors hover:bg-theme-bg-hover"
          title="Select this tool on the canvas"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2">{content}</div>
      )}
    </li>
  );
};

export default ProblemsViewer;
