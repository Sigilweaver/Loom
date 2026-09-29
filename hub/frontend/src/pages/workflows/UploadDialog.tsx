import { useRef, useState, type DragEvent, type FormEvent } from "react";
import clsx from "clsx";
import { FileText, Upload } from "lucide-react";
import { uploadWorkflow } from "@api";
import { errorMessage } from "@utils/errors";
import { formatBytes } from "@utils/format";
import { Alert, Button, Field, Input, Modal } from "@components/ui";
import { FolderInput, TagInput } from "./inputs";

interface UploadDialogProps {
  onClose: () => void;
  /** Called after a successful upload so the list can refresh. */
  onUploaded: () => void;
  existingFolders: string[];
  existingTags: string[];
  initialFolder?: string;
}

const EXTENSION = ".swwf";

export function UploadDialog({ onClose, onUploaded, existingFolders, existingTags, initialFolder }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState(initialFolder || "/");
  const [tags, setTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (selected: File | undefined) => {
    if (!selected) return;
    if (!selected.name.endsWith(EXTENSION)) {
      setError(`Please choose a ${EXTENSION} workflow file.`);
      return;
    }
    setFile(selected);
    setError(null);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadWorkflow(file, folder, tags, message.trim() || undefined);
      onUploaded();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload workflow"
      description={`Add a ${EXTENSION} workflow file to the Hub.`}
      icon={<Upload className="h-5 w-5" />}
      dismissable={!uploading}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={uploading} disabled={!file} icon={<Upload className="h-4 w-4" />}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <div>
          <span className="mb-1 block text-sm font-medium text-ink-muted" id="upload-file-label">
            Workflow file
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={EXTENSION}
            className="sr-only"
            aria-labelledby="upload-file-label"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={clsx(
              "w-full rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              file || dragging
                ? "border-brand-500 bg-accent-soft"
                : "border-line-strong hover:border-brand-500/60 hover:bg-surface-hover"
            )}
          >
            {file ? (
              <span className="flex items-center justify-center gap-2 text-accent-ink">
                <FileText className="h-5 w-5" />
                <span className="font-medium">{file.name}</span>
                <span className="text-sm text-ink-subtle">({formatBytes(file.size)})</span>
              </span>
            ) : (
              <span className="block text-ink-subtle">
                <Upload className="mx-auto mb-2 h-8 w-8" />
                Click to choose a {EXTENSION} file, or drop it here
              </span>
            )}
          </button>
        </div>

        <Field label="Folder" hint="Pick an existing folder or type a new path, for example /projects/sales.">
          <FolderInput value={folder} onChange={setFolder} existingFolders={existingFolders} />
        </Field>

        <Field label="Tags" hint="Press Enter or comma to add a tag.">
          <TagInput value={tags} onChange={setTags} suggestions={existingTags} placeholder="Add tags..." />
        </Field>

        <Field label="Version note (optional)" hint="Shown in the workflow's history.">
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Initial upload" />
        </Field>
      </div>
    </Modal>
  );
}
