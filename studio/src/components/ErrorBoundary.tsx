import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree.
 * Without this, React will unmount the entire component tree when an error occurs,
 * resulting in a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log the error to console for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-theme-surface-page p-8">
                    <div className="max-w-2xl w-full bg-theme-surface-elevated rounded-lg border border-theme-border-primary shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-theme-status-error-bg flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-theme-status-error-text"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-theme-text-primary">
                                    Something went wrong
                                </h1>
                                <p className="text-sm text-theme-text-secondary">
                                    An unexpected error occurred in the application.
                                </p>
                            </div>
                        </div>

                        {this.state.error && (
                            <div className="mb-4">
                                <h2 className="text-sm font-medium text-theme-text-primary mb-2">
                                    Error Message
                                </h2>
                                <pre className="text-xs bg-theme-surface p-3 rounded border border-theme-border-secondary text-theme-status-error-text overflow-x-auto whitespace-pre-wrap">
                                    {this.state.error.message}
                                </pre>
                            </div>
                        )}

                        {this.state.errorInfo && (
                            <details className="mb-4">
                                <summary className="text-sm font-medium text-theme-text-primary cursor-pointer hover:text-theme-text-secondary">
                                    Stack Trace
                                </summary>
                                <pre className="mt-2 text-xs bg-theme-surface p-3 rounded border border-theme-border-secondary text-theme-text-tertiary overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 text-sm font-medium text-theme-text-on-accent bg-theme-interactive-accent rounded-md hover:opacity-90 transition-opacity"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface rounded-md border border-theme-border-primary hover:bg-theme-bg-hover transition-colors"
                            >
                                Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
