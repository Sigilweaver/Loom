import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Link2, Unlink, Users } from "lucide-react";
import {
  addConnectionToGrantGroup,
  deleteGrantGroup,
  getGrantGroup,
  listConnections,
  removeConnectionFromGrantGroup,
  type ConnectionResponse,
  type GrantGroupSummary,
} from "@api";
import { errorMessage } from "@utils/errors";
import { formatDateTime, pluralize } from "@utils/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  Tabs,
  useConfirm,
  useToast,
} from "@components/ui";
import { EntityHeader } from "../shared/EntityHeader";
import { PickerDialog } from "../shared/PickerDialog";

interface GrantGroupDetailsProps {
  grantGroup: GrantGroupSummary;
  onEdit: () => void;
  onDeleted: () => void;
}

/** One-line description of where a connection points. */
export function describeConnection(conn: ConnectionResponse): string {
  if (conn.type === "database" && conn.database_config) {
    const { db_type, host, port } = conn.database_config;
    return `${db_type} - ${host}:${port}`;
  }
  if (conn.filesystem_config) {
    return `${conn.filesystem_config.path_type} - ${conn.filesystem_config.path}`;
  }
  return conn.type;
}

export function GrantGroupDetails({ grantGroup, onEdit, onDeleted }: GrantGroupDetailsProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [picking, setPicking] = useState(false);

  const detail = useQuery({
    queryKey: ["admin", "grant-groups", grantGroup.id],
    queryFn: () => getGrantGroup(grantGroup.id),
  });
  const connections = useQuery({
    queryKey: ["admin", "connections", "all"],
    queryFn: () => listConnections(),
    enabled: picking,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "grant-groups"] });

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete grant group?",
      message: `"${grantGroup.name}" will be deleted, along with its connection assignments and the access it gave to user groups.`,
      confirmLabel: "Delete grant group",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteGrantGroup(grantGroup.id);
      toast.success(`Deleted "${grantGroup.name}".`);
      onDeleted();
    } catch (err) {
      toast.error(err, "Failed to delete grant group");
    }
  };

  const handleRemoveConnection = async (connectionId: string, name: string) => {
    const ok = await confirm({
      title: "Remove connection?",
      message: `User groups with "${grantGroup.name}" will lose access to "${name}".`,
      confirmLabel: "Remove connection",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await removeConnectionFromGrantGroup(grantGroup.id, connectionId);
      await refresh();
    } catch (err) {
      toast.error(err, "Failed to remove connection");
    }
  };

  const data = detail.data;

  const connectionsPanel = detail.isPending ? (
    <LoadingState />
  ) : detail.isError ? (
    <ErrorState message={errorMessage(detail.error)} onRetry={() => void detail.refetch()} />
  ) : (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-subtle">Every user group with this grant group can use these connections.</p>
        <Button size="sm" variant="primary" icon={<Link2 className="h-4 w-4" />} onClick={() => setPicking(true)}>
          Add connection
        </Button>
      </div>
      {data && data.connections.length === 0 ? (
        <EmptyState icon={Database} title="No connections yet" />
      ) : (
        <ul className="space-y-2">
          {data?.connections.map((conn) => (
            <li key={conn.connection_id}>
              <ListRow
                icon={Database}
                title={conn.name}
                subtitle={conn.type}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger-ink"
                    icon={<Unlink className="h-3.5 w-3.5" />}
                    onClick={() => void handleRemoveConnection(conn.connection_id, conn.name)}
                    aria-label={`Remove connection ${conn.name}`}
                  >
                    Remove
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const userGroupsPanel = detail.isPending ? (
    <LoadingState />
  ) : detail.isError ? (
    <ErrorState message={errorMessage(detail.error)} onRetry={() => void detail.refetch()} />
  ) : (
    <div>
      <p className="mb-4 text-sm text-ink-subtle">
        User groups that use this grant group. Assign it to a group from the User groups page.
      </p>
      {data && data.user_groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Not assigned to any user group"
          description="Assign this grant group from the User groups page."
        />
      ) : (
        <ul className="space-y-2">
          {data?.user_groups.map((ug) => (
            <li key={ug.user_group_id}>
              <ListRow
                icon={Users}
                iconTone="info"
                title={ug.user_group_name}
                subtitle={
                  <>
                    {ug.description && <span className="block text-ink-muted">{ug.description}</span>}
                    {pluralize(ug.member_count, "member")} - assigned {formatDateTime(ug.assigned_at)} by{" "}
                    {ug.assigned_by}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const assigned = new Set(data?.connections.map((c) => c.connection_id));

  return (
    <Card padding="none">
      <EntityHeader
        name={grantGroup.name}
        description={grantGroup.description}
        createdBy={grantGroup.created_by}
        createdAt={grantGroup.created_at}
        onEdit={onEdit}
        onDelete={() => void handleDelete()}
      />
      <Tabs
        label="Grant group details"
        tabs={[
          { value: "connections", label: "Connections", icon: Database, count: data?.connections.length ?? 0, content: connectionsPanel },
          { value: "user-groups", label: "User groups", icon: Users, count: data?.user_groups.length ?? 0, content: userGroupsPanel },
        ]}
      />

      {picking && (
        <PickerDialog
          title={`Add a connection to ${grantGroup.name}`}
          items={connections.data?.connections
            .filter((c) => !assigned.has(c.id))
            .map((c) => ({ id: c.id, title: c.name, subtitle: describeConnection(c) }))}
          loading={connections.isPending}
          loadError={connections.error}
          onRetry={() => void connections.refetch()}
          icon={Database}
          addLabel="Add"
          emptyTitle="Every connection is already in this grant group"
          onAdd={async (item) => {
            await addConnectionToGrantGroup(grantGroup.id, item.id);
            await refresh();
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </Card>
  );
}
