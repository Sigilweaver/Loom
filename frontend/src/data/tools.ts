import { ToolDefinition } from '../domain/workflow/entities/workflow';
import { 
  FileInput, 
  FileOutput, 
  Filter, 
  CheckSquare, 
  ArrowUpDown, 
  Calculator, 
  Layers, 
  Link, 
  Sigma,
  FlaskRound,
  Fingerprint 
} from 'lucide-react';
import { CommonSockets, FilterSockets, JoinSockets, UnionSockets, UniqueSockets } from '../domain/workflow/constants/socketIds';

const DOCS_BASE_URL = 'https://docs.sigilweaver.app/user';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // In/Out Tools
  {
    type: 'Input',
    name: 'Input',
    icon: FileInput,
    category: 'inout',
    defaultConfig: {
      placeholder: 'Configuration coming soon...',
    },
    sockets: [
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/input-output/input`,
  },
  {
    type: 'Output',
    name: 'Output',
    icon: FileOutput,
    category: 'inout',
    defaultConfig: {
      placeholder: 'Configuration coming soon...',
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/input-output/output`,
  },
  
  // Preparation Tools
  {
    type: 'Filter',
    name: 'Filter',
    icon: Filter,
    category: 'preparation',
    defaultConfig: {
      expression: '',
      mode: 'Custom',
    },
    sockets: [
      { id: FilterSockets.INPUT, direction: 'input' },
      { id: FilterSockets.OUTPUT_TRUE, direction: 'output', type: 'T' },
      { id: FilterSockets.OUTPUT_FALSE, direction: 'output', type: 'F' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/preparation/filter`,
  },
  {
    type: 'Select',
    name: 'Select',
    icon: CheckSquare,
    category: 'preparation',
    defaultConfig: {
      columnConfigs: [],
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' },
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/preparation/select`,
  },
  {
    type: 'Sort',
    name: 'Sort',
    icon: ArrowUpDown,
    category: 'preparation',
    defaultConfig: {
      sortColumns: [],
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' },
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/preparation/sort`,
  },
  {
    type: 'Formula',
    name: 'Formula',
    icon: Calculator,
    category: 'preparation',
    defaultConfig: {
      expression: '',
      column_name: '',
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' },
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/preparation/formula`,
  },
  {
    type: 'Sample',
    name: 'Sample',
    icon: FlaskRound,
    category: 'preparation',
    defaultConfig: {
      mode: 'FirstN',
      n: 100,
      percent: 10.0,
      offset: 0,
      seed: null,
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' },
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/preparation/sample`,
  },
  {
    type: 'Unique',
    name: 'Unique',
    icon: Fingerprint,
    category: 'preparation',
    defaultConfig: {
      columns: [],
      mode: 'First',
    },
    sockets: [
      { id: UniqueSockets.INPUT, direction: 'input' },
      { id: UniqueSockets.OUTPUT_UNIQUE, direction: 'output', type: 'U' },
      { id: UniqueSockets.OUTPUT_DUPLICATE, direction: 'output', type: 'D' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/preparation/unique`,
  },
  
  // Join Tools
  {
    type: 'Union',
    name: 'Union',
    icon: Layers,
    category: 'join',
    defaultConfig: {
      mode: 'ByName',
    },
    sockets: [
      { id: UnionSockets.INPUT, direction: 'input', multiple: true },
      { id: UnionSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/join/union`,
  },
  {
    type: 'Join',
    name: 'Join',
    icon: Link,
    category: 'join',
    defaultConfig: {
      joinType: 'inner',
      leftKeys: [],
      rightKeys: [],
    },
    sockets: [
      { id: JoinSockets.INPUT_LEFT, direction: 'input', type: 'L' },
      { id: JoinSockets.INPUT_RIGHT, direction: 'input', type: 'R' },
      { id: JoinSockets.OUTPUT_LEFT, direction: 'output', type: 'L' },
      { id: JoinSockets.OUTPUT_MATCH, direction: 'output', type: 'J' },
      { id: JoinSockets.OUTPUT_RIGHT, direction: 'output', type: 'R' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/join/join-tool`,
  },

  // Aggregate Tools
  {
    type: 'Summarize',
    name: 'Summarize',
    icon: Sigma,
    category: 'aggregate',
    defaultConfig: {
      groupByColumns: [],
      aggregations: [
        {
          column: '',
          operation: 'Sum',
          outputName: ''
        }
      ],
      includeNulls: false,
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' },
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/aggregate/summarize`,
  },
];

export const EXPRESSION_DOCS_URL = `${DOCS_BASE_URL}/expressions/basics`;

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
