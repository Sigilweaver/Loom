import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme, ThemeContextType } from '../types/theme';
import { availableThemes, getThemeById, lightTheme } from '../themes';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(lightTheme);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedThemeId = localStorage.getItem('sigilweaver-theme');
    if (savedThemeId) {
      const theme = getThemeById(savedThemeId);
      setCurrentTheme(theme);
      applyThemeVariables(theme);
    } else {
      applyThemeVariables(lightTheme);
    }
  }, []);

  // Apply CSS custom properties when theme changes
  const applyThemeVariables = (theme: Theme) => {
    const root = document.documentElement;
    const { colors } = theme;

    // Background colors
    root.style.setProperty('--color-bg-primary', colors.background.primary);
    root.style.setProperty('--color-bg-secondary', colors.background.secondary);
    root.style.setProperty('--color-bg-tertiary', colors.background.tertiary);
    root.style.setProperty('--color-bg-elevated', colors.background.elevated);

    // Text colors
    root.style.setProperty('--color-text-primary', colors.text.primary);
    root.style.setProperty('--color-text-secondary', colors.text.secondary);
    root.style.setProperty('--color-text-tertiary', colors.text.tertiary);
    root.style.setProperty('--color-text-inverse', colors.text.inverse);
    root.style.setProperty('--color-text-muted', colors.text.muted);

    // Border colors
    root.style.setProperty('--color-border-primary', colors.border.primary);
    root.style.setProperty('--color-border-secondary', colors.border.secondary);
    root.style.setProperty('--color-border-focus', colors.border.focus);
    root.style.setProperty('--color-border-error', colors.border.error);
    root.style.setProperty('--color-border-success', colors.border.success);

    // Tool category colors
    root.style.setProperty('--color-tool-inout', colors.tool.inout);
    root.style.setProperty('--color-tool-preparation', colors.tool.preparation);
    root.style.setProperty('--color-tool-join', colors.tool.join);
    root.style.setProperty('--color-tool-aggregate', colors.tool.aggregate);
    root.style.setProperty('--color-tool-favorites', colors.tool.favorites);
    root.style.setProperty('--color-tool-default', colors.tool.default);

    // Interactive states
    root.style.setProperty('--color-interactive-primary', colors.interactive.primary.default);
    root.style.setProperty('--color-interactive-primary-hover', colors.interactive.primary.hover);
    root.style.setProperty('--color-interactive-primary-active', colors.interactive.primary.active);
    root.style.setProperty('--color-interactive-primary-disabled', colors.interactive.primary.disabled);
    
    root.style.setProperty('--color-interactive-secondary', colors.interactive.secondary.default);
    root.style.setProperty('--color-interactive-secondary-hover', colors.interactive.secondary.hover);
    root.style.setProperty('--color-interactive-secondary-active', colors.interactive.secondary.active);
    root.style.setProperty('--color-interactive-secondary-disabled', colors.interactive.secondary.disabled);
    
    root.style.setProperty('--color-interactive-accent', colors.interactive.accent.default);
    root.style.setProperty('--color-interactive-accent-hover', colors.interactive.accent.hover);
    root.style.setProperty('--color-interactive-accent-active', colors.interactive.accent.active);

    // Semantic colors
    Object.entries(colors.semantic).forEach(([type, colors]) => {
      root.style.setProperty(`--color-${type}-bg`, colors.background);
      root.style.setProperty(`--color-${type}-border`, colors.border);
      root.style.setProperty(`--color-${type}-text`, colors.text);
      root.style.setProperty(`--color-${type}-accent`, colors.accent);
    });

    // Workflow colors
    root.style.setProperty('--color-workflow-canvas', colors.workflow.canvas);
    root.style.setProperty('--color-workflow-grid-primary', colors.workflow.grid.primary);
    root.style.setProperty('--color-workflow-grid-secondary', colors.workflow.grid.secondary);
    root.style.setProperty('--color-workflow-edge-default', colors.workflow.edge.default);
    root.style.setProperty('--color-workflow-edge-hover', colors.workflow.edge.hover);
    root.style.setProperty('--color-workflow-edge-selected', colors.workflow.edge.selected);
    root.style.setProperty('--color-workflow-edge-rejected', colors.workflow.edge.rejected);
    root.style.setProperty('--color-workflow-node-bg', colors.workflow.node.background);
    root.style.setProperty('--color-workflow-node-shadow', colors.workflow.node.shadow);
    root.style.setProperty('--color-workflow-handle-input', colors.workflow.node.handle.input);
    root.style.setProperty('--color-workflow-handle-output', colors.workflow.node.handle.output);

    // Syntax highlighting colors
    Object.entries(colors.syntax).forEach(([type, color]) => {
      root.style.setProperty(`--color-syntax-${type}`, color);
    });

    // Set theme attribute for CSS selectors
    root.setAttribute('data-theme', theme.id);
  };

  const setTheme = (themeId: string) => {
    const theme = getThemeById(themeId);
    setCurrentTheme(theme);
    applyThemeVariables(theme);
    localStorage.setItem('sigilweaver-theme', themeId);
  };

  const contextValue: ThemeContextType = {
    currentTheme,
    availableThemes,
    setTheme,
    isDark: currentTheme.id === 'dark',
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
