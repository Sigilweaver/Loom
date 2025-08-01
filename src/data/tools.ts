import { ToolDefinition } from '../types/workflow';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // In/Out Tools
  {
    type: 'Input',
    name: 'Input Data',
    icon: '📂',
    category: 'inout',
    defaultConfig: {
      path: '',
    },
    inlets: 0,
    outlets: 1,
  },
  {
    type: 'Output',
    name: 'Output Data',
    icon: '💾',
    category: 'inout',
    defaultConfig: {
      path: '',
    },
    inlets: 1,
    outlets: 0,
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
    inlets: 1,
    outlets: 2,
  },
  {
    type: 'Select',
    name: 'Select',
    icon: '✅',
    category: 'preparation',
    defaultConfig: {
      columns: [],
    },
    inlets: 1,
    outlets: 1,
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
    inlets: 1,
    outlets: 1,
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
    inlets: 2,
    outlets: 1,
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
    inlets: 2,
    outlets: 1,
  },
];

export const FAVORITES_TOOLS = ['Input', 'Output', 'Filter', 'Union'];

export const getToolsByCategory = (category: string) => {
  if (category === 'favorites') {
    return TOOL_DEFINITIONS.filter(tool => FAVORITES_TOOLS.includes(tool.type));
  }
  return TOOL_DEFINITIONS.filter(tool => tool.category === category);
};

export const getToolDefinition = (type: string) => {
  return TOOL_DEFINITIONS.find(tool => tool.type === type);
};
