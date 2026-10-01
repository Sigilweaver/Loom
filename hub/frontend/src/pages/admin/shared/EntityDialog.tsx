import { useState, type FormEvent } from "react";
import type { ComponentType } from "react";
import { errorMessage, fieldError } from "@utils/errors";
import { isApiError } from "@api";
import { Alert, Button, Field, Input, Modal, Textarea } from "@components/ui";

export interface EntityValues {
  name: string;
  description: string;
}

interface EntityDialogProps {
  /** Singular noun, e.g. "group" or "grant group". */
  noun: string;
  icon: ComponentType<{ className?: string }>;
  /** The item being edited, or null to create one. */
  entity: EntityValues | null;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  onClose: () => void;
  /** Save the values; throw to show the error in the dialog. */
  onSave: (values: EntityValues) => Promise<void>;
}

/** Name + description dialog shared by user groups and grant groups. */
export function EntityDialog({
  noun,
  icon: Icon,
  entity,
  namePlaceholder,
  descriptionPlaceholder,
  onClose,
  onSave,
}: EntityDialogProps) {
  const editing = entity !== null;
  const [name, setName] = useState(entity?.name ?? "");
  const [description, setDescription] = useState(entity?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSave({ name: name.trim(), description });
      onClose();
    } catch (err) {
      const message = errorMessage(err, `Failed to save ${noun}`);
      const named = fieldError(err, "name");
      // A 409 means another item already has this name.
      if (named) setFieldErrors({ name: named });
      else if (isApiError(err) && err.isConflict) setFieldErrors({ name: message });
      else setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${editing ? "Edit" : "Create"} ${noun}`}
      icon={<Icon className="h-5 w-5" />}
      dismissable={!saving}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
            {editing ? "Save changes" : `Create ${noun}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Name" required error={fieldErrors.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder={namePlaceholder}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={descriptionPlaceholder}
          />
        </Field>
      </div>
    </Modal>
  );
}
