import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Sigilweaver Documentation Sidebar
 * 
 * Structure:
 * - Introduction (home page)
 * - Getting Started (installation, first workflow, interface tour)
 * - Concepts (workflows, tools, formulas, data flow)
 * - Tools Reference (each tool category and individual tools)
 * - Guides (common use cases, best practices)
 * - Contributing (for developers)
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/first-workflow',
        'getting-started/interface-tour',
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/workflows',
        'concepts/tools-and-connections',
        'concepts/formulas',
        'concepts/data-flow',
        'concepts/file-formats',
      ],
    },
    {
      type: 'category',
      label: 'Tools Reference',
      items: [
        'tools/overview',
        {
          type: 'category',
          label: 'Input/Output',
          items: [
            'tools/input-output/input',
            'tools/input-output/output',
          ],
        },
        {
          type: 'category',
          label: 'Preparation',
          items: [
            'tools/preparation/select',
            'tools/preparation/filter',
            'tools/preparation/formula',
            'tools/preparation/sort',
          ],
        },
        {
          type: 'category',
          label: 'Transform',
          items: [
            'tools/transform/summarize',
          ],
        },
        {
          type: 'category',
          label: 'Join',
          items: [
            'tools/join/join',
            'tools/join/union',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/csv-to-parquet',
        'guides/data-cleaning',
        'guides/joining-datasets',
        'guides/aggregations',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/keyboard-shortcuts',
        'reference/workflow-files',
        'reference/polars-expressions',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'contributing/overview',
        'contributing/development-setup',
        'contributing/architecture',
      ],
    },
  ],
};

export default sidebars;
