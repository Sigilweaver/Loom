// Color palette definitions - base colors that other components reference
export interface ColorPalette {
  // Foundation colors
  foundation: {
    white: string;
    black: string;
    transparent: string;
  };
  
  // Grayscale palette
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
  
  // Brand colors
  brand: {
    primary: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    secondary: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
  };
  
  // Semantic color scales
  semantic: {
    success: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    warning: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    error: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    info: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
  };
  
  // Tool category colors (preserve visual associations)
  tools: {
    inout: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    preparation: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    join: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    aggregate: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    favorites: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
  };
}

// UI element styling interface
export interface ElementStyle {
  background: string;
  border: string;
  text: string;
  shadow?: string;
}

export interface InteractiveElementStyle {
  default: ElementStyle;
  hover: ElementStyle;
  active: ElementStyle;
  disabled: ElementStyle;
  focus?: ElementStyle;
}

// Component-specific theming
export interface ThemeColors {
  // Global color palette
  palette: ColorPalette;
  
  // Global backgrounds and surfaces
  surfaces: {
    page: string;           // Main app background
    panel: string;          // Side panels, secondary backgrounds
    elevated: string;       // Cards, modals, elevated surfaces
    overlay: string;        // Modal overlays, dropdowns
    canvas: string;         // Workflow canvas background
  };
  
  // Global text colors
  text: {
    primary: string;        // Main content text
    secondary: string;      // Secondary content text
    tertiary: string;       // Muted text, captions
    inverse: string;        // Text on dark backgrounds
    disabled: string;       // Disabled text
  };
  
  // Global border colors
  borders: {
    primary: string;        // Main borders
    secondary: string;      // Subtle borders
    focus: string;          // Focus indicators
    divider: string;        // Section dividers
  };
  
  // Header component theming
  header: {
    background: string;
    logo: {
      icon: string;
      text: string;
    };
    title: {
      text: string;
    };
    metadata: {
      text: string;
      divider: string;
    };
    buttons: {
      new: InteractiveElementStyle;
      import: InteractiveElementStyle;
      export: InteractiveElementStyle;
      viewCode: InteractiveElementStyle;
      preview: InteractiveElementStyle;
      run: InteractiveElementStyle;
    };
    divider: string;
    themeSelector: {
      trigger: InteractiveElementStyle;
      dropdown: {
        background: string;
        border: string;
        shadow: string;
      };
      option: InteractiveElementStyle;
    };
  };
  
  // Configuration panel theming
  configPanel: {
    background: string;
    border: string;
    shadow: string;
    header: {
      background: string;
      border: string;
      text: string;
    };
    sections: {
      background: string;
      border: string;
      title: string;
    };
    fields: {
      label: string;
      input: InteractiveElementStyle;
      select: InteractiveElementStyle;
      checkbox: InteractiveElementStyle;
      radio: InteractiveElementStyle;
    };
  };
  
  // Tool palette theming
  toolPalette: {
    background: string;
    border: string;
    shadow: string;
    search: {
      input: InteractiveElementStyle;
      icon: string;
    };
    categories: {
      header: {
        background: string;
        text: string;
        border: string;
      };
      expanded: {
        background: string;
      };
    };
    tools: {
      item: InteractiveElementStyle;
      icon: string;
      label: string;
      dragPreview: {
        background: string;
        border: string;
        shadow: string;
      };
    };
  };
  
  // Canvas and workflow theming
  canvas: {
    background: string;
    grid: {
      primary: string;
      secondary: string;
    };
    minimap: {
      background: string;
      border: string;
      viewport: string;
      mask: string;
    };
    controls: {
      background: string;
      border: string;
      shadow: string;
      button: InteractiveElementStyle;
    };
  };
  
  // Workflow nodes theming
  nodes: {
    default: {
      background: string;
      border: string;
      shadow: string;
    };
    selected: {
      background: string;
      border: string;
      shadow: string;
    };
    dragging: {
      background: string;
      border: string;
      shadow: string;
    };
    header: {
      background: string;
      text: string;
      icon: string;
    };
    content: {
      background: string;
      text: string;
    };
    handles: {
      input: {
        background: string;
        border: string;
        connected: string;
      };
      output: {
        background: string;
        border: string;
        connected: string;
      };
    };
  };
  
  // Workflow edges/connections theming
  edges: {
    default: {
      stroke: string;
      strokeHover: string;
    };
    selected: {
      stroke: string;
      strokeHover: string;
    };
    animated: {
      stroke: string;
      strokeHover: string;
    };
    invalid: {
      stroke: string;
      strokeHover: string;
    };
  };
  
  // Modal and overlay theming
  modals: {
    overlay: string;
    container: {
      background: string;
      border: string;
      shadow: string;
    };
    header: {
      background: string;
      border: string;
      text: string;
    };
    content: {
      background: string;
      text: string;
    };
    buttons: {
      primary: InteractiveElementStyle;
      secondary: InteractiveElementStyle;
      cancel: InteractiveElementStyle;
    };
  };
  
  // Notification system theming
  notifications: {
    success: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };
    warning: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };
    error: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };
    info: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };
  };
  
  // Code syntax highlighting
  syntax: {
    tag: string;
    attribute: string;
    value: string;
    comment: string;
    declaration: string;
    text: string;
    background: string;
    selection: string;
  };
  
  // Form controls theming
  forms: {
    input: InteractiveElementStyle;
    select: InteractiveElementStyle;
    checkbox: InteractiveElementStyle;
    radio: InteractiveElementStyle;
    button: {
      primary: InteractiveElementStyle;
      secondary: InteractiveElementStyle;
      tertiary: InteractiveElementStyle;
      danger: InteractiveElementStyle;
    };
    label: string;
    helpText: string;
    errorText: string;
    successText: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

export interface ThemeContextType {
  currentTheme: Theme;
  availableThemes: Theme[];
  setTheme: (themeId: string) => void;
  isDark: boolean;
}
