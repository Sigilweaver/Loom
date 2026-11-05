import * as React from 'react';
import clsx from 'clsx';

/**
 * Button and IconButton: the shared action primitives.
 *
 * Variants:
 * - primary:   the one main action in a view (accent fill)
 * - secondary: other actions (bordered surface)
 * - ghost:     low-emphasis actions in toolbars and lists
 * - danger:    destructive actions (error colors)
 *
 * All variants use theme tokens, show a keyboard focus ring and dim when
 * disabled, so they look right in every theme.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const base = clsx(
  'inline-flex items-center justify-center gap-1.5 shrink-0 rounded font-medium',
  'transition-colors select-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-theme-surface-panel',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
);

const variantClasses: Record<ButtonVariant, string> = {
  primary: clsx(
    'bg-theme-interactive-accent text-theme-text-on-accent border border-transparent',
    'hover:bg-theme-interactive-accent-hover'
  ),
  secondary: clsx(
    'bg-theme-surface-elevated text-theme-text-primary border border-theme-border-primary',
    'hover:bg-theme-bg-hover hover:border-theme-border-focus'
  ),
  ghost: clsx(
    'bg-transparent text-theme-text-secondary border border-transparent',
    'hover:bg-theme-surface-hover hover:text-theme-text-primary'
  ),
  danger: clsx(
    'bg-theme-status-error-bg text-theme-status-error-text border border-theme-status-error-border',
    'hover:border-theme-status-error-text'
  ),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
};

export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string
): string {
  return clsx(base, variantClasses[variant], sizeClasses[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name, also shown as the tooltip. Required: the button has no text. */
  label: string;
  variant?: Exclude<ButtonVariant, 'primary'>;
  size?: ButtonSize;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'ghost', size = 'sm', className, type = 'button', title, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={clsx(
        base,
        variant === 'danger'
          ? 'bg-transparent text-theme-text-secondary border border-transparent hover:bg-theme-status-error-bg hover:text-theme-status-error-text'
          : variantClasses[variant],
        iconSizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
IconButton.displayName = 'IconButton';
