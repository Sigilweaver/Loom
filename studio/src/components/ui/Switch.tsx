import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import clsx from 'clsx';

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  /**
   * Optional label to display next to the switch
   */
  label?: string;
  /**
   * Optional description text below the label
   */
  description?: string;
}

/**
 * Switch component built on Radix UI primitives.
 * Provides accessible toggle switch with optional label and description.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, description, id, ...props }, ref) => {
  const generatedId = React.useId();
  const switchId = id || generatedId;

  const switchElement = (
    <SwitchPrimitive.Root
      ref={ref}
      id={switchId}
      className={clsx(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
        'border-2 border-transparent transition-colors',
        'bg-theme-bg-tertiary',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-theme-border-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-theme-interactive-accent',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          'pointer-events-none block h-4 w-4 rounded-full shadow-sm',
          'bg-theme-text-primary transition-transform',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) {
    return switchElement;
  }

  return (
    <div className="flex items-start gap-3">
      {switchElement}
      <div className="grid gap-0.5 leading-none">
        <label
          htmlFor={switchId}
          className="text-sm font-medium text-theme-text-primary cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-theme-text-secondary">{description}</p>
        )}
      </div>
    </div>
  );
});

Switch.displayName = 'Switch';

export { Switch };
