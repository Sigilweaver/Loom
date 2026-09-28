/**
 * Version history for a workflow: every uploaded version, what changed between
 * versions, and one-click restore. Restoring never deletes anything; it adds a
 * new version that copies the older one.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, Download, GitCompare, History, RotateCcw } from "lucide-react";
import {
  downloadWorkflowRevision,
  getWorkflowDiff,
  listWorkflowRevisions,
  rollbackWorkflow,
  type WorkflowMetadata,
  type WorkflowRevision,
} from "@api";
import { errorMessage } from "@utils/errors";
import { saveBlob } from "@utils/download";
import { formatBytes, formatDateTime, formatRelativeTime } from "@utils/format";
import {
  ActionMenu,
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  useConfirm,
  useToast,
} from "@components/ui";
import { parseUnifiedDiff, summarizeDiff, type DiffLineKind } from "./diff";

interface HistoryDialogProps {
  workflow: WorkflowMetadata;
  onClose: () => void;
  /** Called with the updated workflow after a restore. */
  onRestored: (workflow: WorkflowMetadata) => void;
}

interface Comparison {
  from: WorkflowRevision;
  to: WorkflowRevision;
}

const LINE_STYLES: Record<DiffLineKind, string> = {
  meta: "text-ink-subtle font-semibold",
  hunk: "bg-info-soft text-info-ink",
  add: "bg-success-soft text-success-ink",
  remove: "bg-danger-soft text-danger-ink",
  context: "text-ink-muted",
};

function DiffView({ workflowId, comparison, onBack }: { workflowId: string; comparison: Comparison; onBack: () => void }) {
  const { from, to } = comparison;
  const diff = useQuery({
    queryKey: ["workflow-diff", workflowId, from.id, to.id],
    queryFn: () => getWorkflowDiff(workflowId, from.id, to.id),
  });

  const lines = diff.data ? parseUnifiedDiff(diff.data) : [];
  const summary = summarizeDiff(lines);

  return (
    <div>
      <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack} className="-ml-2">
        Back to history
      </Button>
      <h3 className="mt-2 text-base font-semibold text-ink">
        Changes from version {from.revision_number} to version {to.revision_number}
      </h3>
      {diff.isSuccess && lines.length > 0 && (
        <p className="mt-1 text-sm text-ink-subtle">
          <span className="text-success-ink">{summary.added} added</span>,{" "}
          <span className="text-danger-ink">{summary.removed} removed</span>
        </p>
      )}

      <div className="mt-3">
        {diff.isPending ? (
          <LoadingState label="Loading changes..." />
        ) : diff.isError ? (
          <ErrorState title="Could not load the changes" message={errorMessage(diff.error)} onRetry={() => void diff.refetch()} />
        ) : lines.length === 0 ? (
          <Alert tone="info">These two versions have identical contents.</Alert>
        ) : (
          <pre
            tabIndex={0}
            aria-label="Changes between versions"
            className="max-h-96 overflow-auto rounded-lg border border-line bg-surface-sunken py-2 font-mono text-xs leading-5"
          >
            {lines.map((line, index) => (
              <div key={index} className={clsx("px-3 whitespace-pre", LINE_STYLES[line.kind])}>
                {line.text || " "}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}

export function HistoryDialog({ workflow, onClose, onRestored }: HistoryDialogProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [comparison, setComparison] = useState<Comparison | null>(null);

  const revisions = useQuery({
    queryKey: ["workflow-revisions", workflow.id],
    queryFn: () => listWorkflowRevisions(workflow.id),
  });

  const restore = useMutation({
    mutationFn: (revision: WorkflowRevision) => rollbackWorkflow(workflow.id, revision.id),
    onSuccess: async (updated, revision) => {
      toast.success(`Restored version ${revision.revision_number}. It is now the newest version.`);
      await queryClient.invalidateQueries({ queryKey: ["workflow-revisions", workflow.id] });
      onRestored(updated);
    },
    onError: (err) => toast.error(err, "Could not restore that version"),
  });

  const list = revisions.data?.revisions ?? [];
  const current = list[0];

  const handleRestore = async (revision: WorkflowRevision) => {
    const ok = await confirm({
      title: `Restore version ${revision.revision_number}?`,
      message: (
        <>
          The workflow file will be replaced with version {revision.revision_number}. Nothing is deleted: the
          restore is saved as a new version, so you can go back again.
        </>
      ),
      confirmLabel: "Restore version",
    });
    if (ok) restore.mutate(revision);
  };

  const handleDownload = async (revision: WorkflowRevision) => {
    try {
      const blob = await downloadWorkflowRevision(workflow.id, revision.id);
      saveBlob(blob, `${workflow.name}.v${revision.revision_number}.swwf`);
    } catch (err) {
      toast.error(err, "Download failed");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Version history"
      description={workflow.name}
      icon={<History className="h-5 w-5" />}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {comparison ? (
        <DiffView workflowId={workflow.id} comparison={comparison} onBack={() => setComparison(null)} />
      ) : revisions.isPending ? (
        <LoadingState label="Loading history..." />
      ) : revisions.isError ? (
        <ErrorState title="Could not load the history" message={errorMessage(revisions.error)} onRetry={() => void revisions.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={History}
          title="No history yet"
          description="Each time a new version of this workflow is uploaded, it is recorded here."
        />
      ) : (
        <ol className="divide-y divide-line rounded-lg border border-line">
          {list.map((revision, index) => {
            const previous = list[index + 1];
            const isCurrent = revision.id === current?.id;
            const actions = [
              ...(previous
                ? [
                    {
                      label: "View changes",
                      icon: <GitCompare className="h-4 w-4" />,
                      onSelect: () => setComparison({ from: previous, to: revision }),
                    },
                  ]
                : []),
              ...(!isCurrent && current
                ? [
                    {
                      label: "Compare with current",
                      icon: <GitCompare className="h-4 w-4" />,
                      onSelect: () => setComparison({ from: revision, to: current }),
                    },
                  ]
                : []),
              {
                label: "Download this version",
                icon: <Download className="h-4 w-4" />,
                onSelect: () => void handleDownload(revision),
              },
              ...(!isCurrent
                ? [
                    {
                      label: "Restore this version",
                      icon: <RotateCcw className="h-4 w-4" />,
                      onSelect: () => void handleRestore(revision),
                      separated: true,
                    },
                  ]
                : []),
            ];

            return (
              <li key={revision.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">Version {revision.revision_number}</span>
                    {isCurrent && <Badge tone="success">Current</Badge>}
                    {!previous && <Badge>First upload</Badge>}
                  </div>
                  {revision.message && <p className="mt-0.5 text-sm text-ink-muted">{revision.message}</p>}
                  <p className="mt-1 text-xs text-ink-subtle">
                    <span title={formatDateTime(revision.created_at)}>{formatRelativeTime(revision.created_at)}</span>
                    {" - "}
                    {revision.author || "unknown"} - {formatBytes(revision.size_bytes)}
                  </p>
                </div>
                <ActionMenu label={`Actions for version ${revision.revision_number}`} items={actions} />
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
