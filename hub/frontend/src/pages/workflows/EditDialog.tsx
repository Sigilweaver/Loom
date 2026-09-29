import { useRef, useState, type FormEvent } from "react";
import { FileText, Upload } from "lucide-react";
import { replaceWorkflowFile, updateWorkflowMetadata, type WorkflowMetadata } from "@api";
import { errorMessage } from "@utils/errors";
import { Alert, Button, Field, Input, Modal } from "@components/ui";
import { FolderInput, TagInput } from "./inputs";

interface EditDialogProps {
  workflow: WorkflowMetadata;
  onClose: () => void;
  onSaved: (updated: WorkflowMetadata) => void;
  existingFolders: string[];
  existingTags: string[];
}

/** Edit a workflow's folder and tags, and optionally upload a new version of its file. */
export function EditDialog({ workflow, onClose, onSaved, existingFolders, existingTags }: EditDialogProps) {
  const [folder, setFolder] = useState(workflow.folder_path);
  const [tags, setTags] = useState(workflow.tags);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const metadataChanged =
    folder !== workflow.folder_path ||
    tags.length !== workflow.tags.length ||
    tags.some((tag, index) => tag !== workflow.tags[index]);

  const chooseFile = (selected: File | undefined) => {
    if (!selected) return;
    if (!selected.name.endsWith(".swwf")) {
      setError("Please choose a .swwf workflow file.");
      return;
    }
    setNewFile(selected);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let updated = workflow;
      if (newFile) updated = await replaceWorkflowFile(workflow.id, newFile, message.trim() || undefined);
      if (metadataChanged) updated = await updateWorkflowMetadata(workflow.id, { folder_path: folder, tags });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit workflow"
      icon={<FileText className="h-5 w-5" />}
      description={workflow.author ? `${workflow.name}, by ${workflow.author}` : workflow.name}
      dismissable={!saving}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!metadataChanged && !newFile}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field label="Folder">
          <FolderInput value={folder} onChange={setFolder} existingFolders={existingFolders} />
        </Field>

        <Field label="Tags">
          <TagInput value={tags} onChange={setTags} suggestions={existingTags} placeholder="Add tags..." />
        </Field>

        <div className="rounded-lg border border-line p-3">
          <p className="text-sm font-medium text-ink-muted">New version of the file</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Upload a changed .swwf file to replace the current one. The old version stays in the workflow's
            history and can be restored.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".swwf"
            className="sr-only"
            aria-label="New workflow file"
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
              {newFile ? "Choose a different file" : "Choose file"}
            </Button>
            {newFile && <span className="text-sm text-ink-muted">{newFile.name}</span>}
          </div>
          {newFile && (
            <Field label="Version note (optional)" className="mt-3">
              <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What changed?" />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}
