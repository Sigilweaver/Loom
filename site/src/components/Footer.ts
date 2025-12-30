/**
 * Footer Component
 * Renders the site footer with links and copyright
 */

export interface FooterLink {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterConfig {
  columns: FooterColumn[];
  copyright: {
    text: string;
    tagline?: string;
  };
}

/**
 * Default footer configuration
 */
export const defaultFooterConfig: FooterConfig = {
  columns: [
    {
      title: 'Quick Links',
      links: [
        { label: 'Downloads', href: '/downloads' },
        { label: 'Contributing', href: '/contributing.html' },
        { label: 'GitHub', href: 'https://github.com/sigilweaver', isExternal: true },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Support Email', href: 'mailto:' },
        { label: 'GitHub Issues', href: 'https://github.com/sigilweaver/sigilweaver/issues', isExternal: true },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Terms of Use', href: '/terms.html' },
        { label: 'Privacy Policy', href: '/privacy.html' },
        { label: 'Code of Conduct', href: 'https://docs.sigilweaver.app/code-of-conduct', isExternal: true },
      ],
    },
  ],
  copyright: {
    tagline: `Open source software with <i data-lucide="heart" class="inline-block w-4 h-4 text-purple-400 fill-current align-middle"></i> for the data community.`,
    text: '© 2025 Nathan Riley (DBA Sigilweaver). Sigilweaver™ is a trademark of Nathan Riley.',
  },
};

export interface FooterOptions {
  config?: FooterConfig;
  showDescription?: boolean;
}

/**
 * Creates the footer HTML structure
 */
export function createFooter(options: FooterOptions = {}): string {
  const {
    config = defaultFooterConfig,
    showDescription = true,
  } = options;

  return `
    <footer class="bg-mystic-900 border-t border-mystic-700 py-12">
      <div class="container mx-auto px-6">
        <!-- Brand Section -->
        <div class="mb-8 text-center sm:text-left">
          <a href="/" class="inline-flex items-center space-x-2 group mb-3">
            <div class="sigil-logo" aria-hidden="true">
              <img src="/icons/sigilweaver-logo.svg" alt="Sigilweaver Logo" width="32" height="32">
            </div>
            <span class="text-xl font-bold text-mystic-200 group-hover:text-gold-400 transition-colors">Sigilweaver</span>
          </a>
          ${showDescription ? `
            <p class="text-mystic-400 max-w-lg mx-auto sm:mx-0">
              Crafted by a solo data wizard who believes in the magic of open source. Support responses are provided on a best effort basis with genuine care for the community.
            </p>
          ` : ''}
        </div>

        <!-- Links Row -->
        <div class="grid grid-cols-3 gap-6 sm:gap-8">
          ${config.columns.map(column => `
            <div>
              <h4 class="font-semibold text-mystic-200 mb-3">${column.title}</h4>
              <ul class="space-y-1.5 text-mystic-400">
                ${column.links.map(link => `
                  <li>
                    <a href="${link.href}" 
                       class="hover:text-gold-400 transition-colors"
                       ${link.isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                      ${link.label}
                    </a>
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
        
        <div class="border-t border-mystic-700 mt-8 pt-8 text-center text-mystic-400">
          ${config.copyright.tagline ? `<p>${config.copyright.tagline}</p>` : ''}
          <p>${config.copyright.text}</p>
        </div>
      </div>
    </footer>
  `;
}

/**
 * Injects the footer into the DOM
 */
export function renderFooter(container: Element | null, options?: FooterOptions): void {
  if (!container) {
    console.error('Footer container not found');
    return;
  }
  container.innerHTML = createFooter(options);
}
