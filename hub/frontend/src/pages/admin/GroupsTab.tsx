/**
 * User groups: who belongs to which group, and which grant groups
 * (bundles of connections) each group can use.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { createGroup, listGroups, updateGroup, type GroupResponse } from "@api";
import { errorMessage } from "@utils/errors";
import { pluralize } from "@utils/format";
import { ErrorState, LoadingState, Page, PageHeader, useToast } from "@components/ui";
import { GroupDetails } from "./groups/GroupDetails";
import { EntityDialog } from "./shared/EntityDialog";
import { MasterDetail } from "./shared/MasterDetail";

export function GroupsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // undefined: dialog closed, null: creating, otherwise the group being edited
  const [editing, setEditing] = useState<GroupResponse | null | undefined>(undefined);

  const groups = useQuery({ queryKey: ["admin", "groups"], queryFn: () => listGroups() });
  const list = groups.data?.groups ?? [];
  const selected = list.find((g) => g.id === selectedId);

  return (
    <Page>
      <PageHeader
        title="User groups"
        description="Collect users into groups, then give each group access to connections through grant groups."
      />

      {groups.isPending ? (
        <LoadingState label="Loading groups..." />
      ) : groups.isError ? (
        <ErrorState title="Could not load groups" message={errorMessage(groups.error)} onRetry={() => void groups.refetch()} />
      ) : (
        <MasterDetail
          listTitle="Groups"
          noun="group"
          icon={Users}
          items={list.map((g) => ({
            id: g.id,
            title: g.name,
            description: g.description,
            meta: (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {pluralize(g.member_count, "member")}
              </span>
            ),
          }))}
          selectedId={selected ? selected.id : null}
          onSelect={setSelectedId}
          onCreate={() => setEditing(null)}
          emptyHint="Groups control which users can use which connections."
          placeholderHint="Choose a group from the list to manage its members and grant groups."
        >
          {selected && (
            <GroupDetails
              key={selected.id}
              group={selected}
              onEdit={() => setEditing(selected)}
              onDeleted={() => {
                setSelectedId(null);
                void queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
              }}
            />
          )}
        </MasterDetail>
      )}

      {editing !== undefined && (
        <EntityDialog
          noun="group"
          icon={Users}
          entity={editing}
          namePlaceholder="e.g. Engineering, Finance"
          descriptionPlaceholder="Optional description for this group"
          onClose={() => setEditing(undefined)}
          onSave={async (values) => {
            if (editing) {
              await updateGroup(editing.id, values);
              toast.success("Group updated.");
            } else {
              const created = await createGroup(values);
              setSelectedId(created.id);
              toast.success("Group created.");
            }
            await queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
          }}
        />
      )}
    </Page>
  );
}
