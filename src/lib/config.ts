/**
 * Navigation configuration
 * Centralized config for header navigation links
 */

export interface NavLink {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface NavConfig {
  logo: {
    src: string;
    alt: string;
    href: string;
  };
  links: NavLink[];
  ctaButton: {
    label: string;
    href: string;
  };
}

/**
 * Default navigation configuration
 * Used across all pages for consistent navigation
 */
export const navConfig: NavConfig = {
  logo: {
    src: '/icons/sigilweaver-logo.svg',
    alt: 'Sigilweaver Logo',
    href: '/',
  },
  links: [
    { label: 'Features', href: '/#features' },
    { label: 'Demo', href: '/#demo' },
    { label: 'Docs', href: 'https://docs.sigilweaver.app', isExternal: true },
    { label: 'Contributing', href: '/contributing.html' },
    { label: 'Open Source', href: '/#opensource' },
  ],
  ctaButton: {
    label: 'Download',
    href: '/downloads.html',
  },
};

/**
 * Simplified navigation for legal/error pages
 */
export const simpleNavConfig: NavConfig = {
  logo: navConfig.logo,
  links: [
    { label: 'Home', href: '/' },
    { label: 'Downloads', href: '/downloads.html' },
    { label: 'GitHub', href: 'https://github.com/sigilweaver', isExternal: true },
  ],
  ctaButton: navConfig.ctaButton,
};
