/**
 * Grant Groups management tab for admin panel
 *
 * Provides UI for:
 * - Creating and editing grant groups (permission bundles)
 * - Managing grant group connections (assign/unassign)
 * - Viewing which user groups have access (read-only, managed from user groups)
 */

import { useState, useEffect } from "react";
import {
    Package,
    Plus,
    Trash2,
    Edit,
    Loader2,
    AlertCircle,
    X,
    Database,
    Link,
    Unlink,
    ChevronRight,
    Users,
} from "lucide-react";
import {
    listGrantGroups,
    createGrantGroup,
    updateGrantGroup,
    deleteGrantGroup,
    getGrantGroup,
    addConnectionToGrantGroup,
    removeConnectionFromGrantGroup,
    listConnections,
    type GrantGroupSummary,
    type GrantGroupDetail,
    type GrantGroupConnection,
    type ConnectionResponse,
} from "@api/client";

export function GrantGroupsTab() {
    const [grantGroups, setGrantGroups] = useState<GrantGroupSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingGrantGroup, setEditingGrantGroup] = useState<GrantGroupSummary | null>(null);
    const [selectedGrantGroup, setSelectedGrantGroup] = useState<GrantGroupSummary | null>(null);

    const fetchGrantGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await listGrantGroups();
            setGrantGroups(response.grant_groups);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load grant groups");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGrantGroups();
    }, []);

    const handleCreateGrantGroup = () => {
        setEditingGrantGroup(null);
        setShowCreateDialog(true);
    };

    const handleEditGrantGroup = (grantGroup: GrantGroupSummary) => {
        setEditingGrantGroup(grantGroup);
        setShowCreateDialog(true);
    };

    const handleSaveGrantGroup = (grantGroup: GrantGroupSummary) => {
        if (editingGrantGroup) {
            setGrantGroups(grantGroups.map((g) => (g.id === grantGroup.id ? grantGroup : g)));
            if (selectedGrantGroup?.id === grantGroup.id) {
                setSelectedGrantGroup(grantGroup);
            }
        } else {
            setGrantGroups([...grantGroups, grantGroup]);
        }
        setShowCreateDialog(false);
    };

    const handleDeleteGrantGroup = async (grantGroup: GrantGroupSummary) => {
        if (
            !confirm(
                `Delete grant group "${grantGroup.name}"? This will remove all connection assignments and user group associations.`
            )
        ) {
            return;
        }

        try {
            await deleteGrantGroup(grantGroup.id);
            setGrantGroups(grantGroups.filter((g) => g.id !== grantGroup.id));
            if (selectedGrantGroup?.id === grantGroup.id) {
                setSelectedGrantGroup(null);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete grant group");
        }
    };

    if (loading && grantGroups.length === 0) {
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
                    <p className="text-sm font-medium text-red-800">Failed to load grant groups</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                    <button onClick={fetchGrantGroups} className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium">
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-6">
            {/* Left: Grant Groups List */}
            <div className="w-80 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-gray-500" />
                        <h2 className="text-lg font-medium text-gray-900">Grant Groups</h2>
                        <span className="text-sm text-gray-500">({grantGroups.length})</span>
                    </div>
                    <button
                        onClick={handleCreateGrantGroup}
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                    >
                        <Plus className="h-4 w-4" />
                        New
                    </button>
                </div>

                {grantGroups.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                        <Package className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 mb-3">No grant groups yet</p>
                        <p className="text-xs text-gray-400 mb-3">
                            Grant groups bundle connections into reusable permission sets.
                        </p>
                        <button
                            onClick={handleCreateGrantGroup}
                            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                        >
                            Create first grant group
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {grantGroups.map((grantGroup) => (
                            <div
                                key={grantGroup.id}
                                className={`bg-white rounded-lg border p-3 cursor-pointer transition-colors ${selectedGrantGroup?.id === grantGroup.id
                                    ? "border-brand-600 ring-1 ring-brand-600"
                                    : "border-gray-200 hover:border-gray-300"
                                    }`}
                                onClick={() => setSelectedGrantGroup(grantGroup)}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium text-gray-900">{grantGroup.name}</h3>
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                    {grantGroup.description || "No description"}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <Database className="h-3.5 w-3.5" />
                                        {grantGroup.connection_count} connections
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {grantGroup.user_group_count} groups
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Right: Grant Group Details */}
            <div className="flex-1 min-w-0">
                {selectedGrantGroup ? (
                    <GrantGroupDetails
                        grantGroup={selectedGrantGroup}
                        onEdit={() => handleEditGrantGroup(selectedGrantGroup)}
                        onDelete={() => handleDeleteGrantGroup(selectedGrantGroup)}
                        onUpdate={(updated) => {
                            setGrantGroups(grantGroups.map((g) => (g.id === updated.id ? updated : g)));
                            setSelectedGrantGroup(updated);
                        }}
                    />
                ) : (
                    <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
                        <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-700 mb-1">Select a grant group</h3>
                        <p className="text-sm text-gray-500">
                            Choose a grant group from the list to view and manage its connections.
                        </p>
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            {showCreateDialog && (
                <GrantGroupDialog
                    grantGroup={editingGrantGroup}
                    onClose={() => setShowCreateDialog(false)}
                    onSave={handleSaveGrantGroup}
                />
            )}
        </div>
    );
}

// =============================================================================
// Grant Group Details Panel
// =============================================================================

interface GrantGroupDetailsProps {
    grantGroup: GrantGroupSummary;
    onEdit: () => void;
    onDelete: () => void;
    onUpdate: (grantGroup: GrantGroupSummary) => void;
}

function GrantGroupDetails({ grantGroup, onEdit, onDelete, onUpdate }: GrantGroupDetailsProps) {
    const [activeTab, setActiveTab] = useState<"connections" | "user-groups">("connections");
    const [detail, setDetail] = useState<GrantGroupDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddConnection, setShowAddConnection] = useState(false);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const response = await getGrantGroup(grantGroup.id);
            setDetail(response);
        } catch (err) {
            console.error("Failed to load grant group details:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [grantGroup.id]);

    const handleRemoveConnection = async (connectionId: string, connectionName: string) => {
        if (!confirm(`Remove ${connectionName} from ${grantGroup.name}?`)) return;

        try {
            await removeConnectionFromGrantGroup(grantGroup.id, connectionId);
            if (detail) {
                setDetail({
                    ...detail,
                    connections: detail.connections.filter((c) => c.connection_id !== connectionId),
                    connection_count: detail.connection_count - 1,
                });
            }
            onUpdate({ ...grantGroup, connection_count: grantGroup.connection_count - 1 });
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to remove connection");
        }
    };

    const handleConnectionAdded = (connection: GrantGroupConnection) => {
        if (detail) {
            setDetail({
                ...detail,
                connections: [...detail.connections, connection],
                connection_count: detail.connection_count + 1,
            });
        }
        onUpdate({ ...grantGroup, connection_count: grantGroup.connection_count + 1 });
        setShowAddConnection(false);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">{grantGroup.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">{grantGroup.description || "No description"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            <Edit className="h-4 w-4" />
                            Edit
                        </button>
                        <button
                            onClick={onDelete}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-white border border-gray-300 rounded-lg hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Created by {grantGroup.created_by} on {new Date(grantGroup.created_at).toLocaleDateString()}
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 px-6">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab("connections")}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "connections"
                            ? "border-brand-600 text-brand-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Connections ({detail?.connections.length ?? 0})
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("user-groups")}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "user-groups"
                            ? "border-brand-600 text-brand-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            User Groups ({detail?.user_groups.length ?? 0})
                        </span>
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                    </div>
                ) : activeTab === "connections" ? (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500">
                                Connections in this grant group are accessible to all assigned user groups.
                            </p>
                            <button
                                onClick={() => setShowAddConnection(true)}
                                className="flex items-center gap-1 px-2 py-1 text-sm text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50"
                            >
                                <Link className="h-4 w-4" />
                                Add Connection
                            </button>
                        </div>

                        {detail?.connections.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Database className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                                <p>No connections assigned yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {detail?.connections.map((conn) => (
                                    <div
                                        key={conn.connection_id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-brand-100">
                                                <Database className="h-4 w-4 text-brand-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{conn.name}</p>
                                                <p className="text-xs text-gray-500">{conn.type}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveConnection(conn.connection_id, conn.name)}
                                            className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <Unlink className="h-3.5 w-3.5" />
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500">
                                User groups with access to this grant group's connections.
                            </p>
                            <p className="text-xs text-gray-400 italic">
                                Manage from User Groups tab
                            </p>
                        </div>

                        {detail?.user_groups.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                                <p>No user groups assigned yet</p>
                                <p className="text-xs mt-1">Assign this grant group from the User Groups tab</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {detail?.user_groups.map((ug) => (
                                    <div
                                        key={ug.user_group_id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-100">
                                                <Users className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{ug.user_group_name}</p>
                                                {ug.description && (
                                                    <p className="text-xs text-gray-600 mt-0.5">{ug.description}</p>
                                                )}
                                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                    <span>{ug.member_count} member{ug.member_count !== 1 ? "s" : ""}</span>
                                                    <span>•</span>
                                                    <span>Assigned {new Date(ug.assigned_at).toLocaleDateString()} by {ug.assigned_by}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Dialogs */}
            {showAddConnection && detail && (
                <AddConnectionToGrantGroupDialog
                    grantGroup={grantGroup}
                    existingConnections={detail.connections}
                    onClose={() => setShowAddConnection(false)}
                    onAdded={handleConnectionAdded}
                />
            )}
        </div>
    );
}

// =============================================================================
// Create/Edit Grant Group Dialog
// =============================================================================

interface GrantGroupDialogProps {
    grantGroup: GrantGroupSummary | null;
    onClose: () => void;
    onSave: (grantGroup: GrantGroupSummary) => void;
}

function GrantGroupDialog({ grantGroup, onClose, onSave }: GrantGroupDialogProps) {
    const [name, setName] = useState(grantGroup?.name || "");
    const [description, setDescription] = useState(grantGroup?.description || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = !!grantGroup;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            let result: GrantGroupSummary;
            if (isEditing) {
                result = await updateGrantGroup(grantGroup!.id, { name, description });
            } else {
                result = await createGrantGroup({ name, description });
            }
            onSave(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save grant group");
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {isEditing ? "Edit Grant Group" : "Create Grant Group"}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="e.g., Production Read Access"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="Describe the purpose of this grant group..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </span>
                            ) : isEditing ? (
                                "Save Changes"
                            ) : (
                                "Create Grant Group"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// =============================================================================
// Add Connection to Grant Group Dialog
// =============================================================================

interface AddConnectionToGrantGroupDialogProps {
    grantGroup: GrantGroupSummary;
    existingConnections: GrantGroupConnection[];
    onClose: () => void;
    onAdded: (connection: GrantGroupConnection) => void;
}

function AddConnectionToGrantGroupDialog({
    grantGroup,
    existingConnections,
    onClose,
    onAdded,
}: AddConnectionToGrantGroupDialogProps) {
    const [connections, setConnections] = useState<ConnectionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const response = await listConnections();
                const existingIds = new Set(existingConnections.map((c) => c.connection_id));
                setConnections(response.connections.filter((c) => !existingIds.has(c.id)));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load connections");
            } finally {
                setLoading(false);
            }
        };
        fetchConnections();
    }, [existingConnections]);

    const handleAddConnection = async (conn: ConnectionResponse) => {
        setAdding(conn.id);
        setError(null);

        try {
            await addConnectionToGrantGroup(grantGroup.id, conn.id);
            onAdded({
                connection_id: conn.id,
                name: conn.name,
                type: conn.type,
                assigned_at: new Date().toISOString(),
                assigned_by: "current_user", // Backend sets this
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add connection");
        } finally {
            setAdding(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Add Connection to {grantGroup.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
                    ) : connections.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Database className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                            <p>All connections are already assigned</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {connections.map((conn) => {
                                const isAdding = adding === conn.id;

                                return (
                                    <div key={conn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-brand-100">
                                                <Database className="h-4 w-4 text-brand-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{conn.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {conn.type} - {conn.host}:{conn.port}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleAddConnection(conn)}
                                            disabled={isAdding}
                                            className="flex items-center gap-1 px-2 py-1 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                                        >
                                            {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                                            Add
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

