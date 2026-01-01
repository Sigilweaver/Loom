/**
 * Servers tab for Admin panel
 *
 * Manages server instances that Hub can dispatch workflows to.
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Server,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import {
  listServers,
  registerServer,
  deleteServer,
  refreshServer,
  testServerConnection,
  type ServerResponse,
} from "@api/client";

type ServerStatus = "online" | "offline" | "unknown";

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    ServerStatus,
    { icon: React.ReactNode; className: string; label: string }
  > = {
    online: {
      icon: <CheckCircle className="h-4 w-4" />,
      className: "bg-green-100 text-green-700",
      label: "Online",
    },
    offline: {
      icon: <XCircle className="h-4 w-4" />,
      className: "bg-red-100 text-red-700",
      label: "Offline",
    },
    unknown: {
      icon: <AlertCircle className="h-4 w-4" />,
      className: "bg-gray-100 text-gray-700",
      label: "Unknown",
    },
  };

  const config = statusConfig[status as ServerStatus] || statusConfig.unknown;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";

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

interface AddServerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (server: ServerResponse) => void;
}

function AddServerDialog({ open, onClose, onAdd }: AddServerDialogProps) {
  const [name, setName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setEndpointUrl("");
    setAuthToken("");
    setTestResult(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testServerConnection({
        name,
        endpoint_url: endpointUrl,
        auth_token: authToken || undefined,
      });

      setTestResult({
        success: result.success,
        message: result.success
          ? `Connected! Version: ${result.version || "unknown"}`
          : result.message || "Connection failed",
      });
    } catch (e) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const server = await registerServer({
        name,
        endpoint_url: endpointUrl,
        auth_token: authToken || undefined,
      });
      onAdd(server);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add server");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Server</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production Server 1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label
              htmlFor="endpoint"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Endpoint URL
            </label>
            <input
              id="endpoint"
              type="url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="http://localhost:25811"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label
              htmlFor="token"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Auth Token{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="token"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Server auth token"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${testResult.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
                }`}
            >
              {testResult.message}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={!endpointUrl || testing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Test Connection
            </button>
            <button
              type="submit"
              disabled={!name || !endpointUrl || submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ServersTab() {
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchServers = async () => {
    try {
      const response = await listServers();
      setServers(response.servers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load servers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();

    // Poll every 30 seconds to get updated status
    const interval = setInterval(fetchServers, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const updated = await refreshServer(id);
      setServers((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (e) {
      console.error("Failed to refresh server:", e);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;

    setDeletingId(id);
    try {
      await deleteServer(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error("Failed to delete server:", e);
      alert(e instanceof Error ? e.message : "Failed to delete server");
    } finally {
      setDeletingId(null);
    }
  };

  const handleServerAdded = (server: ServerResponse) => {
    setServers((prev) => [...prev, server]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header with action button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">
            Manage Sigilweaver Server instances that Hub can dispatch workflows to.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Server
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {servers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Server className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No servers registered
          </h3>
          <p className="text-gray-500 mb-4">
            Register a Sigilweaver Server instance to start executing workflows
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors mx-auto"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Polled
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {servers.map((server) => (
                <tr key={server.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {server.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {server.endpoint_url}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={server.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {server.version || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatRelativeTime(server.last_poll)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRefresh(server.id)}
                        disabled={refreshingId === server.id}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Refresh status"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${refreshingId === server.id ? "animate-spin" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() => handleDelete(server.id, server.name)}
                        disabled={deletingId === server.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove server"
                      >
                        {deletingId === server.id ? (
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

      <AddServerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleServerAdded}
      />
    </div>
  );
}
