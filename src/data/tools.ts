import { ToolDefinition } from '../domain/workflow/entities/workflow';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // In/Out Tools
  {
    type: 'Input',
    name: 'Input Data',
    icon: '📂',
    category: 'inout',
    defaultConfig: {
      placeholder: 'Configuration coming soon...',
    },
    sockets: [
      { id: 0, direction: 'output' }
    ]
  },
  {
    type: 'Output',
    name: 'Output Data',
    icon: '💾',
    category: 'inout',
    defaultConfig: {
      placeholder: 'Configuration coming soon...',
    },
    sockets: [
      { id: 0, direction: 'input' }
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
      { id: 0, direction: 'input' },
      { id: 1, direction: 'output', type: 'T' },
      { id: 2, direction: 'output', type: 'F' }
    ]
  },
  {
    type: 'Select',
    name: 'Select',
    icon: '✅',
    category: 'preparation',
    defaultConfig: {
      columns: [],
    },
    sockets: [
      { id: 0, direction: 'input' },
      { id: 1, direction: 'output' }
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
      { id: 0, direction: 'input' },
      { id: 1, direction: 'output' }
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
      { id: 0, direction: 'input' },
      { id: 1, direction: 'output' }
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
      { id: 0, direction: 'input', multiple: true },
      { id: 1, direction: 'output' }
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
      { id: 0, direction: 'input', type: 'L' }, // Left input
      { id: 1, direction: 'input', type: 'R' }, // Right input  
      { id: 2, direction: 'output', type: 'L' }, // Left output
      { id: 3, direction: 'output', type: 'J' }, // Join output
      { id: 4, direction: 'output', type: 'R' }  // Right output
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
      { id: 0, direction: 'input' },
      { id: 1, direction: 'output' }
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
