import { Theme } from '../types/theme';

export const lightTheme: Theme = {
  id: 'light',
  name: 'Light Theme',
  description: 'Clean and bright theme for daytime use',
  colors: {
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      elevated: '#ffffff',
    },
    text: {
      primary: '#1f2937',
      secondary: '#374151',
      tertiary: '#6b7280',
      inverse: '#ffffff',
      muted: '#9ca3af',
    },
    border: {
      primary: '#e5e7eb',
      secondary: '#d1d5db',
      focus: '#3b82f6',
      error: '#ef4444',
      success: '#10b981',
    },
    tool: {
      inout: '#10b981',      // Green - Input/Output
      preparation: '#3b82f6', // Blue - Preparation
      join: '#8b5cf6',       // Purple - Join
      aggregate: '#f97316',   // Orange - Aggregate
      favorites: '#eab308',   // Yellow - Favorites
      default: '#6b7280',     // Gray - Default
    },
    interactive: {
      primary: {
        default: '#1a0b2e',
        hover: '#7c3aed',
        active: '#6d28d9',
        disabled: '#d1d5db',
      },
      secondary: {
        default: '#6b7280',
        hover: '#4b5563',
        active: '#374151',
        disabled: '#e5e7eb',
      },
      accent: {
        default: '#3b82f6',
        hover: '#2563eb',
        active: '#1d4ed8',
      },
    },
    semantic: {
      error: {
        background: '#fef2f2',
        border: '#fecaca',
        text: '#991b1b',
        accent: '#ef4444',
      },
      warning: {
        background: '#fffbeb',
        border: '#fde68a',
        text: '#92400e',
        accent: '#f59e0b',
      },
      success: {
        background: '#ecfdf5',
        border: '#a7f3d0',
        text: '#065f46',
        accent: '#10b981',
      },
      info: {
        background: '#eff6ff',
        border: '#93c5fd',
        text: '#1e40af',
        accent: '#3b82f6',
      },
    },
    workflow: {
      canvas: '#f8fafc',
      grid: {
        primary: '#9ca3af',
        secondary: '#d1d5db',
      },
      edge: {
        default: '#4f46e5',
        hover: '#7c3aed',
        selected: '#ef4444',
        rejected: '#ef4444',
      },
      node: {
        background: '#ffffff',
        shadow: 'rgba(0, 0, 0, 0.1)',
        handle: {
          input: '#3b82f6',
          output: '#10b981',
        },
      },
    },
    syntax: {
      tag: '#1e40af',
      attribute: '#059669',
      value: '#dc2626',
      comment: '#16a34a',
      declaration: '#7c3aed',
      text: '#1f2937',
    },
  },
};

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark Theme',
  description: 'Easy on the eyes for nighttime coding',
  colors: {
    background: {
      primary: '#111827',
      secondary: '#1f2937',
      tertiary: '#374151',
      elevated: '#1f2937',
    },
    text: {
      primary: '#f9fafb',
      secondary: '#e5e7eb',
      tertiary: '#d1d5db',
      inverse: '#d1d5db',
      muted: '#9ca3af',
    },
    border: {
      primary: '#374151',
      secondary: '#4b5563',
      focus: '#60a5fa',
      error: '#f87171',
      success: '#34d399',
    },
    tool: {
      inout: '#34d399',      // Brighter green for dark mode
      preparation: '#60a5fa', // Brighter blue for dark mode
      join: '#a78bfa',       // Brighter purple for dark mode
      aggregate: '#fb923c',   // Brighter orange for dark mode
      favorites: '#fbbf24',   // Brighter yellow for dark mode
      default: '#9ca3af',     // Lighter gray for dark mode
    },
    interactive: {
      primary: {
        default: '#1a0b2e',
        hover: '#c4b5fd',
        active: '#ddd6fe',
        disabled: '#4b5563',
      },
      secondary: {
        default: '#9ca3af',
        hover: '#d1d5db',
        active: '#e5e7eb',
        disabled: '#374151',
      },
      accent: {
        default: '#60a5fa',
        hover: '#93c5fd',
        active: '#bfdbfe',
      },
    },
    semantic: {
      error: {
        background: '#450a0a',
        border: '#7f1d1d',
        text: '#fca5a5',
        accent: '#f87171',
      },
      warning: {
        background: '#451a03',
        border: '#92400e',
        text: '#fed7aa',
        accent: '#fb923c',
      },
      success: {
        background: '#064e3b',
        border: '#047857',
        text: '#a7f3d0',
        accent: '#34d399',
      },
      info: {
        background: '#1e3a8a',
        border: '#1d4ed8',
        text: '#bfdbfe',
        accent: '#60a5fa',
      },
    },
    workflow: {
      canvas: '#1f2937',
      grid: {
        primary: '#4b5563',
        secondary: '#374151',
      },
      edge: {
        default: '#8b5cf6',
        hover: '#a78bfa',
        selected: '#f87171',
        rejected: '#f87171',
      },
      node: {
        background: '#374151',
        shadow: 'rgba(0, 0, 0, 0.3)',
        handle: {
          input: '#60a5fa',
          output: '#34d399',
        },
      },
    },
    syntax: {
      tag: '#60a5fa',
      attribute: '#34d399',
      value: '#f87171',
      comment: '#4ade80',
      declaration: '#a78bfa',
      text: '#f9fafb',
    },
  },
};

export const highContrastTheme: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'Maximum contrast for accessibility',
  colors: {
    background: {
      primary: '#ffffff',
      secondary: '#ffffff',
      tertiary: '#f5f5f5',
      elevated: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#000000',
      tertiary: '#333333',
      inverse: '#ffffff',
      muted: '#666666',
    },
    border: {
      primary: '#000000',
      secondary: '#333333',
      focus: '#0066cc',
      error: '#cc0000',
      success: '#006600',
    },
    tool: {
      inout: '#006600',      // High contrast green
      preparation: '#0066cc', // High contrast blue
      join: '#6600cc',       // High contrast purple
      aggregate: '#cc6600',   // High contrast orange
      favorites: '#cccc00',   // High contrast yellow
      default: '#333333',     // High contrast gray
    },
    interactive: {
      primary: {
        default: '#1f2937',
        hover: '#c4b5fd',
        active: '#002266',
        disabled: '#cccccc',
      },
      secondary: {
        default: '#333333',
        hover: '#000000',
        active: '#000000',
        disabled: '#cccccc',
      },
      accent: {
        default: '#0066cc',
        hover: '#004499',
        active: '#002266',
      },
    },
    semantic: {
      error: {
        background: '#ffeeee',
        border: '#cc0000',
        text: '#cc0000',
        accent: '#cc0000',
      },
      warning: {
        background: '#fffaee',
        border: '#cc6600',
        text: '#cc6600',
        accent: '#cc6600',
      },
      success: {
        background: '#eeffee',
        border: '#006600',
        text: '#006600',
        accent: '#006600',
      },
      info: {
        background: '#eeeeff',
        border: '#0066cc',
        text: '#0066cc',
        accent: '#0066cc',
      },
    },
    workflow: {
      canvas: '#ffffff',
      grid: {
        primary: '#000000',
        secondary: '#333333',
      },
      edge: {
        default: '#000000',
        hover: '#0066cc',
        selected: '#cc0000',
        rejected: '#cc0000',
      },
      node: {
        background: '#ffffff',
        shadow: 'rgba(0, 0, 0, 0.5)',
        handle: {
          input: '#0066cc',
          output: '#006600',
        },
      },
    },
    syntax: {
      tag: '#0066cc',
      attribute: '#006600',
      value: '#cc0000',
      comment: '#666666',
      declaration: '#6600cc',
      text: '#000000',
    },
  },
};

export const availableThemes: Theme[] = [
  lightTheme,
  darkTheme,
  highContrastTheme,
];

export const getThemeById = (id: string): Theme => {
  return availableThemes.find(theme => theme.id === id) || lightTheme;
};
