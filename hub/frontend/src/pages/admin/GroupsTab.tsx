/**
 * Groups management tab for admin panel
 *
 * Provides UI for:
 * - Creating and editing groups
 * - Managing group members (add/remove users)
 * - Assigning grant groups to user groups
 */

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Loader2,
  AlertCircle,
  X,
  UserPlus,
  UserMinus,
  ChevronRight,
  Shield,
  ShieldCheck,
  Eye,
  User,
  Package,
} from "lucide-react";
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  listUsers,
  listGroupGrantGroups,
  listGrantGroups,
  assignGrantGroupToGroup,
  removeGrantGroupFromGroup,
  type GroupResponse,
  type GroupMemberResponse,
  type UserResponse,
  type GroupGrantGroupResponse,
  type GrantGroupSummary,
} from "@api";
import type { UserRole } from "@state/authStore";

const roleConfig: Record<UserRole, { label: string; icon: typeof Shield; color: string }> = {
  owner: { label: "Owner", icon: ShieldCheck, color: "text-purple-600" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-600" },
  auditor: { label: "Auditor", icon: Eye, color: "text-amber-600" },
  user: { label: "User", icon: User, color: "text-ink-muted" },
};

export function GroupsTab() {
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupResponse | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupResponse | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listGroups();
      setGroups(response.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setShowCreateDialog(true);
  };

  const handleEditGroup = (group: GroupResponse) => {
    setEditingGroup(group);
    setShowCreateDialog(true);
  };

  const handleSaveGroup = (group: GroupResponse) => {
    if (editingGroup) {
      setGroups(groups.map((g) => (g.id === group.id ? group : g)));
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(group);
      }
    } else {
      setGroups([...groups, group]);
    }
    setShowCreateDialog(false);
  };

  const handleDeleteGroup = async (group: GroupResponse) => {
    if (!confirm(`Delete group "${group.name}"? This will remove all member and connection associations.`)) {
      return;
    }

    try {
      await deleteGroup(group.id);
      setGroups(groups.filter((g) => g.id !== group.id));
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete group");
    }
  };

  if (loading && groups.length === 0) {
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
          <p className="text-sm font-medium text-red-800">Failed to load groups</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button onClick={fetchGroups} className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Left: Groups List */}
      <div className="w-80 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-ink-subtle" />
            <h2 className="text-lg font-medium text-ink">Groups</h2>
            <span className="text-sm text-ink-subtle">({groups.length})</span>
          </div>
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-1 px-2 py-1 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="bg-surface-sunken rounded-lg border-2 border-dashed border-line p-6 text-center">
            <Users className="h-10 w-10 text-ink-faint mx-auto mb-2" />
            <p className="text-sm text-ink-subtle mb-3">No groups yet</p>
            <button
              onClick={handleCreateGroup}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Create first group
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className={`bg-surface-raised rounded-lg border p-3 cursor-pointer transition-colors ${selectedGroup?.id === group.id
                  ? "border-brand-600 ring-1 ring-brand-600"
                  : "border-line hover:border-line-strong"
                  }`}
                onClick={() => setSelectedGroup(group)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-ink">{group.name}</h3>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </div>
                <p className="text-sm text-ink-subtle mt-1 line-clamp-1">
                  {group.description || "No description"}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-ink-subtle">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {group.member_count} members
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Group Details */}
      <div className="flex-1 min-w-0">
        {selectedGroup ? (
          <GroupDetails
            group={selectedGroup}
            onEdit={() => handleEditGroup(selectedGroup)}
            onDelete={() => handleDeleteGroup(selectedGroup)}
            onUpdate={(updated) => {
              setGroups(groups.map((g) => (g.id === updated.id ? updated : g)));
              setSelectedGroup(updated);
            }}
          />
        ) : (
          <div className="bg-surface-sunken rounded-lg border-2 border-dashed border-line p-12 text-center">
            <Users className="h-12 w-12 text-ink-faint mx-auto mb-4" />
            <h3 className="text-lg font-medium text-ink-muted mb-1">Select a group</h3>
            <p className="text-sm text-ink-subtle">
              Choose a group from the list to view and manage its members and connections.
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      {showCreateDialog && (
        <GroupDialog
          group={editingGroup}
          onClose={() => setShowCreateDialog(false)}
          onSave={handleSaveGroup}
        />
      )}
    </div>
  );
}

// =============================================================================
// Group Details Panel
// =============================================================================

interface GroupDetailsProps {
  group: GroupResponse;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (group: GroupResponse) => void;
}

function GroupDetails({ group, onEdit, onDelete, onUpdate }: GroupDetailsProps) {
  const [activeTab, setActiveTab] = useState<"members" | "grant-groups">("members");
  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [grantGroups, setGrantGroups] = useState<GroupGrantGroupResponse[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingGrantGroups, setLoadingGrantGroups] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddGrantGroup, setShowAddGrantGroup] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const response = await listGroupMembers(group.id);
        setMembers(response.members);
      } catch (err) {
        console.error("Failed to load members:", err);
      } finally {
        setLoadingMembers(false);
      }
    };

    const fetchGrantGroups = async () => {
      setLoadingGrantGroups(true);
      try {
        const response = await listGroupGrantGroups(group.id);
        setGrantGroups(response.grant_groups);
      } catch (err) {
        console.error("Failed to load grant groups:", err);
      } finally {
        setLoadingGrantGroups(false);
      }
    };

    fetchMembers();
    fetchGrantGroups();
  }, [group.id]);

  const handleRemoveMember = async (userId: string, username: string) => {
    if (!confirm(`Remove ${username} from ${group.name}?`)) return;

    try {
      await removeGroupMember(group.id, userId);
      setMembers(members.filter((m) => m.user_id !== userId));
      onUpdate({ ...group, member_count: group.member_count - 1 });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleMemberAdded = (member: GroupMemberResponse) => {
    setMembers([...members, member]);
    onUpdate({ ...group, member_count: group.member_count + 1 });
    setShowAddMember(false);
  };

  const handleRemoveGrantGroup = async (grantGroupId: string, grantGroupName: string) => {
    if (!confirm(`Remove grant group "${grantGroupName}" from ${group.name}?`)) return;

    try {
      await removeGrantGroupFromGroup(group.id, grantGroupId);
      setGrantGroups(grantGroups.filter((g) => g.grant_group_id !== grantGroupId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove grant group");
    }
  };

  const handleGrantGroupAdded = (grantGroup: GroupGrantGroupResponse) => {
    setGrantGroups([...grantGroups, grantGroup]);
    setShowAddGrantGroup(false);
  };

  return (
    <div className="bg-surface-raised rounded-lg border border-line">
      {/* Header */}
      <div className="px-6 py-4 border-b border-line">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">{group.name}</h2>
            <p className="text-sm text-ink-subtle mt-1">
              {group.description || "No description"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-ink-muted bg-surface-raised border border-line-strong rounded-lg hover:bg-surface-sunken"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-surface-raised border border-line-strong rounded-lg hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-faint mt-2">
          Created by {group.created_by} on {new Date(group.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-line px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("members")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "members"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-ink-subtle hover:text-ink-muted"
              }`}
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("grant-groups")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "grant-groups"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-ink-subtle hover:text-ink-muted"
              }`}
          >
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Grant Groups ({grantGroups.length})
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "members" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-ink-subtle">Users in this group get access to assigned grant groups.</p>
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                <UserPlus className="h-4 w-4" />
                Add Member
              </button>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-ink-subtle">
                <Users className="h-10 w-10 mx-auto mb-2 text-ink-faint" />
                <p>No members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const config = roleConfig[member.role as UserRole] || roleConfig.user;
                  const RoleIcon = config.icon;
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-3 bg-surface-sunken rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-brand-700">
                            {member.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink">{member.username}</p>
                          <p className={`text-xs flex items-center gap-1 ${config.color}`}>
                            <RoleIcon className="h-3 w-3" />
                            {config.label}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member.user_id, member.username)}
                        className="p-1.5 text-ink-faint hover:text-red-600 rounded"
                        title="Remove from group"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "grant-groups" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-ink-subtle">
                Grant groups provide bundled connection access to this group's members.
              </p>
              <button
                onClick={() => setShowAddGrantGroup(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                <Package className="h-4 w-4" />
                Assign Grant Group
              </button>
            </div>

            {loadingGrantGroups ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              </div>
            ) : grantGroups.length === 0 ? (
              <div className="text-center py-8 text-ink-subtle">
                <Package className="h-10 w-10 mx-auto mb-2 text-ink-faint" />
                <p>No grant groups assigned</p>
                <p className="text-xs mt-1">
                  Assign grant groups to give this group access to bundled connections.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {grantGroups.map((gg) => (
                  <div
                    key={gg.grant_group_id}
                    className="flex items-center justify-between p-3 bg-surface-sunken rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <Package className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{gg.grant_group_name}</p>
                        <p className="text-xs text-ink-subtle">
                          {gg.connection_count} connection{gg.connection_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveGrantGroup(gg.grant_group_id, gg.grant_group_name)}
                      className="p-1.5 text-ink-faint hover:text-red-600 rounded"
                      title="Remove grant group"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      {showAddMember && (
        <AddMemberDialog
          group={group}
          existingMembers={members}
          onClose={() => setShowAddMember(false)}
          onAdded={handleMemberAdded}
        />
      )}

      {/* Add Grant Group Dialog */}
      {showAddGrantGroup && (
        <AddGrantGroupDialog
          group={group}
          existingGrantGroups={grantGroups}
          onClose={() => setShowAddGrantGroup(false)}
          onAdded={handleGrantGroupAdded}
        />
      )}
    </div>
  );
}

// =============================================================================
// Group Create/Edit Dialog
// =============================================================================

interface GroupDialogProps {
  group: GroupResponse | null;
  onClose: () => void;
  onSave: (group: GroupResponse) => void;
}

function GroupDialog({ group, onClose, onSave }: GroupDialogProps) {
  const isEditing = !!group;
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let result: GroupResponse;
      if (isEditing) {
        result = await updateGroup(group.id, { name, description });
      } else {
        result = await createGroup({ name, description });
      }
      onSave(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="text-lg font-semibold text-ink">
            {isEditing ? "Edit Group" : "Create Group"}
          </h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g., Engineering, Finance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="Optional description for this group"
            />
          </div>

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
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Group"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Add Member Dialog
// =============================================================================

interface AddMemberDialogProps {
  group: GroupResponse;
  existingMembers: GroupMemberResponse[];
  onClose: () => void;
  onAdded: (member: GroupMemberResponse) => void;
}

function AddMemberDialog({ group, existingMembers, onClose, onAdded }: AddMemberDialogProps) {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admin-level roles that cannot be added to groups
  const adminRoles = useMemo(() => new Set(["owner", "admin", "auditor"]), []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await listUsers();
        // Filter out users already in the group and admin-level users
        const existingIds = new Set(existingMembers.map((m) => m.user_id));
        setUsers(
          response.users.filter(
            (u) => !existingIds.has(u.id) && !adminRoles.has(u.role)
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [existingMembers, adminRoles]);

  const handleAddUser = async (user: UserResponse) => {
    setAdding(user.id);
    setError(null);

    try {
      await addGroupMember(group.id, user.id);
      onAdded({
        user_id: user.id,
        username: user.username,
        role: user.role,
        joined_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="text-lg font-semibold text-ink">Add Member to {group.name}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-ink-subtle">
              <Users className="h-10 w-10 mx-auto mb-2 text-ink-faint" />
              <p>All users are already members</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const config = roleConfig[user.role as UserRole] || roleConfig.user;
                const RoleIcon = config.icon;
                const isAdding = adding === user.id;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-surface-sunken rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-brand-700">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{user.username}</p>
                        <p className={`text-xs flex items-center gap-1 ${config.color}`}>
                          <RoleIcon className="h-3 w-3" />
                          {config.label}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddUser(user)}
                      disabled={isAdding}
                      className="flex items-center gap-1 px-2 py-1 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                    >
                      {isAdding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line bg-surface-sunken">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-line-strong text-ink-muted font-medium rounded-lg hover:bg-surface-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Add Grant Group Dialog
// =============================================================================

interface AddGrantGroupDialogProps {
  group: GroupResponse;
  existingGrantGroups: GroupGrantGroupResponse[];
  onClose: () => void;
  onAdded: (grantGroup: GroupGrantGroupResponse) => void;
}

function AddGrantGroupDialog({ group, existingGrantGroups, onClose, onAdded }: AddGrantGroupDialogProps) {
  const [grantGroups, setGrantGroups] = useState<GrantGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGrantGroups = async () => {
      try {
        const response = await listGrantGroups();
        const existingIds = new Set(existingGrantGroups.map((g) => g.grant_group_id));
        setGrantGroups(response.grant_groups.filter((g) => !existingIds.has(g.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load grant groups");
      } finally {
        setLoading(false);
      }
    };
    fetchGrantGroups();
  }, [existingGrantGroups]);

  const handleAddGrantGroup = async (gg: GrantGroupSummary) => {
    setAdding(gg.id);
    setError(null);

    try {
      await assignGrantGroupToGroup(group.id, gg.id);
      onAdded({
        grant_group_id: gg.id,
        grant_group_name: gg.name,
        connection_count: gg.connection_count,
        assigned_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign grant group");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="text-lg font-semibold text-ink">Assign Grant Group to {group.name}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : grantGroups.length === 0 ? (
            <div className="text-center py-8 text-ink-subtle">
              <Package className="h-10 w-10 mx-auto mb-2 text-ink-faint" />
              <p>All grant groups are already assigned</p>
            </div>
          ) : (
            <div className="space-y-2">
              {grantGroups.map((gg) => {
                const isAdding = adding === gg.id;

                return (
                  <div
                    key={gg.id}
                    className="flex items-center justify-between p-3 bg-surface-sunken rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <Package className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{gg.name}</p>
                        <p className="text-xs text-ink-subtle">
                          {gg.connection_count} connection{gg.connection_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddGrantGroup(gg)}
                      disabled={isAdding}
                      className="flex items-center gap-1 px-2 py-1 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                    >
                      {isAdding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Assign
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line bg-surface-sunken">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-line-strong text-ink-muted font-medium rounded-lg hover:bg-surface-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
