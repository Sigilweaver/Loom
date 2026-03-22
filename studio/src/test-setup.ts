import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { DEFAULT_SETTINGS, mergeWithDefaults } from './types/settings';

/**
 * Mock platform adapter for tests
 * 
 * Tests can configure this mock by importing and modifying:
 *   import { mockPlatform, mockPlatformCapabilities } from '../../test-setup';
 * 
 * The mock defaults to simulating the Electron platform with all capabilities.
 */
export const mockPlatformCapabilities = {
  secureStorage: true,
  nativeDialogs: true,
  nativeMenus: true,
  autoUpdate: true,
};

export const mockPlatformCredentials = {
  isAvailable: vi.fn().mockResolvedValue(true),
  list: vi.fn().mockResolvedValue([]),
  listByType: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  resolve: vi.fn().mockResolvedValue(null),
  test: vi.fn().mockResolvedValue({ success: true, message: 'OK' }),
};

const SETTINGS_KEY = 'application-settings';

export const mockPlatformSettings = {
  // Default implementation uses localStorage like the web platform
  getSettings: vi.fn(async () => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        return mergeWithDefaults(JSON.parse(stored));
      } catch {
        console.error('Failed to parse settings from localStorage');
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  }),
  setSettings: vi.fn(async (settings: unknown) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }),
};

export const mockPlatformAuth = {
  getSessionToken: vi.fn().mockResolvedValue(null),
  setSessionToken: vi.fn().mockResolvedValue(undefined),
};

export const mockPlatformFiles = {
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  showOpenDialog: vi.fn().mockResolvedValue(null),
  showSaveDialog: vi.fn().mockResolvedValue(null),
};

export const mockPlatformMenu = {
  onMenuAction: vi.fn().mockReturnValue(() => {}),
};

export const mockPlatform = {
  name: 'electron' as 'electron' | 'web' | 'tauri',
  capabilities: mockPlatformCapabilities,
  initialize: vi.fn().mockResolvedValue(undefined),
  credentials: mockPlatformCredentials,
  settings: mockPlatformSettings,
  auth: mockPlatformAuth,
  files: mockPlatformFiles,
  menu: mockPlatformMenu,
};

// Mock the @platform module
vi.mock('@platform', () => ({
  platform: mockPlatform,
  initializePlatform: vi.fn().mockResolvedValue(undefined),
  isDesktop: vi.fn(() => mockPlatform.name === 'electron' || mockPlatform.name === 'tauri'),
  isBrowser: vi.fn(() => mockPlatform.name === 'web'),
  hasSecureStorage: vi.fn(() => mockPlatformCapabilities.secureStorage),
  hasNativeDialogs: vi.fn(() => mockPlatformCapabilities.nativeDialogs),
}));

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock pointer capture methods for Radix UI components
// JSDOM doesn't implement these but Radix Select uses them
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = vi.fn();
}
if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (typeof Element.prototype.hasPointerCapture !== 'function') {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}

// Mock IntersectionObserver (used by ReactFlow)
global.IntersectionObserver = class {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return []; }
  get root() { return null; }
  get rootMargin() { return ''; }
  get thresholds() { return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Mock ResizeObserver (used by ReactFlow and other components)
global.ResizeObserver = class {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock getComputedStyle for layout tests
global.getComputedStyle = () => ({
  getPropertyValue: () => '',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(callback, 0);
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Mock createObjectURL and revokeObjectURL
global.URL.createObjectURL = () => 'mock-url';
global.URL.revokeObjectURL = () => {};

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  Editor: vi.fn(({ value, onChange, onMount }) => {
    // Simulate editor mount
    if (onMount) {
      const mockEditor = {
        getValue: () => value,
        setValue: (newValue: string) => onChange?.(newValue),
        updateOptions: vi.fn(),
        createDecorationsCollection: vi.fn(() => ({
          clear: vi.fn(),
        })),
        onDidChangeModelContent: vi.fn(() => {
          // Store callback for testing
          return { dispose: vi.fn() };
        }),
        dispose: vi.fn(),
        addCommand: vi.fn(),
        trigger: vi.fn(),
      };

      const mockMonaco = {
        editor: {
          defineTheme: vi.fn(),
          setTheme: vi.fn(),
          createDecorationsCollection: vi.fn(),
        },
        languages: {
          registerCompletionItemProvider: vi.fn(() => ({
            dispose: vi.fn(),
          })),
          CompletionItemKind: {
            Function: 1,
            Field: 2,
            Method: 3,
            Operator: 4,
          },
          CompletionItemInsertTextRule: {
            InsertAsSnippet: 4,
          },
        },
        Range: class {
          constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number
          ) {}
        },
        KeyCode: {
          Space: 10,
        },
      };

      setTimeout(() => onMount(mockEditor, mockMonaco), 0);
    }

    return (
      React.createElement('textarea', {
        'data-testid': 'monaco-editor',
        value: value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
        placeholder: 'Monaco Editor Mock'
      })
    );
  }),
  OnMount: vi.fn(),
}));

// Mock monaco-editor types
vi.mock('monaco-editor', () => ({
  editor: {},
  languages: {},
  Position: class {},
  IRange: {},
}));

// Mock lucide-react icons to avoid rendering issues in tests
vi.mock('lucide-react', () => {
  const icons = [
    'FileInput', 'FileOutput', 'FileDown', 'Filter', 'CheckSquare', 'ArrowUpDown',
    'Calculator', 'Layers', 'Link', 'Sigma', 'Star', 'ArrowRightLeft',
    'Wrench', 'BarChart3', 'Settings', 'FlaskRound', 'AlertTriangle',
    'Fingerprint', 'CornerRightDown', 'CornerLeftUp', 'ChevronDown',
    'ChevronRight', 'ChevronUp', 'LayoutGrid', 'X', 'Check', 'Minus', 'Circle',
    'Trash2', 'Plus', 'Loader2', 'MessageSquare', 'Copy', 'GripVertical'
  ];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockIcons: Record<string, React.FC<any>> = {};
  icons.forEach(icon => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockIcons[icon] = (props: any) => React.createElement('div', { ...props, 'data-testid': `icon-${icon}` }, icon);
  });
  
  return mockIcons;
});
