import type { ComponentType, ReactNode } from "react";
import clsx from "clsx";
import { ChevronRight, Plus } from "lucide-react";
import { Button, EmptyState } from "@components/ui";

export interface MasterItem {
  id: string;
  title: string;
  description: string;
  /** Small facts shown under the description, e.g. "3 members". */
  meta: ReactNode;
}

interface MasterDetailProps {
  /** Heading for the list, e.g. "Groups". */
  listTitle: string;
  /** Singular noun for buttons and hints, e.g. "group". */
  noun: string;
  items: MasterItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  icon: ComponentType<{ className?: string }>;
  emptyHint: string;
  placeholderHint: string;
  /** The detail panel for the selected item. */
  children: ReactNode;
}

/** A list of things on the left and the selected thing's details on the right (stacked on phones). */
export function MasterDetail({
  listTitle,
  noun,
  items,
  selectedId,
  onSelect,
  onCreate,
  icon: Icon,
  emptyHint,
  placeholderHint,
  children,
}: MasterDetailProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section aria-label={listTitle} className="w-full shrink-0 lg:w-80">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            {listTitle}
            <span className="text-sm font-normal text-ink-subtle">({items.length})</span>
          </h2>
          <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
            New {noun}
          </Button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            dashed
            icon={Icon}
            title={`No ${noun}s yet`}
            description={emptyHint}
            action={
              <Button variant="primary" onClick={onCreate}>
                Create first {noun}
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const selected = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(item.id)}
                    className={clsx(
                      "w-full rounded-xl border bg-surface-raised p-3 text-left transition-colors",
                      selected
                        ? "border-brand-500 ring-1 ring-brand-500"
                        : "border-line hover:border-line-strong hover:bg-surface-hover/50"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-ink">{item.title}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                    </span>
                    <span className="mt-1 line-clamp-1 block text-sm text-ink-subtle">
                      {item.description || "No description"}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                      {item.meta}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="min-w-0 flex-1">
        {selectedId ? (
          children
        ) : (
          <EmptyState
            dashed
            icon={Icon}
            title={`Select a ${noun}`}
            description={placeholderHint}
            className="py-16"
          />
        )}
      </div>
    </div>
  );
}
