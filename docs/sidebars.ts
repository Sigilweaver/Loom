import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Sigilweaver Loom documentation sidebar.
 *
 * Reading order:
 *   users:       getting started -> concepts -> interface -> data -> tools
 *                -> connections -> AI assistant -> Hub
 *   admins:      deployment -> configuration -> Hub beta notes -> access model -> security
 *   developers:  setup -> architecture -> contributing -> testing -> building -> reference
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'User Guide',
      link: { type: 'doc', id: 'user/index' },
      items: [
        'user/getting-started',
        'user/concepts',
        {
          type: 'category',
          label: 'Studio Interface',
          items: [
            'user/interface/canvas',
            'user/interface/tool-palette',
            'user/interface/wiring',
            'user/interface/configuration-panel',
            'user/interface/data-preview',
            'user/interface/keyboard-shortcuts',
            'user/interface/settings',
            'user/interface/caching',
          ],
        },
        {
          type: 'category',
          label: 'Data and Expressions',
          items: [
            'user/data-types',
            'user/expressions/basics',
            'user/expressions/syntax-rules',
            'user/expressions/common-operations',
          ],
        },
        {
          type: 'category',
          label: 'Tools Reference',
          link: { type: 'doc', id: 'user/tools/index' },
          items: [
            {
              type: 'category',
              label: 'Connect',
              items: [
                'user/tools/input-output/input',
                'user/tools/input-output/output',
              ],
            },
            {
              type: 'category',
              label: 'Compute',
              items: [
                'user/tools/preparation/filter',
                'user/tools/preparation/select',
                'user/tools/preparation/sort',
                'user/tools/preparation/formula',
                'user/tools/preparation/sample',
                'user/tools/preparation/unique',
              ],
            },
            {
              type: 'category',
              label: 'Reshape',
              items: [
                'user/tools/aggregate/summarize',
                'user/tools/aggregate/pivot',
                'user/tools/aggregate/unpivot',
              ],
            },
            {
              type: 'category',
              label: 'Combine',
              items: [
                'user/tools/join/union',
                'user/tools/join/join-tool',
              ],
            },
          ],
        },
        {
          type: 'doc',
          id: 'user/interface/connections',
          label: 'Managing Connections',
        },
        {
          type: 'doc',
          id: 'user/interface/ai-assistant',
          label: 'AI Assistant',
        },
        {
          type: 'doc',
          id: 'user/interface/hub',
          label: 'Using Hub',
        },
      ],
    },
    {
      type: 'category',
      label: 'Administrator Guide',
      link: { type: 'doc', id: 'admin/index' },
      items: [
        'admin/deployment',
        'admin/server-configuration',
        'admin/hub-configuration',
        'admin/hub-beta',
        {
          type: 'category',
          label: 'Access Control',
          items: [
            'admin/roles',
            'admin/users',
            'admin/groups',
            'admin/grant-groups',
          ],
        },
        'admin/connections',
        'admin/servers',
        'admin/security',
      ],
    },
    {
      type: 'category',
      label: 'Developer Guide',
      link: { type: 'doc', id: 'developer/index' },
      items: [
        'developer/getting-started',
        {
          type: 'category',
          label: 'Architecture',
          items: [
            'developer/architecture/overview',
            'developer/architecture/component-relationships',
            'developer/architecture/frontend',
            'developer/architecture/backend',
            'developer/architecture/hub',
            'developer/architecture/caching',
            'developer/architecture/decisions',
          ],
        },
        {
          type: 'category',
          label: 'Contributing',
          items: [
            'developer/contributing/workflow',
            'developer/contributing/cla',
            'developer/contributing/code-style',
            'developer/contributing/studio',
            'developer/contributing/server',
            'developer/contributing/hub',
            'developer/contributing/adding-tools',
            'developer/contributing/adding-formats',
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
          label: 'Building and Releasing',
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
        'developer/known-issues',
        'developer/ai-philosophy',
      ],
    },
    'roadmap',
  ],
};

export default sidebars;
