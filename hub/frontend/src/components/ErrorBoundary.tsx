import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@components/ui";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this value changes (e.g. the route), the boundary clears its error. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey?: string;
}

/**
 * Catches render errors in a page so one broken screen shows a recovery
 * message instead of a blank window.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the details for bug reports; the UI only shows a summary.
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
          <AlertCircle className="h-6 w-6 text-danger-ink" />
        </div>
        <h1 className="text-lg font-semibold text-ink">This page hit a problem</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Something unexpected went wrong while showing this page. Reloading usually fixes it.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    );
  }
}
