/**
 * Header Component
 * Renders the main navigation header with responsive mobile menu
 */

import { NavConfig, navConfig as defaultNavConfig } from '@lib/config';

export interface HeaderOptions {
  config?: NavConfig;
  currentPath?: string;
}

/**
 * Creates the header HTML structure
 */
export function createHeader(options: HeaderOptions = {}): string {
  const {
    config = defaultNavConfig,
  } = options;

  return `
    <!-- Navigation -->
    <nav class="fixed top-0 w-full z-50 nav-bar" role="navigation" aria-label="Main navigation">
      <div class="container mx-auto px-6 py-3">
        <div class="flex items-center justify-between">
          <a href="${config.logo.href}" class="flex items-center space-x-2 group">
            <div class="sigil-logo" aria-hidden="true">
              <img src="${config.logo.src}" alt="${config.logo.alt}" width="32" height="32">
            </div>
            <span class="text-xl font-bold site-title">Sigilweaver Loom</span>
          </a>
          <div class="hidden md:flex items-center space-x-8">
            ${config.links.map(link => `
              <a href="${link.href}" 
                 class="nav-link"
                 ${link.isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                ${link.label}
              </a>
            `).join('')}
            <a href="${config.ctaButton.href}" class="cta-button">
              ${config.ctaButton.label}
            </a>
          </div>
          <button class="md:hidden text-mystic-300 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-opacity-50 rounded-md p-1" id="mobile-menu-toggle" aria-label="Toggle mobile menu" aria-expanded="false" aria-controls="mobile-menu">
            <i data-lucide="menu" class="w-6 h-6" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile Menu -->
    <div id="mobile-menu" class="fixed top-[72px] left-0 w-full z-40 md:hidden mobile-menu" role="navigation" aria-label="Mobile navigation">
      <div class="container mx-auto px-6 py-3">
        <div class="space-y-3" role="menu">
          ${config.links.map(link => `
            <a href="${link.href}" 
               class="block nav-link mobile-link" 
               role="menuitem"
               ${link.isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>
              ${link.label}
            </a>
          `).join('')}
          <a href="${config.ctaButton.href}" class="block cta-button text-center mobile-link" role="menuitem">
            ${config.ctaButton.label}
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Injects the header into the DOM
 */
export function renderHeader(container: Element | null, options?: HeaderOptions): void {
  if (!container) {
    console.error('Header container not found');
    return;
  }
  container.innerHTML = createHeader(options);
}
