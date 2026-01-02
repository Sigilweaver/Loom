import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Sigilweaver Docs',
  tagline: 'The visual data pipeline tool you always wished existed',
  favicon: 'img/favicon.ico',

  // Custom plugins
  plugins: [
    './plugins/remove-google-fonts', // Remove Infima's Google Fonts import
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Mermaid diagram support
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  // Set the production url of your site here
  url: 'https://docs.sigilweaver.app',
  // Serve at root of subdomain
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'sigilweaver',
  projectName: 'sigilweaver-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang.
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/', // Serve docs at root
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/sigilweaver/sigilweaver-docs/tree/main/',
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/sigilweaver-social-card.jpg',
    // Color mode configuration
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Sigilweaver',
      logo: {
        alt: 'Sigilweaver Logo',
        src: 'img/logo.svg',
        href: 'https://sigilweaver.app',
        target: '_self',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://sigilweaver.app',
          label: 'Website',
          position: 'right',
        },
        {
          href: 'https://sigilweaver.app/downloads',
          label: 'Download',
          position: 'right',
        },
        {
          href: 'https://github.com/sigilweaver/sigilweaver',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/sigilweaver/sigilweaver/discussions',
            },
            {
              label: 'GitHub Issues',
              href: 'https://github.com/sigilweaver/sigilweaver/issues',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Website',
              href: 'https://sigilweaver.app',
            },
            {
              label: 'Downloads',
              href: 'https://sigilweaver.app/downloads',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/sigilweaver/sigilweaver',
            },
          ],
        },
        {
          title: 'Legal',
          items: [
            {
              label: 'Terms of Use',
              href: 'https://sigilweaver.app/terms',
            },
            {
              label: 'Privacy Policy',
              href: 'https://sigilweaver.app/privacy',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Sigilweaver Holdings LLC. Sigilweaver™ is a trademark of Sigilweaver Holdings LLC. Documentation licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC-BY-SA 4.0</a>. Operated under license by Sigilweaver LLC.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
