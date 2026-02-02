/**
 * Skip Link Component
 * Accessibility helper for keyboard navigation
 */

/**
 * Creates the skip link for accessibility
 */
export function createSkipLink(targetId = 'main-content'): string {
  return `
    <a href="#${targetId}" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-gold-500 text-mystic-900 px-4 py-2 rounded-md z-50 font-semibold">
      Skip to main content
    </a>
  `;
}
