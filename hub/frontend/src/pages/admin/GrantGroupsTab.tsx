/**
 * Grant groups: reusable bundles of connections. Assign a grant group to a
 * user group to give that group's members access to every connection in it.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Package, Users } from "lucide-react";
import { createGrantGroup, listGrantGroups, updateGrantGroup, type GrantGroupSummary } from "@api";
import { errorMessage } from "@utils/errors";
import { pluralize } from "@utils/format";
import { ErrorState, LoadingState, Page, PageHeader, useToast } from "@components/ui";
import { GrantGroupDetails } from "./grantGroups/GrantGroupDetails";
import { EntityDialog } from "./shared/EntityDialog";
import { MasterDetail } from "./shared/MasterDetail";

export function GrantGroupsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // undefined: dialog closed, null: creating, otherwise the grant group being edited
  const [editing, setEditing] = useState<GrantGroupSummary | null | undefined>(undefined);

  const grantGroups = useQuery({ queryKey: ["admin", "grant-groups"], queryFn: () => listGrantGroups() });
  const list = grantGroups.data?.grant_groups ?? [];
  const selected = list.find((g) => g.id === selectedId);

  return (
    <Page>
      <PageHeader
        title="Grant groups"
        description="Bundle connections into reusable sets. Assign a grant group to a user group to give its members access to those connections."
      />

      {grantGroups.isPending ? (
        <LoadingState label="Loading grant groups..." />
      ) : grantGroups.isError ? (
        <ErrorState
          title="Could not load grant groups"
          message={errorMessage(grantGroups.error)}
          onRetry={() => void grantGroups.refetch()}
        />
      ) : (
        <MasterDetail
          listTitle="Grant groups"
          noun="grant group"
          icon={Package}
          items={list.map((g) => ({
            id: g.id,
            title: g.name,
            description: g.description,
            meta: (
              <>
                <span className="flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  {pluralize(g.connection_count, "connection")}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  {pluralize(g.user_group_count, "group")}
                </span>
              </>
            ),
          }))}
          selectedId={selected ? selected.id : null}
          onSelect={setSelectedId}
          onCreate={() => setEditing(null)}
          emptyHint="Grant groups bundle connections into reusable permission sets."
          placeholderHint="Choose a grant group from the list to manage its connections."
        >
          {selected && (
            <GrantGroupDetails
              key={selected.id}
              grantGroup={selected}
              onEdit={() => setEditing(selected)}
              onDeleted={() => {
                setSelectedId(null);
                void queryClient.invalidateQueries({ queryKey: ["admin", "grant-groups"] });
              }}
            />
          )}
        </MasterDetail>
      )}

      {editing !== undefined && (
        <EntityDialog
          noun="grant group"
          icon={Package}
          entity={editing}
          namePlaceholder="e.g. Production read access"
          descriptionPlaceholder="What access does this grant group give?"
          onClose={() => setEditing(undefined)}
          onSave={async (values) => {
            if (editing) {
              await updateGrantGroup(editing.id, values);
              toast.success("Grant group updated.");
            } else {
              const created = await createGrantGroup(values);
              setSelectedId(created.id);
              toast.success("Grant group created.");
            }
            await queryClient.invalidateQueries({ queryKey: ["admin", "grant-groups"] });
          }}
        />
      )}
    </Page>
  );
}
