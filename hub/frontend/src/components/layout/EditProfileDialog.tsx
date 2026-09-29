import { useState, type FormEvent } from "react";
import { UserCog } from "lucide-react";
import { updateProfile } from "@api";
import { errorMessage, fieldError } from "@utils/errors";
import { Alert, Button, Field, Input, Modal } from "@components/ui";

interface EditProfileDialogProps {
  username: string;
  onClose: () => void;
  onUpdated: (newUsername: string) => void;
}

const MIN_PASSWORD_LENGTH = 8;

export function EditProfileDialog({ username, onClose, onUpdated }: EditProfileDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasChanges = newUsername !== username || newPassword.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!hasChanges) {
      onClose();
      return;
    }
    if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
      setFieldErrors({ new_password: `Must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setFieldErrors({ confirm: "Passwords do not match" });
      return;
    }

    setSubmitting(true);
    try {
      await updateProfile({
        current_password: currentPassword,
        username: newUsername !== username ? newUsername : undefined,
        new_password: newPassword || undefined,
      });
      onUpdated(newUsername);
    } catch (err) {
      const next: Record<string, string> = {};
      for (const key of ["username", "new_password", "current_password"]) {
        const message = fieldError(err, key);
        if (message) next[key] = message;
      }
      setFieldErrors(next);
      if (Object.keys(next).length === 0) setError(errorMessage(err, "Failed to update profile"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit profile"
      description="Confirm your current password to change your username or password."
      icon={<UserCog className="h-5 w-5" />}
      dismissable={!submitting}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!currentPassword || !hasChanges}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field label="Current password" required error={fieldErrors.current_password}>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
        </Field>

        <hr className="border-line" />

        <Field label="Username" error={fieldErrors.username}>
          <Input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
          />
        </Field>

        <Field
          label="New password"
          hint={`Leave blank to keep your current password. Minimum ${MIN_PASSWORD_LENGTH} characters.`}
          error={fieldErrors.new_password}
        >
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {newPassword && (
          <Field label="Confirm new password" error={fieldErrors.confirm}>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
