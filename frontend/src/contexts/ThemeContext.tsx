import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { availableThemes, getThemeById, sigilweaverTheme } from "../themes";
import { Theme, ThemeContextType } from "../types/theme";
import { useSettingsStore } from "../state/settingsStore";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

// Apply CSS custom properties when theme changes (kept outside component to avoid HMR churn)
const applyThemeVariables = (theme: Theme) => {
  const root = document.documentElement;
  const { colors } = theme;

  // Global surfaces
  root.style.setProperty("--color-surface-page", colors.surfaces.page);
  root.style.setProperty("--color-surface-panel", colors.surfaces.panel);
  root.style.setProperty("--color-surface-elevated", colors.surfaces.elevated);
  root.style.setProperty("--color-surface-overlay", colors.surfaces.overlay);
  root.style.setProperty("--color-surface-canvas", colors.surfaces.canvas);

  // Global text
  root.style.setProperty("--color-text-primary", colors.text.primary);
  root.style.setProperty("--color-text-secondary", colors.text.secondary);
  root.style.setProperty("--color-text-tertiary", colors.text.tertiary);
  root.style.setProperty("--color-text-inverse", colors.text.inverse);
  root.style.setProperty("--color-text-disabled", colors.text.disabled);

  // Global borders
  root.style.setProperty("--color-border-primary", colors.borders.primary);
  root.style.setProperty("--color-border-secondary", colors.borders.secondary);
  root.style.setProperty("--color-border-focus", colors.borders.focus);
  root.style.setProperty("--color-border-divider", colors.borders.divider);

  // Header component
  root.style.setProperty("--color-header-bg", colors.header.background);
  root.style.setProperty("--color-header-logo-icon", colors.header.logo.icon);
  root.style.setProperty("--color-header-logo-text", colors.header.logo.text);
  root.style.setProperty("--color-header-title-text", colors.header.title.text);
  root.style.setProperty(
    "--color-header-metadata-text",
    colors.header.metadata.text
  );
  root.style.setProperty(
    "--color-header-metadata-divider",
    colors.header.metadata.divider
  );
  root.style.setProperty("--color-header-divider", colors.header.divider);

  // Header buttons
  const buttonMappings = {
    new: colors.header.buttons.new,
    import: colors.header.buttons.import,
    export: colors.header.buttons.export,
    viewcode: colors.header.buttons.viewCode,
    preview: colors.header.buttons.preview,
    run: colors.header.buttons.run,
  };

  Object.entries(buttonMappings).forEach(([buttonType, button]) => {
    root.style.setProperty(
      `--color-header-btn-${buttonType}-bg`,
      button.default.background
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-bg-hover`,
      button.hover.background
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-bg-active`,
      button.active.background
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-bg-disabled`,
      button.disabled.background
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-border`,
      button.default.border
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-border-hover`,
      button.hover.border
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-border-active`,
      button.active.border
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-border-disabled`,
      button.disabled.border
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-text`,
      button.default.text
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-text-hover`,
      button.hover.text
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-text-active`,
      button.active.text
    );
    root.style.setProperty(
      `--color-header-btn-${buttonType}-text-disabled`,
      button.disabled.text
    );
  });

  // Header theme selector
  const themeSelector = colors.header.themeSelector;
  root.style.setProperty(
    "--color-header-theme-trigger-bg",
    themeSelector.trigger.default.background
  );
  root.style.setProperty(
    "--color-header-theme-trigger-bg-hover",
    themeSelector.trigger.hover.background
  );
  root.style.setProperty(
    "--color-header-theme-trigger-bg-active",
    themeSelector.trigger.active.background
  );
  root.style.setProperty(
    "--color-header-theme-trigger-bg-disabled",
    themeSelector.trigger.disabled.background
  );
  root.style.setProperty(
    "--color-header-theme-trigger-border",
    themeSelector.trigger.default.border
  );
  root.style.setProperty(
    "--color-header-theme-trigger-border-hover",
    themeSelector.trigger.hover.border
  );
  root.style.setProperty(
    "--color-header-theme-trigger-border-active",
    themeSelector.trigger.active.border
  );
  root.style.setProperty(
    "--color-header-theme-trigger-border-disabled",
    themeSelector.trigger.disabled.border
  );
  root.style.setProperty(
    "--color-header-theme-trigger-text",
    themeSelector.trigger.default.text
  );
  root.style.setProperty(
    "--color-header-theme-trigger-text-hover",
    themeSelector.trigger.hover.text
  );
  root.style.setProperty(
    "--color-header-theme-trigger-text-active",
    themeSelector.trigger.active.text
  );
  root.style.setProperty(
    "--color-header-theme-trigger-text-disabled",
    themeSelector.trigger.disabled.text
  );

  root.style.setProperty(
    "--color-header-theme-dropdown-bg",
    themeSelector.dropdown.background
  );
  root.style.setProperty(
    "--color-header-theme-dropdown-border",
    themeSelector.dropdown.border
  );
  root.style.setProperty(
    "--color-header-theme-dropdown-shadow",
    themeSelector.dropdown.shadow
  );

  root.style.setProperty(
    "--color-header-theme-option-bg",
    themeSelector.option.default.background
  );
  root.style.setProperty(
    "--color-header-theme-option-bg-hover",
    themeSelector.option.hover.background
  );
  root.style.setProperty(
    "--color-header-theme-option-bg-active",
    themeSelector.option.active.background
  );
  root.style.setProperty(
    "--color-header-theme-option-bg-disabled",
    themeSelector.option.disabled.background
  );
  root.style.setProperty(
    "--color-header-theme-option-border",
    themeSelector.option.default.border
  );
  root.style.setProperty(
    "--color-header-theme-option-border-hover",
    themeSelector.option.hover.border
  );
  root.style.setProperty(
    "--color-header-theme-option-border-active",
    themeSelector.option.active.border
  );
  root.style.setProperty(
    "--color-header-theme-option-border-disabled",
    themeSelector.option.disabled.border
  );
  root.style.setProperty(
    "--color-header-theme-option-text",
    themeSelector.option.default.text
  );
  root.style.setProperty(
    "--color-header-theme-option-text-hover",
    themeSelector.option.hover.text
  );
  root.style.setProperty(
    "--color-header-theme-option-text-active",
    themeSelector.option.active.text
  );
  root.style.setProperty(
    "--color-header-theme-option-text-disabled",
    themeSelector.option.disabled.text
  );

  // Configuration panel
  root.style.setProperty(
    "--color-config-panel-bg",
    colors.configPanel.background
  );
  root.style.setProperty(
    "--color-config-panel-border",
    colors.configPanel.border
  );
  root.style.setProperty(
    "--color-config-panel-shadow",
    colors.configPanel.shadow
  );
  root.style.setProperty(
    "--color-config-header-bg",
    colors.configPanel.header.background
  );
  root.style.setProperty(
    "--color-config-header-border",
    colors.configPanel.header.border
  );
  root.style.setProperty(
    "--color-config-header-text",
    colors.configPanel.header.text
  );
  root.style.setProperty(
    "--color-config-section-bg",
    colors.configPanel.sections.background
  );
  root.style.setProperty(
    "--color-config-section-border",
    colors.configPanel.sections.border
  );
  root.style.setProperty(
    "--color-config-section-title",
    colors.configPanel.sections.title
  );
  root.style.setProperty(
    "--color-config-field-label",
    colors.configPanel.fields.label
  );

  // Tool palette
  root.style.setProperty(
    "--color-tool-palette-bg",
    colors.toolPalette.background
  );
  root.style.setProperty(
    "--color-tool-palette-border",
    colors.toolPalette.border
  );
  root.style.setProperty(
    "--color-tool-palette-shadow",
    colors.toolPalette.shadow
  );
  root.style.setProperty(
    "--color-tool-search-icon",
    colors.toolPalette.search.icon
  );
  root.style.setProperty(
    "--color-tool-category-header-bg",
    colors.toolPalette.categories.header.background
  );
  root.style.setProperty(
    "--color-tool-category-header-text",
    colors.toolPalette.categories.header.text
  );
  root.style.setProperty(
    "--color-tool-category-header-border",
    colors.toolPalette.categories.header.border
  );
  root.style.setProperty(
    "--color-tool-category-expanded-bg",
    colors.toolPalette.categories.expanded.background
  );
  root.style.setProperty(
    "--color-tool-item-icon",
    colors.toolPalette.tools.icon
  );
  root.style.setProperty(
    "--color-tool-item-label",
    colors.toolPalette.tools.label
  );
  root.style.setProperty(
    "--color-tool-drag-preview-bg",
    colors.toolPalette.tools.dragPreview.background
  );
  root.style.setProperty(
    "--color-tool-drag-preview-border",
    colors.toolPalette.tools.dragPreview.border
  );
  root.style.setProperty(
    "--color-tool-drag-preview-shadow",
    colors.toolPalette.tools.dragPreview.shadow
  );

  // Tool tabs accent border (pastel brand for Sigilweaver, fallback to secondary border)
  try {
    const palette = colors.palette as unknown as
      | { brand?: { primary?: Record<string | number, string> } }
      | undefined;
    const pastelAccent =
      theme.id === "sigilweaver"
        ? (palette?.brand?.primary?.[200] ?? colors.borders.focus)
        : colors.borders.secondary;
    root.style.setProperty("--color-tool-tab-accent", pastelAccent);
  } catch {
    root.style.setProperty("--color-tool-tab-accent", colors.borders.secondary);
  }

  // Canvas
  root.style.setProperty("--color-canvas-bg", colors.canvas.background);
  root.style.setProperty(
    "--color-canvas-grid-primary",
    colors.canvas.grid.primary
  );
  root.style.setProperty(
    "--color-canvas-grid-secondary",
    colors.canvas.grid.secondary
  );
  root.style.setProperty(
    "--color-canvas-minimap-bg",
    colors.canvas.minimap.background
  );
  root.style.setProperty(
    "--color-canvas-minimap-border",
    colors.canvas.minimap.border
  );
  root.style.setProperty(
    "--color-canvas-minimap-viewport",
    colors.canvas.minimap.viewport
  );
  root.style.setProperty(
    "--color-canvas-minimap-mask",
    colors.canvas.minimap.mask
  );
  root.style.setProperty(
    "--color-canvas-controls-bg",
    colors.canvas.controls.background
  );
  root.style.setProperty(
    "--color-canvas-controls-border",
    colors.canvas.controls.border
  );
  root.style.setProperty(
    "--color-canvas-controls-shadow",
    colors.canvas.controls.shadow
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-bg",
    colors.canvas.controls.button.default.background
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-border",
    colors.canvas.controls.button.default.border
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-text",
    colors.canvas.controls.button.default.text
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-bg-hover",
    colors.canvas.controls.button.hover.background
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-border-hover",
    colors.canvas.controls.button.hover.border
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-text-hover",
    colors.canvas.controls.button.hover.text
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-bg-active",
    colors.canvas.controls.button.active.background
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-border-active",
    colors.canvas.controls.button.active.border
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-text-active",
    colors.canvas.controls.button.active.text
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-bg-disabled",
    colors.canvas.controls.button.disabled.background
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-border-disabled",
    colors.canvas.controls.button.disabled.border
  );
  root.style.setProperty(
    "--color-canvas-controls-btn-text-disabled",
    colors.canvas.controls.button.disabled.text
  );

  // Workflow nodes
  root.style.setProperty(
    "--color-node-default-bg",
    colors.nodes.default.background
  );
  root.style.setProperty(
    "--color-node-default-border",
    colors.nodes.default.border
  );
  root.style.setProperty(
    "--color-node-default-shadow",
    colors.nodes.default.shadow
  );
  root.style.setProperty(
    "--color-node-selected-bg",
    colors.nodes.selected.background
  );
  root.style.setProperty(
    "--color-node-selected-border",
    colors.nodes.selected.border
  );
  root.style.setProperty(
    "--color-node-selected-shadow",
    colors.nodes.selected.shadow
  );
  root.style.setProperty(
    "--color-node-dragging-bg",
    colors.nodes.dragging.background
  );
  root.style.setProperty(
    "--color-node-dragging-border",
    colors.nodes.dragging.border
  );
  root.style.setProperty(
    "--color-node-dragging-shadow",
    colors.nodes.dragging.shadow
  );
  root.style.setProperty(
    "--color-node-header-bg",
    colors.nodes.header.background
  );
  root.style.setProperty("--color-node-header-text", colors.nodes.header.text);
  root.style.setProperty("--color-node-header-icon", colors.nodes.header.icon);
  root.style.setProperty(
    "--color-node-content-bg",
    colors.nodes.content.background
  );
  root.style.setProperty(
    "--color-node-content-text",
    colors.nodes.content.text
  );
  root.style.setProperty(
    "--color-node-handle-input-bg",
    colors.nodes.handles.input.background
  );
  root.style.setProperty(
    "--color-node-handle-input-border",
    colors.nodes.handles.input.border
  );
  root.style.setProperty(
    "--color-node-handle-input-connected",
    colors.nodes.handles.input.connected
  );
  root.style.setProperty(
    "--color-node-handle-output-bg",
    colors.nodes.handles.output.background
  );
  root.style.setProperty(
    "--color-node-handle-output-border",
    colors.nodes.handles.output.border
  );
  root.style.setProperty(
    "--color-node-handle-output-connected",
    colors.nodes.handles.output.connected
  );

  // Workflow edges
  root.style.setProperty(
    "--color-edge-default-stroke",
    colors.edges.default.stroke
  );
  root.style.setProperty(
    "--color-edge-default-stroke-hover",
    colors.edges.default.strokeHover
  );
  root.style.setProperty(
    "--color-edge-selected-stroke",
    colors.edges.selected.stroke
  );
  root.style.setProperty(
    "--color-edge-selected-stroke-hover",
    colors.edges.selected.strokeHover
  );
  root.style.setProperty(
    "--color-edge-animated-stroke",
    colors.edges.animated.stroke
  );
  root.style.setProperty(
    "--color-edge-animated-stroke-hover",
    colors.edges.animated.strokeHover
  );
  root.style.setProperty(
    "--color-edge-invalid-stroke",
    colors.edges.invalid.stroke
  );
  root.style.setProperty(
    "--color-edge-invalid-stroke-hover",
    colors.edges.invalid.strokeHover
  );

  // Modals
  root.style.setProperty("--color-modal-overlay", colors.modals.overlay);
  root.style.setProperty(
    "--color-modal-container-bg",
    colors.modals.container.background
  );
  root.style.setProperty(
    "--color-modal-container-border",
    colors.modals.container.border
  );
  root.style.setProperty(
    "--color-modal-container-shadow",
    colors.modals.container.shadow
  );
  root.style.setProperty(
    "--color-modal-header-bg",
    colors.modals.header.background
  );
  root.style.setProperty(
    "--color-modal-header-border",
    colors.modals.header.border
  );
  root.style.setProperty(
    "--color-modal-header-text",
    colors.modals.header.text
  );
  root.style.setProperty(
    "--color-modal-content-bg",
    colors.modals.content.background
  );
  root.style.setProperty(
    "--color-modal-content-text",
    colors.modals.content.text
  );

  // Modal buttons
  const modalButtonTypes = ["primary", "secondary", "cancel"];
  modalButtonTypes.forEach((buttonType) => {
    const button =
      colors.modals.buttons[buttonType as keyof typeof colors.modals.buttons];
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-bg`,
      button.default.background
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-bg-hover`,
      button.hover.background
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-bg-active`,
      button.active.background
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-bg-disabled`,
      button.disabled.background
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-border`,
      button.default.border
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-border-hover`,
      button.hover.border
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-border-active`,
      button.active.border
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-border-disabled`,
      button.disabled.border
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-text`,
      button.default.text
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-text-hover`,
      button.hover.text
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-text-active`,
      button.active.text
    );
    root.style.setProperty(
      `--color-modal-btn-${buttonType}-text-disabled`,
      button.disabled.text
    );
  });

  // Notifications
  root.style.setProperty(
    "--color-notification-success-bg",
    colors.notifications.success.background
  );
  root.style.setProperty(
    "--color-notification-success-border",
    colors.notifications.success.border
  );
  root.style.setProperty(
    "--color-notification-success-text",
    colors.notifications.success.text
  );
  root.style.setProperty(
    "--color-notification-success-icon",
    colors.notifications.success.icon
  );
  root.style.setProperty(
    "--color-notification-warning-bg",
    colors.notifications.warning.background
  );
  root.style.setProperty(
    "--color-notification-warning-border",
    colors.notifications.warning.border
  );
  root.style.setProperty(
    "--color-notification-warning-text",
    colors.notifications.warning.text
  );
  root.style.setProperty(
    "--color-notification-warning-icon",
    colors.notifications.warning.icon
  );
  root.style.setProperty(
    "--color-notification-error-bg",
    colors.notifications.error.background
  );
  root.style.setProperty(
    "--color-notification-error-border",
    colors.notifications.error.border
  );
  root.style.setProperty(
    "--color-notification-error-text",
    colors.notifications.error.text
  );
  root.style.setProperty(
    "--color-notification-error-icon",
    colors.notifications.error.icon
  );
  root.style.setProperty(
    "--color-notification-info-bg",
    colors.notifications.info.background
  );
  root.style.setProperty(
    "--color-notification-info-border",
    colors.notifications.info.border
  );
  root.style.setProperty(
    "--color-notification-info-text",
    colors.notifications.info.text
  );
  root.style.setProperty(
    "--color-notification-info-icon",
    colors.notifications.info.icon
  );

  // Syntax highlighting
  root.style.setProperty("--color-syntax-tag", colors.syntax.tag);
  root.style.setProperty("--color-syntax-attribute", colors.syntax.attribute);
  root.style.setProperty("--color-syntax-value", colors.syntax.value);
  root.style.setProperty("--color-syntax-comment", colors.syntax.comment);
  root.style.setProperty(
    "--color-syntax-declaration",
    colors.syntax.declaration
  );
  root.style.setProperty("--color-syntax-text", colors.syntax.text);
  root.style.setProperty("--color-syntax-bg", colors.syntax.background);
  root.style.setProperty("--color-syntax-selection", colors.syntax.selection);

  // Form controls
  root.style.setProperty("--color-form-label", colors.forms.label);
  root.style.setProperty("--color-form-help-text", colors.forms.helpText);
  root.style.setProperty("--color-form-error-text", colors.forms.errorText);
  root.style.setProperty("--color-form-success-text", colors.forms.successText);

  // Tool category colors (preserved for visual associations)
  root.style.setProperty("--color-tool-inout", colors.palette.tools.inout[500]);
  root.style.setProperty(
    "--color-tool-preparation",
    colors.palette.tools.preparation[500]
  );
  root.style.setProperty("--color-tool-join", colors.palette.tools.join[500]);
  root.style.setProperty(
    "--color-tool-aggregate",
    colors.palette.tools.aggregate[500]
  );
  root.style.setProperty(
    "--color-tool-favorites",
    colors.palette.tools.favorites[500]
  );

  // Socket colors - consistent across all themes
  root.style.setProperty("--color-socket-input", "#3b82f6"); // Blue for inputs
  root.style.setProperty("--color-socket-output", "#10b981"); // Green for outputs
  root.style.setProperty("--color-socket-input-border", "#1e40af"); // Darker blue border for input sockets
  root.style.setProperty("--color-socket-output-border", "#047857"); // Darker green border for output sockets

  // Set theme attribute for CSS selectors
  root.setAttribute("data-theme", theme.id);
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(sigilweaverTheme);
  const settingsThemeId = useSettingsStore((s) => s.theme.id);
  const updateSettingsTheme = useSettingsStore((s) => s.updateTheme);

  // Load theme from settings store on mount and when settings change
  useEffect(() => {
    const theme = getThemeById(settingsThemeId);
    setCurrentTheme(theme);
    applyThemeVariables(theme);
  }, [settingsThemeId]);

  const setTheme = (themeId: string) => {
    // Update settings store - this will trigger the useEffect above
    updateSettingsTheme(themeId);
  };

  const contextValue: ThemeContextType = {
    currentTheme,
    availableThemes,
    setTheme,
    isDark: currentTheme.id === "dark",
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
