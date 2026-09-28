import { Fragment, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { MoreVertical } from "lucide-react";
import { IconButton } from "./Button";

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Render a divider above this item. */
  separated?: boolean;
}

export interface ActionMenuProps {
  /** Accessible name for the trigger, e.g. "Actions for Daily Sales". */
  label: string;
  items: ActionMenuItem[];
  className?: string;
}

/**
 * Overflow ("...") menu. Radix handles keyboard navigation, typeahead,
 * Escape and focus return.
 */
export function ActionMenu({ label, items, className }: ActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton label={label} className={className} onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-50 min-w-40 overflow-hidden rounded-lg border border-line bg-surface-raised py-1 shadow-lg"
        >
          {items.map((item) => (
            <Fragment key={item.label}>
              {item.separated && <DropdownMenu.Separator className="my-1 h-px bg-line" />}
              <DropdownMenu.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                  item.tone === "danger"
                    ? "text-danger-ink data-[highlighted]:bg-danger-soft"
                    : "text-ink-muted data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink"
                )}
              >
                {item.icon}
                {item.label}
              </DropdownMenu.Item>
            </Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
