import { Theme, ColorPalette } from '../types/theme';

// Light theme color palette
const lightPalette: ColorPalette = {
  foundation: {
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
  brand: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    secondary: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7c3aed',
      800: '#6d28d9',
      900: '#581c87',
    },
  },
  semantic: {
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
  },
  tools: {
    inout: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    preparation: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    join: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7c3aed',
      800: '#6d28d9',
      900: '#581c87',
    },
    aggregate: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    favorites: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
  },
};

// Dark theme color palette
const darkPalette: ColorPalette = {
  foundation: {
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  },
  gray: {
    50: '#030712',
    100: '#111827',
    200: '#1f2937',
    300: '#374151',
    400: '#4b5563',
    500: '#6b7280',
    600: '#9ca3af',
    700: '#d1d5db',
    800: '#e5e7eb',
    900: '#f3f4f6',
    950: '#f9fafb',
  },
  brand: {
    primary: {
      50: '#0c4a6e',
      100: '#075985',
      200: '#0369a1',
      300: '#0284c7',
      400: '#0ea5e9',
      500: '#38bdf8',
      600: '#7dd3fc',
      700: '#bae6fd',
      800: '#e0f2fe',
      900: '#f0f9ff',
    },
    secondary: {
      50: '#581c87',
      100: '#6d28d9',
      200: '#7c3aed',
      300: '#9333ea',
      400: '#a855f7',
      500: '#c084fc',
      600: '#d8b4fe',
      700: '#e9d5ff',
      800: '#f3e8ff',
      900: '#faf5ff',
    },
  },
  semantic: {
    success: {
      50: '#064e3b',
      100: '#065f46',
      200: '#047857',
      300: '#059669',
      400: '#10b981',
      500: '#34d399',
      600: '#6ee7b7',
      700: '#a7f3d0',
      800: '#d1fae5',
      900: '#ecfdf5',
    },
    warning: {
      50: '#78350f',
      100: '#92400e',
      200: '#b45309',
      300: '#d97706',
      400: '#f59e0b',
      500: '#fbbf24',
      600: '#fcd34d',
      700: '#fde68a',
      800: '#fef3c7',
      900: '#fffbeb',
    },
    error: {
      50: '#7f1d1d',
      100: '#991b1b',
      200: '#b91c1c',
      300: '#dc2626',
      400: '#ef4444',
      500: '#f87171',
      600: '#fca5a5',
      700: '#fecaca',
      800: '#fee2e2',
      900: '#fef2f2',
    },
    info: {
      50: '#1e3a8a',
      100: '#1e40af',
      200: '#1d4ed8',
      300: '#2563eb',
      400: '#3b82f6',
      500: '#60a5fa',
      600: '#93c5fd',
      700: '#bfdbfe',
      800: '#dbeafe',
      900: '#eff6ff',
    },
  },
  tools: {
    inout: {
      50: '#064e3b',
      100: '#065f46',
      200: '#047857',
      300: '#059669',
      400: '#10b981',
      500: '#34d399',
      600: '#6ee7b7',
      700: '#a7f3d0',
      800: '#d1fae5',
      900: '#ecfdf5',
    },
    preparation: {
      50: '#1e3a8a',
      100: '#1e40af',
      200: '#1d4ed8',
      300: '#2563eb',
      400: '#3b82f6',
      500: '#60a5fa',
      600: '#93c5fd',
      700: '#bfdbfe',
      800: '#dbeafe',
      900: '#eff6ff',
    },
    join: {
      50: '#581c87',
      100: '#6d28d9',
      200: '#7c3aed',
      300: '#9333ea',
      400: '#a855f7',
      500: '#c084fc',
      600: '#d8b4fe',
      700: '#e9d5ff',
      800: '#f3e8ff',
      900: '#faf5ff',
    },
    aggregate: {
      50: '#7c2d12',
      100: '#9a3412',
      200: '#c2410c',
      300: '#ea580c',
      400: '#f97316',
      500: '#fb923c',
      600: '#fdba74',
      700: '#fed7aa',
      800: '#ffedd5',
      900: '#fff7ed',
    },
    favorites: {
      50: '#713f12',
      100: '#854d0e',
      200: '#a16207',
      300: '#ca8a04',
      400: '#eab308',
      500: '#facc15',
      600: '#fde047',
      700: '#fef08a',
      800: '#fef9c3',
      900: '#fefce8',
    },
  },
};

export const lightTheme: Theme = {
  id: 'light',
  name: 'Light Theme',
  description: 'Clean and bright theme for daytime use',
  colors: {
    palette: lightPalette,
    
    surfaces: {
      page: lightPalette.foundation.white,
      panel: lightPalette.gray[50],
      elevated: lightPalette.foundation.white,
      overlay: 'rgba(0, 0, 0, 0.5)',
      canvas: lightPalette.gray[50],
    },
    
    text: {
      primary: lightPalette.gray[900],
      secondary: lightPalette.gray[700],
      tertiary: lightPalette.gray[500],
      inverse: lightPalette.foundation.white,
      disabled: lightPalette.gray[400],
    },
    
    borders: {
      primary: lightPalette.gray[200],
      secondary: lightPalette.gray[100],
      focus: lightPalette.brand.primary[500],
      divider: lightPalette.gray[200],
    },
    
    header: {
      background: '#2a1a3e',  // Copy from sigilweaver - deep mystic
      logo: {
        icon: '#fcd34d', // Copy from sigilweaver - gold accent
        text: '#ffffff',  // Copy from sigilweaver - white text
      },
      title: {
        text: '#ffffff', // Copy from sigilweaver - white
      },
      metadata: {
        text: '#eae0f6', // Copy from sigilweaver - good contrast
        divider: '#6a5a86', // Copy from sigilweaver
      },
      buttons: {
        new: {
          default: {
            background: lightPalette.semantic.success[500],
            border: lightPalette.semantic.success[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.success[600],
            border: lightPalette.semantic.success[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.success[700],
            border: lightPalette.semantic.success[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        import: {
          default: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.primary[600],
            border: lightPalette.brand.primary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.primary[700],
            border: lightPalette.brand.primary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        export: {
          default: {
            background: lightPalette.gray[600],
            border: lightPalette.gray[700],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.gray[700],
            border: lightPalette.gray[800],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.gray[800],
            border: lightPalette.gray[900],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        viewCode: {
          default: {
            background: lightPalette.brand.secondary[500],
            border: lightPalette.brand.secondary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.secondary[600],
            border: lightPalette.brand.secondary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.secondary[700],
            border: lightPalette.brand.secondary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        preview: {
          default: {
            background: lightPalette.semantic.info[500],
            border: lightPalette.semantic.info[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.info[600],
            border: lightPalette.semantic.info[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.info[700],
            border: lightPalette.semantic.info[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        run: {
          default: {
            background: lightPalette.semantic.error[500],
            border: lightPalette.semantic.error[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.error[600],
            border: lightPalette.semantic.error[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.error[700],
            border: lightPalette.semantic.error[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
      },
      divider: lightPalette.gray[600],
      themeSelector: {
        trigger: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.gray[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.gray[800],
            border: lightPalette.gray[500],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.gray[700],
            border: lightPalette.gray[500],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.gray[700],
            text: lightPalette.gray[600],
          },
        },
        dropdown: {
          background: lightPalette.foundation.white,
          border: lightPalette.gray[200],
          shadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        },
        option: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[900],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.brand.primary[50],
            border: lightPalette.foundation.transparent,
            text: lightPalette.brand.primary[900],
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
      },
    },
    
    configPanel: {
      background: lightPalette.foundation.white,
      border: lightPalette.gray[200],
      shadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      header: {
        background: lightPalette.gray[50],
        border: lightPalette.gray[200],
        text: lightPalette.gray[900],
      },
      sections: {
        background: lightPalette.foundation.white,
        border: lightPalette.gray[200],
        title: lightPalette.gray[900],
      },
      fields: {
        label: lightPalette.gray[700],
        input: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[300],
            text: lightPalette.gray[900],
          },
          hover: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[400],
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.foundation.white,
            border: lightPalette.brand.primary[500],
            text: lightPalette.gray[900],
          },
          disabled: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[500],
          },
          focus: {
            background: lightPalette.foundation.white,
            border: lightPalette.brand.primary[500],
            text: lightPalette.gray[900],
            shadow: `0 0 0 3px ${lightPalette.brand.primary[100]}`,
          },
        },
        select: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[300],
            text: lightPalette.gray[900],
          },
          hover: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[400],
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.foundation.white,
            border: lightPalette.brand.primary[500],
            text: lightPalette.gray[900],
          },
          disabled: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[500],
          },
        },
        checkbox: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[300],
            text: lightPalette.brand.primary[500],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[400],
            text: lightPalette.brand.primary[600],
          },
          active: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[500],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[400],
          },
        },
        radio: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[300],
            text: lightPalette.brand.primary[500],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[400],
            text: lightPalette.brand.primary[600],
          },
          active: {
            background: lightPalette.foundation.white,
            border: lightPalette.brand.primary[500],
            text: lightPalette.brand.primary[500],
          },
          disabled: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[400],
          },
        },
      },
    },
    
    toolPalette: {
      background: lightPalette.foundation.white,
      border: lightPalette.gray[200],
      shadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      search: {
        input: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[300],
            text: lightPalette.gray[900],
          },
          hover: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[400],
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.foundation.white,
            border: lightPalette.brand.primary[500],
            text: lightPalette.gray[900],
          },
          disabled: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[500],
          },
          focus: {
            background: lightPalette.foundation.white,
            border: lightPalette.brand.primary[500],
            text: lightPalette.gray[900],
            shadow: `0 0 0 3px ${lightPalette.brand.primary[100]}`,
          },
        },
        icon: lightPalette.gray[400],
      },
      categories: {
        header: {
          background: lightPalette.gray[50],
          text: lightPalette.gray[900],
          border: lightPalette.gray[200],
        },
        expanded: {
          background: lightPalette.foundation.white,
        },
      },
      tools: {
        item: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[700],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.brand.primary[50],
            border: lightPalette.brand.primary[200],
            text: lightPalette.gray[900],
          },
          disabled: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
        icon: lightPalette.gray[600],
        label: lightPalette.gray[700],
        dragPreview: {
          background: lightPalette.foundation.white,
          border: lightPalette.brand.primary[300],
          shadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    
    canvas: {
      background: lightPalette.gray[50],
      grid: {
        primary: lightPalette.gray[200],
        secondary: lightPalette.gray[100],
      },
      minimap: {
        background: lightPalette.foundation.white,
        border: lightPalette.gray[200],
        viewport: lightPalette.brand.primary[500],
        mask: 'rgba(139, 92, 246, 0.3)', // Semi-transparent purple overlay
      },
      controls: {
        background: lightPalette.foundation.white,
        border: lightPalette.gray[200],
        shadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        button: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[200],
            text: lightPalette.gray[600],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[300],
            text: lightPalette.gray[700],
          },
          active: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[600],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[200],
            text: lightPalette.gray[400],
          },
        },
      },
    },
    
    nodes: {
      default: {
        background: lightPalette.foundation.white,
        border: lightPalette.gray[200],
        shadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      },
      selected: {
        background: lightPalette.foundation.white,
        border: lightPalette.brand.primary[500],
        shadow: `0 0 0 3px ${lightPalette.brand.primary[100]}`,
      },
      dragging: {
        background: lightPalette.foundation.white,
        border: lightPalette.brand.primary[400],
        shadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
      },
      header: {
        background: lightPalette.gray[50],
        text: lightPalette.gray[900],
        icon: lightPalette.gray[600],
      },
      content: {
        background: lightPalette.foundation.white,
        text: lightPalette.gray[700],
      },
      handles: {
        input: {
          background: lightPalette.tools.preparation[500],
          border: lightPalette.tools.preparation[600],
          connected: lightPalette.tools.preparation[700],
        },
        output: {
          background: lightPalette.tools.inout[500],
          border: lightPalette.tools.inout[600],
          connected: lightPalette.tools.inout[700],
        },
      },
    },
    
    edges: {
      default: {
        stroke: lightPalette.gray[700], // Darker for light theme
        strokeHover: lightPalette.gray[800],
      },
      selected: {
        stroke: lightPalette.brand.primary[600],
        strokeHover: lightPalette.brand.primary[700],
      },
      animated: {
        stroke: lightPalette.brand.secondary[600],
        strokeHover: lightPalette.brand.secondary[700],
      },
      invalid: {
        stroke: lightPalette.semantic.error[600],
        strokeHover: lightPalette.semantic.error[700],
      },
    },
    
    modals: {
      overlay: 'rgba(0, 0, 0, 0.5)',
      container: {
        background: lightPalette.foundation.white,
        border: lightPalette.gray[200],
        shadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
      },
      header: {
        background: lightPalette.gray[50],
        border: lightPalette.gray[200],
        text: lightPalette.gray[900],
      },
      content: {
        background: lightPalette.foundation.white,
        text: lightPalette.gray[700],
      },
      buttons: {
        primary: {
          default: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.primary[600],
            border: lightPalette.brand.primary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.primary[700],
            border: lightPalette.brand.primary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[300],
            border: lightPalette.gray[300],
            text: lightPalette.gray[500],
          },
        },
        secondary: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[300],
            text: lightPalette.gray[700],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[400],
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[900],
          },
          disabled: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[400],
          },
        },
        cancel: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[600],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.gray[100],
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[900],
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
      },
    },
    
    notifications: {
      success: {
        background: lightPalette.semantic.success[50],
        border: lightPalette.semantic.success[200],
        text: lightPalette.semantic.success[800],
        icon: lightPalette.semantic.success[600],
      },
      warning: {
        background: lightPalette.semantic.warning[50],
        border: lightPalette.semantic.warning[200],
        text: lightPalette.semantic.warning[800],
        icon: lightPalette.semantic.warning[600],
      },
      error: {
        background: lightPalette.semantic.error[50],
        border: lightPalette.semantic.error[200],
        text: lightPalette.semantic.error[800],
        icon: lightPalette.semantic.error[600],
      },
      info: {
        background: lightPalette.semantic.info[50],
        border: lightPalette.semantic.info[200],
        text: lightPalette.semantic.info[800],
        icon: lightPalette.semantic.info[600],
      },
    },
    
    syntax: {
      tag: lightPalette.semantic.info[700],
      attribute: lightPalette.semantic.success[700],
      value: lightPalette.semantic.error[600],
      comment: lightPalette.semantic.success[500],
      declaration: lightPalette.brand.secondary[700],
      text: lightPalette.gray[900],
      background: lightPalette.gray[50],
      selection: lightPalette.brand.primary[100],
    },
    
    forms: {
      input: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.gray[300],
          text: lightPalette.gray[900],
        },
        hover: {
          background: lightPalette.foundation.white,
          border: lightPalette.gray[400],
          text: lightPalette.gray[900],
        },
        active: {
          background: lightPalette.foundation.white,
          border: lightPalette.brand.primary[500],
          text: lightPalette.gray[900],
        },
        disabled: {
          background: lightPalette.gray[50],
          border: lightPalette.gray[200],
          text: lightPalette.gray[500],
        },
        focus: {
          background: lightPalette.foundation.white,
          border: lightPalette.brand.primary[500],
          text: lightPalette.gray[900],
          shadow: `0 0 0 3px ${lightPalette.brand.primary[100]}`,
        },
      },
      select: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.gray[300],
          text: lightPalette.gray[900],
        },
        hover: {
          background: lightPalette.foundation.white,
          border: lightPalette.gray[400],
          text: lightPalette.gray[900],
        },
        active: {
          background: lightPalette.foundation.white,
          border: lightPalette.brand.primary[500],
          text: lightPalette.gray[900],
        },
        disabled: {
          background: lightPalette.gray[50],
          border: lightPalette.gray[200],
          text: lightPalette.gray[500],
        },
      },
      checkbox: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.gray[300],
          text: lightPalette.brand.primary[500],
        },
        hover: {
          background: lightPalette.gray[50],
          border: lightPalette.gray[400],
          text: lightPalette.brand.primary[600],
        },
        active: {
          background: lightPalette.brand.primary[500],
          border: lightPalette.brand.primary[500],
          text: lightPalette.foundation.white,
        },
        disabled: {
          background: lightPalette.gray[50],
          border: lightPalette.gray[200],
          text: lightPalette.gray[400],
        },
      },
      radio: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.gray[300],
          text: lightPalette.brand.primary[500],
        },
        hover: {
          background: lightPalette.gray[50],
          border: lightPalette.gray[400],
          text: lightPalette.brand.primary[600],
        },
        active: {
          background: lightPalette.foundation.white,
          border: lightPalette.brand.primary[500],
          text: lightPalette.brand.primary[500],
        },
        disabled: {
          background: lightPalette.gray[50],
          border: lightPalette.gray[200],
          text: lightPalette.gray[400],
        },
      },
      button: {
        primary: {
          default: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.primary[600],
            border: lightPalette.brand.primary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.primary[700],
            border: lightPalette.brand.primary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[300],
            border: lightPalette.gray[300],
            text: lightPalette.gray[500],
          },
        },
        secondary: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.gray[300],
            text: lightPalette.gray[700],
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[400],
            text: lightPalette.gray[900],
          },
          active: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[900],
          },
          disabled: {
            background: lightPalette.gray[50],
            border: lightPalette.gray[200],
            text: lightPalette.gray[400],
          },
        },
        tertiary: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.brand.primary[600],
          },
          hover: {
            background: lightPalette.brand.primary[50],
            border: lightPalette.foundation.transparent,
            text: lightPalette.brand.primary[700],
          },
          active: {
            background: lightPalette.brand.primary[100],
            border: lightPalette.foundation.transparent,
            text: lightPalette.brand.primary[800],
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
        danger: {
          default: {
            background: lightPalette.semantic.error[500],
            border: lightPalette.semantic.error[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.error[600],
            border: lightPalette.semantic.error[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.error[700],
            border: lightPalette.semantic.error[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[300],
            border: lightPalette.gray[300],
            text: lightPalette.gray[500],
          },
        },
      },
      label: lightPalette.gray[700],
      helpText: lightPalette.gray[600],
      errorText: lightPalette.semantic.error[600],
      successText: lightPalette.semantic.success[600],
    },
  },
};

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark Theme',
  description: 'Easy on the eyes for nighttime coding',
  colors: {
    palette: darkPalette,
    
    surfaces: {
      page: darkPalette.gray[100], // Very dark background for app
      panel: darkPalette.gray[200], // Slightly lighter for panels
      elevated: darkPalette.gray[300], // Even lighter for elevated surfaces like tabs
      overlay: 'rgba(0, 0, 0, 0.8)',
      canvas: darkPalette.gray[200], // Canvas same as panels for now
    },
    
    text: {
      primary: darkPalette.gray[900], // Light text on dark backgrounds
      secondary: darkPalette.gray[800], // Slightly less prominent
      tertiary: darkPalette.gray[700], // Even less prominent
      inverse: darkPalette.gray[100], // Dark text for light backgrounds
      disabled: darkPalette.gray[500],
    },
    
    borders: {
      primary: darkPalette.gray[400], // More visible borders
      secondary: darkPalette.gray[300], // Secondary borders
      focus: darkPalette.brand.primary[500],
      divider: darkPalette.gray[400], // Visible dividers
    },
    
    header: {
      background: '#2a1a3e',  // Copy from sigilweaver - deep mystic
      logo: {
        icon: '#fcd34d', // Copy from sigilweaver - gold accent
        text: '#ffffff',  // Copy from sigilweaver - white text
      },
      title: {
        text: '#ffffff', // Copy from sigilweaver - white
      },
      metadata: {
        text: '#eae0f6', // Copy from sigilweaver - good contrast
        divider: '#6a5a86', // Copy from sigilweaver
      },
      buttons: {
        new: {
          default: {
            background: lightPalette.semantic.success[500],
            border: lightPalette.semantic.success[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.success[600],
            border: lightPalette.semantic.success[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.success[700],
            border: lightPalette.semantic.success[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        import: {
          default: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.primary[600],
            border: lightPalette.brand.primary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.primary[700],
            border: lightPalette.brand.primary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        export: {
          default: {
            background: lightPalette.gray[600],
            border: lightPalette.gray[700],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.gray[700],
            border: lightPalette.gray[800],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.gray[800],
            border: lightPalette.gray[900],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        viewCode: {
          default: {
            background: lightPalette.brand.secondary[500],
            border: lightPalette.brand.secondary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.secondary[600],
            border: lightPalette.brand.secondary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.secondary[700],
            border: lightPalette.brand.secondary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        preview: {
          default: {
            background: lightPalette.semantic.info[500],
            border: lightPalette.semantic.info[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.info[600],
            border: lightPalette.semantic.info[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.info[700],
            border: lightPalette.semantic.info[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        run: {
          default: {
            background: lightPalette.semantic.error[500],
            border: lightPalette.semantic.error[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.error[600],
            border: lightPalette.semantic.error[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.error[700],
            border: lightPalette.semantic.error[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
      },
      divider: darkPalette.gray[400],
      themeSelector: {
        trigger: {
          default: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.gray[400],
            text: darkPalette.gray[900],
          },
          hover: {
            background: darkPalette.gray[300],
            border: darkPalette.gray[300],
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.gray[400],
            border: darkPalette.gray[300],
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.gray[300],
            text: darkPalette.gray[500],
          },
        },
        dropdown: {
          background: darkPalette.gray[200],
          border: darkPalette.gray[300],
          shadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
        },
        option: {
          default: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[900],
          },
          hover: {
            background: darkPalette.gray[300],
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.brand.primary[800],
            border: darkPalette.foundation.transparent,
            text: darkPalette.brand.primary[100],
          },
          disabled: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[500],
          },
        },
      },
    },
    
    configPanel: {
      background: darkPalette.gray[200],
      border: darkPalette.gray[300],
      shadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      header: {
        background: darkPalette.gray[300],
        border: darkPalette.gray[400],
        text: darkPalette.gray[900],
      },
      sections: {
        background: darkPalette.gray[200],
        border: darkPalette.gray[300],
        title: darkPalette.gray[900],
      },
      fields: {
        label: darkPalette.gray[700],
        input: {
          default: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[400],
            text: darkPalette.gray[900],
          },
          hover: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[500],
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.gray[100],
            border: darkPalette.brand.primary[500],
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[600],
          },
          focus: {
            background: darkPalette.gray[100],
            border: darkPalette.brand.primary[500],
            text: darkPalette.gray[900],
            shadow: `0 0 0 3px ${darkPalette.brand.primary[800]}`,
          },
        },
        select: {
          default: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[400],
            text: darkPalette.gray[900],
          },
          hover: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[500],
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.gray[100],
            border: darkPalette.brand.primary[500],
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[600],
          },
        },
        checkbox: {
          default: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[400],
            text: darkPalette.brand.primary[500],
          },
          hover: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[500],
            text: darkPalette.brand.primary[400],
          },
          active: {
            background: darkPalette.brand.primary[500],
            border: darkPalette.brand.primary[500],
            text: darkPalette.gray[100],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[500],
          },
        },
        radio: {
          default: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[400],
            text: darkPalette.brand.primary[500],
          },
          hover: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[500],
            text: darkPalette.brand.primary[400],
          },
          active: {
            background: darkPalette.gray[100],
            border: darkPalette.brand.primary[500],
            text: darkPalette.brand.primary[500],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[500],
          },
        },
      },
    },
    
    toolPalette: {
      background: darkPalette.gray[200],
      border: darkPalette.gray[300],
      shadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      search: {
        input: {
          default: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[400],
            text: darkPalette.gray[900],
          },
          hover: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[500],
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.gray[100],
            border: darkPalette.brand.primary[500],
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[600],
          },
          focus: {
            background: darkPalette.gray[100],
            border: darkPalette.brand.primary[500],
            text: darkPalette.gray[900],
            shadow: `0 0 0 3px ${darkPalette.brand.primary[800]}`,
          },
        },
        icon: darkPalette.gray[500],
      },
      categories: {
        header: {
          background: darkPalette.gray[300],
          text: darkPalette.gray[900],
          border: darkPalette.gray[400],
        },
        expanded: {
          background: darkPalette.gray[200],
        },
      },
      tools: {
        item: {
          default: {
            background: darkPalette.gray[200],
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[800],
          },
          hover: {
            background: darkPalette.gray[300],
            border: darkPalette.gray[400],
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.brand.primary[800],
            border: darkPalette.brand.primary[700],
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[500],
          },
        },
        icon: darkPalette.gray[600],
        label: darkPalette.gray[800],
        dragPreview: {
          background: darkPalette.gray[100],
          border: darkPalette.brand.primary[600],
          shadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
        },
      },
    },
    
    canvas: {
      background: darkPalette.gray[200],
      grid: {
        primary: darkPalette.gray[400],
        secondary: darkPalette.gray[300],
      },
      minimap: {
        background: darkPalette.gray[100],
        border: darkPalette.gray[300],
        viewport: darkPalette.brand.primary[500],
        mask: 'rgba(139, 92, 246, 0.3)', // Semi-transparent purple overlay
      },
      controls: {
        background: darkPalette.gray[200],
        border: darkPalette.gray[400],
        shadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        button: {
          default: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[400],
            text: darkPalette.gray[700],
          },
          hover: {
            background: darkPalette.gray[300],
            border: darkPalette.gray[500],
            text: darkPalette.gray[800],
          },
          active: {
            background: darkPalette.brand.primary[600],
            border: darkPalette.brand.primary[700],
            text: darkPalette.foundation.white,
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[500],
          },
        },
      },
    },
    
    nodes: {
      default: {
        background: darkPalette.gray[200],
        border: darkPalette.gray[400],
        shadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      selected: {
        background: darkPalette.gray[200],
        border: darkPalette.brand.primary[500],
        shadow: `0 0 0 3px ${darkPalette.brand.primary[800]}`,
      },
      dragging: {
        background: darkPalette.gray[200],
        border: darkPalette.brand.primary[400],
        shadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
      },
      header: {
        background: darkPalette.gray[300],
        text: darkPalette.gray[900],
        icon: darkPalette.gray[700],
      },
      content: {
        background: darkPalette.gray[200],
        text: darkPalette.gray[800],
      },
      handles: {
        input: {
          background: darkPalette.tools.preparation[500],
          border: darkPalette.tools.preparation[400],
          connected: darkPalette.tools.preparation[300],
        },
        output: {
          background: darkPalette.tools.inout[500],
          border: darkPalette.tools.inout[400],
          connected: darkPalette.tools.inout[300],
        },
      },
    },
    
    edges: {
      default: {
        stroke: darkPalette.gray[700], // Lighter for dark theme
        strokeHover: darkPalette.gray[800],
      },
      selected: {
        stroke: darkPalette.brand.primary[400],
        strokeHover: darkPalette.brand.primary[300],
      },
      animated: {
        stroke: darkPalette.brand.secondary[400],
        strokeHover: darkPalette.brand.secondary[300],
      },
      invalid: {
        stroke: darkPalette.semantic.error[400],
        strokeHover: darkPalette.semantic.error[300],
      },
    },
    
    modals: {
      overlay: 'rgba(0, 0, 0, 0.8)',
      container: {
        background: darkPalette.gray[200],
        border: darkPalette.gray[400],
        shadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
      },
      header: {
        background: darkPalette.gray[300],
        border: darkPalette.gray[400],
        text: darkPalette.gray[900],
      },
      content: {
        background: darkPalette.gray[200],
        text: darkPalette.gray[800],
      },
      buttons: {
        primary: {
          default: {
            background: darkPalette.brand.primary[500],
            border: darkPalette.brand.primary[400],
            text: darkPalette.gray[100],
          },
          hover: {
            background: darkPalette.brand.primary[400],
            border: darkPalette.brand.primary[300],
            text: darkPalette.gray[100],
          },
          active: {
            background: darkPalette.brand.primary[300],
            border: darkPalette.brand.primary[200],
            text: darkPalette.gray[100],
          },
          disabled: {
            background: darkPalette.gray[400],
            border: darkPalette.gray[400],
            text: darkPalette.gray[600],
          },
        },
        secondary: {
          default: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[400],
            text: darkPalette.gray[800],
          },
          hover: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[500],
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.gray[300],
            border: darkPalette.gray[500],
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[500],
          },
        },
        cancel: {
          default: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[600],
          },
          hover: {
            background: darkPalette.gray[300],
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.gray[400],
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[500],
          },
        },
      },
    },
    
    notifications: {
      success: {
        background: darkPalette.semantic.success[800],
        border: darkPalette.semantic.success[700],
        text: darkPalette.semantic.success[200],
        icon: darkPalette.semantic.success[400],
      },
      warning: {
        background: darkPalette.semantic.warning[800],
        border: darkPalette.semantic.warning[700],
        text: darkPalette.semantic.warning[200],
        icon: darkPalette.semantic.warning[400],
      },
      error: {
        background: darkPalette.semantic.error[800],
        border: darkPalette.semantic.error[700],
        text: darkPalette.semantic.error[200],
        icon: darkPalette.semantic.error[400],
      },
      info: {
        background: darkPalette.semantic.info[800],
        border: darkPalette.semantic.info[700],
        text: darkPalette.semantic.info[200],
        icon: darkPalette.semantic.info[400],
      },
    },
    
    syntax: {
      tag: darkPalette.semantic.info[400],
      attribute: darkPalette.semantic.success[400],
      value: darkPalette.semantic.error[500],
      comment: darkPalette.semantic.success[600],
      declaration: darkPalette.brand.secondary[400],
      text: darkPalette.gray[900],
      background: darkPalette.gray[200],
      selection: darkPalette.brand.primary[800],
    },
    
    forms: {
      input: {
        default: {
          background: darkPalette.gray[100],
          border: darkPalette.gray[400],
          text: darkPalette.gray[900],
        },
        hover: {
          background: darkPalette.gray[100],
          border: darkPalette.gray[500],
          text: darkPalette.gray[900],
        },
        active: {
          background: darkPalette.gray[100],
          border: darkPalette.brand.primary[500],
          text: darkPalette.gray[900],
        },
        disabled: {
          background: darkPalette.gray[200],
          border: darkPalette.gray[300],
          text: darkPalette.gray[600],
        },
        focus: {
          background: darkPalette.gray[100],
          border: darkPalette.brand.primary[500],
          text: darkPalette.gray[900],
          shadow: `0 0 0 3px ${darkPalette.brand.primary[800]}`,
        },
      },
      select: {
        default: {
          background: darkPalette.gray[100],
          border: darkPalette.gray[400],
          text: darkPalette.gray[900],
        },
        hover: {
          background: darkPalette.gray[100],
          border: darkPalette.gray[500],
          text: darkPalette.gray[900],
        },
        active: {
          background: darkPalette.gray[100],
          border: darkPalette.brand.primary[500],
          text: darkPalette.gray[900],
        },
        disabled: {
          background: darkPalette.gray[200],
          border: darkPalette.gray[300],
          text: darkPalette.gray[600],
        },
      },
      checkbox: {
        default: {
          background: darkPalette.gray[100],
          border: darkPalette.gray[400],
          text: darkPalette.brand.primary[500],
        },
        hover: {
          background: darkPalette.gray[200],
          border: darkPalette.gray[500],
          text: darkPalette.brand.primary[400],
        },
        active: {
          background: darkPalette.brand.primary[500],
          border: darkPalette.brand.primary[500],
          text: darkPalette.gray[100],
        },
        disabled: {
          background: darkPalette.gray[200],
          border: darkPalette.gray[300],
          text: darkPalette.gray[500],
        },
      },
      radio: {
        default: {
          background: darkPalette.gray[100],
          border: darkPalette.gray[400],
          text: darkPalette.brand.primary[500],
        },
        hover: {
          background: darkPalette.gray[200],
          border: darkPalette.gray[500],
          text: darkPalette.brand.primary[400],
        },
        active: {
          background: darkPalette.gray[100],
          border: darkPalette.brand.primary[500],
          text: darkPalette.brand.primary[500],
        },
        disabled: {
          background: darkPalette.gray[200],
          border: darkPalette.gray[300],
          text: darkPalette.gray[500],
        },
      },
      button: {
        primary: {
          default: {
            background: darkPalette.brand.primary[500],
            border: darkPalette.brand.primary[400],
            text: darkPalette.gray[100],
          },
          hover: {
            background: darkPalette.brand.primary[400],
            border: darkPalette.brand.primary[300],
            text: darkPalette.gray[100],
          },
          active: {
            background: darkPalette.brand.primary[300],
            border: darkPalette.brand.primary[200],
            text: darkPalette.gray[100],
          },
          disabled: {
            background: darkPalette.gray[400],
            border: darkPalette.gray[400],
            text: darkPalette.gray[600],
          },
        },
        secondary: {
          default: {
            background: darkPalette.gray[100],
            border: darkPalette.gray[400],
            text: darkPalette.gray[800],
          },
          hover: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[500],
            text: darkPalette.gray[900],
          },
          active: {
            background: darkPalette.gray[300],
            border: darkPalette.gray[500],
            text: darkPalette.gray[900],
          },
          disabled: {
            background: darkPalette.gray[200],
            border: darkPalette.gray[300],
            text: darkPalette.gray[500],
          },
        },
        tertiary: {
          default: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.foundation.transparent,
            text: darkPalette.brand.primary[400],
          },
          hover: {
            background: darkPalette.brand.primary[800],
            border: darkPalette.foundation.transparent,
            text: darkPalette.brand.primary[300],
          },
          active: {
            background: darkPalette.brand.primary[700],
            border: darkPalette.foundation.transparent,
            text: darkPalette.brand.primary[200],
          },
          disabled: {
            background: darkPalette.foundation.transparent,
            border: darkPalette.foundation.transparent,
            text: darkPalette.gray[500],
          },
        },
        danger: {
          default: {
            background: darkPalette.semantic.error[500],
            border: darkPalette.semantic.error[400],
            text: darkPalette.gray[100],
          },
          hover: {
            background: darkPalette.semantic.error[400],
            border: darkPalette.semantic.error[300],
            text: darkPalette.gray[100],
          },
          active: {
            background: darkPalette.semantic.error[300],
            border: darkPalette.semantic.error[200],
            text: darkPalette.gray[100],
          },
          disabled: {
            background: darkPalette.gray[400],
            border: darkPalette.gray[400],
            text: darkPalette.gray[600],
          },
        },
      },
      label: darkPalette.gray[800],
      helpText: darkPalette.gray[600],
      errorText: darkPalette.semantic.error[400],
      successText: darkPalette.semantic.success[400],
    },
  },
};

export const highContrastTheme: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'Maximum contrast for accessibility',
  colors: {
    palette: lightPalette, // Use light palette as base but override colors
    
    surfaces: {
      page: lightPalette.foundation.white,
      panel: lightPalette.foundation.white,
      elevated: lightPalette.foundation.white,
      overlay: 'rgba(0, 0, 0, 0.8)',
      canvas: lightPalette.foundation.white,
    },
    
    text: {
      primary: lightPalette.foundation.black,
      secondary: lightPalette.foundation.black,
      tertiary: lightPalette.gray[700],
      inverse: lightPalette.foundation.white,
      disabled: lightPalette.gray[500],
    },
    
    borders: {
      primary: lightPalette.foundation.black,
      secondary: lightPalette.gray[700],
      focus: '#0066cc',
      divider: lightPalette.foundation.black,
    },
    
    header: {
      background: lightPalette.foundation.black,
      logo: {
        icon: lightPalette.foundation.white,
        text: lightPalette.foundation.white,
      },
      title: {
        text: lightPalette.foundation.white,
      },
      metadata: {
        text: lightPalette.gray[400],
        divider: lightPalette.gray[600],
      },
      buttons: {
        new: {
          default: {
            background: lightPalette.semantic.success[500],
            border: lightPalette.semantic.success[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.success[600],
            border: lightPalette.semantic.success[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.success[700],
            border: lightPalette.semantic.success[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        import: {
          default: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.primary[600],
            border: lightPalette.brand.primary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.primary[700],
            border: lightPalette.brand.primary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        export: {
          default: {
            background: lightPalette.gray[600],
            border: lightPalette.gray[700],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.gray[700],
            border: lightPalette.gray[800],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.gray[800],
            border: lightPalette.gray[900],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        viewCode: {
          default: {
            background: lightPalette.brand.secondary[500],
            border: lightPalette.brand.secondary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.secondary[600],
            border: lightPalette.brand.secondary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.secondary[700],
            border: lightPalette.brand.secondary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        preview: {
          default: {
            background: lightPalette.semantic.info[500],
            border: lightPalette.semantic.info[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.info[600],
            border: lightPalette.semantic.info[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.info[700],
            border: lightPalette.semantic.info[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        run: {
          default: {
            background: lightPalette.semantic.error[500],
            border: lightPalette.semantic.error[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.error[600],
            border: lightPalette.semantic.error[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.error[700],
            border: lightPalette.semantic.error[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
      },
      divider: lightPalette.gray[600],
      themeSelector: {
        trigger: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.gray[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.gray[800],
            border: lightPalette.gray[500],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.gray[700],
            border: lightPalette.gray[500],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.gray[700],
            text: lightPalette.gray[600],
          },
        },
        dropdown: {
          background: lightPalette.foundation.white,
          border: lightPalette.foundation.black,
          shadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
        },
        option: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.gray[100],
            border: lightPalette.foundation.transparent,
            text: lightPalette.foundation.black,
          },
          active: {
            background: '#0066cc',
            border: lightPalette.foundation.transparent,
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
      },
    },
    
    configPanel: {
      background: lightPalette.foundation.white,
      border: lightPalette.foundation.black,
      shadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
      header: {
        background: lightPalette.gray[100],
        border: lightPalette.foundation.black,
        text: lightPalette.foundation.black,
      },
      sections: {
        background: lightPalette.foundation.white,
        border: lightPalette.foundation.black,
        title: lightPalette.foundation.black,
      },
      fields: {
        label: lightPalette.foundation.black,
        input: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          active: {
            background: lightPalette.foundation.white,
            border: '#0066cc',
            text: lightPalette.foundation.black,
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[500],
          },
          focus: {
            background: lightPalette.foundation.white,
            border: '#0066cc',
            text: lightPalette.foundation.black,
            shadow: '0 0 0 3px #cceeff',
          },
        },
        select: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          active: {
            background: lightPalette.foundation.white,
            border: '#0066cc',
            text: lightPalette.foundation.black,
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[500],
          },
        },
        checkbox: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: '#0066cc',
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.foundation.black,
            text: '#0066cc',
          },
          active: {
            background: '#0066cc',
            border: '#0066cc',
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[400],
          },
        },
        radio: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: '#0066cc',
          },
          hover: {
            background: lightPalette.gray[50],
            border: lightPalette.foundation.black,
            text: '#0066cc',
          },
          active: {
            background: lightPalette.foundation.white,
            border: '#0066cc',
            text: '#0066cc',
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[400],
          },
        },
      },
    },
    
    toolPalette: {
      background: lightPalette.foundation.white,
      border: lightPalette.foundation.black,
      shadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
      search: {
        input: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          active: {
            background: lightPalette.foundation.white,
            border: '#0066cc',
            text: lightPalette.foundation.black,
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[500],
          },
          focus: {
            background: lightPalette.foundation.white,
            border: '#0066cc',
            text: lightPalette.foundation.black,
            shadow: '0 0 0 3px #cceeff',
          },
        },
        icon: lightPalette.gray[600],
      },
      categories: {
        header: {
          background: lightPalette.gray[100],
          text: lightPalette.foundation.black,
          border: lightPalette.foundation.black,
        },
        expanded: {
          background: lightPalette.foundation.white,
        },
      },
      tools: {
        item: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.transparent,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.gray[100],
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          active: {
            background: '#cceeff',
            border: '#0066cc',
            text: lightPalette.foundation.black,
          },
          disabled: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
        icon: lightPalette.gray[700],
        label: lightPalette.foundation.black,
        dragPreview: {
          background: lightPalette.foundation.white,
          border: '#0066cc',
          shadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
        },
      },
    },
    
    canvas: {
      background: lightPalette.foundation.white,
      grid: {
        primary: lightPalette.foundation.black,
        secondary: lightPalette.gray[700],
      },
      minimap: {
        background: lightPalette.foundation.white,
        border: lightPalette.foundation.black,
        viewport: '#0066cc',
        mask: 'rgba(0, 102, 204, 0.4)', // Semi-transparent blue overlay for high contrast
      },
      controls: {
        background: lightPalette.foundation.white,
        border: lightPalette.foundation.black,
        shadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
        button: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.gray[100],
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          active: {
            background: '#0066cc',
            border: '#004499',
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[200],
            border: lightPalette.gray[400],
            text: lightPalette.gray[500],
          },
        },
      },
    },
    
    nodes: {
      default: {
        background: lightPalette.foundation.white,
        border: lightPalette.foundation.black,
        shadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      },
      selected: {
        background: lightPalette.foundation.white,
        border: '#0066cc',
        shadow: '0 0 0 3px #cceeff',
      },
      dragging: {
        background: lightPalette.foundation.white,
        border: '#0066cc',
        shadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
      },
      header: {
        background: lightPalette.gray[100],
        text: lightPalette.foundation.black,
        icon: lightPalette.foundation.black,
      },
      content: {
        background: lightPalette.foundation.white,
        text: lightPalette.foundation.black,
      },
      handles: {
        input: {
          background: '#0066cc',
          border: '#004499',
          connected: '#002266',
        },
        output: {
          background: '#006600',
          border: '#004400',
          connected: '#002200',
        },
      },
    },
    
    edges: {
      default: {
        stroke: lightPalette.foundation.black,
        strokeHover: lightPalette.foundation.black,
      },
      selected: {
        stroke: '#0066cc',
        strokeHover: '#0066cc',
      },
      animated: {
        stroke: '#6600cc',
        strokeHover: '#6600cc',
      },
      invalid: {
        stroke: '#cc0000',
        strokeHover: '#cc0000',
      },
    },
    
    modals: {
      overlay: 'rgba(0, 0, 0, 0.8)',
      container: {
        background: lightPalette.foundation.white,
        border: lightPalette.foundation.black,
        shadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
      },
      header: {
        background: lightPalette.gray[100],
        border: lightPalette.foundation.black,
        text: lightPalette.foundation.black,
      },
      content: {
        background: lightPalette.foundation.white,
        text: lightPalette.foundation.black,
      },
      buttons: {
        primary: {
          default: {
            background: '#0066cc',
            border: '#004499',
            text: lightPalette.foundation.white,
          },
          hover: {
            background: '#0088ff',
            border: '#0066cc',
            text: lightPalette.foundation.white,
          },
          active: {
            background: '#004499',
            border: '#002266',
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[500],
          },
        },
        secondary: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.gray[100],
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          active: {
            background: lightPalette.gray[200],
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[400],
          },
        },
        cancel: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[600],
          },
          hover: {
            background: lightPalette.gray[100],
            border: lightPalette.foundation.transparent,
            text: lightPalette.foundation.black,
          },
          active: {
            background: lightPalette.gray[200],
            border: lightPalette.foundation.transparent,
            text: lightPalette.foundation.black,
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
      },
    },
    
    notifications: {
      success: {
        background: '#eeffee',
        border: '#006600',
        text: '#004400',
        icon: '#006600',
      },
      warning: {
        background: '#fffaee',
        border: '#cc6600',
        text: '#aa4400',
        icon: '#cc6600',
      },
      error: {
        background: '#ffeeee',
        border: '#cc0000',
        text: '#990000',
        icon: '#cc0000',
      },
      info: {
        background: '#eeeeff',
        border: '#0066cc',
        text: '#004499',
        icon: '#0066cc',
      },
    },
    
    syntax: {
      tag: '#0066cc',
      attribute: '#006600',
      value: '#cc0000',
      comment: '#666666',
      declaration: '#6600cc',
      text: lightPalette.foundation.black,
      background: lightPalette.foundation.white,
      selection: '#cceeff',
    },
    
    forms: {
      input: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.foundation.black,
          text: lightPalette.foundation.black,
        },
        hover: {
          background: lightPalette.foundation.white,
          border: lightPalette.foundation.black,
          text: lightPalette.foundation.black,
        },
        active: {
          background: lightPalette.foundation.white,
          border: '#0066cc',
          text: lightPalette.foundation.black,
        },
        disabled: {
          background: lightPalette.gray[100],
          border: lightPalette.gray[400],
          text: lightPalette.gray[500],
        },
        focus: {
          background: lightPalette.foundation.white,
          border: '#0066cc',
          text: lightPalette.foundation.black,
          shadow: '0 0 0 3px #cceeff',
        },
      },
      select: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.foundation.black,
          text: lightPalette.foundation.black,
        },
        hover: {
          background: lightPalette.foundation.white,
          border: lightPalette.foundation.black,
          text: lightPalette.foundation.black,
        },
        active: {
          background: lightPalette.foundation.white,
          border: '#0066cc',
          text: lightPalette.foundation.black,
        },
        disabled: {
          background: lightPalette.gray[100],
          border: lightPalette.gray[400],
          text: lightPalette.gray[500],
        },
      },
      checkbox: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.foundation.black,
          text: '#0066cc',
        },
        hover: {
          background: lightPalette.gray[50],
          border: lightPalette.foundation.black,
          text: '#0066cc',
        },
        active: {
          background: '#0066cc',
          border: '#0066cc',
          text: lightPalette.foundation.white,
        },
        disabled: {
          background: lightPalette.gray[100],
          border: lightPalette.gray[400],
          text: lightPalette.gray[400],
        },
      },
      radio: {
        default: {
          background: lightPalette.foundation.white,
          border: lightPalette.foundation.black,
          text: '#0066cc',
        },
        hover: {
          background: lightPalette.gray[50],
          border: lightPalette.foundation.black,
          text: '#0066cc',
        },
        active: {
          background: lightPalette.foundation.white,
          border: '#0066cc',
          text: '#0066cc',
        },
        disabled: {
          background: lightPalette.gray[100],
          border: lightPalette.gray[400],
          text: lightPalette.gray[400],
        },
      },
      button: {
        primary: {
          default: {
            background: '#0066cc',
            border: '#004499',
            text: lightPalette.foundation.white,
          },
          hover: {
            background: '#0088ff',
            border: '#0066cc',
            text: lightPalette.foundation.white,
          },
          active: {
            background: '#004499',
            border: '#002266',
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[500],
          },
        },
        secondary: {
          default: {
            background: lightPalette.foundation.white,
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          hover: {
            background: lightPalette.gray[100],
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          active: {
            background: lightPalette.gray[200],
            border: lightPalette.foundation.black,
            text: lightPalette.foundation.black,
          },
          disabled: {
            background: lightPalette.gray[100],
            border: lightPalette.gray[400],
            text: lightPalette.gray[400],
          },
        },
        tertiary: {
          default: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: '#0066cc',
          },
          hover: {
            background: '#cceeff',
            border: lightPalette.foundation.transparent,
            text: '#004499',
          },
          active: {
            background: '#aaddff',
            border: lightPalette.foundation.transparent,
            text: '#002266',
          },
          disabled: {
            background: lightPalette.foundation.transparent,
            border: lightPalette.foundation.transparent,
            text: lightPalette.gray[400],
          },
        },
        danger: {
          default: {
            background: '#cc0000',
            border: '#990000',
            text: lightPalette.foundation.white,
          },
          hover: {
            background: '#ff0000',
            border: '#cc0000',
            text: lightPalette.foundation.white,
          },
          active: {
            background: '#990000',
            border: '#660000',
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[500],
          },
        },
      },
      label: lightPalette.foundation.black,
      helpText: lightPalette.gray[600],
      errorText: '#cc0000',
      successText: '#006600',
    },
  },
};

// Sigilweaver Color Palette - Inspired by the website's mystical design
const sigilweaverPalette: ColorPalette = {
  foundation: {
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  },
  gray: {
    50: '#1a0b2e',   // Deepest mystic purple - main background
    100: '#2a1a3e',  // Slightly lighter - panel backgrounds
    200: '#3a2a52',  // Card/elevated surfaces
    300: '#4a3a66',  // Borders and dividers
    400: '#6a5a86',  // Secondary borders
    500: '#8a7aa6',  // Disabled text/elements
    600: '#aaa0c6',  // Tertiary text
    700: '#cac0e6',  // Secondary text
    800: '#eae0f6',  // Primary text (high contrast)
    900: '#f5f0ff',  // Highest contrast text
    950: '#ffffff',  // Pure white for critical text
  },
  brand: {
    primary: {
      50: '#4c2a6b',   // Deep mystic for dark backgrounds
      100: '#5c3a7b',
      200: '#6b3fa0',
      300: '#7c4fb0',
      400: '#8b5cf6',  // Main brand color
      500: '#9d6ff8',
      600: '#a78bfa',
      700: '#b794fb',
      800: '#c4b5fd',
      900: '#ddd6fe',
    },
    secondary: {
      50: '#b45309',   // Deep gold
      100: '#d97706',
      200: '#f59e0b',  // Website's gold-500
      300: '#fbbf24',  // Website's gold-400
      400: '#fcd34d',  // Website's gold-300
      500: '#fde68a',
      600: '#fef3c7',  // Website's gold-200
      700: '#fffbeb',
      800: '#fffef7',
      900: '#ffffff',
    },
  },
  semantic: {
    success: {
      50: '#064e3b',
      100: '#065f46',
      200: '#047857',
      300: '#059669',
      400: '#10b981',
      500: '#34d399',
      600: '#6ee7b7',
      700: '#a7f3d0',
      800: '#d1fae5',
      900: '#ecfdf5',
    },
    warning: {
      50: '#78350f',
      100: '#92400e',
      200: '#b45309',
      300: '#d97706',
      400: '#f59e0b',
      500: '#fbbf24',
      600: '#fcd34d',
      700: '#fde68a',
      800: '#fef3c7',
      900: '#fffbeb',
    },
    error: {
      50: '#7f1d1d',
      100: '#991b1b',
      200: '#b91c1c',
      300: '#dc2626',
      400: '#ef4444',
      500: '#f87171',
      600: '#fca5a5',
      700: '#fecaca',
      800: '#fee2e2',
      900: '#fef2f2',
    },
    info: {
      50: '#1e3a8a',
      100: '#1e40af',
      200: '#1d4ed8',
      300: '#2563eb',
      400: '#3b82f6',
      500: '#60a5fa',
      600: '#93c5fd',
      700: '#bfdbfe',
      800: '#dbeafe',
      900: '#eff6ff',
    },
  },
  tools: {
    inout: {
      50: '#064e3b',
      100: '#065f46', 
      200: '#047857',
      300: '#059669',
      400: '#10b981',
      500: '#34d399',
      600: '#6ee7b7',
      700: '#a7f3d0',
      800: '#d1fae5',
      900: '#ecfdf5',
    },
    preparation: {
      50: '#1e3a8a',
      100: '#1e40af',
      200: '#1d4ed8', 
      300: '#2563eb',
      400: '#3b82f6',
      500: '#60a5fa',
      600: '#93c5fd',
      700: '#bfdbfe',
      800: '#dbeafe',
      900: '#eff6ff',
    },
    join: {
      50: '#4c1d95',
      100: '#5b21b6',
      200: '#6d28d9',
      300: '#7c3aed',
      400: '#8b5cf6',
      500: '#a78bfa',
      600: '#c4b5fd',
      700: '#ddd6fe',
      800: '#ede9fe',
      900: '#f5f3ff',
    },
    aggregate: {
      50: '#78350f',
      100: '#92400e',
      200: '#b45309',
      300: '#d97706',
      400: '#f59e0b',
      500: '#fbbf24',
      600: '#fcd34d',
      700: '#fde68a',
      800: '#fef3c7',
      900: '#fffbeb',
    },
    favorites: {
      50: '#1a0b2e',
      100: '#2d1b42',
      200: '#3d2852',
      300: '#4c2a6b',
      400: '#5c3a7b',
      500: '#6b3fa0',
      600: '#8b5cf6',
      700: '#a78bfa',
      800: '#c4b5fd',
      900: '#ddd6fe',
    },
  },
};

export const sigilweaverTheme: Theme = {
  id: 'sigilweaver',
  name: 'Sigilweaver',
  description: 'A mystical dark theme inspired by the magic of data weaving',
  colors: {
    palette: sigilweaverPalette,
    
    surfaces: {
      page: sigilweaverPalette.gray[100],      // Deep mystic background
      panel: sigilweaverPalette.gray[200],     // Slightly lighter panels
      elevated: sigilweaverPalette.gray[300],  // Elevated surfaces like tabs
      overlay: 'rgba(26, 11, 46, 0.9)',       // Deep mystic overlay
      canvas: sigilweaverPalette.gray[200],    // Canvas background
    },
    
    text: {
      primary: sigilweaverPalette.gray[950],   // Pure white for best readability
      secondary: sigilweaverPalette.gray[800], // High contrast light text
      tertiary: sigilweaverPalette.gray[700],  // Medium contrast for less important text
      inverse: sigilweaverPalette.gray[50],    // Dark text for light backgrounds
      disabled: sigilweaverPalette.gray[500],  // Disabled state
    },
    
    borders: {
      primary: sigilweaverPalette.gray[400],       // Visible borders
      secondary: sigilweaverPalette.gray[300],     // Secondary borders
      focus: sigilweaverPalette.brand.primary[500], // Brand focus
      divider: sigilweaverPalette.gray[400],       // Dividers
    },
    
    header: {
      background: sigilweaverPalette.gray[100],  // Deep mystic header
      logo: {
        icon: sigilweaverPalette.brand.secondary[400], // Subtle gold accent
        text: sigilweaverPalette.gray[950],            // High contrast white text
      },
      title: {
        text: sigilweaverPalette.gray[950], // High contrast white
      },
      metadata: {
        text: sigilweaverPalette.gray[800], // Good contrast for secondary info
        divider: sigilweaverPalette.gray[400],
      },
      buttons: {
        new: {
          default: {
            background: lightPalette.semantic.success[500],
            border: lightPalette.semantic.success[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.success[600],
            border: lightPalette.semantic.success[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.success[700],
            border: lightPalette.semantic.success[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        import: {
          default: {
            background: lightPalette.brand.primary[500],
            border: lightPalette.brand.primary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.primary[600],
            border: lightPalette.brand.primary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.primary[700],
            border: lightPalette.brand.primary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        export: {
          default: {
            background: lightPalette.gray[600],
            border: lightPalette.gray[700],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.gray[700],
            border: lightPalette.gray[800],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.gray[800],
            border: lightPalette.gray[900],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        viewCode: {
          default: {
            background: lightPalette.brand.secondary[500],
            border: lightPalette.brand.secondary[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.brand.secondary[600],
            border: lightPalette.brand.secondary[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.brand.secondary[700],
            border: lightPalette.brand.secondary[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        preview: {
          default: {
            background: lightPalette.semantic.info[500],
            border: lightPalette.semantic.info[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.info[600],
            border: lightPalette.semantic.info[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.info[700],
            border: lightPalette.semantic.info[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
        run: {
          default: {
            background: lightPalette.semantic.error[500],
            border: lightPalette.semantic.error[600],
            text: lightPalette.foundation.white,
          },
          hover: {
            background: lightPalette.semantic.error[600],
            border: lightPalette.semantic.error[700],
            text: lightPalette.foundation.white,
          },
          active: {
            background: lightPalette.semantic.error[700],
            border: lightPalette.semantic.error[800],
            text: lightPalette.foundation.white,
          },
          disabled: {
            background: lightPalette.gray[400],
            border: lightPalette.gray[400],
            text: lightPalette.gray[600],
          },
        },
      },
      divider: sigilweaverPalette.gray[400],
      themeSelector: {
        trigger: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[800],
          },
          hover: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[900],
          },
          active: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[700],
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
        dropdown: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.gray[400],
          shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        },
        option: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[800],
          },
          hover: {
            background: sigilweaverPalette.brand.primary[500],
            border: sigilweaverPalette.brand.primary[600],
            text: sigilweaverPalette.foundation.white,
          },
          active: {
            background: sigilweaverPalette.brand.primary[600],
            border: sigilweaverPalette.brand.primary[700],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
      },
    },

    configPanel: {
      background: sigilweaverPalette.gray[200],
      border: sigilweaverPalette.gray[400],
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      header: {
        background: sigilweaverPalette.gray[200],
        border: sigilweaverPalette.gray[400],
        text: sigilweaverPalette.gray[950], // High contrast white
      },
      sections: {
        background: sigilweaverPalette.gray[300],
        border: sigilweaverPalette.gray[400],
        title: sigilweaverPalette.gray[950], // High contrast white
      },
      fields: {
        label: sigilweaverPalette.gray[950], // High contrast white for labels
        input: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[950], // High contrast white text
          },
          hover: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          active: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.brand.primary[500],
            text: sigilweaverPalette.gray[950],
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[500],
          },
        },
        select: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[950], // High contrast white text
          },
          hover: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          active: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.brand.primary[500],
            text: sigilweaverPalette.gray[950],
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[500],
          },
        },
        checkbox: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[950], // High contrast white text
          },
          hover: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          active: {
            background: sigilweaverPalette.brand.primary[500],
            border: sigilweaverPalette.brand.primary[600],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
        radio: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[950], // High contrast white text
          },
          hover: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          active: {
            background: sigilweaverPalette.brand.primary[500],
            border: sigilweaverPalette.brand.primary[600],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
      },
    },

    toolPalette: {
      background: sigilweaverPalette.gray[200],
      border: sigilweaverPalette.gray[400],
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      search: {
        input: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[800],
          },
          hover: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[900],
          },
          active: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.brand.primary[500],
            text: sigilweaverPalette.gray[900],
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[500],
          },
        },
        icon: sigilweaverPalette.gray[600],
      },
      categories: {
        header: {
          background: sigilweaverPalette.gray[300],
          text: sigilweaverPalette.gray[950], // High contrast white
          border: sigilweaverPalette.gray[400],
        },
        expanded: {
          background: sigilweaverPalette.gray[200],
        },
      },
      tools: {
        item: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[950], // High contrast white
          },
          hover: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          active: {
            background: sigilweaverPalette.brand.primary[500],
            border: sigilweaverPalette.brand.primary[600],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
        icon: sigilweaverPalette.gray[800], // Good contrast for icons
        label: sigilweaverPalette.gray[950], // High contrast white for labels
        dragPreview: {
          background: sigilweaverPalette.brand.primary[400],
          border: sigilweaverPalette.brand.primary[300],
          shadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
        },
      },
    },

    canvas: {
      background: sigilweaverPalette.gray[200],
      grid: {
        primary: sigilweaverPalette.gray[400],
        secondary: sigilweaverPalette.gray[300],
      },
      minimap: {
        background: sigilweaverPalette.gray[300],
        border: sigilweaverPalette.gray[400],
        viewport: sigilweaverPalette.brand.primary[500],
        mask: 'rgba(139, 92, 246, 0.3)', // Semi-transparent purple overlay
      },
      controls: {
        background: sigilweaverPalette.gray[300],
        border: sigilweaverPalette.gray[400],
        shadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        button: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[800],
          },
          hover: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[900],
          },
          active: {
            background: sigilweaverPalette.brand.primary[500],
            border: sigilweaverPalette.brand.primary[600],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
      },
    },

    nodes: {
      default: {
        background: sigilweaverPalette.gray[300],
        border: sigilweaverPalette.gray[400],
        shadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      selected: {
        background: sigilweaverPalette.gray[300],
        border: sigilweaverPalette.brand.primary[500],
        shadow: '0 4px 8px rgba(139, 92, 246, 0.3)',
      },
      dragging: {
        background: sigilweaverPalette.brand.primary[400],
        border: sigilweaverPalette.brand.primary[500],
        shadow: '0 8px 16px rgba(139, 92, 246, 0.4)',
      },
      header: {
        background: sigilweaverPalette.gray[400],
        text: sigilweaverPalette.gray[950], // High contrast white
        icon: sigilweaverPalette.brand.primary[600],
      },
      content: {
        background: sigilweaverPalette.gray[300],
        text: sigilweaverPalette.gray[950], // High contrast white
      },
      handles: {
        input: {
          background: sigilweaverPalette.gray[400],
          border: sigilweaverPalette.gray[500],
          connected: sigilweaverPalette.semantic.success[500],
        },
        output: {
          background: sigilweaverPalette.gray[400],
          border: sigilweaverPalette.gray[500],
          connected: sigilweaverPalette.semantic.info[500],
        },
      },
    },

    edges: {
      default: {
        stroke: sigilweaverPalette.brand.primary[400], // Purple for sigilweaver theme
        strokeHover: sigilweaverPalette.brand.primary[300],
      },
      selected: {
        stroke: sigilweaverPalette.brand.primary[300],
        strokeHover: sigilweaverPalette.brand.primary[200],
      },
      animated: {
        stroke: sigilweaverPalette.brand.secondary[400], // Gold for animated
        strokeHover: sigilweaverPalette.brand.secondary[300],
      },
      invalid: {
        stroke: sigilweaverPalette.semantic.error[400],
        strokeHover: sigilweaverPalette.semantic.error[300],
      },
    },

    modals: {
      overlay: 'rgba(26, 11, 46, 0.8)',
      container: {
        background: sigilweaverPalette.gray[200],
        border: sigilweaverPalette.gray[400],
        shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
      },
      header: {
        background: sigilweaverPalette.gray[200],
        border: sigilweaverPalette.gray[400],
        text: sigilweaverPalette.gray[950], // High contrast white
      },
      content: {
        background: sigilweaverPalette.gray[200],
        text: sigilweaverPalette.gray[950], // High contrast white
      },
      buttons: {
        primary: {
          default: {
            background: sigilweaverPalette.brand.primary[500],
            border: sigilweaverPalette.brand.primary[600],
            text: sigilweaverPalette.foundation.white,
          },
          hover: {
            background: sigilweaverPalette.brand.primary[400],
            border: sigilweaverPalette.brand.primary[500],
            text: sigilweaverPalette.foundation.white,
          },
          active: {
            background: sigilweaverPalette.brand.primary[600],
            border: sigilweaverPalette.brand.primary[700],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[500],
          },
        },
        secondary: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[800],
          },
          hover: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[900],
          },
          active: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[700],
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
        cancel: {
          default: {
            background: sigilweaverPalette.semantic.error[500],
            border: sigilweaverPalette.semantic.error[600],
            text: sigilweaverPalette.foundation.white,
          },
          hover: {
            background: sigilweaverPalette.semantic.error[400],
            border: sigilweaverPalette.semantic.error[500],
            text: sigilweaverPalette.foundation.white,
          },
          active: {
            background: sigilweaverPalette.semantic.error[600],
            border: sigilweaverPalette.semantic.error[700],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[500],
          },
        },
      },
    },

    notifications: {
      success: {
        background: sigilweaverPalette.semantic.success[100],
        border: sigilweaverPalette.semantic.success[400],
        text: sigilweaverPalette.semantic.success[800],
        icon: sigilweaverPalette.semantic.success[500],
      },
      warning: {
        background: sigilweaverPalette.semantic.warning[100],
        border: sigilweaverPalette.semantic.warning[400],
        text: sigilweaverPalette.semantic.warning[800],
        icon: sigilweaverPalette.semantic.warning[500],
      },
      error: {
        background: sigilweaverPalette.semantic.error[100],
        border: sigilweaverPalette.semantic.error[400],
        text: sigilweaverPalette.semantic.error[800],
        icon: sigilweaverPalette.semantic.error[500],
      },
      info: {
        background: sigilweaverPalette.semantic.info[100],
        border: sigilweaverPalette.semantic.info[400],
        text: sigilweaverPalette.semantic.info[800],
        icon: sigilweaverPalette.semantic.info[500],
      },
    },

    syntax: {
      tag: sigilweaverPalette.brand.primary[600],
      attribute: sigilweaverPalette.brand.secondary[400], // Gold
      value: sigilweaverPalette.semantic.success[500],
      comment: sigilweaverPalette.gray[600],
      declaration: sigilweaverPalette.brand.primary[500],
      text: sigilweaverPalette.gray[950], // High contrast white
      background: sigilweaverPalette.gray[300],
      selection: sigilweaverPalette.brand.primary[200],
    },

    forms: {
      input: {
        default: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.gray[400],
          text: sigilweaverPalette.gray[950], // High contrast white
        },
        hover: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.gray[500],
          text: sigilweaverPalette.gray[950],
        },
        active: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.brand.primary[500],
          text: sigilweaverPalette.gray[950],
        },
        disabled: {
          background: sigilweaverPalette.gray[200],
          border: sigilweaverPalette.gray[300],
          text: sigilweaverPalette.gray[500],
        },
      },
      select: {
        default: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.gray[400],
          text: sigilweaverPalette.gray[950], // High contrast white
        },
        hover: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.gray[500],
          text: sigilweaverPalette.gray[950],
        },
        active: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.brand.primary[500],
          text: sigilweaverPalette.gray[950],
        },
        disabled: {
          background: sigilweaverPalette.gray[200],
          border: sigilweaverPalette.gray[300],
          text: sigilweaverPalette.gray[500],
        },
      },
      checkbox: {
        default: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.gray[400],
          text: sigilweaverPalette.gray[950], // High contrast white
        },
        hover: {
          background: sigilweaverPalette.gray[400],
          border: sigilweaverPalette.gray[500],
          text: sigilweaverPalette.gray[950],
        },
        active: {
          background: sigilweaverPalette.brand.primary[500],
          border: sigilweaverPalette.brand.primary[600],
          text: sigilweaverPalette.foundation.white,
        },
        disabled: {
          background: sigilweaverPalette.gray[200],
          border: sigilweaverPalette.gray[300],
          text: sigilweaverPalette.gray[400],
        },
      },
      radio: {
        default: {
          background: sigilweaverPalette.gray[300],
          border: sigilweaverPalette.gray[400],
          text: sigilweaverPalette.gray[950], // High contrast white
        },
        hover: {
          background: sigilweaverPalette.gray[400],
          border: sigilweaverPalette.gray[500],
          text: sigilweaverPalette.gray[950],
        },
        active: {
          background: sigilweaverPalette.brand.primary[500],
          border: sigilweaverPalette.brand.primary[600],
          text: sigilweaverPalette.foundation.white,
        },
        disabled: {
          background: sigilweaverPalette.gray[200],
          border: sigilweaverPalette.gray[300],
          text: sigilweaverPalette.gray[400],
        },
      },
      button: {
        primary: {
          default: {
            background: sigilweaverPalette.brand.primary[500],
            border: sigilweaverPalette.brand.primary[600],
            text: sigilweaverPalette.foundation.white,
          },
          hover: {
            background: sigilweaverPalette.brand.primary[400],
            border: sigilweaverPalette.brand.primary[500],
            text: sigilweaverPalette.foundation.white,
          },
          active: {
            background: sigilweaverPalette.brand.primary[600],
            border: sigilweaverPalette.brand.primary[700],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[500],
          },
        },
        secondary: {
          default: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[950], // High contrast white
          },
          hover: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          active: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[950],
          },
          disabled: {
            background: sigilweaverPalette.gray[200],
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
        tertiary: {
          default: {
            background: sigilweaverPalette.foundation.transparent,
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[950], // High contrast white
          },
          hover: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          active: {
            background: sigilweaverPalette.gray[400],
            border: sigilweaverPalette.gray[500],
            text: sigilweaverPalette.gray[950],
          },
          disabled: {
            background: sigilweaverPalette.foundation.transparent,
            border: sigilweaverPalette.gray[300],
            text: sigilweaverPalette.gray[400],
          },
        },
        danger: {
          default: {
            background: sigilweaverPalette.semantic.error[500],
            border: sigilweaverPalette.semantic.error[600],
            text: sigilweaverPalette.foundation.white,
          },
          hover: {
            background: sigilweaverPalette.semantic.error[400],
            border: sigilweaverPalette.semantic.error[500],
            text: sigilweaverPalette.foundation.white,
          },
          active: {
            background: sigilweaverPalette.semantic.error[600],
            border: sigilweaverPalette.semantic.error[700],
            text: sigilweaverPalette.foundation.white,
          },
          disabled: {
            background: sigilweaverPalette.gray[300],
            border: sigilweaverPalette.gray[400],
            text: sigilweaverPalette.gray[500],
          },
        },
      },
      label: sigilweaverPalette.gray[950], // High contrast white
      helpText: sigilweaverPalette.gray[800], // Good contrast for help text
      errorText: sigilweaverPalette.semantic.error[400],
      successText: sigilweaverPalette.semantic.success[500],
    },
  },
};

export const availableThemes: Theme[] = [
  lightTheme,
  darkTheme,
  highContrastTheme,
  sigilweaverTheme,
];

export const getThemeById = (id: string): Theme => {
  return availableThemes.find(theme => theme.id === id) || sigilweaverTheme;
};
