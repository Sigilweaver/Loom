/**
 * App-wide feedback: promise-based confirmation dialogs (replacing
 * window.confirm) and toast notifications (replacing window.alert).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { errorMessage } from "@utils/errors";
import { ConfirmDialog } from "./Modal";

// -----------------------------------------------------------------------------
// Confirm
// -----------------------------------------------------------------------------

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// -----------------------------------------------------------------------------
// Toasts
// -----------------------------------------------------------------------------

interface ToastItem {
  id: number;
  tone: "success" | "error";
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  /** Accepts an Error/ApiError (rendered with `errorMessage`) or a string. */
  error: (error: unknown, fallback?: string) => void;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);
const ToastContext = createContext<ToastApi | null>(null);

const TOAST_MS = 5000;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((tone: ToastItem["tone"], message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-3), { id, tone, message }]);
  }, []);

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (error, fallback) =>
        push("error", typeof error === "string" ? error : errorMessage(error, fallback)),
    }),
    [push]
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      <ToastContext.Provider value={toast}>
        {children}
        <ConfirmDialog
          open={pending !== null}
          title={pending?.title ?? ""}
          message={pending?.message}
          confirmLabel={pending?.confirmLabel}
          tone={pending?.tone}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-96"
        >
          {toasts.map((item) => (
            <Toast key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  const isError = item.tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
        isError
          ? "border-danger-line bg-surface-raised text-danger-ink"
          : "border-success-line bg-surface-raised text-success-ink"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words text-ink">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="-m-1 rounded p-1 text-ink-subtle hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Ask the user to confirm an action. Resolves true if they confirmed. */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <FeedbackProvider>");
  return confirm;
}

/** Show a transient success or error notification. */
export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <FeedbackProvider>");
  return toast;
}
