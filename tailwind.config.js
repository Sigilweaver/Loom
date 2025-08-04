/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS custom properties
        'theme': {
          // Background colors
          'bg-primary': 'var(--color-bg-primary)',
          'bg-secondary': 'var(--color-bg-secondary)',
          'bg-tertiary': 'var(--color-bg-tertiary)',
          'bg-elevated': 'var(--color-bg-elevated)',
          
          // Text colors
          'text-primary': 'var(--color-text-primary)',
          'text-secondary': 'var(--color-text-secondary)',
          'text-tertiary': 'var(--color-text-tertiary)',
          'text-inverse': 'var(--color-text-inverse)',
          'text-muted': 'var(--color-text-muted)',
          
          // Border colors
          'border-primary': 'var(--color-border-primary)',
          'border-secondary': 'var(--color-border-secondary)',
          'border-focus': 'var(--color-border-focus)',
          'border-error': 'var(--color-border-error)',
          'border-success': 'var(--color-border-success)',
          
          // Tool category colors
          'tool-inout': 'var(--color-tool-inout)',
          'tool-preparation': 'var(--color-tool-preparation)',
          'tool-join': 'var(--color-tool-join)',
          'tool-aggregate': 'var(--color-tool-aggregate)',
          'tool-favorites': 'var(--color-tool-favorites)',
          'tool-default': 'var(--color-tool-default)',
          
          // Interactive states
          'interactive-primary': 'var(--color-interactive-primary)',
          'interactive-primary-hover': 'var(--color-interactive-primary-hover)',
          'interactive-primary-active': 'var(--color-interactive-primary-active)',
          'interactive-primary-disabled': 'var(--color-interactive-primary-disabled)',
          'interactive-secondary': 'var(--color-interactive-secondary)',
          'interactive-secondary-hover': 'var(--color-interactive-secondary-hover)',
          'interactive-secondary-active': 'var(--color-interactive-secondary-active)',
          'interactive-secondary-disabled': 'var(--color-interactive-secondary-disabled)',
          'interactive-accent': 'var(--color-interactive-accent)',
          'interactive-accent-hover': 'var(--color-interactive-accent-hover)',
          'interactive-accent-active': 'var(--color-interactive-accent-active)',
          
          // Semantic colors
          'error-bg': 'var(--color-error-bg)',
          'error-border': 'var(--color-error-border)',
          'error-text': 'var(--color-error-text)',
          'error-accent': 'var(--color-error-accent)',
          'warning-bg': 'var(--color-warning-bg)',
          'warning-border': 'var(--color-warning-border)',
          'warning-text': 'var(--color-warning-text)',
          'warning-accent': 'var(--color-warning-accent)',
          'success-bg': 'var(--color-success-bg)',
          'success-border': 'var(--color-success-border)',
          'success-text': 'var(--color-success-text)',
          'success-accent': 'var(--color-success-accent)',
          'info-bg': 'var(--color-info-bg)',
          'info-border': 'var(--color-info-border)',
          'info-text': 'var(--color-info-text)',
          'info-accent': 'var(--color-info-accent)',
          
          // Workflow colors
          'workflow-canvas': 'var(--color-workflow-canvas)',
          'workflow-grid-primary': 'var(--color-workflow-grid-primary)',
          'workflow-grid-secondary': 'var(--color-workflow-grid-secondary)',
          'workflow-edge-default': 'var(--color-workflow-edge-default)',
          'workflow-edge-hover': 'var(--color-workflow-edge-hover)',
          'workflow-edge-selected': 'var(--color-workflow-edge-selected)',
          'workflow-edge-rejected': 'var(--color-workflow-edge-rejected)',
          'workflow-node-bg': 'var(--color-workflow-node-bg)',
          'workflow-handle-input': 'var(--color-workflow-handle-input)',
          'workflow-handle-output': 'var(--color-workflow-handle-output)',
          
          // Syntax highlighting
          'syntax-tag': 'var(--color-syntax-tag)',
          'syntax-attribute': 'var(--color-syntax-attribute)',
          'syntax-value': 'var(--color-syntax-value)',
          'syntax-comment': 'var(--color-syntax-comment)',
          'syntax-declaration': 'var(--color-syntax-declaration)',
          'syntax-text': 'var(--color-syntax-text)',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
