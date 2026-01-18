/**
 * RemoteFileBrowser Component
 *
 * A file browser dialog for selecting files from a remote Server.
 * In Hub mode, uses browse tokens to access files within granted paths.
 * In non-Hub modes, uses the Server's configured allowed_file_paths.
 *
 * Browse tokens are single-use per security model, so the component
 * accepts a getToken function that is called before each API request.
 *
 * Usage:
 * ```tsx
 * <RemoteFileBrowser
 *   open={isOpen}
 *   getToken={async () => {
 *     const response = await hubClient.requestToken();
 *     return { token: response.token, serverUrl: response.server_endpoint };
 *   }}
 *   onSelect={(path) => console.log('Selected:', path)}
 *   onClose={() => setOpen(false)}
 *   fileTypes={['csv', 'tsv', 'xlsx']}
 *   title="Select Data File"
 * />
 * ```
 */

import React, { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import {
    Folder,
    File,
    ChevronRight,
    RefreshCw,
    Home,
    ArrowUp,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '../ui/Dialog';
import {
    listFileRoots,
    listFiles,
    type RootEntry,
    type FileEntry,
    type ListFilesResponse,
} from '../../api/backend';
import { createLogger } from '../../utils/logger';

const logger = createLogger('RemoteFileBrowser');

// =============================================================================
// Types
// =============================================================================

export interface RemoteFileBrowserProps {
    /** Whether the dialog is open */
    open: boolean;
    /**
     * Function to get a fresh browse token for each operation.
     * Browse tokens are single-use, so this is called before every API request.
     * Returns { token, serverUrl } or throws on error.
     */
    getToken: () => Promise<{ token: string; serverUrl: string }>;
    /** Callback when a file is selected */
    onSelect: (path: string) => void;
    /** Callback when the dialog is closed */
    onClose: () => void;
    /** Optional file extensions to filter (without dot, e.g., ['csv', 'xlsx']) */
    fileTypes?: string[];
    /** Dialog title */
    title?: string;
    /** Dialog description */
    description?: string;
    /** Whether to allow selecting directories (default: false) */
    allowDirectories?: boolean;
}

interface BreadcrumbItem {
    name: string;
    path: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatFileSize(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function pathToBreadcrumbs(path: string, roots: RootEntry[]): BreadcrumbItem[] {
    // Find the matching root
    const root = roots.find((r) => path.startsWith(r.path));
    if (!root) return [{ name: path, path }];

    // Build breadcrumb trail from root to current path
    const items: BreadcrumbItem[] = [];
    const rootName = root.path.split('/').filter(Boolean).pop() || root.path;
    items.push({ name: rootName, path: root.path });

    // Add intermediate directories
    const relativePath = path.slice(root.path.length);
    const parts = relativePath.split('/').filter(Boolean);
    let currentPath = root.path;

    for (const part of parts) {
        currentPath = currentPath.endsWith('/')
            ? currentPath + part
            : currentPath + '/' + part;
        items.push({ name: part, path: currentPath });
    }

    return items;
}

// =============================================================================
// Component
// =============================================================================

export const RemoteFileBrowser: React.FC<RemoteFileBrowserProps> = ({
    open,
    getToken,
    onSelect,
    onClose,
    fileTypes,
    title = 'Select File',
    description = 'Choose a file from the server',
    allowDirectories = false,
}) => {
    // State
    const [roots, setRoots] = useState<RootEntry[]>([]);
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [loadedPath, setLoadedPath] = useState<string | null>(null); // Track what's actually loaded
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Track if initial load has happened to prevent double-loading in StrictMode
    const [initialized, setInitialized] = useState(false);

    // Load roots on open (only once)
    useEffect(() => {
        if (open && !initialized) {
            setInitialized(true);
            loadRoots();
        }
        // Reset when closed
        if (!open) {
            setInitialized(false);
            setRoots([]);
            setCurrentPath(null);
            setLoadedPath(null);
            setEntries([]);
            setSelectedPath(null);
            setError(null);
        }
    }, [open]);

    const loadRoots = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Get a fresh token for this request
            const { token, serverUrl: url } = await getToken();
            const loadedRoots = await listFileRoots(url, token);
            setRoots(loadedRoots);

            // If no roots, show error
            if (loadedRoots.length === 0) {
                setError('No browsable directories available');
                setEntries([]);
                setCurrentPath(null);
            } else if (loadedRoots.length === 1) {
                // Auto-navigate to the only root
                const firstRoot = loadedRoots[0];
                if (firstRoot) {
                    // Set currentPath to trigger the load effect
                    setCurrentPath(firstRoot.path);
                }
            }
            // If multiple roots, let user choose (don't auto-navigate)
        } catch (err) {
            logger.error('Failed to load roots:', err);
            setError(err instanceof Error ? err.message : 'Failed to load directories');
            setRoots([]);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    // Internal function to load directory (used by loadRoots for auto-nav)
    const loadDirectoryInternal = useCallback(
        async (path: string) => {
            try {
                // Get a fresh token for this request
                const { token, serverUrl: url } = await getToken();
                const response: ListFilesResponse = await listFiles(url, token, path);

                // Server may normalize/resolve the requested path.
                // Keep UI state aligned to avoid re-fetch loops and token churn.
                const normalizedPath = response.path;

                // Filter by file type if specified
                let filtered = response.entries;
                if (fileTypes && fileTypes.length > 0) {
                    filtered = response.entries.filter(
                        (e) =>
                            e.is_dir ||
                            (e.extension && fileTypes.includes(e.extension.toLowerCase()))
                    );
                }

                setEntries(filtered);
                setLoadedPath(normalizedPath); // Track what was loaded (avoid re-triggering effect)
                setCurrentPath(normalizedPath);
                setSelectedPath(null); // Clear selection on navigation
            } catch (err) {
                logger.error('Failed to load directory:', err);
                setError(err instanceof Error ? err.message : 'Failed to load directory');
                setEntries([]);
            }
        },
        [getToken, fileTypes]
    );

    const loadDirectory = useCallback(
        async (path: string) => {
            setLoading(true);
            setError(null);
            try {
                await loadDirectoryInternal(path);
            } finally {
                setLoading(false);
            }
        },
        [loadDirectoryInternal]
    );

    // Load directory contents when currentPath changes (user navigation)
    useEffect(() => {
        // Only load if the path changed and we haven't loaded it yet
        if (currentPath && initialized && currentPath !== loadedPath) {
            loadDirectory(currentPath);
        }
    }, [currentPath, initialized, loadedPath, loadDirectory]);

    const handleEntryClick = useCallback(
        (entry: FileEntry) => {
            if (entry.is_dir) {
                // Navigate into directory
                setCurrentPath(entry.path);
            } else {
                // Select file
                setSelectedPath(entry.path);
            }
        },
        []
    );

    const handleEntryDoubleClick = useCallback(
        (entry: FileEntry) => {
            if (entry.is_dir) {
                // Navigate into directory
                setCurrentPath(entry.path);
            } else {
                // Select and confirm
                onSelect(entry.path);
                onClose();
            }
        },
        [onSelect, onClose]
    );

    const handleNavigateUp = useCallback(() => {
        if (!currentPath) return;

        // Find parent path
        const parts = currentPath.split('/').filter(Boolean);
        if (parts.length <= 1) {
            // At root, show roots view
            setCurrentPath(null);
            setLoadedPath(null);
            setEntries([]);
        } else {
            parts.pop();
            setCurrentPath('/' + parts.join('/'));
        }
    }, [currentPath]);

    const handleBreadcrumbClick = useCallback((path: string) => {
        setCurrentPath(path);
    }, []);

    const handleConfirm = useCallback(() => {
        if (selectedPath) {
            onSelect(selectedPath);
            onClose();
        } else if (allowDirectories && currentPath) {
            onSelect(currentPath);
            onClose();
        }
    }, [selectedPath, currentPath, allowDirectories, onSelect, onClose]);

    const breadcrumbs = currentPath ? pathToBreadcrumbs(currentPath, roots) : [];

    // Can confirm if file is selected, or if directories allowed and we have a path
    const canConfirm = selectedPath !== null || (allowDirectories && currentPath !== null);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {/* Toolbar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
                    {/* Navigation buttons */}
                    <button
                        onClick={handleNavigateUp}
                        disabled={!currentPath || loading}
                        className={clsx(
                            'p-1.5 rounded',
                            'text-theme-text-secondary hover:text-theme-text-primary',
                            'hover:bg-theme-bg-hover',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'transition-colors'
                        )}
                        title="Go up one level"
                    >
                        <ArrowUp className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => {
                            setCurrentPath(null);
                            setLoadedPath(null);
                            setEntries([]);
                        }}
                        disabled={loading}
                        className={clsx(
                            'p-1.5 rounded',
                            'text-theme-text-secondary hover:text-theme-text-primary',
                            'hover:bg-theme-bg-hover',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'transition-colors'
                        )}
                        title="Go to roots"
                    >
                        <Home className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => currentPath ? loadDirectory(currentPath) : loadRoots()}
                        disabled={loading}
                        className={clsx(
                            'p-1.5 rounded',
                            'text-theme-text-secondary hover:text-theme-text-primary',
                            'hover:bg-theme-bg-hover',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'transition-colors'
                        )}
                        title="Refresh"
                    >
                        <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                    </button>

                    <div className="w-px h-5 bg-theme-border-primary mx-1" />

                    {/* Breadcrumbs / Path bar */}
                    <div className="flex-1 flex items-center gap-1 overflow-x-auto text-sm px-2 py-1 bg-theme-bg-primary rounded border border-theme-border-primary">
                        {currentPath === null ? (
                            <span className="text-theme-text-tertiary italic">Select a directory...</span>
                        ) : (
                            breadcrumbs.map((item, index) => (
                                <React.Fragment key={item.path}>
                                    {index > 0 && (
                                        <ChevronRight className="w-3 h-3 text-theme-text-tertiary flex-shrink-0" />
                                    )}
                                    <button
                                        onClick={() => handleBreadcrumbClick(item.path)}
                                        className={clsx(
                                            'px-1 py-0.5 rounded',
                                            'hover:bg-theme-bg-hover',
                                            'truncate max-w-[120px]',
                                            index === breadcrumbs.length - 1
                                                ? 'text-theme-text-primary font-medium'
                                                : 'text-theme-text-secondary hover:text-theme-text-primary'
                                        )}
                                        title={item.path}
                                    >
                                        {item.name}
                                    </button>
                                </React.Fragment>
                            ))
                        )}
                    </div>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-auto min-h-[300px] bg-theme-bg-primary">
                    {/* Error state */}
                    {error && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                            <AlertCircle className="w-10 h-10 text-theme-status-error mb-2" />
                            <p className="text-theme-text-secondary">{error}</p>
                            <button
                                onClick={loadRoots}
                                className="mt-4 px-4 py-2 text-sm text-theme-text-primary bg-theme-surface-elevated border border-theme-border-primary rounded hover:bg-theme-bg-hover transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && !error && entries.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-theme-text-tertiary" />
                        </div>
                    )}

                    {/* Roots view (when no current path) */}
                    {!error && !loading && currentPath === null && roots.length > 0 && (
                        <div className="p-1">
                            {roots.map((root) => (
                                <button
                                    key={root.path}
                                    onClick={() => setCurrentPath(root.path)}
                                    className={clsx(
                                        'w-full flex items-center gap-3 px-3 py-2 rounded',
                                        'hover:bg-theme-bg-hover',
                                        'text-left transition-colors'
                                    )}
                                >
                                    <Folder className="w-5 h-5 text-theme-interactive-accent flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-theme-text-primary truncate">
                                            {root.path.split('/').filter(Boolean).pop() || root.path}
                                        </p>
                                        <p className="text-xs text-theme-text-tertiary truncate">
                                            {root.path}
                                            {root.read_only && ' (read-only)'}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Directory listing */}
                    {!error && currentPath !== null && entries.length > 0 && (
                        <div className="p-1">
                            {entries.map((entry) => (
                                <button
                                    key={entry.path}
                                    onClick={() => handleEntryClick(entry)}
                                    onDoubleClick={() => handleEntryDoubleClick(entry)}
                                    className={clsx(
                                        'w-full flex items-center gap-3 px-3 py-1.5 rounded',
                                        'text-left transition-colors',
                                        selectedPath === entry.path
                                            ? 'bg-theme-interactive-accent/15 ring-1 ring-theme-interactive-accent'
                                            : 'hover:bg-theme-bg-hover'
                                    )}
                                >
                                    {entry.is_dir ? (
                                        <Folder className="w-4 h-4 text-theme-interactive-accent flex-shrink-0" />
                                    ) : (
                                        <File className="w-4 h-4 text-theme-text-tertiary flex-shrink-0" />
                                    )}
                                    <span className={clsx(
                                        'flex-1 min-w-0 text-sm truncate',
                                        selectedPath === entry.path
                                            ? 'text-theme-text-primary'
                                            : 'text-theme-text-primary'
                                    )}>
                                        {entry.name}
                                    </span>
                                    {!entry.is_dir && (
                                        <>
                                            <span className="text-xs text-theme-text-tertiary w-16 text-right tabular-nums">
                                                {formatFileSize(entry.size)}
                                            </span>
                                            <span className="text-xs text-theme-text-tertiary w-28 text-right hidden sm:block">
                                                {formatDate(entry.modified)}
                                            </span>
                                        </>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Empty directory */}
                    {!error && !loading && currentPath !== null && entries.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                            <Folder className="w-10 h-10 text-theme-text-tertiary mb-2" />
                            <p className="text-theme-text-tertiary">
                                {fileTypes && fileTypes.length > 0
                                    ? `No matching files (${fileTypes.join(', ')})`
                                    : 'This directory is empty'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Selected file info */}
                {selectedPath && (
                    <div className="px-4 py-2 border-t border-theme-border-primary bg-theme-surface-elevated">
                        <p className="text-sm text-theme-text-secondary truncate">
                            <span className="text-theme-text-primary font-medium">Selected:</span> {selectedPath}
                        </p>
                    </div>
                )}

                <DialogFooter>
                    <button
                        onClick={onClose}
                        className={clsx(
                            'px-4 py-2 text-sm rounded',
                            'text-theme-text-primary',
                            'border border-theme-border-primary',
                            'hover:bg-theme-bg-hover',
                            'transition-colors'
                        )}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className={clsx(
                            'px-4 py-2 text-sm rounded font-medium',
                            'bg-theme-interactive-accent text-white',
                            'hover:bg-theme-interactive-accent/90',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'transition-colors'
                        )}
                    >
                        Select
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RemoteFileBrowser;
