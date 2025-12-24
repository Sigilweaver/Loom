import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import clsx from 'clsx';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /**
   * Optional label to display next to the checkbox
   */
  label?: string;
  /**
   * Optional description text below the label
   */
  description?: string;
}

/**
 * Checkbox component built on Radix UI primitives.
 * Provides accessible checkbox with optional label and description.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, id, ...props }, ref) => {
  const generatedId = React.useId();
  const checkboxId = id || generatedId;

  const checkbox = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={checkboxId}
      className={clsx(
        'peer h-4 w-4 shrink-0 rounded border',
        'border-theme-border-primary bg-theme-bg-input',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-theme-border-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-theme-interactive-accent data-[state=checked]:border-theme-interactive-accent',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={clsx(
          'flex items-center justify-center text-theme-text-on-accent'
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) {
    return checkbox;
  }

  return (
    <div className="flex items-start gap-2">
      {checkbox}
      <div className="grid gap-0.5 leading-none">
        <label
          htmlFor={checkboxId}
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

Checkbox.displayName = 'Checkbox';

export { Checkbox };
