import { ToolDefinition } from '../domain/workflow/entities/workflow';
import { 
  FileInput, 
  FileDown, 
  Filter, 
  CheckSquare, 
  ArrowUpDown, 
  Calculator, 
  Layers, 
  Sigma,
  FlaskRound,
  Fingerprint,
  CornerRightDown,
  CornerLeftUp,
} from 'lucide-react';
import { SigilweaverIcon } from '../components/icons/SigilweaverIcon';
import { CommonSockets, FilterSockets, JoinSockets, UnionSockets, UniqueSockets } from '../domain/workflow/constants/socketIds';

const DOCS_BASE_URL = 'https://sigilweaver.app/loom/docs/user';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // Connect Tools
  {
    type: 'Input',
    name: 'Read',
    icon: FileInput,
    category: 'connect',
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
    name: 'Write',
    icon: FileDown,
    category: 'connect',
    defaultConfig: {
      placeholder: 'Configuration coming soon...',
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/input-output/output`,
  },
  
  // Compute Tools
  {
    type: 'Filter',
    name: 'Filter',
    icon: Filter,
    category: 'compute',
    defaultConfig: {
      expression: '',
      mode: 'Basic',
      conditions: [],
      combinator: 'and',
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
    name: 'Schema',
    icon: CheckSquare,
    category: 'compute',
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
    category: 'compute',
    blocking: true,
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
    name: 'Calculate',
    icon: Calculator,
    category: 'compute',
    defaultConfig: {
      operations: [],
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
    category: 'compute',
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
    category: 'compute',
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
  
  // Combine Tools
  {
    type: 'Union',
    name: 'Concatenate',
    icon: Layers,
    category: 'combine',
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
    icon: SigilweaverIcon,
    category: 'combine',
    blocking: true,
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

  // Reshape Tools
  {
    type: 'Summarize',
    name: 'Aggregate',
    icon: Sigma,
    category: 'reshape',
    blocking: true,
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
  {
    type: 'Pivot',
    name: 'Pivot',
    icon: CornerRightDown,
    category: 'reshape',
    blocking: true,
    defaultConfig: {
      on: '',
      index: [],
      values: '',
      aggregateFunction: 'first',
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' },
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/aggregate/pivot`,
  },
  {
    type: 'Unpivot',
    name: 'Unpivot',
    icon: CornerLeftUp,
    category: 'reshape',
    blocking: true,
    defaultConfig: {
      on: [],
      index: [],
      variableName: 'variable',
      valueName: 'value',
    },
    sockets: [
      { id: CommonSockets.INPUT, direction: 'input' },
      { id: CommonSockets.OUTPUT, direction: 'output' }
    ],
    docsUrl: `${DOCS_BASE_URL}/tools/aggregate/unpivot`,
  },
];

export const EXPRESSION_DOCS_URL = `${DOCS_BASE_URL}/expressions/basics`;

// Default favorite tools (single source of truth; used as the initial set)
export const DEFAULT_FAVORITE_TOOLS = ['Input', 'Output', 'Filter', 'Select', 'Sort', 'Formula', 'Union', 'Join', 'Summarize'];

export const getToolsByCategory = (category: string, favoriteTools?: string[]) => {
  if (category === 'favorites') {
    // Use provided favorites or default to the static list
    const favorites = favoriteTools ?? DEFAULT_FAVORITE_TOOLS;
    return TOOL_DEFINITIONS.filter(tool => favorites.includes(tool.type));
  }
  return TOOL_DEFINITIONS.filter(tool => tool.category === category);
};

export const getToolDefinition = (type: string) => {
  return TOOL_DEFINITIONS.find(tool => tool.type === type);
};
