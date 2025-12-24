/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Component-specific theming using CSS custom properties
        theme: {
          // Global surfaces
          "surface-page": "var(--color-surface-page)",
          "surface-panel": "var(--color-surface-panel)",
          "surface-elevated": "var(--color-surface-elevated)",
          "surface-overlay": "var(--color-surface-overlay)",
          "surface-canvas": "var(--color-surface-canvas)",

          // Global text
          "text-primary": "var(--color-text-primary)",
          "text-secondary": "var(--color-text-secondary)",
          "text-tertiary": "var(--color-text-tertiary)",
          "text-inverse": "var(--color-text-inverse)",
          "text-disabled": "var(--color-text-disabled)",
          "text-on-accent": "var(--color-text-on-accent)",

          // Global borders
          "border-primary": "var(--color-border-primary)",
          "border-secondary": "var(--color-border-secondary)",
          "border-focus": "var(--color-border-focus)",
          "border-divider": "var(--color-border-divider)",

          // Global backgrounds (for UI primitives)
          "bg-primary": "var(--color-bg-primary)",
          "bg-secondary": "var(--color-bg-secondary)",
          "bg-tertiary": "var(--color-bg-tertiary)",
          "bg-hover": "var(--color-bg-hover)",
          "bg-input": "var(--color-bg-input)",
          "bg-tooltip": "var(--color-bg-tooltip)",
          "modal-overlay": "var(--color-modal-overlay)",

          // Legacy compatibility classes (to be migrated)
          "bg-elevated": "var(--color-surface-elevated)",
          "workflow-canvas": "var(--color-surface-canvas)",
          "workflow-node-bg": "var(--color-surface-elevated)",

          // Additional missing classes for forms and semantic colors
          "text-muted": "var(--color-text-tertiary)",
          "interactive-accent": "var(--color-interactive-accent)",
          "interactive-accent-hover": "var(--color-interactive-accent-hover)",
          "interactive-secondary": "var(--color-surface-panel)",
          "border-error": "var(--color-border-primary)", // Will be updated when semantic borders are added
          "syntax-declaration": "var(--color-text-primary)", // Will be updated when syntax highlighting is added

          // Header component
          "header-bg": "var(--color-header-bg)",
          "header-logo-icon": "var(--color-header-logo-icon)",
          "header-logo-text": "var(--color-header-logo-text)",
          "header-title-text": "var(--color-header-title-text)",
          "header-metadata-text": "var(--color-header-metadata-text)",
          "header-metadata-divider": "var(--color-header-metadata-divider)",
          "header-divider": "var(--color-header-divider)",

          // Header buttons
          "header-btn-new-bg": "var(--color-header-btn-new-bg)",
          "header-btn-new-bg-hover": "var(--color-header-btn-new-bg-hover)",
          "header-btn-new-bg-active": "var(--color-header-btn-new-bg-active)",
          "header-btn-new-bg-disabled":
            "var(--color-header-btn-new-bg-disabled)",
          "header-btn-new-border": "var(--color-header-btn-new-border)",
          "header-btn-new-border-hover":
            "var(--color-header-btn-new-border-hover)",
          "header-btn-new-border-active":
            "var(--color-header-btn-new-border-active)",
          "header-btn-new-border-disabled":
            "var(--color-header-btn-new-border-disabled)",
          "header-btn-new-text": "var(--color-header-btn-new-text)",
          "header-btn-new-text-hover": "var(--color-header-btn-new-text-hover)",
          "header-btn-new-text-active":
            "var(--color-header-btn-new-text-active)",
          "header-btn-new-text-disabled":
            "var(--color-header-btn-new-text-disabled)",

          "header-btn-import-bg": "var(--color-header-btn-import-bg)",
          "header-btn-import-bg-hover":
            "var(--color-header-btn-import-bg-hover)",
          "header-btn-import-bg-active":
            "var(--color-header-btn-import-bg-active)",
          "header-btn-import-bg-disabled":
            "var(--color-header-btn-import-bg-disabled)",
          "header-btn-import-border": "var(--color-header-btn-import-border)",
          "header-btn-import-border-hover":
            "var(--color-header-btn-import-border-hover)",
          "header-btn-import-border-active":
            "var(--color-header-btn-import-border-active)",
          "header-btn-import-border-disabled":
            "var(--color-header-btn-import-border-disabled)",
          "header-btn-import-text": "var(--color-header-btn-import-text)",
          "header-btn-import-text-hover":
            "var(--color-header-btn-import-text-hover)",
          "header-btn-import-text-active":
            "var(--color-header-btn-import-text-active)",
          "header-btn-import-text-disabled":
            "var(--color-header-btn-import-text-disabled)",

          "header-btn-export-bg": "var(--color-header-btn-export-bg)",
          "header-btn-export-bg-hover":
            "var(--color-header-btn-export-bg-hover)",
          "header-btn-export-bg-active":
            "var(--color-header-btn-export-bg-active)",
          "header-btn-export-bg-disabled":
            "var(--color-header-btn-export-bg-disabled)",
          "header-btn-export-border": "var(--color-header-btn-export-border)",
          "header-btn-export-border-hover":
            "var(--color-header-btn-export-border-hover)",
          "header-btn-export-border-active":
            "var(--color-header-btn-export-border-active)",
          "header-btn-export-border-disabled":
            "var(--color-header-btn-export-border-disabled)",
          "header-btn-export-text": "var(--color-header-btn-export-text)",
          "header-btn-export-text-hover":
            "var(--color-header-btn-export-text-hover)",
          "header-btn-export-text-active":
            "var(--color-header-btn-export-text-active)",
          "header-btn-export-text-disabled":
            "var(--color-header-btn-export-text-disabled)",

          "header-btn-viewcode-bg": "var(--color-header-btn-viewcode-bg)",
          "header-btn-viewcode-bg-hover":
            "var(--color-header-btn-viewcode-bg-hover)",
          "header-btn-viewcode-bg-active":
            "var(--color-header-btn-viewcode-bg-active)",
          "header-btn-viewcode-bg-disabled":
            "var(--color-header-btn-viewcode-bg-disabled)",
          "header-btn-viewcode-border":
            "var(--color-header-btn-viewcode-border)",
          "header-btn-viewcode-border-hover":
            "var(--color-header-btn-viewcode-border-hover)",
          "header-btn-viewcode-border-active":
            "var(--color-header-btn-viewcode-border-active)",
          "header-btn-viewcode-border-disabled":
            "var(--color-header-btn-viewcode-border-disabled)",
          "header-btn-viewcode-text": "var(--color-header-btn-viewcode-text)",
          "header-btn-viewcode-text-hover":
            "var(--color-header-btn-viewcode-text-hover)",
          "header-btn-viewcode-text-active":
            "var(--color-header-btn-viewcode-text-active)",
          "header-btn-viewcode-text-disabled":
            "var(--color-header-btn-viewcode-text-disabled)",

          "header-btn-preview-bg": "var(--color-header-btn-preview-bg)",
          "header-btn-preview-bg-hover":
            "var(--color-header-btn-preview-bg-hover)",
          "header-btn-preview-bg-active":
            "var(--color-header-btn-preview-bg-active)",
          "header-btn-preview-bg-disabled":
            "var(--color-header-btn-preview-bg-disabled)",
          "header-btn-preview-border": "var(--color-header-btn-preview-border)",
          "header-btn-preview-border-hover":
            "var(--color-header-btn-preview-border-hover)",
          "header-btn-preview-border-active":
            "var(--color-header-btn-preview-border-active)",
          "header-btn-preview-border-disabled":
            "var(--color-header-btn-preview-border-disabled)",
          "header-btn-preview-text": "var(--color-header-btn-preview-text)",
          "header-btn-preview-text-hover":
            "var(--color-header-btn-preview-text-hover)",
          "header-btn-preview-text-active":
            "var(--color-header-btn-preview-text-active)",
          "header-btn-preview-text-disabled":
            "var(--color-header-btn-preview-text-disabled)",

          "header-btn-run-bg": "var(--color-header-btn-run-bg)",
          "header-btn-run-bg-hover": "var(--color-header-btn-run-bg-hover)",
          "header-btn-run-bg-active": "var(--color-header-btn-run-bg-active)",
          "header-btn-run-bg-disabled":
            "var(--color-header-btn-run-bg-disabled)",
          "header-btn-run-border": "var(--color-header-btn-run-border)",
          "header-btn-run-border-hover":
            "var(--color-header-btn-run-border-hover)",
          "header-btn-run-border-active":
            "var(--color-header-btn-run-border-active)",
          "header-btn-run-border-disabled":
            "var(--color-header-btn-run-border-disabled)",
          "header-btn-run-text": "var(--color-header-btn-run-text)",
          "header-btn-run-text-hover": "var(--color-header-btn-run-text-hover)",
          "header-btn-run-text-active":
            "var(--color-header-btn-run-text-active)",
          "header-btn-run-text-disabled":
            "var(--color-header-btn-run-text-disabled)",

          // Header theme selector
          "header-theme-trigger-bg": "var(--color-header-theme-trigger-bg)",
          "header-theme-trigger-bg-hover":
            "var(--color-header-theme-trigger-bg-hover)",
          "header-theme-trigger-bg-active":
            "var(--color-header-theme-trigger-bg-active)",
          "header-theme-trigger-bg-disabled":
            "var(--color-header-theme-trigger-bg-disabled)",
          "header-theme-trigger-border":
            "var(--color-header-theme-trigger-border)",
          "header-theme-trigger-border-hover":
            "var(--color-header-theme-trigger-border-hover)",
          "header-theme-trigger-border-active":
            "var(--color-header-theme-trigger-border-active)",
          "header-theme-trigger-border-disabled":
            "var(--color-header-theme-trigger-border-disabled)",
          "header-theme-trigger-text": "var(--color-header-theme-trigger-text)",
          "header-theme-trigger-text-hover":
            "var(--color-header-theme-trigger-text-hover)",
          "header-theme-trigger-text-active":
            "var(--color-header-theme-trigger-text-active)",
          "header-theme-trigger-text-disabled":
            "var(--color-header-theme-trigger-text-disabled)",

          "header-theme-dropdown-bg": "var(--color-header-theme-dropdown-bg)",
          "header-theme-dropdown-border":
            "var(--color-header-theme-dropdown-border)",
          "header-theme-dropdown-shadow":
            "var(--color-header-theme-dropdown-shadow)",

          "header-theme-option-bg": "var(--color-header-theme-option-bg)",
          "header-theme-option-bg-hover":
            "var(--color-header-theme-option-bg-hover)",
          "header-theme-option-bg-active":
            "var(--color-header-theme-option-bg-active)",
          "header-theme-option-bg-disabled":
            "var(--color-header-theme-option-bg-disabled)",
          "header-theme-option-border":
            "var(--color-header-theme-option-border)",
          "header-theme-option-border-hover":
            "var(--color-header-theme-option-border-hover)",
          "header-theme-option-border-active":
            "var(--color-header-theme-option-border-active)",
          "header-theme-option-border-disabled":
            "var(--color-header-theme-option-border-disabled)",
          "header-theme-option-text": "var(--color-header-theme-option-text)",
          "header-theme-option-text-hover":
            "var(--color-header-theme-option-text-hover)",
          "header-theme-option-text-active":
            "var(--color-header-theme-option-text-active)",
          "header-theme-option-text-disabled":
            "var(--color-header-theme-option-text-disabled)",

          // Configuration panel
          "config-panel-bg": "var(--color-config-panel-bg)",
          "config-panel-border": "var(--color-config-panel-border)",
          "config-panel-shadow": "var(--color-config-panel-shadow)",

          "config-header-bg": "var(--color-config-header-bg)",
          "config-header-border": "var(--color-config-header-border)",
          "config-header-text": "var(--color-config-header-text)",

          "config-section-bg": "var(--color-config-section-bg)",
          "config-section-border": "var(--color-config-section-border)",
          "config-section-title": "var(--color-config-section-title)",

          "config-field-label": "var(--color-config-field-label)",

          // Tool palette
          "tool-palette-bg": "var(--color-tool-palette-bg)",
          "tool-palette-border": "var(--color-tool-palette-border)",
          "tool-palette-shadow": "var(--color-tool-palette-shadow)",

          "tool-search-icon": "var(--color-tool-search-icon)",

          "tool-category-header-bg": "var(--color-tool-category-header-bg)",
          "tool-category-header-text": "var(--color-tool-category-header-text)",
          "tool-category-header-border":
            "var(--color-tool-category-header-border)",
          "tool-category-expanded-bg": "var(--color-tool-category-expanded-bg)",

          "tool-item-icon": "var(--color-tool-item-icon)",
          "tool-item-label": "var(--color-tool-item-label)",

          "tool-drag-preview-bg": "var(--color-tool-drag-preview-bg)",
          "tool-drag-preview-border": "var(--color-tool-drag-preview-border)",
          "tool-drag-preview-shadow": "var(--color-tool-drag-preview-shadow)",

          // Canvas
          "canvas-bg": "var(--color-canvas-bg)",
          "canvas-grid-primary": "var(--color-canvas-grid-primary)",
          "canvas-grid-secondary": "var(--color-canvas-grid-secondary)",

          "canvas-minimap-bg": "var(--color-canvas-minimap-bg)",
          "canvas-minimap-border": "var(--color-canvas-minimap-border)",
          "canvas-minimap-viewport": "var(--color-canvas-minimap-viewport)",

          "canvas-controls-bg": "var(--color-canvas-controls-bg)",
          "canvas-controls-border": "var(--color-canvas-controls-border)",
          "canvas-controls-shadow": "var(--color-canvas-controls-shadow)",
          "canvas-controls-btn-bg": "var(--color-canvas-controls-btn-bg)",
          "canvas-controls-btn-border":
            "var(--color-canvas-controls-btn-border)",
          "canvas-controls-btn-text": "var(--color-canvas-controls-btn-text)",
          "canvas-controls-btn-bg-hover":
            "var(--color-canvas-controls-btn-bg-hover)",
          "canvas-controls-btn-border-hover":
            "var(--color-canvas-controls-btn-border-hover)",
          "canvas-controls-btn-text-hover":
            "var(--color-canvas-controls-btn-text-hover)",
          "canvas-controls-btn-bg-active":
            "var(--color-canvas-controls-btn-bg-active)",
          "canvas-controls-btn-border-active":
            "var(--color-canvas-controls-btn-border-active)",
          "canvas-controls-btn-text-active":
            "var(--color-canvas-controls-btn-text-active)",
          "canvas-controls-btn-bg-disabled":
            "var(--color-canvas-controls-btn-bg-disabled)",
          "canvas-controls-btn-border-disabled":
            "var(--color-canvas-controls-btn-border-disabled)",
          "canvas-controls-btn-text-disabled":
            "var(--color-canvas-controls-btn-text-disabled)",

          // Workflow nodes
          "node-default-bg": "var(--color-node-default-bg)",
          "node-default-border": "var(--color-node-default-border)",
          "node-default-shadow": "var(--color-node-default-shadow)",

          "node-selected-bg": "var(--color-node-selected-bg)",
          "node-selected-border": "var(--color-node-selected-border)",
          "node-selected-shadow": "var(--color-node-selected-shadow)",

          "node-dragging-bg": "var(--color-node-dragging-bg)",
          "node-dragging-border": "var(--color-node-dragging-border)",
          "node-dragging-shadow": "var(--color-node-dragging-shadow)",

          "node-header-bg": "var(--color-node-header-bg)",
          "node-header-text": "var(--color-node-header-text)",
          "node-header-icon": "var(--color-node-header-icon)",

          "node-content-bg": "var(--color-node-content-bg)",
          "node-content-text": "var(--color-node-content-text)",

          "node-handle-input-bg": "var(--color-node-handle-input-bg)",
          "node-handle-input-border": "var(--color-node-handle-input-border)",
          "node-handle-input-connected":
            "var(--color-node-handle-input-connected)",

          "node-handle-output-bg": "var(--color-node-handle-output-bg)",
          "node-handle-output-border": "var(--color-node-handle-output-border)",
          "node-handle-output-connected":
            "var(--color-node-handle-output-connected)",

          // Workflow edges
          "edge-default-stroke": "var(--color-edge-default-stroke)",
          "edge-default-stroke-hover": "var(--color-edge-default-stroke-hover)",

          "edge-selected-stroke": "var(--color-edge-selected-stroke)",
          "edge-selected-stroke-hover":
            "var(--color-edge-selected-stroke-hover)",

          "edge-animated-stroke": "var(--color-edge-animated-stroke)",
          "edge-animated-stroke-hover":
            "var(--color-edge-animated-stroke-hover)",

          "edge-invalid-stroke": "var(--color-edge-invalid-stroke)",
          "edge-invalid-stroke-hover": "var(--color-edge-invalid-stroke-hover)",

          // Modals
          "modal-overlay": "var(--color-modal-overlay)",

          "modal-container-bg": "var(--color-modal-container-bg)",
          "modal-container-border": "var(--color-modal-container-border)",
          "modal-container-shadow": "var(--color-modal-container-shadow)",

          "modal-header-bg": "var(--color-modal-header-bg)",
          "modal-header-border": "var(--color-modal-header-border)",
          "modal-header-text": "var(--color-modal-header-text)",

          "modal-content-bg": "var(--color-modal-content-bg)",
          "modal-content-text": "var(--color-modal-content-text)",

          // Modal buttons
          "modal-btn-primary-bg": "var(--color-modal-btn-primary-bg)",
          "modal-btn-primary-bg-hover":
            "var(--color-modal-btn-primary-bg-hover)",
          "modal-btn-primary-bg-active":
            "var(--color-modal-btn-primary-bg-active)",
          "modal-btn-primary-bg-disabled":
            "var(--color-modal-btn-primary-bg-disabled)",
          "modal-btn-primary-border": "var(--color-modal-btn-primary-border)",
          "modal-btn-primary-border-hover":
            "var(--color-modal-btn-primary-border-hover)",
          "modal-btn-primary-border-active":
            "var(--color-modal-btn-primary-border-active)",
          "modal-btn-primary-border-disabled":
            "var(--color-modal-btn-primary-border-disabled)",
          "modal-btn-primary-text": "var(--color-modal-btn-primary-text)",
          "modal-btn-primary-text-hover":
            "var(--color-modal-btn-primary-text-hover)",
          "modal-btn-primary-text-active":
            "var(--color-modal-btn-primary-text-active)",
          "modal-btn-primary-text-disabled":
            "var(--color-modal-btn-primary-text-disabled)",

          "modal-btn-secondary-bg": "var(--color-modal-btn-secondary-bg)",
          "modal-btn-secondary-bg-hover":
            "var(--color-modal-btn-secondary-bg-hover)",
          "modal-btn-secondary-bg-active":
            "var(--color-modal-btn-secondary-bg-active)",
          "modal-btn-secondary-bg-disabled":
            "var(--color-modal-btn-secondary-bg-disabled)",
          "modal-btn-secondary-border":
            "var(--color-modal-btn-secondary-border)",
          "modal-btn-secondary-border-hover":
            "var(--color-modal-btn-secondary-border-hover)",
          "modal-btn-secondary-border-active":
            "var(--color-modal-btn-secondary-border-active)",
          "modal-btn-secondary-border-disabled":
            "var(--color-modal-btn-secondary-border-disabled)",
          "modal-btn-secondary-text": "var(--color-modal-btn-secondary-text)",
          "modal-btn-secondary-text-hover":
            "var(--color-modal-btn-secondary-text-hover)",
          "modal-btn-secondary-text-active":
            "var(--color-modal-btn-secondary-text-active)",
          "modal-btn-secondary-text-disabled":
            "var(--color-modal-btn-secondary-text-disabled)",

          "modal-btn-cancel-bg": "var(--color-modal-btn-cancel-bg)",
          "modal-btn-cancel-bg-hover": "var(--color-modal-btn-cancel-bg-hover)",
          "modal-btn-cancel-bg-active":
            "var(--color-modal-btn-cancel-bg-active)",
          "modal-btn-cancel-bg-disabled":
            "var(--color-modal-btn-cancel-bg-disabled)",
          "modal-btn-cancel-border": "var(--color-modal-btn-cancel-border)",
          "modal-btn-cancel-border-hover":
            "var(--color-modal-btn-cancel-border-hover)",
          "modal-btn-cancel-border-active":
            "var(--color-modal-btn-cancel-border-active)",
          "modal-btn-cancel-border-disabled":
            "var(--color-modal-btn-cancel-border-disabled)",
          "modal-btn-cancel-text": "var(--color-modal-btn-cancel-text)",
          "modal-btn-cancel-text-hover":
            "var(--color-modal-btn-cancel-text-hover)",
          "modal-btn-cancel-text-active":
            "var(--color-modal-btn-cancel-text-active)",
          "modal-btn-cancel-text-disabled":
            "var(--color-modal-btn-cancel-text-disabled)",

          // Notifications
          "notification-success-bg": "var(--color-notification-success-bg)",
          "notification-success-border":
            "var(--color-notification-success-border)",
          "notification-success-text": "var(--color-notification-success-text)",
          "notification-success-icon": "var(--color-notification-success-icon)",

          "notification-warning-bg": "var(--color-notification-warning-bg)",
          "notification-warning-border":
            "var(--color-notification-warning-border)",
          "notification-warning-text": "var(--color-notification-warning-text)",
          "notification-warning-icon": "var(--color-notification-warning-icon)",

          "notification-error-bg": "var(--color-notification-error-bg)",
          "notification-error-border": "var(--color-notification-error-border)",
          "notification-error-text": "var(--color-notification-error-text)",
          "notification-error-icon": "var(--color-notification-error-icon)",

          "notification-info-bg": "var(--color-notification-info-bg)",
          "notification-info-border": "var(--color-notification-info-border)",
          "notification-info-text": "var(--color-notification-info-text)",
          "notification-info-icon": "var(--color-notification-info-icon)",

          // Syntax highlighting
          "syntax-tag": "var(--color-syntax-tag)",
          "syntax-attribute": "var(--color-syntax-attribute)",
          "syntax-value": "var(--color-syntax-value)",
          "syntax-comment": "var(--color-syntax-comment)",
          "syntax-declaration": "var(--color-syntax-declaration)",
          "syntax-text": "var(--color-syntax-text)",
          "syntax-bg": "var(--color-syntax-bg)",
          "syntax-selection": "var(--color-syntax-selection)",
          "syntax-number":
            "var(--color-syntax-number, var(--color-syntax-value))", // Fallback to value color
          "syntax-keyword":
            "var(--color-syntax-keyword, var(--color-syntax-declaration))", // Fallback to declaration color
          "syntax-function":
            "var(--color-syntax-function, var(--color-syntax-attribute))", // Fallback to attribute color

          // Form controls
          "form-label": "var(--color-form-label)",
          "form-help-text": "var(--color-form-help-text)",
          "form-error-text": "var(--color-form-error-text)",
          "form-success-text": "var(--color-form-success-text)",

          // Tool category colors (preserved for visual recognition)
          "tool-inout": "var(--color-tool-inout)",
          "tool-preparation": "var(--color-tool-preparation)",
          "tool-join": "var(--color-tool-join)",
          "tool-aggregate": "var(--color-tool-aggregate)",
          "tool-favorites": "var(--color-tool-favorites)",

          // Socket colors (consistent across themes)
          "socket-input": "var(--color-socket-input)",
          "socket-output": "var(--color-socket-output)",
          "socket-border": "var(--color-socket-border)",

          // Semantic status colors (for inline alerts, badges, indicators)
          "status-success-bg": "var(--color-status-success-bg)",
          "status-success-border": "var(--color-status-success-border)",
          "status-success-text": "var(--color-status-success-text)",
          "status-warning-bg": "var(--color-status-warning-bg)",
          "status-warning-border": "var(--color-status-warning-border)",
          "status-warning-text": "var(--color-status-warning-text)",
          "status-error-bg": "var(--color-status-error-bg)",
          "status-error-border": "var(--color-status-error-border)",
          "status-error-text": "var(--color-status-error-text)",
          "status-info-bg": "var(--color-status-info-bg)",
          "status-info-border": "var(--color-status-info-border)",
          "status-info-text": "var(--color-status-info-text)",

          // Log viewer colors
          "log-error": "var(--color-log-error)",
          "log-warning": "var(--color-log-warning)",
          "log-success": "var(--color-log-success)",
          "log-info": "var(--color-log-info)",
          "log-request": "var(--color-log-request)",
          "log-response": "var(--color-log-response)",
          "log-cache-hit": "var(--color-log-cache-hit)",
          "log-cache-miss": "var(--color-log-cache-miss)",

          // Quality indicator colors (for data profiling)
          "quality-ok": "var(--color-quality-ok)",
          "quality-warning": "var(--color-quality-warning)",
          "quality-issue": "var(--color-quality-issue)",
          "quality-null": "var(--color-quality-null)",

          // Toggle and interactive colors
          "toggle-on": "var(--color-toggle-on)",
          "toggle-off": "var(--color-toggle-off)",
          "favorites": "var(--color-favorites)",

          // Badge colors for mode indicators
          "badge-read": "var(--color-badge-read)",
          "badge-write": "var(--color-badge-write)",
        },
      },
      // Animation keyframes for Radix UI primitives
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "zoom-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "zoom-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-to-top": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-100%)" },
        },
        "slide-out-to-bottom": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        "slide-out-to-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "slide-out-to-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
        "fade-out": "fade-out 0.15s ease-out",
        "zoom-in": "zoom-in 0.15s ease-out",
        "zoom-out": "zoom-out 0.15s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.15s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.15s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.15s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.15s ease-out",
        "slide-out-to-top": "slide-out-to-top 0.15s ease-out",
        "slide-out-to-bottom": "slide-out-to-bottom 0.15s ease-out",
        "slide-out-to-left": "slide-out-to-left 0.15s ease-out",
        "slide-out-to-right": "slide-out-to-right 0.15s ease-out",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("tailwindcss-animate"),
    function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          /* Firefox */
          "scrollbar-width": "none",
          /* Safari and Chrome */
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    },
  ],
};
