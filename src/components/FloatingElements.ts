/**
 * Floating Elements Component
 * Creates decorative animated background nodes
 */

export interface FloatingElementsOptions {
  count?: number;
}

/**
 * Creates the floating elements HTML
 */
export function createFloatingElements(options: FloatingElementsOptions = {}): string {
  const { count = 6 } = options;
  
  const nodes = Array.from({ length: count }, () => '<div class="floating-node"></div>').join('\n        ');
  
  return `
    <!-- Global Floating Elements -->
    <div class="floating-elements">
        ${nodes}
    </div>
  `;
}

/**
 * Creates the skip link for accessibility
 */
export function createSkipLink(targetId = 'main-content'): string {
  return `
    <!-- Skip Link for Accessibility -->
    <a href="#${targetId}" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-gold-500 text-mystic-900 px-4 py-2 rounded-md z-50 font-semibold">
      Skip to main content
    </a>
  `;
}
