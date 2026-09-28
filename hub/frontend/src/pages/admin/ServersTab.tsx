/**
 * Servers: the Loom Server instances the Hub can send workflow runs to.
 */

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import {
  deleteServer,
  listServers,
  refreshServer,
  registerServer,
  testServerConnection,
  type ServerResponse,
} from "@api";
import { useHasMinRole } from "@state/authStore";
import { errorMessage, fieldError } from "@utils/errors";
import { formatRelativeTime } from "@utils/format";
import { ServerStatusBadge } from "@components/ServerStatus";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  Modal,
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

interface TestResult {
  success: boolean;
  message: string;
}

function AddServerDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const input = { name, endpoint_url: endpointUrl, auth_token: authToken || undefined };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testServerConnection(input);
      setTestResult({
        success: result.success,
        message: result.success
          ? `Connected. Server version ${result.version || "unknown"}.`
          : result.message || "Could not connect to that server.",
      });
    } catch (err) {
      setTestResult({ success: false, message: errorMessage(err, "Connection test failed") });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await registerServer(input);
      onAdded();
      onClose();
    } catch (err) {
      const next: Record<string, string> = {};
      for (const key of ["name", "endpoint_url", "auth_token"]) {
        const message = fieldError(err, key);
        if (message) next[key] = message;
      }
      setFieldErrors(next);
      if (Object.keys(next).length === 0) setError(errorMessage(err, "Failed to add server"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add server"
      description="Register a Loom Server so the Hub can run workflows on it."
      icon={<Server className="h-5 w-5" />}
      dismissable={!submitting}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={handleTest}
            loading={testing}
            disabled={!endpointUrl || submitting}
          >
            Test connection
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            loading={submitting}
            disabled={!name || !endpointUrl}
          >
            Add server
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required error={fieldErrors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production server 1" required />
        </Field>
        <Field label="Endpoint URL" required error={fieldErrors.endpoint_url} hint="Where the Hub can reach the server.">
          <Input
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="http://localhost:25811"
            required
          />
        </Field>
        <Field label="Auth token (optional)" error={fieldErrors.auth_token} hint="The token the server expects from the Hub.">
          <Input
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            autoComplete="off"
          />
        </Field>

        {testResult && <Alert tone={testResult.success ? "success" : "danger"}>{testResult.message}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}

export function ServersTab() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const canManage = useHasMinRole("admin");

  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Poll so status changes show up without a manual refresh.
  const servers = useQuery({ queryKey: ["admin", "servers"], queryFn: () => listServers(), refetchInterval: 30_000 });

  const reload = () => queryClient.invalidateQueries({ queryKey: ["admin", "servers"] });

  const handleRefresh = async (server: ServerResponse) => {
    setBusyId(server.id);
    try {
      await refreshServer(server.id);
      await reload();
    } catch (err) {
      toast.error(err, `Could not refresh "${server.name}"`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (server: ServerResponse) => {
    const ok = await confirm({
      title: "Remove server?",
      message: `"${server.name}" will no longer receive workflow runs. Its past executions stay in the history.`,
      confirmLabel: "Remove server",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(server.id);
    try {
      await deleteServer(server.id);
      toast.success(`Removed "${server.name}".`);
      await reload();
    } catch (err) {
      toast.error(err, "Failed to remove server");
    } finally {
      setBusyId(null);
    }
  };

  const rows = servers.data?.servers ?? [];
  const addButton = canManage && (
    <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
      Add server
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title="Servers"
        description="Loom Server instances the Hub can send workflow runs to."
        actions={addButton}
      />

      {servers.isPending ? (
        <LoadingState label="Loading servers..." />
      ) : servers.isError ? (
        <ErrorState title="Could not load servers" message={errorMessage(servers.error)} onRetry={() => void servers.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No servers registered"
          description="Register a Loom Server to start running workflows."
          className="rounded-xl border border-line bg-surface-raised"
          action={addButton}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Server</Th>
              <Th>Status</Th>
              <Th className="hidden sm:table-cell">Version</Th>
              <Th className="hidden md:table-cell">Last checked</Th>
              {canManage && <Th className="text-right">Actions</Th>}
            </tr>
          </THead>
          <TBody>
            {rows.map((server) => (
              <Tr key={server.id}>
                <Td>
                  <div className="font-medium text-ink">{server.name}</div>
                  <div className="text-xs break-all text-ink-subtle">{server.endpoint_url}</div>
                </Td>
                <Td>
                  <ServerStatusBadge status={server.status} />
                </Td>
                <Td className="hidden sm:table-cell">{server.version || "-"}</Td>
                <Td className="hidden whitespace-nowrap md:table-cell">
                  {server.last_poll ? formatRelativeTime(server.last_poll) : "Never"}
                </Td>
                {canManage && (
                  <Td className="text-right whitespace-nowrap">
                    <IconButton
                      label={`Check status of ${server.name}`}
                      onClick={() => void handleRefresh(server)}
                      disabled={busyId === server.id}
                    >
                      <RefreshCw className={`h-4 w-4 ${busyId === server.id ? "animate-spin" : ""}`} />
                    </IconButton>
                    <IconButton
                      label={`Remove ${server.name}`}
                      tone="danger"
                      onClick={() => void handleDelete(server)}
                      disabled={busyId === server.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {adding && (
        <AddServerDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            toast.success("Server added.");
            void reload();
          }}
        />
      )}
    </Page>
  );
}
