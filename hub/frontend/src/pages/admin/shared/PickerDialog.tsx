import { useState, type ComponentType, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { errorMessage } from "@utils/errors";
import { Alert, Button, EmptyState, ErrorState, ListRow, LoadingState, Modal, type Tone } from "@components/ui";

export interface PickerItem {
  id: string;
  title: string;
  subtitle?: ReactNode;
  /** Initial letter shown in an avatar (used for people). */
  avatar?: string;
}

interface PickerDialogProps {
  title: string;
  description?: string;
  /** Items that can still be added. */
  items: PickerItem[] | undefined;
  loading: boolean;
  loadError: unknown;
  onRetry: () => void;
  icon: ComponentType<{ className?: string }>;
  iconTone?: Tone;
  addLabel: string;
  /** Shown when every item has already been added. */
  emptyTitle: string;
  onAdd: (item: PickerItem) => Promise<void>;
  onClose: () => void;
}

/**
 * "Add something to this group" dialog: lists what can still be added, one
 * button per row. Stays open so several can be added in a row.
 */
export function PickerDialog({
  title,
  description,
  items,
  loading,
  loadError,
  onRetry,
  icon,
  iconTone,
  addLabel,
  emptyTitle,
  onAdd,
  onClose,
}: PickerDialogProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (item: PickerItem) => {
    setAdding(item.id);
    setError(null);
    try {
      await onAdd(item);
    } catch (err) {
      setError(errorMessage(err, `Could not add ${item.title}`));
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {error && (
        <Alert className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={errorMessage(loadError)} onRetry={onRetry} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={icon} title={emptyTitle} />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <ListRow
                icon={icon}
                iconTone={iconTone}
                avatar={item.avatar}
                title={item.title}
                subtitle={item.subtitle}
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    loading={adding === item.id}
                    disabled={adding !== null}
                    onClick={() => void handleAdd(item)}
                    aria-label={`${addLabel} ${item.title}`}
                  >
                    {addLabel}
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
