import type { FormEvent, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { X } from "lucide-react";
import { Button } from "./Button";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Icon shown in a tinted tile beside the title. */
  icon?: ReactNode;
  size?: keyof typeof sizes;
  children: ReactNode;
  /** Action buttons, right aligned in a footer bar. */
  footer?: ReactNode;
  /** Wraps body and footer in a form so the primary button submits it. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Prevent closing (Escape, overlay click, close button) while work is in flight. */
  dismissable?: boolean;
}

/**
 * Dialog built on Radix, which provides focus trapping, focus return, Escape to
 * close, scroll locking and the correct ARIA roles.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = "md",
  children,
  footer,
  onSubmit,
  dismissable = true,
}: ModalProps) {
  const content = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          {footer}
        </div>
      )}
    </>
  );
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && dismissable && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className={clsx(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface-raised shadow-xl",
            sizes[size]
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {icon && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <Dialog.Title className="truncate text-lg font-semibold text-ink">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-sm text-ink-subtle">
                    {description}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={!dismissable}
                className="-m-1.5 rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {onSubmit ? (
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              {content}
            </form>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">{content}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  /** Show a spinner on the confirm button while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation prompt for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissable={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{message}</div>
    </Modal>
  );
}
