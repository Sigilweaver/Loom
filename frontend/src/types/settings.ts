/**
 * Application Settings Types
 * 
 * Persistent settings that are saved across sessions using Electron Store.
 */

export interface AppSettings {
  /** User's name for workflow authorship */
  author: string;
  
  /** Backend server configuration */
  backend: {
    /** Backend URL (default: http://localhost:8000) */
    url: string;
    /** Whether to auto-start bundled backend (full mode only) */
    autoStart: boolean;
    /** Number of rows to show in data previews (default: 100) */
    previewRows: number;
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
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  author: 'User', // Will be replaced by system username in Electron, or user can change it
  backend: {
    url: 'http://localhost:8000',
    autoStart: true,
    previewRows: 100,
  },
  theme: {
    id: 'sigilweaver',
  },
  ui: {
    snapToGrid: true,
    minimapVisible: true,
    minimapPosition: 'bottom-right',
    edgeStyle: 'bezier',
  },
};
