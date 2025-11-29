import { ToolDefinition } from '../domain/workflow/entities/workflow';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // In/Out Tools
  {
    type: 'Input',
    name: 'Input',
    icon: '📂',
    category: 'inout',
    defaultConfig: {
      placeholder: 'Configuration coming soon...',
    },
    sockets: [
      { id: 'output', direction: 'output' }
    ]
  },
  {
    type: 'Output',
    name: 'Output',
    icon: '💾',
    category: 'inout',
    defaultConfig: {
      placeholder: 'Configuration coming soon...',
    },
    sockets: [
      { id: 'input', direction: 'input' }
    ]
  },
  
  // Preparation Tools
  {
    type: 'Filter',
    name: 'Filter',
    icon: '🔍',
    category: 'preparation',
    defaultConfig: {
      expression: '',
      mode: 'Custom',
    },
    sockets: [
      { id: 'input', direction: 'input' },
      { id: 'output-true', direction: 'output', type: 'T' },
      { id: 'output-false', direction: 'output', type: 'F' }
    ]
  },
  {
    type: 'Select',
    name: 'Select',
    icon: '✅',
    category: 'preparation',
    defaultConfig: {
      columnConfigs: [],
    },
    sockets: [
      { id: 'input', direction: 'input' },
      { id: 'output', direction: 'output' }
    ]
  },
  {
    type: 'Sort',
    name: 'Sort',
    icon: '🔢',
    category: 'preparation',
    defaultConfig: {
      columns: [],
      order: 'asc',
    },
    sockets: [
      { id: 'input', direction: 'input' },
      { id: 'output', direction: 'output' }
    ]
  },
  {
    type: 'Formula',
    name: 'Formula',
    icon: '🧮',
    category: 'preparation',
    defaultConfig: {
      expression: '',
      resultColumn: 'Result',
    },
    sockets: [
      { id: 'input', direction: 'input' },
      { id: 'output', direction: 'output' }
    ]
  },
  
  // Join Tools
  {
    type: 'Union',
    name: 'Union',
    icon: '🔗',
    category: 'join',
    defaultConfig: {
      mode: 'ByName',
    },
    sockets: [
      { id: 'input', direction: 'input', multiple: true },
      { id: 'output', direction: 'output' }
    ]
  },
  {
    type: 'Join',
    name: 'Join',
    icon: '🤝',
    category: 'join',
    defaultConfig: {
      joinType: 'inner',
      leftKeys: [],
      rightKeys: [],
    },
    sockets: [
      { id: 'input-left', direction: 'input', type: 'L' },
      { id: 'input-right', direction: 'input', type: 'R' },
      { id: 'output-left', direction: 'output', type: 'L' },
      { id: 'output-match', direction: 'output', type: 'J' },
      { id: 'output-right', direction: 'output', type: 'R' }
    ]
  },

  // Aggregate Tools
  {
    type: 'Summarize',
    name: 'Summarize',
    icon: '📊',
    category: 'aggregate',
    defaultConfig: {
      groupByFields: [],
      aggregations: [
        {
          field: '',
          operation: 'Sum',
          outputName: ''
        }
      ],
      includeNulls: false,
    },
    sockets: [
      { id: 'input', direction: 'input' },
      { id: 'output', direction: 'output' }
    ]
  },
];

export const FAVORITES_TOOLS = ['Input', 'Output', 'Filter', 'Select', 'Sort', 'Formula', 'Union', 'Join', 'Summarize'];

export const getToolsByCategory = (category: string) => {
  if (category === 'favorites') {
    return TOOL_DEFINITIONS.filter(tool => FAVORITES_TOOLS.includes(tool.type));
  }
  return TOOL_DEFINITIONS.filter(tool => tool.category === category);
};

export const getToolDefinition = (type: string) => {
  return TOOL_DEFINITIONS.find(tool => tool.type === type);
};
