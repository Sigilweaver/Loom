/**
 * Connections tab for Admin panel
 *
 * Manages both database and filesystem connections that Hub can provide to Servers.
 * Database credentials are encrypted at rest and only sent to Servers during
 * validated workflow execution.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Database,
  FolderOpen,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Edit,
  Eye,
  EyeOff,
  Filter,
} from "lucide-react";
import {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  testConnectionPreCreate,
  checkAllConnectionsHealth,
  type ConnectionResponse,
  type ConnectionType,
  type DatabaseType,
  type PathType,
  type ConnectionStatus,
  type CreateDatabaseConnectionRequest,
  type CreateFilesystemConnectionRequest,
} from "@api";

const CONNECTION_TYPES: { value: ConnectionType; label: string; icon: typeof Database }[] = [
  { value: "database", label: "Database", icon: Database },
  { value: "filesystem", label: "Filesystem", icon: FolderOpen },
];

const DATABASE_TYPES: { value: DatabaseType; label: string; defaultPort: number }[] = [
  { value: "postgresql", label: "PostgreSQL", defaultPort: 5432 },
  { value: "mysql", label: "MySQL", defaultPort: 3306 },
  { value: "mssql", label: "SQL Server", defaultPort: 1433 },
  { value: "sqlite", label: "SQLite", defaultPort: 0 },
];

const PATH_TYPES: { value: PathType; label: string }[] = [
  { value: "local", label: "Local Path" },
  { value: "unc", label: "UNC Path (Network)" },
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

function ConnectionTypeBadge({ type }: { type: ConnectionType }) {
  const config: Record<ConnectionType, { color: string; label: string; icon: typeof Database }> = {
    database: { color: "bg-blue-100 text-blue-700", label: "Database", icon: Database },
    filesystem: { color: "bg-amber-100 text-amber-700", label: "Filesystem", icon: FolderOpen },
  };

  const { color, label, icon: Icon } = config[type] || config.database;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function DatabaseTypeBadge({ type }: { type: DatabaseType }) {
  const config: Record<DatabaseType, { color: string; label: string }> = {
    postgresql: { color: "bg-blue-100 text-blue-700", label: "PostgreSQL" },
    mysql: { color: "bg-orange-100 text-orange-700", label: "MySQL" },
    mssql: { color: "bg-purple-100 text-purple-700", label: "SQL Server" },
    sqlite: { color: "bg-surface-hover text-ink-muted", label: "SQLite" },
  };

  const { color, label } = config[type] || config.postgresql;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function PathTypeBadge({ type }: { type: PathType }) {
  const config: Record<PathType, { color: string; label: string }> = {
    local: { color: "bg-green-100 text-green-700", label: "Local" },
    unc: { color: "bg-indigo-100 text-indigo-700", label: "UNC" },
  };

  const { color, label } = config[type] || config.local;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function HealthStatusBadge({ status, lastChecked, lastError }: { status: ConnectionStatus; lastChecked: string | null; lastError: string | null }) {
  const config: Record<ConnectionStatus, { color: string; label: string; icon: typeof CheckCircle }> = {
    healthy: { color: "text-green-600", label: "Healthy", icon: CheckCircle },
    unhealthy: { color: "text-red-600", label: "Unhealthy", icon: XCircle },
    error: { color: "text-red-600", label: "Error", icon: XCircle },
    unknown: { color: "text-ink-faint", label: "Unknown", icon: RefreshCw },
  };

  const statusConfig = config[status] ?? config.unknown;
  const { color, label, icon: Icon } = statusConfig;

  return (
    <div className="flex flex-col">
      <span className={`inline-flex items-center gap-1.5 text-sm ${color}`}>
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {lastChecked && (
        <span className="text-xs text-ink-faint">
          Checked {formatRelativeTime(lastChecked)}
        </span>
      )}
      {lastError && status !== "healthy" && (
        <span className="text-xs text-red-500 truncate max-w-[200px]" title={lastError}>
          {lastError}
        </span>
      )}
    </div>
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

  // Common fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [connectionType, setConnectionType] = useState<ConnectionType>("database");
  const [readOnly, setReadOnly] = useState(false);

  // Database-specific fields
  const [dbType, setDbType] = useState<DatabaseType>("postgresql");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Filesystem-specific fields
  const [path, setPath] = useState("");
  const [pathType, setPathType] = useState<PathType>("local");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or connection changes
  useEffect(() => {
    if (open) {
      if (connection) {
        setName(connection.name);
        setDescription(connection.description || "");
        setConnectionType(connection.type);
        setReadOnly(connection.read_only);

        if (connection.type === "database" && connection.database_config) {
          setDbType(connection.database_config.db_type);
          setHost(connection.database_config.host);
          setPort(connection.database_config.port);
          setDatabase(connection.database_config.database);
        } else if (connection.type === "filesystem" && connection.filesystem_config) {
          setPath(connection.filesystem_config.path);
          setPathType(connection.filesystem_config.path_type);
        }

        setUsername("");
        setPassword("");
      } else {
        setName("");
        setDescription("");
        setConnectionType("database");
        setReadOnly(false);
        setDbType("postgresql");
        setHost("");
        setPort(5432);
        setDatabase("");
        setUsername("");
        setPassword("");
        setPath("");
        setPathType("local");
      }
      setShowPassword(false);
      setTestResult(null);
      setError(null);
    }
  }, [open, connection]);

  const handleDbTypeChange = (newDbType: DatabaseType) => {
    setDbType(newDbType);
    // Update port to default for the new type
    const typeConfig = DATABASE_TYPES.find((t) => t.value === newDbType);
    if (typeConfig && port === DATABASE_TYPES.find((t) => t.value === dbType)?.defaultPort) {
      setPort(typeConfig.defaultPort);
    }
  };

  const handleConnectionTypeChange = (newType: ConnectionType) => {
    setConnectionType(newType);
    setTestResult(null);
    setError(null);
  };

  const handleTest = async () => {
    if (connectionType !== "database") {
      setError("Test connection is only available for database connections");
      return;
    }

    if (!username || !password) {
      setError("Username and password are required to test connection");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testConnectionPreCreate({
        type: dbType,
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

    if (connectionType === "database") {
      if (!host.trim() && dbType !== "sqlite") {
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
    } else if (connectionType === "filesystem") {
      if (!path.trim()) {
        setError("Path is required");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      let result: ConnectionResponse;

      if (isEditing) {
        // Only send fields that changed
        const updates: Record<string, unknown> = {};
        if (name !== connection.name) updates.name = name;
        if (description !== (connection.description || "")) updates.description = description;
        if (readOnly !== connection.read_only) updates.read_only = readOnly;

        if (connection.type === "database" && connection.database_config) {
          if (host !== connection.database_config.host) updates.host = host;
          if (port !== connection.database_config.port) updates.port = port;
          if (database !== connection.database_config.database) updates.database = database;
          if (username) updates.username = username;
          if (password) updates.password = password;
        } else if (connection.type === "filesystem" && connection.filesystem_config) {
          if (path !== connection.filesystem_config.path) updates.path = path;
          if (pathType !== connection.filesystem_config.path_type) updates.path_type = pathType;
        }

        result = await updateConnection(connection.id, updates);
      } else {
        if (connectionType === "database") {
          const createRequest: CreateDatabaseConnectionRequest = {
            type: "database",
            name,
            description: description || undefined,
            read_only: readOnly,
            db_type: dbType,
            host,
            port,
            database,
            username,
            password,
          };
          result = await createConnection(createRequest);
        } else {
          const createRequest: CreateFilesystemConnectionRequest = {
            type: "filesystem",
            name,
            description: description || undefined,
            read_only: readOnly,
            path,
            path_type: pathType,
          };
          result = await createConnection(createRequest);
        }
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

  const canTestConnection = connectionType === "database" && dbType !== "sqlite" && host && database;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-lg font-semibold text-ink">
            {isEditing ? "Edit Connection" : "Add Connection"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-ink-faint hover:text-ink-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Connection Type */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Connection Type
            </label>
            <select
              value={connectionType}
              onChange={(e) => handleConnectionTypeChange(e.target.value as ConnectionType)}
              disabled={isEditing}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-surface-hover"
            >
              {CONNECTION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={connectionType === "database" ? "Production Database" : "Shared Data Folder"}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Description <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this connection"
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Database-specific fields */}
          {connectionType === "database" && (
            <>
              {/* Database Type */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Database Type
                </label>
                <select
                  value={dbType}
                  onChange={(e) => handleDbTypeChange(e.target.value as DatabaseType)}
                  disabled={isEditing}
                  className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-surface-hover"
                >
                  {DATABASE_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Host and Port */}
              {dbType !== "sqlite" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      Host
                    </label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="localhost"
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              {/* Database */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {dbType === "sqlite" ? "Database File Path" : "Database Name"}
                </label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder={dbType === "sqlite" ? "/path/to/database.db" : "mydb"}
                  className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Username and Password */}
              {dbType !== "sqlite" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      Username
                      {isEditing && (
                        <span className="text-ink-faint font-normal"> (leave blank to keep current)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={isEditing ? "Leave blank to keep current" : "postgres"}
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      Password
                      {isEditing && (
                        <span className="text-ink-faint font-normal"> (leave blank to keep current)</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isEditing ? "Leave blank to keep current" : ""}
                        className="w-full px-3 py-2 pr-10 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink-muted"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Filesystem-specific fields */}
          {connectionType === "filesystem" && (
            <>
              {/* Path Type */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Path Type
                </label>
                <select
                  value={pathType}
                  onChange={(e) => setPathType(e.target.value as PathType)}
                  className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  {PATH_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Path */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Path
                </label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={pathType === "unc" ? "\\\\server\\share\\folder" : "/path/to/data"}
                  className="w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <p className="mt-1 text-xs text-ink-subtle">
                  {pathType === "unc"
                    ? "Network path in UNC format (e.g., \\\\server\\share)"
                    : "Local filesystem path accessible by servers"}
                </p>
              </div>
            </>
          )}

          {/* Read Only checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="read-only"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="read-only" className="text-sm text-ink-muted">
              Read-only connection
            </label>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success
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
        <div className="flex items-center justify-between p-6 border-t border-line bg-surface-sunken rounded-b-xl">
          {connectionType === "database" ? (
            <button
              onClick={handleTest}
              disabled={testing || !canTestConnection}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-muted bg-surface-raised border border-line-strong rounded-lg hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Test Connection
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-ink-muted bg-surface-raised border border-line-strong rounded-lg hover:bg-surface-sunken"
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
  const [checkingAll, setCheckingAll] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ConnectionType | "all">("all");

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterType = typeFilter === "all" ? undefined : typeFilter;
      const response = await listConnections(filterType);
      setConnections(response.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

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
    // Only test database connections
    if (connection.type !== "database") {
      return;
    }
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

  const handleCheckAll = async () => {
    setCheckingAll(true);
    setError(null);
    try {
      await checkAllConnectionsHealth();
      // Refresh connections to get updated health status
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check connections");
    } finally {
      setCheckingAll(false);
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
          <h2 className="text-lg font-semibold text-ink">Connections</h2>
          <p className="text-sm text-ink-subtle">
            Manage database and filesystem connections. Database credentials are encrypted at rest.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ConnectionType | "all")}
              className="pl-9 pr-8 py-2 text-sm font-medium text-ink-muted bg-surface-raised border border-line-strong rounded-lg hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="database">Databases</option>
              <option value="filesystem">Filesystems</option>
            </select>
          </div>
          <button
            onClick={handleCheckAll}
            disabled={checkingAll || connections.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink-muted bg-surface-raised border border-line-strong rounded-lg hover:bg-surface-sunken disabled:opacity-50"
            title="Check health of all connections"
          >
            <CheckCircle className={`h-4 w-4 ${checkingAll ? "animate-pulse" : ""}`} />
            {checkingAll ? "Checking..." : "Check All"}
          </button>
          <button
            onClick={fetchConnections}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink-muted bg-surface-raised border border-line-strong rounded-lg hover:bg-surface-sunken disabled:opacity-50"
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
        <div className="text-center py-12 bg-surface-sunken rounded-xl border-2 border-dashed border-line">
          <div className="flex justify-center gap-2 mb-4">
            <Database className="h-10 w-10 text-ink-faint" />
            <FolderOpen className="h-10 w-10 text-ink-faint" />
          </div>
          <h3 className="text-lg font-medium text-ink mb-1">No connections yet</h3>
          <p className="text-sm text-ink-subtle mb-4">
            Add a database or filesystem connection to get started.
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
        <div className="bg-surface-raised rounded-xl border border-line overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-sunken border-b border-line">
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                  Connection
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-ink-subtle uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {connections.map((connection) => {
                const Icon = connection.type === "database" ? Database : FolderOpen;
                const iconBgColor = connection.type === "database" ? "bg-brand-50" : "bg-amber-50";
                const iconColor = connection.type === "database" ? "text-brand-600" : "text-amber-600";

                // Get display info based on type
                let detailsText = "";
                let subText = "";
                if (connection.type === "database" && connection.database_config) {
                  const cfg = connection.database_config;
                  if (cfg.db_type === "sqlite") {
                    detailsText = "Local file";
                    subText = cfg.database;
                  } else {
                    detailsText = `${cfg.host}:${cfg.port}`;
                    subText = cfg.database;
                  }
                } else if (connection.type === "filesystem" && connection.filesystem_config) {
                  detailsText = connection.filesystem_config.path;
                  subText = connection.filesystem_config.path_type === "unc" ? "Network path" : "Local path";
                }

                return (
                  <tr key={connection.id} className="hover:bg-surface-sunken">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${iconBgColor}`}>
                          <Icon className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <div>
                          <div className="font-medium text-ink">{connection.name}</div>
                          {connection.description && (
                            <div className="text-sm text-ink-subtle truncate max-w-[200px]" title={connection.description}>
                              {connection.description}
                            </div>
                          )}
                        </div>
                        {connection.read_only && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-ink-subtle">
                            Read-only
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <ConnectionTypeBadge type={connection.type} />
                        {connection.type === "database" && connection.database_config && (
                          <DatabaseTypeBadge type={connection.database_config.db_type} />
                        )}
                        {connection.type === "filesystem" && connection.filesystem_config && (
                          <PathTypeBadge type={connection.filesystem_config.path_type} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-ink">{detailsText}</div>
                      <div className="text-ink-subtle truncate max-w-[200px]" title={subText}>
                        {subText}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-subtle">
                      {formatRelativeTime(connection.updated_at)}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const testResult = testResults[connection.id];
                        if (testingId === connection.id) {
                          return (
                            <span className="inline-flex items-center gap-1.5 text-sm text-ink-subtle">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Testing...
                            </span>
                          );
                        }
                        if (testResult) {
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 text-sm ${testResult.success ? "text-green-600" : "text-red-600"
                                }`}
                            >
                              {testResult.success ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              {testResult.success ? "Connected" : "Failed"}
                            </span>
                          );
                        }
                        return (
                          <HealthStatusBadge
                            status={connection.status}
                            lastChecked={connection.last_checked}
                            lastError={connection.last_error}
                          />
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Only show test button for database connections */}
                        {connection.type === "database" && (
                          <button
                            onClick={() => handleTestConnection(connection)}
                            disabled={testingId === connection.id}
                            className="p-1.5 text-ink-faint hover:text-brand-600 rounded disabled:opacity-50"
                            title="Test connection"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditConnection(connection)}
                          className="p-1.5 text-ink-faint hover:text-brand-600 rounded"
                          title="Edit connection"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteConnection(connection)}
                          disabled={deletingId === connection.id}
                          className="p-1.5 text-ink-faint hover:text-red-600 rounded disabled:opacity-50"
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
                );
              })}
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
