/**
 * Layout initialization
 * Handles dynamic component injection and page setup
 */

import { createHeader, createFooter, createSkipLink, createBetaBanner, HeaderOptions, FooterOptions } from '@components/index';

export interface LayoutOptions {
  header?: HeaderOptions | false;
  footer?: FooterOptions | false;
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
    skipLink = true,
  } = options;

  // Insert skip link at the start of body
  if (skipLink) {
    const skipLinkHtml = createSkipLink();
    document.body.insertAdjacentHTML('afterbegin', skipLinkHtml);
  }

  // Insert header
  if (header !== false) {
    const headerContainer = document.getElementById('header-root');
    if (headerContainer) {
      headerContainer.innerHTML = createHeader(header);
    } else {
      // Insert header after skip link
      const skipLinkEl = document.querySelector('a[href="#main-content"]');
      if (skipLinkEl) {
        skipLinkEl.insertAdjacentHTML('afterend', createHeader(header));
      } else {
        document.body.insertAdjacentHTML('afterbegin', createHeader(header));
      }
    }

    // Insert beta banner after header
    const headerEl = document.querySelector('nav[role="navigation"]');
    if (headerEl) {
      headerEl.insertAdjacentHTML('afterend', createBetaBanner());
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
