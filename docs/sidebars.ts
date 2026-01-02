import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Sigilweaver Documentation Sidebar
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'User Guide',
      link: {
        type: 'doc',
        id: 'user/index',
      },
      items: [
        {
          type: 'category',
          label: 'Interface',
          items: [
            'user/interface/canvas',
            'user/interface/tool-palette',
            'user/interface/wiring',
            'user/interface/configuration-panel',
            'user/interface/data-preview',
            'user/interface/keyboard-shortcuts',
            'user/interface/connections',
            'user/interface/hub',
            'user/interface/caching',
          ],
        },
        {
          type: 'category',
          label: 'Expressions',
          items: [
            'user/expressions/basics',
            'user/expressions/syntax-rules',
            'user/expressions/common-operations',
          ],
        },
        'user/data-types',
        {
          type: 'category',
          label: 'Tools',
          link: {
            type: 'doc',
            id: 'user/tools/index',
          },
          items: [
            {
              type: 'category',
              label: 'Input/Output',
              items: [
                'user/tools/input-output/input',
                'user/tools/input-output/output',
              ],
            },
            {
              type: 'category',
              label: 'Preparation',
              items: [
                'user/tools/preparation/filter',
                'user/tools/preparation/select',
                'user/tools/preparation/sort',
                'user/tools/preparation/formula',
              ],
            },
            {
              type: 'category',
              label: 'Join',
              items: [
                'user/tools/join/union',
                'user/tools/join/join-tool',
              ],
            },
            {
              type: 'category',
              label: 'Aggregate',
              items: [
                'user/tools/aggregate/summarize',
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'Crash Courses',
          link: {
            type: 'doc',
            id: 'user/crash-courses/index',
          },
          items: [
            'user/crash-courses/tableau-prep',
            'user/crash-courses/alteryx',
            'user/crash-courses/power-query',
            'user/crash-courses/knime',
            'user/crash-courses/orange',
            'user/crash-courses/excel',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Administrator Guide',
      link: {
        type: 'doc',
        id: 'admin/index',
      },
      items: [
        'admin/roles',
        'admin/users',
        'admin/groups',
        'admin/grant-groups',
        'admin/connections',
        'admin/servers',
        'admin/security',
      ],
    },
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
            'developer/architecture/hub',
            'developer/architecture/caching',
            'developer/architecture/decisions',
          ],
        },
        {
          type: 'category',
          label: 'Contributing',
          items: [
            'developer/contributing/cla',
            'developer/contributing/workflow',
            'developer/contributing/adding-tools',
            'developer/contributing/studio',
            'developer/contributing/server',
            'developer/contributing/hub',
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
    'code-of-conduct',
  ],
};

export default sidebars;
