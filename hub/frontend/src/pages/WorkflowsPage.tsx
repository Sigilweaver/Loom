/**
 * Workflows: browse, search, upload and manage stored workflow files, with
 * folders, tags, version history and one-click runs.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileCode2, Search, Upload } from "lucide-react";
import {
  deleteWorkflow,
  downloadWorkflow,
  listWorkflows,
  triggerExecution,
  type WorkflowMetadata,
} from "@api";
import { saveBlob } from "@utils/download";
import { errorMessage } from "@utils/errors";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  useConfirm,
  useToast,
} from "@components/ui";
import { DetailDialog } from "./workflows/DetailDialog";
import { EditDialog } from "./workflows/EditDialog";
import { FolderSelect, FolderTree } from "./workflows/FolderTree";
import { HistoryDialog } from "./workflows/HistoryDialog";
import { UploadDialog } from "./workflows/UploadDialog";
import { WorkflowCard, type WorkflowActions } from "./workflows/WorkflowCard";
import { buildFolderTree, isInFolder } from "./workflows/folders";
import { searchWorkflows } from "./workflows/search";

type Dialog =
  | { kind: "upload" }
  | { kind: "view" | "edit" | "history"; id: string }
  | null;

export function WorkflowsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState(""); // "" = all workflows
  const [dialog, setDialog] = useState<Dialog>(null);

  const workflows = useQuery({ queryKey: ["workflows"], queryFn: () => listWorkflows() });
  const all = workflows.data?.workflows;

  const { folders, tags, tree } = useMemo(() => {
    const list = all ?? [];
    return {
      folders: [...new Set(list.map((w) => w.folder_path))].sort(),
      tags: [...new Set(list.flatMap((w) => w.tags))].sort(),
      tree: buildFolderTree(list),
    };
  }, [all]);

  const visible = useMemo(
    () => searchWorkflows((all ?? []).filter((w) => isInFolder(w.folder_path, folder)), search),
    [all, folder, search]
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["workflows"] });
  const selected = dialog && dialog.kind !== "upload" ? all?.find((w) => w.id === dialog.id) : undefined;

  const actions: WorkflowActions = {
    onView: (w) => setDialog({ kind: "view", id: w.id }),
    onEdit: (w) => setDialog({ kind: "edit", id: w.id }),
    onHistory: (w) => setDialog({ kind: "history", id: w.id }),
    onDownload: async (w) => {
      try {
        saveBlob(await downloadWorkflow(w.id), `${w.name}.swwf`);
      } catch (err) {
        toast.error(err, "Download failed");
      }
    },
    onDelete: async (w) => {
      const ok = await confirm({
        title: "Delete workflow?",
        message: `"${w.name}" and its version history will be permanently deleted. Schedules that use it will stop working.`,
        confirmLabel: "Delete workflow",
        tone: "danger",
      });
      if (!ok) return;
      try {
        await deleteWorkflow(w.id);
        toast.success(`Deleted "${w.name}".`);
        setDialog(null);
        await refresh();
      } catch (err) {
        toast.error(err, "Delete failed");
      }
    },
    onRun: async (w) => {
      try {
        await triggerExecution({ workflow_id: w.id });
        toast.success(`Started "${w.name}". See Executions for progress.`);
      } catch (err) {
        toast.error(err, `Could not run "${w.name}"`);
      }
    },
  };

  const filtering = Boolean(search.trim() || folder);
  const crumbs = folder.split("/").filter(Boolean);

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-64 shrink-0 border-r border-line lg:block">
        <div className="sticky top-0 max-h-dvh overflow-y-auto p-4">
          <FolderTree root={tree} selectedPath={folder} onSelect={setFolder} />
        </div>
      </aside>

      <Page className="min-w-0 flex-1">
        <PageHeader
          title="Workflows"
          description={
            crumbs.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => setFolder("")} className="rounded hover:underline">
                  All workflows
                </button>
                {crumbs.map((part, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    {part}
                  </span>
                ))}
              </span>
            ) : (
              "Workflow files stored on the Hub."
            )
          }
          actions={
            <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setDialog({ kind: "upload" })}>
              Upload workflow
            </Button>
          }
        />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search workflows"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, tag, author or folder..."
              className="pl-9"
            />
          </div>
          <div className="lg:hidden sm:w-56">
            <FolderSelect root={tree} selectedPath={folder} onSelect={setFolder} />
          </div>
        </div>

        {workflows.isPending ? (
          <LoadingState label="Loading workflows..." />
        ) : workflows.isError ? (
          <ErrorState
            title="Could not load workflows"
            message={errorMessage(workflows.error)}
            onRetry={() => void workflows.refetch()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FileCode2}
            title={filtering ? "No workflows found" : "No workflows yet"}
            description={
              filtering
                ? "Try a different search or folder."
                : "Upload a .swwf workflow file to get started."
            }
            className="rounded-xl border border-line bg-surface-raised"
            action={
              !filtering && (
                <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setDialog({ kind: "upload" })}>
                  Upload workflow
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((workflow) => (
              <li key={workflow.id}>
                <WorkflowCard workflow={workflow} actions={actions} />
              </li>
            ))}
          </ul>
        )}
      </Page>

      {dialog?.kind === "upload" && (
        <UploadDialog
          onClose={() => setDialog(null)}
          onUploaded={() => {
            toast.success("Workflow uploaded.");
            void refresh();
          }}
          existingFolders={folders}
          existingTags={tags}
          initialFolder={folder || "/"}
        />
      )}

      {dialog?.kind === "edit" && selected && (
        <EditDialog
          workflow={selected}
          onClose={() => setDialog(null)}
          onSaved={() => {
            toast.success("Workflow updated.");
            void refresh();
          }}
          existingFolders={folders}
          existingTags={tags}
        />
      )}

      {dialog?.kind === "view" && selected && (
        <DetailDialog
          workflow={selected}
          onClose={() => setDialog(null)}
          onEdit={() => setDialog({ kind: "edit", id: selected.id })}
          onHistory={() => setDialog({ kind: "history", id: selected.id })}
          onDownload={() => void actions.onDownload(selected)}
          onRun={() => void actions.onRun(selected)}
        />
      )}

      {dialog?.kind === "history" && selected && (
        <HistoryDialog
          workflow={selected}
          onClose={() => setDialog(null)}
          onRestored={(updated: WorkflowMetadata) => {
            void refresh();
            queryClient.setQueryData<{ workflows: WorkflowMetadata[]; total: number }>(["workflows"], (current) =>
              current && {
                ...current,
                workflows: current.workflows.map((w) => (w.id === updated.id ? updated : w)),
              }
            );
          }}
        />
      )}
    </div>
  );
}
