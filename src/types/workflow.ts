export interface WorkflowMeta {
  name: string;
  description: string;
  author: string;
  workflowId: string;
  created: string;
}

export interface ToolConfig {
  [key: string]: any;
}

export interface Inlet {
  id: number;
}

export interface Outlet {
  id: number;
}

export interface Tool {
  id: string;
  type: string;
  x: number;
  y: number;
  config: ToolConfig;
  inlets: Inlet[];
  outlets: Outlet[];
}

export interface Group {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tools: Tool[];
  groups?: Group[];
}

export interface Edge {
  from: {
    tool: string;
    port: number;
  };
  to: {
    tool: string;
    port: number;
  };
}

export interface Workflow {
  version: string;
  xmlns: string;
  meta: WorkflowMeta;
  hierarchy: Group;
  edges: Edge[];
}

export interface ToolDefinition {
  type: string;
  name: string;
  icon: string;
  category: 'inout' | 'preparation' | 'join';
  defaultConfig: ToolConfig;
  inlets: number;
  outlets: number;
}

export type ToolCategory = 'favorites' | 'inout' | 'preparation' | 'join';
