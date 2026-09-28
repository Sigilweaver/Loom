import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, UserMinus, UserPlus, Users, X } from "lucide-react";
import {
  addGroupMember,
  assignGrantGroupToGroup,
  deleteGroup,
  listGrantGroups,
  listGroupGrantGroups,
  listGroupMembers,
  listUsers,
  removeGrantGroupFromGroup,
  removeGroupMember,
  type GroupResponse,
} from "@api";
import { errorMessage } from "@utils/errors";
import { pluralize } from "@utils/format";
import { roleMeta } from "@components/RoleBadge";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  LoadingState,
  Tabs,
  useConfirm,
  useToast,
} from "@components/ui";
import { EntityHeader } from "../shared/EntityHeader";
import { PickerDialog } from "../shared/PickerDialog";

interface GroupDetailsProps {
  group: GroupResponse;
  onEdit: () => void;
  /** Called after the group was deleted. */
  onDeleted: () => void;
}

// Admin-level accounts already have access to everything, so only regular users join groups.
const NON_MEMBER_ROLES = new Set(["owner", "admin", "auditor"]);

export function GroupDetails({ group, onEdit, onDeleted }: GroupDetailsProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [picker, setPicker] = useState<"member" | "grant-group" | null>(null);

  const membersKey = ["admin", "groups", group.id, "members"] as const;
  const grantGroupsKey = ["admin", "groups", group.id, "grant-groups"] as const;

  const members = useQuery({ queryKey: membersKey, queryFn: () => listGroupMembers(group.id) });
  const grantGroups = useQuery({ queryKey: grantGroupsKey, queryFn: () => listGroupGrantGroups(group.id) });

  // Only fetched while a picker is open.
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers(), enabled: picker === "member" });
  const allGrantGroups = useQuery({
    queryKey: ["admin", "grant-groups"],
    queryFn: () => listGrantGroups(),
    enabled: picker === "grant-group",
  });

  // Member counts appear in the group list too.
  const refreshLists = () => queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete group?",
      message: `"${group.name}" will be deleted. Its members lose the access this group gave them, and its grant group assignments are removed.`,
      confirmLabel: "Delete group",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteGroup(group.id);
      toast.success(`Deleted "${group.name}".`);
      onDeleted();
    } catch (err) {
      toast.error(err, "Failed to delete group");
    }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    const ok = await confirm({
      title: "Remove member?",
      message: `${username} will lose the access that "${group.name}" gives them.`,
      confirmLabel: "Remove member",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await removeGroupMember(group.id, userId);
      await refreshLists();
    } catch (err) {
      toast.error(err, "Failed to remove member");
    }
  };

  const handleRemoveGrantGroup = async (grantGroupId: string, name: string) => {
    const ok = await confirm({
      title: "Remove grant group?",
      message: `Members of "${group.name}" will no longer get the connections in "${name}".`,
      confirmLabel: "Remove grant group",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await removeGrantGroupFromGroup(group.id, grantGroupId);
      await refreshLists();
    } catch (err) {
      toast.error(err, "Failed to remove grant group");
    }
  };

  const memberList = members.data?.members ?? [];
  const grantGroupList = grantGroups.data?.grant_groups ?? [];

  const membersPanel = members.isPending ? (
    <LoadingState />
  ) : members.isError ? (
    <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} />
  ) : (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-subtle">Users in this group get access to its grant groups.</p>
        <Button size="sm" variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setPicker("member")}>
          Add member
        </Button>
      </div>
      {memberList.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" />
      ) : (
        <ul className="space-y-2">
          {memberList.map((member) => (
            <li key={member.user_id}>
              <ListRow
                avatar={member.username}
                title={member.username}
                subtitle={roleMeta(member.role).label}
                action={
                  <IconButton
                    label={`Remove ${member.username} from group`}
                    tone="danger"
                    onClick={() => void handleRemoveMember(member.user_id, member.username)}
                  >
                    <UserMinus className="h-4 w-4" />
                  </IconButton>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const grantGroupsPanel = grantGroups.isPending ? (
    <LoadingState />
  ) : grantGroups.isError ? (
    <ErrorState message={errorMessage(grantGroups.error)} onRetry={() => void grantGroups.refetch()} />
  ) : (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-subtle">Grant groups give this group's members access to bundles of connections.</p>
        <Button size="sm" variant="primary" icon={<Package className="h-4 w-4" />} onClick={() => setPicker("grant-group")}>
          Assign grant group
        </Button>
      </div>
      {grantGroupList.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No grant groups assigned"
          description="Assign a grant group to give this group access to its connections."
        />
      ) : (
        <ul className="space-y-2">
          {grantGroupList.map((gg) => (
            <li key={gg.grant_group_id}>
              <ListRow
                icon={Package}
                title={gg.grant_group_name}
                subtitle={pluralize(gg.connection_count, "connection")}
                action={
                  <IconButton
                    label={`Remove grant group ${gg.grant_group_name}`}
                    tone="danger"
                    onClick={() => void handleRemoveGrantGroup(gg.grant_group_id, gg.grant_group_name)}
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const memberIds = new Set(memberList.map((m) => m.user_id));
  const assignedIds = new Set(grantGroupList.map((g) => g.grant_group_id));

  return (
    <Card padding="none">
      <EntityHeader
        name={group.name}
        description={group.description}
        createdBy={group.created_by}
        createdAt={group.created_at}
        onEdit={onEdit}
        onDelete={() => void handleDelete()}
      />
      <Tabs
        label="Group details"
        tabs={[
          { value: "members", label: "Members", icon: Users, count: memberList.length, content: membersPanel },
          { value: "grant-groups", label: "Grant groups", icon: Package, count: grantGroupList.length, content: grantGroupsPanel },
        ]}
      />

      {picker === "member" && (
        <PickerDialog
          title={`Add member to ${group.name}`}
          items={users.data?.users
            .filter((u) => !memberIds.has(u.id) && !NON_MEMBER_ROLES.has(u.role))
            .map((u) => ({ id: u.id, title: u.username, avatar: u.username, subtitle: roleMeta(u.role).label }))}
          loading={users.isPending}
          loadError={users.error}
          onRetry={() => void users.refetch()}
          icon={Users}
          addLabel="Add"
          emptyTitle="Every eligible user is already a member"
          onAdd={async (item) => {
            await addGroupMember(group.id, item.id);
            await Promise.all([members.refetch(), refreshLists()]);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {picker === "grant-group" && (
        <PickerDialog
          title={`Assign a grant group to ${group.name}`}
          items={allGrantGroups.data?.grant_groups
            .filter((g) => !assignedIds.has(g.id))
            .map((g) => ({ id: g.id, title: g.name, subtitle: pluralize(g.connection_count, "connection") }))}
          loading={allGrantGroups.isPending}
          loadError={allGrantGroups.error}
          onRetry={() => void allGrantGroups.refetch()}
          icon={Package}
          iconTone="info"
          addLabel="Assign"
          emptyTitle="Every grant group is already assigned"
          onAdd={async (item) => {
            await assignGrantGroupToGroup(group.id, item.id);
            await Promise.all([grantGroups.refetch(), refreshLists()]);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </Card>
  );
}
