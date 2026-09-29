import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Download, FileText, History, Pencil, Play } from "lucide-react";
import { getWorkflowContent, type WorkflowMetadata } from "@api";
import { errorMessage } from "@utils/errors";
import { formatDateTime } from "@utils/format";
import { Badge, Button, ErrorState, LoadingState, Modal } from "@components/ui";
import { DescriptionText } from "./DescriptionText";

interface DetailDialogProps {
  workflow: WorkflowMetadata;
  onClose: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDownload: () => void;
  onRun: () => void;
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-sunken p-3">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-ink">{children}</dd>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-surface-sunken p-3 text-center">
      <div className="text-2xl font-bold text-accent-ink">{value}</div>
      <div className="text-xs text-ink-subtle">{label}</div>
    </div>
  );
}

export function DetailDialog({ workflow, onClose, onEdit, onHistory, onDownload, onRun }: DetailDialogProps) {
  const content = useQuery({
    queryKey: ["workflow-content", workflow.id, workflow.checksum],
    queryFn: () => getWorkflowContent(workflow.id),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={workflow.name}
      description={workflow.author ? `by ${workflow.author}` : undefined}
      icon={<FileText className="h-5 w-5" />}
      footer={
        <>
          <Button icon={<Download className="h-4 w-4" />} onClick={onDownload}>
            Download
          </Button>
          <Button icon={<History className="h-4 w-4" />} onClick={onHistory}>
            History
          </Button>
          <Button icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>
            Edit
          </Button>
          <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={onRun}>
            Run now
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {workflow.description && (
          <section aria-labelledby="wf-description">
            <h3 id="wf-description" className="mb-2 text-sm font-medium text-ink">
              Description
            </h3>
            <div className="rounded-lg bg-surface-sunken p-4">
              <DescriptionText text={workflow.description} />
            </div>
          </section>
        )}

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Meta label="Folder">{workflow.folder_path}</Meta>
          <Meta label="Uploaded by">{workflow.uploaded_by}</Meta>
          <Meta label="Created">{formatDateTime(workflow.created_at)}</Meta>
          <Meta label="Last updated">{formatDateTime(workflow.updated_at)}</Meta>
        </dl>

        {workflow.tags.length > 0 && (
          <section aria-labelledby="wf-tags">
            <h3 id="wf-tags" className="mb-2 text-sm font-medium text-ink">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {workflow.tags.map((tag) => (
                <Badge key={tag} tone="accent">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="wf-contents">
          <h3 id="wf-contents" className="mb-2 text-sm font-medium text-ink">
            What is inside
          </h3>
          {content.isPending ? (
            <LoadingState className="py-4" />
          ) : content.isError ? (
            <ErrorState
              title="Could not read the workflow file"
              message={errorMessage(content.error)}
              onRetry={() => void content.refetch()}
            />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Stat value={content.data.tools.length} label="Tools" />
              <Stat value={content.data.wires.length} label="Connections" />
              <Stat value={`v${content.data.version}`} label="File format" />
            </div>
          )}
        </section>

        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-subtle hover:text-ink-muted">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
            Technical details
          </summary>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ["Workflow ID", workflow.workflow_id],
              ["Storage ID", workflow.id],
              ["Checksum (SHA-256)", workflow.checksum],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 border-b border-line py-2 sm:flex-row sm:justify-between">
                <dt className="text-ink-subtle">{label}</dt>
                <dd>
                  <code className="rounded bg-surface-hover px-2 py-1 font-mono text-xs break-all">{value}</code>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Modal>
  );
}
