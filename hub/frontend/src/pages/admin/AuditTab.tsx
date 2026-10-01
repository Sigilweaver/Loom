/**
 * Audit log: browse and filter the tamper-evident event log and verify its
 * hash chain. Consumes /audit/events and /audit/verify.
 */

import { Fragment, useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, RefreshCw, ShieldCheck } from "lucide-react";
import { listAuditEvents, verifyAuditChain, type AuditEventResponse } from "@api";
import { errorMessage } from "@utils/errors";
import { formatDateTime, pluralize } from "@utils/format";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Pagination,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@components/ui";

const PAGE_SIZE = 25;

interface Filters {
  eventType: string;
  fromDate: string;
  toDate: string;
}

const NO_FILTERS: Filters = { eventType: "", fromDate: "", toDate: "" };

function shortHash(hash: string | null): string {
  if (!hash) return "-";
  return hash.length > 12 ? `${hash.slice(0, 12)}...` : hash;
}

function Detail({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wider text-ink-subtle uppercase">{label}</dt>
      <dd className={`text-sm break-all text-ink ${mono ? "font-mono" : ""}`}>{value || "-"}</dd>
    </div>
  );
}

/** Show an event's free-form details as labelled values instead of a JSON dump. */
function EventDetails({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-xs font-medium tracking-wider text-ink-subtle uppercase">Details</h4>
      <dl className="grid grid-cols-1 gap-2 rounded-lg border border-line bg-surface-raised p-3 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <Detail
            key={key}
            label={key.replace(/_/g, " ")}
            value={typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}
            mono={typeof value === "object"}
          />
        ))}
      </dl>
    </div>
  );
}

function AuditRow({ event }: { event: AuditEventResponse }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Fragment>
      <Tr>
        <Td className="w-10 align-top">
          <IconButton
            label={expanded ? "Hide event details" : "Show event details"}
            aria-expanded={expanded}
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </IconButton>
        </Td>
        <Td className="align-top whitespace-nowrap">{formatDateTime(event.timestamp)}</Td>
        <Td className="align-top">
          <code className="rounded bg-surface-hover px-2 py-0.5 font-mono text-xs text-ink">{event.event_type}</code>
        </Td>
        <Td className="align-top">
          <p className="text-ink">{event.actor_identity}</p>
          <p className="text-xs text-ink-subtle">{event.actor_type}</p>
        </Td>
        <Td className="hidden align-top whitespace-nowrap md:table-cell">{event.client_ip || "-"}</Td>
        <Td className="hidden align-top lg:table-cell">
          <code className="font-mono text-xs" title={event.event_hash}>
            {shortHash(event.event_hash)}
          </code>
        </Td>
      </Tr>
      {expanded && (
        <tr className="bg-surface-sunken">
          <td />
          <td colSpan={5} className="px-4 py-3">
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Detail label="Event ID" value={event.id} mono />
              <Detail label="Auth method" value={event.auth_method} />
              <Detail label="Execution ID" value={event.execution_id} mono />
              <Detail label="Workflow ID" value={event.workflow_id} mono />
              <Detail label="Schedule ID" value={event.schedule_id} mono />
              <Detail label="Server ID" value={event.server_id} mono />
              <Detail label="Event hash" value={event.event_hash} mono />
              <Detail label="Previous hash" value={event.previous_hash} mono />
              <Detail label="User agent" value={event.user_agent} />
            </dl>
            <EventDetails details={event.details ?? {}} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function AuditTab() {
  const [page, setPage] = useState(0);
  // Form values, applied on submit so typing does not refetch on every keystroke.
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);

  const events = useQuery({
    queryKey: ["admin", "audit", applied, page],
    queryFn: () =>
      listAuditEvents({
        event_type: applied.eventType || undefined,
        from_date: applied.fromDate ? new Date(applied.fromDate).toISOString() : undefined,
        to_date: applied.toDate ? new Date(applied.toDate).toISOString() : undefined,
        page: page + 1,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const verify = useMutation({ mutationFn: () => verifyAuditChain() });

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setApplied(draft);
  };

  const clearFilters = () => {
    setDraft(NO_FILTERS);
    setApplied(NO_FILTERS);
    setPage(0);
  };

  const rows = events.data?.events ?? [];
  const result = verify.data;

  return (
    <Page>
      <PageHeader
        title="Audit log"
        description="Tamper-evident record of security-relevant events."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw className={`h-4 w-4 ${events.isFetching ? "animate-spin" : ""}`} />}
              onClick={() => void events.refetch()}
              disabled={events.isFetching}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<ShieldCheck className="h-4 w-4" />}
              loading={verify.isPending}
              onClick={() => verify.mutate()}
            >
              Verify chain
            </Button>
          </>
        }
      />

      {verify.isError && (
        <Alert className="mb-4" onDismiss={() => verify.reset()}>
          {errorMessage(verify.error, "Failed to verify the audit chain")}
        </Alert>
      )}
      {result &&
        (result.valid ? (
          <Alert tone="success" className="mb-4" title="Hash chain verified" onDismiss={() => verify.reset()}>
            {pluralize(result.events_checked, "event")} checked. No tampering detected.
          </Alert>
        ) : (
          <Alert className="mb-4" title="Hash chain verification failed" onDismiss={() => verify.reset()}>
            {result.error || "The audit chain is inconsistent."} ({pluralize(result.events_checked, "event")} checked.)
          </Alert>
        ))}

      <form
        onSubmit={applyFilters}
        aria-label="Filter audit events"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface-raised p-4"
      >
        <Field label="Event type" className="w-full sm:w-64">
          <Input
            value={draft.eventType}
            onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}
            placeholder="e.g. execution.requested"
          />
        </Field>
        <Field label="From" className="w-full sm:w-auto">
          <Input
            type="datetime-local"
            value={draft.fromDate}
            onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })}
          />
        </Field>
        <Field label="To" className="w-full sm:w-auto">
          <Input
            type="datetime-local"
            value={draft.toDate}
            onChange={(e) => setDraft({ ...draft, toDate: e.target.value })}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">
            Apply
          </Button>
          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </form>

      {events.isPending ? (
        <LoadingState label="Loading audit events..." />
      ) : events.isError && !events.data ? (
        <ErrorState title="Could not load audit events" message={errorMessage(events.error)} onRetry={() => void events.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No audit events found"
          description={
            applied.eventType || applied.fromDate || applied.toDate
              ? "Try widening the filters."
              : "Security events, such as a server requesting access for a run, appear here as they happen."
          }
          className="rounded-xl border border-line bg-surface-raised"
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th className="w-10">
                  <span className="sr-only">Details</span>
                </Th>
                <Th>Time</Th>
                <Th>Event</Th>
                <Th>Actor</Th>
                <Th className="hidden md:table-cell">Client IP</Th>
                <Th className="hidden lg:table-cell">Hash</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((event) => (
                <AuditRow key={event.id} event={event} />
              ))}
            </TBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={events.data?.total ?? 0} onPageChange={setPage} noun="events" />
        </>
      )}
    </Page>
  );
}
