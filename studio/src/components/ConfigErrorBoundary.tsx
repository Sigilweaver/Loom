import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    onReset?: () => void;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Lightweight error boundary for configuration panels.
 * Catches errors in tool configuration components and displays a recovery UI
 * without crashing the entire application.
 */
export class ConfigErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error(`ConfigErrorBoundary (${this.props.componentName || 'unknown'}):`, error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <div className="w-12 h-12 mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <svg
                            className="w-6 h-6 text-amber-500"
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
                    <h3 className="text-sm font-medium text-theme-text-primary mb-2">
                        Configuration Error
                    </h3>
                    <p className="text-xs text-theme-text-secondary mb-4 max-w-xs">
                        {this.state.error?.message || 'An error occurred while rendering this configuration panel.'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="px-3 py-1.5 text-xs font-medium text-theme-text-primary bg-theme-surface rounded-md border border-theme-border-primary hover:bg-theme-bg-hover transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ConfigErrorBoundary;
