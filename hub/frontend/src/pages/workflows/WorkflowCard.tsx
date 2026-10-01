import { Download, Eye, FileText, Folder, History, Pencil, Play, Trash2 } from "lucide-react";
import type { WorkflowMetadata } from "@api";
import { formatRelativeTime } from "@utils/format";
import { ActionMenu, Badge, Card } from "@components/ui";

export interface WorkflowActions {
  onView: (workflow: WorkflowMetadata) => void;
  onEdit: (workflow: WorkflowMetadata) => void;
  onHistory: (workflow: WorkflowMetadata) => void;
  onDownload: (workflow: WorkflowMetadata) => void;
  onDelete: (workflow: WorkflowMetadata) => void;
  onRun: (workflow: WorkflowMetadata) => void;
}

export function WorkflowCard({ workflow, actions }: { workflow: WorkflowMetadata; actions: WorkflowActions }) {
  return (
    <Card interactive className="cursor-pointer" onClick={() => actions.onView(workflow)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-medium text-ink">
              {/* The title is the keyboard and screen reader entry point; the whole card is clickable for mouse users. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onView(workflow);
                }}
                className="max-w-full truncate rounded text-left hover:underline"
              >
                {workflow.name}
              </button>
            </h3>
            {workflow.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-ink-subtle">{workflow.description}</p>
            )}
          </div>
        </div>

        <ActionMenu
          label={`Actions for ${workflow.name}`}
          items={[
            { label: "Run now", icon: <Play className="h-4 w-4" />, onSelect: () => actions.onRun(workflow) },
            { label: "View details", icon: <Eye className="h-4 w-4" />, onSelect: () => actions.onView(workflow) },
            { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => actions.onEdit(workflow) },
            { label: "Version history", icon: <History className="h-4 w-4" />, onSelect: () => actions.onHistory(workflow) },
            { label: "Download", icon: <Download className="h-4 w-4" />, onSelect: () => actions.onDownload(workflow) },
            {
              label: "Delete",
              icon: <Trash2 className="h-4 w-4" />,
              onSelect: () => actions.onDelete(workflow),
              tone: "danger",
              separated: true,
            },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
        {workflow.author && <span>by {workflow.author}</span>}
        <span className="flex items-center gap-1">
          <Folder className="h-3 w-3" aria-hidden="true" />
          {workflow.folder_path}
        </span>
        <span>Updated {formatRelativeTime(workflow.updated_at)}</span>
      </div>

      {workflow.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {workflow.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
