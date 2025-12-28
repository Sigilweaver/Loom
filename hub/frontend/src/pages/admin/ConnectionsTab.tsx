/**
 * Connections tab for Admin panel
 *
 * Manages database connections that Hub can provide to Servers.
 * Credentials are encrypted at rest and only sent to Servers during
 * validated workflow execution.
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Edit,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  testConnectionPreCreate,
  type ConnectionResponse,
  type DatabaseType,
} from "@api/client";

const DATABASE_TYPES: { value: DatabaseType; label: string; defaultPort: number }[] = [
  { value: "postgresql", label: "PostgreSQL", defaultPort: 5432 },
  { value: "mysql", label: "MySQL", defaultPort: 3306 },
  { value: "mssql", label: "SQL Server", defaultPort: 1433 },
  { value: "sqlite", label: "SQLite", defaultPort: 0 },
];

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function DatabaseTypeBadge({ type }: { type: DatabaseType }) {
  const config: Record<DatabaseType, { color: string; label: string }> = {
    postgresql: { color: "bg-blue-100 text-blue-700", label: "PostgreSQL" },
    mysql: { color: "bg-orange-100 text-orange-700", label: "MySQL" },
    mssql: { color: "bg-purple-100 text-purple-700", label: "SQL Server" },
    sqlite: { color: "bg-gray-100 text-gray-700", label: "SQLite" },
  };

  const { color, label } = config[type] || config.postgresql;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

interface ConnectionDialogProps {
  open: boolean;
  connection?: ConnectionResponse | null;
  onClose: () => void;
  onSave: (connection: ConnectionResponse) => void;
}

function ConnectionDialog({ open, connection, onClose, onSave }: ConnectionDialogProps) {
  const isEditing = !!connection;

  const [name, setName] = useState("");
  const [type, setType] = useState<DatabaseType>("postgresql");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or connection changes
  useEffect(() => {
    if (open) {
      if (connection) {
        setName(connection.name);
        setType(connection.type);
        setHost(connection.host);
        setPort(connection.port);
        setDatabase(connection.database);
        setUsername("");
        setPassword("");
      } else {
        setName("");
        setType("postgresql");
        setHost("");
        setPort(5432);
        setDatabase("");
        setUsername("");
        setPassword("");
      }
      setShowPassword(false);
      setTestResult(null);
      setError(null);
    }
  }, [open, connection]);

  const handleTypeChange = (newType: DatabaseType) => {
    setType(newType);
    // Update port to default for the new type
    const typeConfig = DATABASE_TYPES.find((t) => t.value === newType);
    if (typeConfig && port === DATABASE_TYPES.find((t) => t.value === type)?.defaultPort) {
      setPort(typeConfig.defaultPort);
    }
  };

  const handleTest = async () => {
    if (!username || !password) {
      setError("Username and password are required to test connection");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testConnectionPreCreate({
        type,
        host,
        port,
        database,
        username,
        password,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!host.trim() && type !== "sqlite") {
      setError("Host is required");
      return;
    }
    if (!database.trim()) {
      setError("Database is required");
      return;
    }

    // For new connections, require username and password
    if (!isEditing && (!username || !password)) {
      setError("Username and password are required for new connections");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let result: ConnectionResponse;

      if (isEditing) {
        // Only send fields that changed
        const updates: Record<string, unknown> = {};
        if (name !== connection.name) updates.name = name;
        if (host !== connection.host) updates.host = host;
        if (port !== connection.port) updates.port = port;
        if (database !== connection.database) updates.database = database;
        if (username) updates.username = username;
        if (password) updates.password = password;

        result = await updateConnection(connection.id, updates);
      } else {
        result = await createConnection({
          name,
          type,
          host,
          port,
          database,
          username,
          password,
        });
      }

      onSave(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connection");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Connection" : "Add Connection"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production Database"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Database Type
            </label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as DatabaseType)}
              disabled={isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100"
            >
              {DATABASE_TYPES.map((dbType) => (
                <option key={dbType.value} value={dbType.value}>
                  {dbType.label}
                </option>
              ))}
            </select>
          </div>

          {/* Host and Port */}
          {type !== "sqlite" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Host
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>
          )}

          {/* Database */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === "sqlite" ? "Database File Path" : "Database Name"}
            </label>
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder={type === "sqlite" ? "/path/to/database.db" : "mydb"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Username and Password */}
          {type !== "sqlite" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                  {isEditing && (
                    <span className="text-gray-400 font-normal"> (leave blank to keep current)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isEditing ? "Leave blank to keep current" : "postgres"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                  {isEditing && (
                    <span className="text-gray-400 font-normal"> (leave blank to keep current)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEditing ? "Leave blank to keep current" : ""}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-50 text-red-700">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={handleTest}
            disabled={testing || !host || !database || type === "sqlite"}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Test Connection
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConnectionsTab() {
  const [connections, setConnections] = useState<ConnectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionResponse | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listConnections();
      setConnections(response.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleAddConnection = () => {
    setEditingConnection(null);
    setDialogOpen(true);
  };

  const handleEditConnection = (connection: ConnectionResponse) => {
    setEditingConnection(connection);
    setDialogOpen(true);
  };

  const handleSaveConnection = (connection: ConnectionResponse) => {
    if (editingConnection) {
      // Update existing
      setConnections(connections.map((c) => (c.id === connection.id ? connection : c)));
    } else {
      // Add new
      setConnections([...connections, connection]);
    }
  };

  const handleTestConnection = async (connection: ConnectionResponse) => {
    setTestingId(connection.id);
    try {
      const result = await testConnection(connection.id);
      setTestResults({ ...testResults, [connection.id]: result });
    } catch (err) {
      setTestResults({
        ...testResults,
        [connection.id]: {
          success: false,
          message: err instanceof Error ? err.message : "Test failed",
        },
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConnection = async (connection: ConnectionResponse) => {
    if (!confirm(`Delete connection "${connection.name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(connection.id);
    try {
      await deleteConnection(connection.id);
      setConnections(connections.filter((c) => c.id !== connection.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connection");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && connections.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Database Connections</h2>
          <p className="text-sm text-gray-500">
            Manage database connections. Credentials are encrypted at rest.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConnections}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleAddConnection}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Connection
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty State */}
      {connections.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No connections yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add a database connection to get started.
          </p>
          <button
            onClick={handleAddConnection}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Connection
          </button>
        </div>
      )}

      {/* Connections Table */}
      {connections.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Connection
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {connections.map((connection) => (
                <tr key={connection.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-50">
                        <Database className="h-5 w-5 text-brand-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{connection.name}</div>
                        <div className="text-sm text-gray-500">{connection.database}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <DatabaseTypeBadge type={connection.type} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {connection.type === "sqlite" ? (
                      <span className="text-gray-500">Local file</span>
                    ) : (
                      `${connection.host}:${connection.port}`
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatRelativeTime(connection.updated_at)}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const result = testResults[connection.id];
                      if (testingId === connection.id) {
                        return (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Testing...
                          </span>
                        );
                      }
                      if (result) {
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 text-sm ${
                              result.success ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {result.success ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {result.success ? "Connected" : "Failed"}
                          </span>
                        );
                      }
                      return <span className="text-sm text-gray-400">-</span>;
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleTestConnection(connection)}
                        disabled={testingId === connection.id}
                        className="p-1.5 text-gray-400 hover:text-brand-600 rounded disabled:opacity-50"
                        title="Test connection"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditConnection(connection)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                        title="Edit connection"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteConnection(connection)}
                        disabled={deletingId === connection.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                        title="Delete connection"
                      >
                        {deletingId === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <ConnectionDialog
        open={dialogOpen}
        connection={editingConnection}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveConnection}
      />
    </div>
  );
}
