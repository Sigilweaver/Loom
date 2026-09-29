import type { ComponentType, ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import clsx from "clsx";

export interface TabItem {
  value: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Small count after the label, e.g. number of members. */
  count?: number;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Accessible name for the tab list. */
  label: string;
  defaultValue?: string;
  className?: string;
}

/** Underlined tabs with arrow-key navigation and proper tab/tabpanel roles (Radix). */
export function Tabs({ tabs, label, defaultValue, className }: TabsProps) {
  return (
    <RadixTabs.Root defaultValue={defaultValue ?? tabs[0]?.value} className={className}>
      <RadixTabs.List aria-label={label} className="flex gap-6 overflow-x-auto border-b border-line px-5">
        {tabs.map(({ value, label: tabLabel, icon: Icon, count }) => (
          <RadixTabs.Trigger
            key={value}
            value={value}
            className={clsx(
              "-mb-px flex items-center gap-2 border-b-2 border-transparent py-3 text-sm font-medium whitespace-nowrap text-ink-subtle transition-colors",
              "hover:text-ink-muted data-[state=active]:border-brand-500 data-[state=active]:text-accent-ink"
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tabLabel}
            {count !== undefined && <span className="text-ink-faint">({count})</span>}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map(({ value, content }) => (
        <RadixTabs.Content key={value} value={value} className="p-5">
          {content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
