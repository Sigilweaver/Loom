import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import clsx from 'clsx';

/**
 * Tabs root component - provides context for all tab components.
 */
const Tabs = TabsPrimitive.Root;

/**
 * TabsList - container for tab triggers.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={clsx(
      'inline-flex items-center justify-start gap-1',
      'border-b border-theme-border-primary',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

/**
 * TabsTrigger - individual tab button.
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={clsx(
      'inline-flex items-center justify-center gap-1.5 px-3 py-2',
      'text-sm font-medium text-theme-text-secondary',
      'border-b-2 border-transparent -mb-px',
      'transition-colors',
      'hover:text-theme-text-primary',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-theme-border-focus',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:text-theme-interactive-accent data-[state=active]:border-theme-interactive-accent',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

/**
 * TabsContent - content panel for each tab.
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={clsx(
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-theme-border-focus',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
