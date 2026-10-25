/**
 * Application Settings Types
 *
 * Persistent settings that are saved across sessions using the Tauri store plugin.
 */

/**
 * Execution mode determines how Studio connects to the execution engine.
 *
 * - 'bundled': Use the bundled server (desktop mode). Server runs locally.
 * - 'external': Connect to an external server directly. No Hub involved.
 * - 'hub': Connect through Hub for centralized credential management.
 */
export type ExecutionMode = 'bundled' | 'external' | 'hub';

export interface AppSettings {
  /** User's name for workflow authorship */
  author: string;

  /** Execution mode configuration */
  executionMode: ExecutionMode;

  /** Backend server configuration (for bundled/external modes) */
  backend: {
    /** Backend URL (default: http://localhost:25811) */
    url: string;
    /** Whether to auto-start bundled backend (full mode only) */
    autoStart: boolean;
    /** Number of rows to show in data previews (default: 100) */
    previewRows: number;
  };

  /** Hub configuration (for hub mode) */
  hub: {
    /** Hub server URL */
    url: string;
    /** Remember login between sessions */
    rememberLogin: boolean;
    /** Persisted session token (when rememberLogin is true) */
    sessionToken: string | null;
  };

  /** Theme configuration */
  theme: {
    /** Active theme ID */
    id: string;
  };

  /** UI preferences */
  ui: {
    /** Snap to grid enabled */
    snapToGrid: boolean;
    /** Minimap visible */
    minimapVisible: boolean;
    /** Minimap position */
    minimapPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Edge style for wire connections
     * - 'bezier': Default curved bezier lines
     * - 'straight': Direct straight lines
     * - 'step': Right-angle lines with sharp corners
     * - 'smoothstep': Right-angle lines with rounded corners
     */
    edgeStyle: 'bezier' | 'straight' | 'step' | 'smoothstep';
    /** Show warning indicators on blocking/semi-blocking tools */
    showBlockingIndicators: boolean;
  };

  /** Behavior preferences */
  behavior: {
    /** Automatically connect new tools to the nearest compatible tool on drop */
    autoConnect: boolean;
    /** Maximum distance (in canvas pixels) to search for auto-connect candidates */
    autoConnectRadius: number;
  };

  /** Tool comment display preferences */
  comments: {
    /** Whether comments are visible on the canvas */
    visible: boolean;
    /** Text alignment within the comment label */
    alignment: 'left' | 'center' | 'right';
    /** Maximum width in pixels for the comment label */
    maxWidth: number;
    /** Maximum height in pixels for the comment label */
    maxHeight: number;
  };

  /** Auto layout preferences */
  layout: {
    /** Vertical alignment strategy */
    alignment: 'upstream' | 'downstream' | 'balanced';
    /** Horizontal gap between columns in pixels */
    horizontalSpacing: number;
    /** Vertical gap between rows in pixels */
    verticalSpacing: number;
    /** Snap positions to grid (0 = disabled) */
    gridSnap: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  author: 'User', // Will be replaced by system username in the desktop app, or user can change it
  executionMode: 'bundled', // Default to bundled for desktop
  backend: {
    url: 'http://localhost:25811',
    autoStart: true,
    previewRows: 100,
  },
  hub: {
    url: '',
    rememberLogin: false,
    sessionToken: null,
  },
  theme: {
    id: 'sigilweaver-signature',
  },
  ui: {
    snapToGrid: true,
    minimapVisible: true,
    minimapPosition: 'bottom-right',
    edgeStyle: 'bezier',
    showBlockingIndicators: true,
  },
  behavior: {
    autoConnect: true,
    autoConnectRadius: 300,
  },
  comments: {
    visible: true,
    alignment: 'center',
    maxWidth: 150,
    maxHeight: 40,
  },
  layout: {
    alignment: 'upstream',
    horizontalSpacing: 280,
    verticalSpacing: 120,
    gridSnap: 0,
  },
};

/**
 * Deep-merge stored settings with DEFAULT_SETTINGS so that newly added
 * nested fields (e.g. `ui.showBlockingIndicators`) get their default value
 * even when the user's persisted `ui` object predates the addition.
 *
 * Only merges one level deep (top-level scalars are overwritten, top-level
 * objects are shallow-merged with their default counterpart).
 */
export function mergeWithDefaults(stored: Record<string, unknown>): AppSettings {
  const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const key of Object.keys(stored)) {
    const defaultVal = merged[key];
    const storedVal = stored[key];
    if (
      defaultVal !== null &&
      storedVal !== null &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal) &&
      typeof storedVal === 'object' &&
      !Array.isArray(storedVal)
    ) {
      merged[key] = { ...defaultVal, ...storedVal };
    } else {
      merged[key] = storedVal;
    }
  }
  return merged as unknown as AppSettings;
}
