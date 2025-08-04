export interface ThemeColors {
  // Base colors
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
  };
  
  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
    muted: string;
  };
  
  // Border colors
  border: {
    primary: string;
    secondary: string;
    focus: string;
    error: string;
    success: string;
  };
  
  // Tool category colors (preserve visual associations)
  tool: {
    inout: string;
    preparation: string;
    join: string;
    aggregate: string;
    favorites: string;
    default: string;
  };
  
  // Interactive states
  interactive: {
    primary: {
      default: string;
      hover: string;
      active: string;
      disabled: string;
    };
    secondary: {
      default: string;
      hover: string;
      active: string;
      disabled: string;
    };
    accent: {
      default: string;
      hover: string;
      active: string;
    };
  };
  
  // Semantic colors
  semantic: {
    error: {
      background: string;
      border: string;
      text: string;
      accent: string;
    };
    warning: {
      background: string;
      border: string;
      text: string;
      accent: string;
    };
    success: {
      background: string;
      border: string;
      text: string;
      accent: string;
    };
    info: {
      background: string;
      border: string;
      text: string;
      accent: string;
    };
  };
  
  // Workflow-specific colors
  workflow: {
    canvas: string;
    grid: {
      primary: string;
      secondary: string;
    };
    edge: {
      default: string;
      hover: string;
      selected: string;
      rejected: string;
    };
    node: {
      background: string;
      shadow: string;
      handle: {
        input: string;
        output: string;
      };
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
