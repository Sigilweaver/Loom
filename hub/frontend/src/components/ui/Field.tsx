import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
} from "react";
import clsx from "clsx";

/** Border, background and focus ring shared by every form control. */
export function fieldSurface(invalid?: boolean): string {
  return clsx(
    "rounded-lg border bg-field text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60",
    invalid ? "border-red-500 focus:border-red-500" : "border-line-strong focus:border-brand-500"
  );
}

/** Class names shared by every text-like form control. */
export function controlClasses(invalid?: boolean, className?: string): string {
  return clsx(fieldSurface(invalid), "w-full px-3 text-sm placeholder:text-ink-faint", className);
}

export interface InputProps extends ComponentPropsWithRef<"input"> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, clsx("h-9", className))}
      {...rest}
    />
  );
}

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, clsx("py-2", className))}
      {...rest}
    />
  );
}

export interface SelectProps extends ComponentPropsWithRef<"select"> {
  invalid?: boolean;
}

/** Native select styled to match the other controls. */
export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, clsx("h-9 pr-8", className))}
      {...rest}
    >
      {children}
    </select>
  );
}

export interface CheckboxProps extends Omit<ComponentPropsWithRef<"input">, "type"> {
  label: ReactNode;
  hint?: ReactNode;
}

export function Checkbox({ label, hint, className, id, ...rest }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={clsx("flex items-start gap-2.5", className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-brand-600"
        {...rest}
      />
      <label htmlFor={inputId} className="text-sm text-ink-muted">
        {label}
        {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
      </label>
    </div>
  );
}

export interface FieldProps {
  label: ReactNode;
  /** The single form control this label belongs to. */
  children: ReactElement<{ id?: string; invalid?: boolean; "aria-describedby"?: string }>;
  hint?: ReactNode;
  /** Error message; also marks the control as invalid. */
  error?: string | null;
  required?: boolean;
  className?: string;
}

/**
 * Label + control + hint/error, wired together for assistive technology:
 * the label targets the control, and hint/error are announced with it.
 */
export function Field({ label, children, hint, error, required, className }: FieldProps) {
  const generated = useId();
  const child = Children.only(children);
  const controlId = (isValidElement(child) && child.props.id) || `${generated}-control`;
  const describedBy = error ? `${generated}-error` : hint ? `${generated}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={controlId} className="mb-1 block text-sm font-medium text-ink-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-danger-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {isValidElement(child)
        ? cloneElement(child, {
            id: controlId,
            invalid: error ? true : child.props.invalid,
            "aria-describedby": describedBy,
          })
        : child}
      {error ? (
        <p id={`${generated}-error`} role="alert" className="mt-1 text-xs text-danger-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${generated}-hint`} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
