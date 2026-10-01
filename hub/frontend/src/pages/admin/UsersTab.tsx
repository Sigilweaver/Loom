/**
 * Users: create, edit and remove Hub accounts.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { deleteUser, listUsers, type UserResponse } from "@api";
import { useAuthStore, type UserRole } from "@state/authStore";
import { errorMessage } from "@utils/errors";
import { RoleBadge } from "@components/RoleBadge";
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Page,
  PageHeader,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  useConfirm,
  useToast,
} from "@components/ui";
import { UserDialog } from "./users/UserDialog";

/** Owners manage everyone but themselves; admins manage auditors and users. */
export function canManageRole(actor: UserRole | undefined, target: UserRole): boolean {
  if (actor === "owner") return target !== "owner";
  if (actor === "admin") return target === "user" || target === "auditor";
  return false;
}

export function UsersTab() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const currentUser = useAuthStore((state) => state.user);

  // undefined: dialog closed, null: creating, otherwise the user being edited
  const [editing, setEditing] = useState<UserResponse | null | undefined>(undefined);

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const reload = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const canCreate = currentUser?.role === "owner" || currentUser?.role === "admin";

  const handleDelete = async (user: UserResponse) => {
    const ok = await confirm({
      title: "Delete user?",
      message: `"${user.username}" will no longer be able to sign in. This cannot be undone.`,
      confirmLabel: "Delete user",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteUser(user.id);
      toast.success(`Deleted "${user.username}".`);
      await reload();
    } catch (err) {
      toast.error(err, "Failed to delete user");
    }
  };

  const rows = users.data?.users ?? [];

  return (
    <Page>
      <PageHeader
        title="Users"
        description={users.data ? `${users.data.total} ${users.data.total === 1 ? "account" : "accounts"} on this Hub.` : "Accounts on this Hub."}
        actions={
          canCreate && (
            <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing(null)}>
              Create user
            </Button>
          )
        }
      />

      {users.isPending ? (
        <LoadingState label="Loading users..." />
      ) : users.isError ? (
        <ErrorState title="Could not load users" message={errorMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No users found" className="rounded-xl border border-line bg-surface-raised" />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>User</Th>
              <Th>Role</Th>
              <Th className="hidden sm:table-cell">Created</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((user) => {
              const isYou = user.id === currentUser?.id;
              const manageable = canManageRole(currentUser?.role, user.role as UserRole) && !isYou;
              return (
                <Tr key={user.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-ink">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium text-ink">
                        {user.username}
                        {isYou && <span className="ml-2 text-xs font-normal text-ink-subtle">(you)</span>}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <RoleBadge role={user.role} />
                  </Td>
                  <Td className="hidden whitespace-nowrap sm:table-cell">
                    {new Date(user.created_at).toLocaleDateString()}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {manageable && (
                      <>
                        <IconButton label={`Edit ${user.username}`} onClick={() => setEditing(user)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton label={`Delete ${user.username}`} tone="danger" onClick={() => void handleDelete(user)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      {editing !== undefined && currentUser && (
        <UserDialog
          user={editing}
          currentRole={currentUser.role}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            toast.success(editing ? "User updated." : "User created.");
            void reload();
          }}
        />
      )}
    </Page>
  );
}
