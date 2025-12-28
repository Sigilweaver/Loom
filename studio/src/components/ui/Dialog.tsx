import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Dialog root component.
 */
const Dialog = DialogPrimitive.Root;

/**
 * DialogTrigger - element that opens the dialog.
 */
const DialogTrigger = DialogPrimitive.Trigger;

/**
 * DialogPortal - renders dialog in a portal.
 */
const DialogPortal = DialogPrimitive.Portal;

/**
 * DialogClose - element that closes the dialog.
 */
const DialogClose = DialogPrimitive.Close;

/**
 * DialogOverlay - background overlay when dialog is open.
 */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={clsx(
      'fixed inset-0 z-50',
      'bg-theme-modal-overlay backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

/**
 * DialogContent - the main dialog container.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
  }
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={clsx(
        'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-lg max-h-[85vh]',
        'rounded-lg border border-theme-border-primary',
        'bg-theme-bg-primary shadow-xl',
        'overflow-hidden flex flex-col',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'focus:outline-none',
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          className={clsx(
            'absolute right-3 top-3 p-1 rounded',
            'text-theme-text-secondary hover:text-theme-text-primary',
            'hover:bg-theme-bg-hover',
            'focus:outline-none focus:ring-1 focus:ring-theme-border-focus',
            'transition-colors'
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = 'DialogContent';

/**
 * DialogHeader - container for title and description.
 */
const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx(
      'flex flex-col gap-1.5 px-6 py-4',
      'border-b border-theme-border-primary',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

/**
 * DialogFooter - container for action buttons.
 */
const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx(
      'flex justify-end gap-2 px-6 py-4',
      'border-t border-theme-border-primary',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/**
 * DialogTitle - accessible title for the dialog.
 */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={clsx(
      'text-lg font-semibold text-theme-text-primary',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

/**
 * DialogDescription - accessible description for the dialog.
 */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={clsx('text-sm text-theme-text-secondary', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
