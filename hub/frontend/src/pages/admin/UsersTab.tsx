/**
 * Users management tab for admin panel
 */

import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  ShieldCheck,
  Eye,
  User,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  Edit,
} from "lucide-react";
import { useAuthStore } from "@state/authStore";
import { createUser, updateUser, deleteUser, listUsers, type CreateUserResponse } from "@api/client";
import type { UserRole } from "@state/authStore";

interface UserInfo {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
}

const roleConfig: Record<UserRole, { label: string; icon: typeof Shield; color: string; bg: string }> = {
  owner: { label: "Owner", icon: ShieldCheck, color: "text-purple-700", bg: "bg-purple-100" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-700", bg: "bg-blue-100" },
  auditor: { label: "Auditor", icon: Eye, color: "text-amber-700", bg: "bg-amber-100" },
  user: { label: "User", icon: User, color: "text-ink-muted", bg: "bg-surface-hover" },
};

export function UsersTab() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listUsers();
      setUsers(
        response.users.map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role as UserRole,
          created_at: u.created_at,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserCreated = (newUser: CreateUserResponse) => {
    // Add the new user to the list
    setUsers((prev) => [
      ...prev,
      {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role as UserRole,
        created_at: newUser.created_at,
      },
    ]);
    setShowCreateDialog(false);
  };

  const handleUserUpdated = (updatedUser: UserInfo) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setEditingUser(null);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const canManageUser = (targetRole: UserRole): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === "owner") return targetRole !== "owner";
    if (currentUser.role === "admin") return targetRole === "user" || targetRole === "auditor";
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load users</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-ink-subtle" />
          <h2 className="text-lg font-medium text-ink">Users</h2>
          <span className="text-sm text-ink-subtle">({users.length})</span>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
        >
          <UserPlus className="h-4 w-4" />
          Create User
        </button>
      </div>

      {/* Users table */}
      <div className="bg-surface-raised rounded-lg border border-line overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-sunken border-b border-line">
            <tr>
              <th className="text-left text-xs font-medium text-ink-subtle uppercase tracking-wider px-4 py-3">
                User
              </th>
              <th className="text-left text-xs font-medium text-ink-subtle uppercase tracking-wider px-4 py-3">
                Role
              </th>
              <th className="text-left text-xs font-medium text-ink-subtle uppercase tracking-wider px-4 py-3">
                Created
              </th>
              <th className="text-right text-xs font-medium text-ink-subtle uppercase tracking-wider px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((user) => {
              const config = roleConfig[user.role] || roleConfig.user;
              const RoleIcon = config.icon;
              const isCurrentUser = user.id === currentUser?.id;
              const canManage = canManageUser(user.role) && !isCurrentUser;

              return (
                <tr key={user.id} className="hover:bg-surface-sunken">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-brand-700">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {user.username}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-ink-subtle">(you)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
                    >
                      <RoleIcon className="h-3.5 w-3.5" />
                      {config.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-subtle">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-ink-faint hover:text-brand-600 p-1"
                          title="Edit user role"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="text-ink-faint hover:text-red-600 p-1"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-subtle">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create user dialog */}
      {showCreateDialog && (
        <CreateUserDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleUserCreated}
          currentUserRole={currentUser?.role || "user"}
        />
      )}

      {/* Edit user dialog */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={handleUserUpdated}
          currentUserRole={currentUser?.role || "user"}
        />
      )}
    </div>
  );
}

interface CreateUserDialogProps {
  onClose: () => void;
  onCreated: (user: CreateUserResponse) => void;
  currentUserRole: UserRole;
}

function CreateUserDialog({ onClose, onCreated, currentUserRole }: CreateUserDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Roles the current user can assign
  const assignableRoles: UserRole[] =
    currentUserRole === "owner" ? ["admin", "auditor", "user"] : ["auditor", "user"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const newUser = await createUser({ username, password, role });
      onCreated(newUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoleConfig = roleConfig[role];
  const SelectedIcon = selectedRoleConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-surface-raised rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="text-lg font-semibold text-ink">Create User</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              autoFocus
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="Enter username"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="Min 8 characters"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Role</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border border-line-strong rounded-lg bg-surface-raised hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <span className="flex items-center gap-2">
                  <SelectedIcon className={`h-4 w-4 ${selectedRoleConfig.color}`} />
                  <span className="text-sm">{selectedRoleConfig.label}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-ink-faint" />
              </button>

              {showRoleDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowRoleDropdown(false)}
                  />
                  <div className="absolute z-20 mt-1 w-full bg-surface-raised rounded-lg border border-line shadow-lg overflow-hidden">
                    {assignableRoles.map((r) => {
                      const config = roleConfig[r];
                      const Icon = config.icon;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setRole(r);
                            setShowRoleDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken ${
                            role === r ? "bg-surface-sunken" : ""
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          <span className="text-sm">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-line-strong text-ink-muted font-medium rounded-lg hover:bg-surface-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditUserDialogProps {
  user: UserInfo;
  onClose: () => void;
  onUpdated: (user: UserInfo) => void;
  currentUserRole: UserRole;
}

function EditUserDialog({ user, onClose, onUpdated, currentUserRole }: EditUserDialogProps) {
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user.role);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Roles the current user can assign
  const assignableRoles: UserRole[] =
    currentUserRole === "owner" ? ["admin", "auditor", "user"] : ["auditor", "user"];

  const hasChanges = username !== user.username || password.length > 0 || role !== user.role;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasChanges) {
      onClose();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const updates: { username?: string; password?: string; role?: string } = {};
      if (username !== user.username) updates.username = username;
      if (password.length > 0) updates.password = password;
      if (role !== user.role) updates.role = role;

      await updateUser(user.id, updates);
      onUpdated({ ...user, username, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoleConfig = roleConfig[role];
  const SelectedIcon = selectedRoleConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-surface-raised rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="text-lg font-semibold text-ink">Edit User</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Password
              <span className="text-ink-faint font-normal ml-1">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="New password (min 8 characters)"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Role</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border border-line-strong rounded-lg bg-surface-raised hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <span className="flex items-center gap-2">
                  <SelectedIcon className={`h-4 w-4 ${selectedRoleConfig.color}`} />
                  <span className="text-sm">{selectedRoleConfig.label}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-ink-faint" />
              </button>

              {showRoleDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowRoleDropdown(false)}
                  />
                  <div className="absolute z-20 mt-1 w-full bg-surface-raised rounded-lg border border-line shadow-lg overflow-hidden">
                    {assignableRoles.map((r) => {
                      const config = roleConfig[r];
                      const Icon = config.icon;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setRole(r);
                            setShowRoleDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken ${
                            role === r ? "bg-surface-sunken" : ""
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          <span className="text-sm">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-line-strong text-ink-muted font-medium rounded-lg hover:bg-surface-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasChanges}
              className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
