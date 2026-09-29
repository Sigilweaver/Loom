import { useState, type FormEvent } from "react";
import { UserPlus, UserCog } from "lucide-react";
import { createUser, isApiError, updateUser, type UserResponse } from "@api";
import type { UserRole } from "@state/authStore";
import { errorMessage, fieldError } from "@utils/errors";
import { roleMeta } from "@components/RoleBadge";
import { Alert, Button, Field, Input, Modal, Select } from "@components/ui";

const MIN_PASSWORD_LENGTH = 8;

/** Roles the signed-in user may hand out. Owners assign admin; admins cannot. */
export function assignableRoles(currentRole: UserRole): UserRole[] {
  return currentRole === "owner" ? ["admin", "auditor", "user"] : ["auditor", "user"];
}

interface UserDialogProps {
  /** The user being edited, or null to create one. */
  user: UserResponse | null;
  currentRole: UserRole;
  onClose: () => void;
  onSaved: () => void;
}

export function UserDialog({ user, currentRole, onClose, onSaved }: UserDialogProps) {
  const editing = user !== null;
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>((user?.role as UserRole | undefined) ?? "user");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasChanges = !editing || username !== user.username || password.length > 0 || role !== user.role;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasChanges) {
      onClose();
      return;
    }

    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (editing) {
        await updateUser(user.id, {
          ...(username !== user.username && { username }),
          ...(password.length > 0 && { password }),
          ...(role !== user.role && { role }),
        });
      } else {
        await createUser({ username, password, role });
      }
      onSaved();
      onClose();
    } catch (err) {
      const next: Record<string, string> = {};
      for (const key of ["username", "password", "role"]) {
        const message = fieldError(err, key);
        if (message) next[key] = message;
      }
      setFieldErrors(next);
      // A 409 means the username is taken: show it on the field it belongs to.
      if (Object.keys(next).length === 0) {
        const message = errorMessage(err, editing ? "Failed to update user" : "Failed to create user");
        if (isApiError(err) && err.isConflict) setFieldErrors({ username: message });
        else setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${user.username}` : "Create user"}
      icon={editing ? <UserCog className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
      dismissable={!submitting}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={!hasChanges}>
            {editing ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field label="Username" required error={fieldErrors.username}>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            autoFocus
            autoComplete="off"
          />
        </Field>

        <Field
          label="Password"
          required={!editing}
          error={fieldErrors.password}
          hint={
            editing
              ? `Leave blank to keep the current password. Minimum ${MIN_PASSWORD_LENGTH} characters.`
              : `Minimum ${MIN_PASSWORD_LENGTH} characters.`
          }
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!editing}
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Role" error={fieldErrors.role} hint={roleMeta(role).description}>
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {assignableRoles(currentRole).map((r) => (
              <option key={r} value={r}>
                {roleMeta(r).label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
