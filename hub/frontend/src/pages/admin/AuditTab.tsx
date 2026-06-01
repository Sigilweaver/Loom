/**
 * Audit tab for admin panel
 *
 * Lets auditors browse and filter the tamper-evident audit log and run a
 * hash-chain integrity verification. Consumes /audit/events and /audit/verify.
 */

import { useState, useEffect, useCallback } from "react";
import {
    ShieldCheck,
    ShieldAlert,
    Loader2,
    AlertCircle,
    RefreshCw,
    Filter,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronRight as ChevronRightSmall,
    User,
    Hash,
} from "lucide-react";
import {
    listAuditEvents,
    verifyAuditChain,
    type AuditEventResponse,
    type AuditChainVerifyResponse,
} from "@api/client";

const PAGE_SIZE = 25;

function formatTimestamp(isoString: string): string {
    return new Date(isoString).toLocaleString();
}

function shortHash(hash: string | null): string {
    if (!hash) return "-";
    return hash.length > 12 ? `${hash.slice(0, 12)}...` : hash;
}

function VerifyBanner({ result }: { result: AuditChainVerifyResponse }) {
    if (result.valid) {
        return (
            <div className="flex items-start gap-3 p-4 border border-green-200 rounded-lg bg-green-50">
                <ShieldCheck className="flex-shrink-0 w-5 h-5 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800">
                    <p className="font-medium">Hash chain verified</p>
                    <p className="text-green-700">
                        {result.events_checked} event{result.events_checked === 1 ? "" : "s"} checked. No
                        tampering detected.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
            <ShieldAlert className="flex-shrink-0 w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-800">
                <p className="font-medium">Hash chain verification failed</p>
                <p className="text-red-700">
                    {result.error || "The audit chain is inconsistent."} ({result.events_checked} event
                    {result.events_checked === 1 ? "" : "s"} checked.)
                </p>
            </div>
        </div>
    );
}

function AuditRow({ event }: { event: AuditEventResponse }) {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = event.details && Object.keys(event.details).length > 0;

    return (
        <>
            <tr className="hover:bg-surface-sunken">
                <td className="px-4 py-3 align-top">
                    <button
                        onClick={() => setExpanded((e) => !e)}
                        className="text-ink-faint hover:text-ink-muted"
                        aria-label={expanded ? "Collapse details" : "Expand details"}
                    >
                        {expanded ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRightSmall className="w-4 h-4" />
                        )}
                    </button>
                </td>
                <td className="px-4 py-3 text-sm text-ink-muted whitespace-nowrap align-top">
                    {formatTimestamp(event.timestamp)}
                </td>
                <td className="px-4 py-3 align-top">
                    <code className="px-2 py-0.5 text-xs bg-surface-hover rounded text-ink">
                        {event.event_type}
                    </code>
                </td>
                <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-ink-faint" />
                        <div>
                            <p className="text-sm text-ink">{event.actor_identity}</p>
                            <p className="text-xs text-ink-subtle">{event.actor_type}</p>
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3 text-sm text-ink-subtle whitespace-nowrap align-top">
                    {event.client_ip || "-"}
                </td>
                <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1.5 text-ink-subtle">
                        <Hash className="w-3.5 h-3.5" />
                        <code className="text-xs">{shortHash(event.event_hash)}</code>
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-surface-sunken">
                    <td />
                    <td colSpan={5} className="px-4 py-3">
                        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <DetailField label="Event ID" value={event.id} mono />
                            <DetailField label="Auth method" value={event.auth_method} />
                            <DetailField label="Execution ID" value={event.execution_id} mono />
                            <DetailField label="Workflow ID" value={event.workflow_id} mono />
                            <DetailField label="Schedule ID" value={event.schedule_id} mono />
                            <DetailField label="Server ID" value={event.server_id} mono />
                            <DetailField label="Event hash" value={event.event_hash} mono />
                            <DetailField label="Previous hash" value={event.previous_hash} mono />
                            <DetailField label="User agent" value={event.user_agent} />
                        </dl>
                        {hasDetails && (
                            <div className="mt-3">
                                <p className="mb-1 text-xs font-medium tracking-wider text-ink-subtle uppercase">
                                    Details
                                </p>
                                <pre className="p-3 overflow-x-auto text-xs bg-surface-raised border border-line rounded">
                                    {JSON.stringify(event.details, null, 2)}
                                </pre>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

function DetailField({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string | null;
    mono?: boolean;
}) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-wider text-ink-subtle uppercase">{label}</dt>
            <dd className={`text-sm text-ink break-all ${mono ? "font-mono" : ""}`}>
                {value || "-"}
            </dd>
        </div>
    );
}

export function AuditTab() {
    const [events, setEvents] = useState<AuditEventResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [eventType, setEventType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    // Applied filters (committed on submit so typing does not refetch each keystroke)
    const [appliedFilters, setAppliedFilters] = useState<{
        eventType: string;
        fromDate: string;
        toDate: string;
    }>({ eventType: "", fromDate: "", toDate: "" });

    // Chain verification
    const [verifyResult, setVerifyResult] = useState<AuditChainVerifyResponse | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const fetchData = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            try {
                const res = await listAuditEvents({
                    event_type: appliedFilters.eventType || undefined,
                    from_date: appliedFilters.fromDate
                        ? new Date(appliedFilters.fromDate).toISOString()
                        : undefined,
                    to_date: appliedFilters.toDate
                        ? new Date(appliedFilters.toDate).toISOString()
                        : undefined,
                    page: page + 1,
                    page_size: PAGE_SIZE,
                });
                setEvents(res.events);
                setTotal(res.total);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load audit events");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [appliedFilters, page]
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const applyFilters = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        setAppliedFilters({ eventType, fromDate, toDate });
    };

    const clearFilters = () => {
        setEventType("");
        setFromDate("");
        setToDate("");
        setPage(0);
        setAppliedFilters({ eventType: "", fromDate: "", toDate: "" });
    };

    const runVerify = async () => {
        setVerifying(true);
        setVerifyError(null);
        setVerifyResult(null);
        try {
            const result = await verifyAuditChain();
            setVerifyResult(result);
        } catch (err) {
            setVerifyError(err instanceof Error ? err.message : "Failed to verify audit chain");
        } finally {
            setVerifying(false);
        }
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-ink">Audit Log</h2>
                    <p className="text-sm text-ink-subtle">
                        Tamper-evident record of security-relevant events.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink-muted hover:text-ink disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    <button
                        onClick={runVerify}
                        disabled={verifying}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
                    >
                        {verifying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <ShieldCheck className="w-4 h-4" />
                        )}
                        Verify chain
                    </button>
                </div>
            </div>

            {/* Verify result / error */}
            {verifyError && (
                <div className="flex items-center gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
                    <AlertCircle className="flex-shrink-0 w-5 h-5 text-red-500" />
                    <p className="text-sm text-red-700">{verifyError}</p>
                </div>
            )}
            {verifyResult && <VerifyBanner result={verifyResult} />}

            {/* Filters */}
            <form
                onSubmit={applyFilters}
                className="flex flex-wrap items-end gap-3 p-4 bg-surface-raised border border-line rounded-lg"
            >
                <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-subtle">
                        <Filter className="w-3.5 h-3.5" />
                        Event type
                    </label>
                    <input
                        type="text"
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        placeholder="e.g. execution.requested"
                        className="border border-line-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-ink-subtle">From</label>
                    <input
                        type="datetime-local"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="border border-line-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-ink-subtle">To</label>
                    <input
                        type="datetime-local"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="border border-line-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                </div>
                <button
                    type="submit"
                    className="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-gray-800 hover:bg-gray-900"
                >
                    Apply
                </button>
                <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
                >
                    Clear
                </button>
            </form>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
                    <AlertCircle className="flex-shrink-0 w-5 h-5 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                </div>
            ) : events.length === 0 ? (
                <div className="p-8 text-center bg-surface-raised border border-line rounded-lg">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-ink-faint" />
                    <p className="text-ink-subtle">No audit events found</p>
                </div>
            ) : (
                <div className="overflow-hidden bg-surface-raised border border-line rounded-lg">
                    <table className="min-w-full divide-y divide-line">
                        <thead className="bg-surface-sunken">
                            <tr>
                                <th className="w-8 px-4 py-3" />
                                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-ink-subtle uppercase">
                                    Timestamp
                                </th>
                                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-ink-subtle uppercase">
                                    Event
                                </th>
                                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-ink-subtle uppercase">
                                    Actor
                                </th>
                                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-ink-subtle uppercase">
                                    Client IP
                                </th>
                                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-ink-subtle uppercase">
                                    Hash
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface-raised divide-y divide-line">
                            {events.map((event) => (
                                <AuditRow key={event.id} event={event} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-line">
                    <p className="text-sm text-ink-subtle">
                        Page {page + 1} of {totalPages} ({total} events)
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-2 border border-line rounded hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="p-2 border border-line rounded hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
