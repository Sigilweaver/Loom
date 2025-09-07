// Domain entities and type contracts for workflow graph (moved from src/types/workflow.ts)

// Tool configuration value type for XML storage
export type FieldValue = string | number | boolean | string[] | null | Record<string, unknown>[] | Record<string, unknown>;

export interface WorkflowMeta {
  name: string;
  description: string;
  author: string;
  workflowId: string;
  created: string;
}

export interface ToolConfig {
  [key: string]: FieldValue;
}

export interface Socket {
  id: number;
  direction: 'input' | 'output';
  type?: string;
  multiple?: boolean;
}

export interface Tool {
  id: string;
  type: string;
  x: number;
  y: number;
  config: ToolConfig;
  sockets: Socket[];
}

export interface Wire {
  from: { tool: string; socket: number };
  to: { tool: string; socket: number };
}

export interface ToolDefinition {
  type: string;
  name: string;
  icon: string;
  category: 'inout' | 'preparation' | 'join' | 'aggregate';
  defaultConfig: ToolConfig;
  sockets: Socket[];
}

export type ToolCategory = 'favorites' | 'inout' | 'preparation' | 'join' | 'aggregate';

export interface ConnectionState {
  isConnecting: boolean;
  startTool?: string;
  startSocket?: number;
  startSocketType?: 'input' | 'output';
  currentX?: number;
  currentY?: number;
}
