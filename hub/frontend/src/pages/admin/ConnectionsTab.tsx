/**
 * Connections: the database and filesystem connections the Hub can provide to
 * servers. Database credentials are encrypted at rest and only sent to a server
 * while a workflow runs.
 */

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Database, Pencil, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import {
  checkAllConnectionsHealth,
  deleteConnection,
  listConnections,
  testConnection,
  type ConnectionResponse,
  type ConnectionType,
} from "@api";
import { errorMessage } from "@utils/errors";
import { formatRelativeTime } from "@utils/format";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Page,
  PageHeader,
  Select,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  useConfirm,
  useToast,
} from "@components/ui";
import { ConnectionDialog } from "./connections/ConnectionDialog";
import {
  ConnectionTypeBadge,
  ConnectionTypeIcon,
  DatabaseTypeBadge,
  HealthStatusBadge,
  PathTypeBadge,
} from "./connections/badges";

type Filter = ConnectionType | "all";

interface TestOutcome {
  success: boolean;
  message: string;
}

/** What the connection points at: host and database, or the filesystem path. */
function describeTarget(connection: ConnectionResponse): { primary: string; secondary: string } {
  const db = connection.database_config;
  const fs = connection.filesystem_config;
  if (connection.type === "database" && db) {
    return db.db_type === "sqlite"
      ? { primary: "Local file", secondary: db.database }
      : { primary: `${db.host}:${db.port}`, secondary: db.database };
  }
  if (connection.type === "filesystem" && fs) {
    return {
      primary: fs.path,
      secondary: fs.path_type === "unc" ? "Network path" : "Local path",
    };
  }
  return { primary: "", secondary: "" };
}

export function ConnectionsTab() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>("all");
  // `undefined` = closed, `null` = adding, a connection = editing it.
  const [dialog, setDialog] = useState<ConnectionResponse | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [testOutcomes, setTestOutcomes] = useState<Record<string, TestOutcome>>({});

  const connections = useQuery({
    queryKey: ["admin", "connections", filter],
    queryFn: () => listConnections(filter === "all" ? undefined : filter),
    placeholderData: keepPreviousData,
  });

  const reload = () => queryClient.invalidateQueries({ queryKey: ["admin", "connections"] });

  const handleTest = async (connection: ConnectionResponse) => {
    setTestingId(connection.id);
    try {
      const result = await testConnection(connection.id);
      setTestOutcomes((current) => ({ ...current, [connection.id]: result }));
    } catch (err) {
      setTestOutcomes((current) => ({
        ...current,
        [connection.id]: { success: false, message: errorMessage(err, "Test failed") },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (connection: ConnectionResponse) => {
    const ok = await confirm({
      title: "Delete connection?",
      message: `"${connection.name}" will be removed and workflows can no longer use it. This cannot be undone.`,
      confirmLabel: "Delete connection",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(connection.id);
    try {
      await deleteConnection(connection.id);
      toast.success(`Deleted "${connection.name}".`);
      await reload();
    } catch (err) {
      toast.error(err, "Failed to delete connection");
    } finally {
      setBusyId(null);
    }
  };

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      await checkAllConnectionsHealth();
      setTestOutcomes({});
      await reload();
    } catch (err) {
      toast.error(err, "Failed to check connections");
    } finally {
      setCheckingAll(false);
    }
  };

  const rows = connections.data?.connections ?? [];
  const addButton = (
    <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDialog(null)}>
      Add connection
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title="Connections"
        description="Database and filesystem connections the Hub can provide to servers. Database credentials are encrypted at rest."
        actions={
          <>
            <Button
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => void handleCheckAll()}
              loading={checkingAll}
              disabled={rows.length === 0}
            >
              Check all
            </Button>
            <Button
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void connections.refetch()}
              loading={connections.isFetching && !checkingAll}
            >
              Refresh
            </Button>
            {addButton}
          </>
        }
      />

      <div className="mb-4">
        <Select
          aria-label="Filter by type"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-full sm:w-48"
        >
          <option value="all">All types</option>
          <option value="database">Databases</option>
          <option value="filesystem">Filesystems</option>
        </Select>
      </div>

      {connections.isPending ? (
        <LoadingState label="Loading connections..." />
      ) : connections.isError && !connections.data ? (
        <ErrorState
          title="Could not load connections"
          message={errorMessage(connections.error)}
          onRetry={() => void connections.refetch()}
        />
      ) : (
        <>
          {connections.isError && (
            <Alert className="mb-4">{errorMessage(connections.error, "Could not refresh connections")}</Alert>
          )}
          {rows.length === 0 ? (
            <EmptyState
              icon={Database}
              title={filter === "all" ? "No connections yet" : "No connections of this type"}
              description="Add a database or filesystem connection to get started."
              className="rounded-xl border border-line bg-surface-raised"
              action={addButton}
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Connection</Th>
                  <Th>Type</Th>
                  <Th className="hidden md:table-cell">Details</Th>
                  <Th className="hidden lg:table-cell">Updated</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((connection) => {
                  const target = describeTarget(connection);
                  const outcome = testOutcomes[connection.id];
                  const busy = busyId === connection.id;
                  const testing = testingId === connection.id;
                  return (
                    <Tr key={connection.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="rounded-lg bg-accent-soft p-2 text-accent-ink">
                            <ConnectionTypeIcon type={connection.type} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-medium text-ink">
                              {connection.name}
                              {connection.read_only && <Badge>Read-only</Badge>}
                            </div>
                            {connection.description && (
                              <div
                                className="max-w-[200px] truncate text-sm text-ink-subtle"
                                title={connection.description}
                              >
                                {connection.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1">
                          <ConnectionTypeBadge type={connection.type} />
                          {connection.database_config && (
                            <DatabaseTypeBadge type={connection.database_config.db_type} />
                          )}
                          {connection.filesystem_config && (
                            <PathTypeBadge type={connection.filesystem_config.path_type} />
                          )}
                        </div>
                      </Td>
                      <Td className="hidden md:table-cell">
                        <div className="max-w-[240px] truncate text-ink" title={target.primary}>
                          {target.primary}
                        </div>
                        <div className="max-w-[240px] truncate text-xs text-ink-subtle" title={target.secondary}>
                          {target.secondary}
                        </div>
                      </Td>
                      <Td className="hidden whitespace-nowrap lg:table-cell">
                        {formatRelativeTime(connection.updated_at)}
                      </Td>
                      <Td>
                        {testing ? (
                          <Badge>Testing...</Badge>
                        ) : outcome ? (
                          <Badge
                            tone={outcome.success ? "success" : "danger"}
                            icon={
                              outcome.success ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )
                            }
                            title={outcome.message}
                          >
                            {outcome.success ? "Connected" : "Failed"}
                          </Badge>
                        ) : (
                          <HealthStatusBadge
                            status={connection.status}
                            lastChecked={connection.last_checked}
                            lastError={connection.last_error}
                          />
                        )}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        {connection.type === "database" && (
                          <IconButton
                            label={`Test ${connection.name}`}
                            onClick={() => void handleTest(connection)}
                            disabled={testing || busy}
                          >
                            <RefreshCw className={`h-4 w-4 ${testing ? "animate-spin" : ""}`} />
                          </IconButton>
                        )}
                        <IconButton label={`Edit ${connection.name}`} onClick={() => setDialog(connection)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={`Delete ${connection.name}`}
                          tone="danger"
                          onClick={() => void handleDelete(connection)}
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {dialog !== undefined && (
        <ConnectionDialog
          key={dialog?.id ?? "new"}
          connection={dialog}
          onClose={() => setDialog(undefined)}
          onSaved={(saved) => {
            toast.success(`Saved "${saved.name}".`);
            void reload();
          }}
        />
      )}
    </Page>
  );
}
