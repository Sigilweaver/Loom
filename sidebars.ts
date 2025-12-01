import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Sigilweaver Documentation Sidebar
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Developer Guide',
      link: {
        type: 'doc',
        id: 'developer/index',
      },
      items: [
        'developer/getting-started',
        {
          type: 'category',
          label: 'Architecture',
          items: [
            'developer/architecture/overview',
            'developer/architecture/frontend',
            'developer/architecture/backend',
            'developer/architecture/decisions',
          ],
        },
        {
          type: 'category',
          label: 'Contributing',
          items: [
            'developer/contributing/workflow',
            'developer/contributing/adding-tools',
            'developer/contributing/frontend',
            'developer/contributing/backend',
            'developer/contributing/code-style',
          ],
        },
        {
          type: 'category',
          label: 'Testing',
          items: [
            'developer/testing/philosophy',
            'developer/testing/backend',
            'developer/testing/frontend',
            'developer/testing/integration',
          ],
        },
        {
          type: 'category',
          label: 'Building',
          items: [
            'developer/building/development',
            'developer/building/packaging',
            'developer/building/releasing',
          ],
        },
        {
          type: 'category',
          label: 'Reference',
          items: [
            'developer/reference/api-endpoints',
            'developer/reference/tool-registry',
          ],
        },
        'developer/roadmap',
        'developer/known-issues',
      ],
    },
  ],
};

export default sidebars;
