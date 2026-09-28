/**
 * Executions: history of workflow runs with filtering, live status updates,
 * cancellation and failure details.
 */

import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Play, RefreshCw, XCircle } from "lucide-react";
import {
  cancelExecution,
  listExecutions,
  listServers,
  listWorkflows,
  streamExecutions,
  type ExecutionListResponse,
  type ExecutionResponse,
} from "@api";
import { errorMessage } from "@utils/errors";
import { formatDateTime, formatDuration, formatRelativeTime } from "@utils/format";
import { ExecutionStatusBadge, TriggerBadge } from "@components/ExecutionStatus";
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Page,
  PageHeader,
  Pagination,
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

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export function ExecutionsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const [workflowId, setWorkflowId] = useState("");
  const [serverId, setServerId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [live, setLive] = useState(true);
  const [viewingError, setViewingError] = useState<ExecutionResponse | null>(null);

  const listKey = ["executions", { workflowId, serverId, status, page }] as const;

  const executions = useQuery({
    queryKey: listKey,
    queryFn: () =>
      listExecutions({
        workflow_id: workflowId || undefined,
        server_id: serverId || undefined,
        status: status || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  // Filter choices. Users without group assignments have no servers, which is fine.
  const workflows = useQuery({ queryKey: ["executions", "workflows"], queryFn: () => listWorkflows() });
  const servers = useQuery({ queryKey: ["executions", "servers"], queryFn: () => listServers(), retry: false });

  const refetch = executions.refetch;

  // Live updates over Server-Sent Events. Rows already on screen update in
  // place for instant feedback; a short debounced refetch then reconciles
  // ordering, filters and new executions.
  useEffect(() => {
    if (!live) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const reconcile = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void refetch();
      }, 400);
    };

    const unsubscribe = streamExecutions({
      onUpdate: (execution) => {
        queryClient.setQueryData<ExecutionListResponse>(
          ["executions", { workflowId, serverId, status, page }],
          (current) =>
            current && {
              ...current,
              executions: current.executions.map((e) => (e.id === execution.id ? execution : e)),
            }
        );
        reconcile();
      },
      // On disconnect, one refresh keeps the list from going stale.
      onError: reconcile,
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [live, refetch, queryClient, workflowId, serverId, status, page]);

  const resetPage = useCallback(() => setPage(0), []);

  const handleCancel = async (execution: ExecutionResponse) => {
    const ok = await confirm({
      title: "Cancel execution?",
      message: `"${execution.workflow_name}" will be stopped.`,
      confirmLabel: "Cancel execution",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await cancelExecution(execution.id);
      toast.success("Cancellation requested.");
      await refetch();
    } catch (err) {
      toast.error(err, "Failed to cancel execution");
    }
  };

  const copyError = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Error copied to clipboard.");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  const filtered = Boolean(workflowId || serverId || status);
  const rows = executions.data?.executions ?? [];

  return (
    <Page>
      <PageHeader
        title="Executions"
        description="Every workflow run, with its status and how it was started."
        actions={
          <>
            <Checkbox label="Live updates" checked={live} onChange={(e) => setLive(e.target.checked)} />
            <Button
              variant="ghost"
              icon={<RefreshCw className={`h-4 w-4 ${executions.isFetching ? "animate-spin" : ""}`} />}
              onClick={() => void refetch()}
              disabled={executions.isFetching}
            >
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Select
          aria-label="Filter by workflow"
          value={workflowId}
          onChange={(e) => {
            setWorkflowId(e.target.value);
            resetPage();
          }}
          className="w-full sm:w-56"
        >
          <option value="">All workflows</option>
          {workflows.data?.workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by server"
          value={serverId}
          onChange={(e) => {
            setServerId(e.target.value);
            resetPage();
          }}
          className="w-full sm:w-48"
        >
          <option value="">All servers</option>
          {servers.data?.servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            resetPage();
          }}
          className="w-full sm:w-44"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {executions.isPending ? (
        <LoadingState label="Loading executions..." />
      ) : executions.isError && !executions.data ? (
        <ErrorState
          title="Could not load executions"
          message={errorMessage(executions.error)}
          onRetry={() => void refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Play}
          title="No executions found"
          description={
            filtered
              ? "Try adjusting your filters."
              : "Executions will appear here when you run workflows."
          }
          className="rounded-xl border border-line bg-surface-raised"
        />
      ) : (
        <>
          {executions.isError && (
            <ErrorState
              className="mb-4"
              title="Could not refresh"
              message={errorMessage(executions.error)}
              onRetry={() => void refetch()}
            />
          )}
          <Table>
            <THead>
              <tr>
                <Th>Workflow</Th>
                <Th className="hidden md:table-cell">Server</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Trigger</Th>
                <Th>Started</Th>
                <Th className="hidden sm:table-cell">Duration</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((execution) => (
                <Tr key={execution.id}>
                  <Td className="font-medium whitespace-nowrap text-ink">{execution.workflow_name}</Td>
                  <Td className="hidden whitespace-nowrap md:table-cell">{execution.server_name}</Td>
                  <Td>
                    <ExecutionStatusBadge status={execution.status} />
                  </Td>
                  <Td className="hidden whitespace-nowrap lg:table-cell">
                    <span className="flex items-center gap-2">
                      <TriggerBadge type={execution.trigger_type} />
                      {execution.triggered_by && (
                        <span className="text-xs text-ink-subtle">by {execution.triggered_by}</span>
                      )}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap" title={formatDateTime(execution.started_at ?? execution.queued_at)}>
                    {formatRelativeTime(execution.started_at ?? execution.queued_at)}
                  </Td>
                  <Td className="hidden whitespace-nowrap sm:table-cell">{formatDuration(execution.duration_seconds)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {(execution.status === "running" || execution.status === "queued") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger-ink"
                        onClick={() => void handleCancel(execution)}
                      >
                        Cancel
                      </Button>
                    )}
                    {execution.status === "failed" && execution.error_message && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger-ink"
                        onClick={() => setViewingError(execution)}
                      >
                        View error
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <Pagination page={page} pageSize={PAGE_SIZE} total={executions.data?.total ?? 0} onPageChange={setPage} noun="executions" />
        </>
      )}

      {viewingError && (
        <Modal
          open
          onClose={() => setViewingError(null)}
          size="lg"
          title="Execution failed"
          description={viewingError.workflow_name}
          icon={<XCircle className="h-5 w-5 text-danger-ink" />}
          footer={
            <>
              <Button
                icon={<Copy className="h-4 w-4" />}
                onClick={() => void copyError(viewingError.error_message ?? "")}
              >
                Copy error
              </Button>
              <Button variant="primary" onClick={() => setViewingError(null)}>
                Close
              </Button>
            </>
          }
        >
          <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Detail label="Server" value={viewingError.server_name} />
            <Detail
              label="Trigger"
              value={`${viewingError.trigger_type}${viewingError.triggered_by ? ` by ${viewingError.triggered_by}` : ""}`}
            />
            <Detail label="Started" value={formatDateTime(viewingError.started_at)} />
            <Detail label="Duration" value={formatDuration(viewingError.duration_seconds)} />
          </dl>
          <h3 className="mb-2 text-sm font-medium text-ink-muted">Error details</h3>
          <pre className="max-h-72 overflow-auto rounded-lg border border-danger-line bg-danger-soft p-4 font-mono text-sm break-words whitespace-pre-wrap text-danger-ink">
            {viewingError.error_message}
          </pre>
        </Modal>
      )}
    </Page>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-ink-subtle">{label}: </dt>
      <dd className="inline font-medium text-ink">{value}</dd>
    </div>
  );
}
