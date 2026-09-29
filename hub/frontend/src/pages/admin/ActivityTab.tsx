/**
 * Activity: every user's workflows, schedules and executions, with an owner filter.
 */

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Calendar, FileCode2, Play, RefreshCw } from "lucide-react";
import {
  listExecutions,
  listSchedules,
  listUsers,
  listWorkflows,
  type ExecutionResponse,
  type ScheduleResponse,
  type WorkflowMetadata,
} from "@api";
import { errorMessage } from "@utils/errors";
import { formatDuration, formatRelativeTime } from "@utils/format";
import { ExecutionStatusBadge } from "@components/ExecutionStatus";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@components/ui";

const PAGE_SIZE = 10;

type ActivityView = "workflows" | "schedules" | "executions";

const VIEW_OPTIONS: { value: ActivityView; label: string }[] = [
  { value: "workflows", label: "Workflows" },
  { value: "schedules", label: "Schedules" },
  { value: "executions", label: "Executions" },
];

interface ActivityPage {
  workflows: WorkflowMetadata[];
  schedules: ScheduleResponse[];
  executions: ExecutionResponse[];
  total: number;
}

const EMPTY: ActivityPage = { workflows: [], schedules: [], executions: [], total: 0 };

async function loadActivity(view: ActivityView, user: string, page: number): Promise<ActivityPage> {
  if (view === "workflows") {
    // The Hub returns every workflow at once, so paginate here.
    const res = await listWorkflows({ uploadedBy: user || undefined });
    return { ...EMPTY, workflows: res.workflows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), total: res.total };
  }
  if (view === "schedules") {
    const res = await listSchedules({ createdBy: user || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    return { ...EMPTY, schedules: res.schedules, total: res.total };
  }
  const res = await listExecutions({ triggeredBy: user || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  return { ...EMPTY, executions: res.executions, total: res.total };
}

export function ActivityTab() {
  const [view, setView] = useState<ActivityView>("workflows");
  const [user, setUser] = useState("");
  const [page, setPage] = useState(0);

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const activity = useQuery({
    queryKey: ["admin", "activity", view, user, page],
    queryFn: () => loadActivity(view, user, page),
    placeholderData: keepPreviousData,
  });

  const data = activity.data ?? EMPTY;
  const noun = view;

  return (
    <Page>
      <PageHeader
        title="Activity"
        description="What every user has uploaded, scheduled and run."
        actions={
          <Button
            variant="ghost"
            icon={<RefreshCw className={`h-4 w-4 ${activity.isFetching ? "animate-spin" : ""}`} />}
            onClick={() => void activity.refetch()}
            disabled={activity.isFetching}
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Activity type"
          value={view}
          options={VIEW_OPTIONS}
          onChange={(next) => {
            setView(next);
            setPage(0);
          }}
        />
        <Select
          aria-label="Filter by user"
          value={user}
          onChange={(e) => {
            setUser(e.target.value);
            setPage(0);
          }}
          className="w-full sm:w-56"
        >
          <option value="">All users</option>
          {users.data?.users.map((u) => (
            <option key={u.id} value={u.username}>
              {u.username} ({u.role})
            </option>
          ))}
        </Select>
      </div>

      {activity.isPending ? (
        <LoadingState label="Loading activity..." />
      ) : activity.isError && !activity.data ? (
        <ErrorState title="Could not load activity" message={errorMessage(activity.error)} onRetry={() => void activity.refetch()} />
      ) : data.total === 0 ? (
        <EmptyState
          icon={view === "workflows" ? FileCode2 : view === "schedules" ? Calendar : Play}
          title={`No ${noun} found`}
          description={user ? `${user} has no ${noun}.` : undefined}
          className="rounded-xl border border-line bg-surface-raised"
        />
      ) : (
        <>
          {view === "workflows" && <WorkflowsTable workflows={data.workflows} />}
          {view === "schedules" && <SchedulesTable schedules={data.schedules} />}
          {view === "executions" && <ExecutionsTable executions={data.executions} />}
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} noun={noun} />
        </>
      )}
    </Page>
  );
}

function WorkflowsTable({ workflows }: { workflows: WorkflowMetadata[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Workflow</Th>
          <Th>Owner</Th>
          <Th className="hidden sm:table-cell">Folder</Th>
          <Th className="hidden md:table-cell">Updated</Th>
        </tr>
      </THead>
      <TBody>
        {workflows.map((w) => (
          <Tr key={w.id}>
            <Td>
              <p className="font-medium text-ink">{w.name}</p>
              {w.description && <p className="max-w-xs truncate text-xs text-ink-subtle">{w.description}</p>}
            </Td>
            <Td>{w.uploaded_by}</Td>
            <Td className="hidden sm:table-cell">{w.folder_path}</Td>
            <Td className="hidden whitespace-nowrap md:table-cell">{formatRelativeTime(w.updated_at)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

function SchedulesTable({ schedules }: { schedules: ScheduleResponse[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Workflow</Th>
          <Th>Owner</Th>
          <Th className="hidden sm:table-cell">Schedule</Th>
          <Th>Status</Th>
          <Th className="hidden md:table-cell">Next run</Th>
        </tr>
      </THead>
      <TBody>
        {schedules.map((s) => (
          <Tr key={s.id}>
            <Td>
              <p className="font-medium text-ink">{s.workflow_name || "Unknown workflow"}</p>
              {s.description && <p className="max-w-xs truncate text-xs text-ink-subtle">{s.description}</p>}
            </Td>
            <Td>{s.created_by || "-"}</Td>
            <Td className="hidden sm:table-cell">
              <code className="rounded bg-surface-hover px-2 py-1 font-mono text-xs">{s.cron_expression}</code>
            </Td>
            <Td>
              <Badge tone={s.enabled ? "success" : "neutral"}>{s.enabled ? "Active" : "Paused"}</Badge>
            </Td>
            <Td className="hidden whitespace-nowrap md:table-cell">
              {s.next_trigger_at ? new Date(s.next_trigger_at).toLocaleString() : "-"}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

function ExecutionsTable({ executions }: { executions: ExecutionResponse[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Workflow</Th>
          <Th className="hidden sm:table-cell">Triggered by</Th>
          <Th className="hidden lg:table-cell">Server</Th>
          <Th>Status</Th>
          <Th className="hidden md:table-cell">Started</Th>
          <Th className="hidden md:table-cell">Duration</Th>
        </tr>
      </THead>
      <TBody>
        {executions.map((e) => (
          <Tr key={e.id}>
            <Td className="font-medium text-ink">{e.workflow_name}</Td>
            <Td className="hidden sm:table-cell">{e.triggered_by || "-"}</Td>
            <Td className="hidden lg:table-cell">{e.server_name}</Td>
            <Td>
              <ExecutionStatusBadge status={e.status} />
            </Td>
            <Td className="hidden whitespace-nowrap md:table-cell">{formatRelativeTime(e.queued_at)}</Td>
            <Td className="hidden whitespace-nowrap md:table-cell">{formatDuration(e.duration_seconds)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
