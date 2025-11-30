import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Sigilweaver Docs',
  tagline: 'The visual data pipeline tool you always wished existed',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

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
          href: 'https://sigilweaver.app/downloads.html',
          label: 'Download',
          position: 'right',
        },
        {
          href: 'https://github.com/sigilweaver/sigilweaver-app',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/getting-started/installation',
            },
            {
              label: 'Tools Reference',
              to: '/tools/overview',
            },
            {
              label: 'Concepts',
              to: '/concepts/workflows',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/sigilweaver/sigilweaver-app/discussions',
            },
            {
              label: 'GitHub Issues',
              href: 'https://github.com/sigilweaver/sigilweaver-app/issues',
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
              href: 'https://sigilweaver.app/downloads.html',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/sigilweaver/sigilweaver-app',
            },
          ],
        },
        {
          title: 'Legal',
          items: [
            {
              label: 'Terms of Use',
              href: 'https://sigilweaver.app/terms.html',
            },
            {
              label: 'Privacy Policy',
              href: 'https://sigilweaver.app/privacy.html',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Nathan Riley (DBA Sigilweaver). Sigilweaver™ is a trademark of Nathan Riley. AGPL-3.0 Licensed.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
