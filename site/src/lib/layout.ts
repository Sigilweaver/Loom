/**
 * Layout initialization
 * Handles dynamic component injection and page setup
 */

import { createHeader, createFooter, createFloatingElements, createSkipLink, HeaderOptions, FooterOptions } from '@components/index';

export interface LayoutOptions {
  header?: HeaderOptions | false;
  footer?: FooterOptions | false;
  floatingElements?: boolean;
  skipLink?: boolean;
}

/**
 * Initialize the page layout with shared components
 * Call this at the start of each page's entry script
 */
export function initializeLayout(options: LayoutOptions = {}): void {
  const {
    header = {},
    footer = {},
    floatingElements = true,
    skipLink = true,
  } = options;

  // Insert skip link at the start of body
  if (skipLink) {
    const skipLinkHtml = createSkipLink();
    document.body.insertAdjacentHTML('afterbegin', skipLinkHtml);
  }

  // Insert floating elements after skip link
  if (floatingElements) {
    const floatingHtml = createFloatingElements();
    const skipLinkEl = document.querySelector('a[href="#main-content"]');
    if (skipLinkEl) {
      skipLinkEl.insertAdjacentHTML('afterend', floatingHtml);
    } else {
      document.body.insertAdjacentHTML('afterbegin', floatingHtml);
    }
  }

  // Insert header
  if (header !== false) {
    const headerContainer = document.getElementById('header-root');
    if (headerContainer) {
      headerContainer.innerHTML = createHeader(header);
    } else {
      // Insert header after floating elements or at start
      const floatingEl = document.querySelector('.floating-elements');
      if (floatingEl) {
        floatingEl.insertAdjacentHTML('afterend', createHeader(header));
      } else {
        document.body.insertAdjacentHTML('afterbegin', createHeader(header));
      }
    }
  }

  // Insert footer
  if (footer !== false) {
    const footerContainer = document.getElementById('footer-root');
    if (footerContainer) {
      footerContainer.innerHTML = createFooter(footer);
    } else {
      // Append footer at end of body
      document.body.insertAdjacentHTML('beforeend', createFooter(footer));
    }
  }
}

/**
 * Get base body classes for consistent styling
 */
export function getBodyClasses(): string {
  return 'bg-gradient-to-b from-mystic-900 to-mystic-700 text-white font-mystical';
}
