import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@components/ui";
import { formatDateTime } from "@utils/format";

interface EntityHeaderProps {
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** Title, description and Edit/Delete buttons at the top of a detail panel. */
export function EntityHeader({ name, description, createdBy, createdAt, onEdit, onDelete }: EntityHeaderProps) {
  return (
    <div className="border-b border-line px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold break-words text-ink">{name}</h2>
          <p className="mt-1 text-sm text-ink-subtle">{description || "No description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" className="text-danger-ink" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Created by {createdBy} on {formatDateTime(createdAt)}
      </p>
    </div>
  );
}
