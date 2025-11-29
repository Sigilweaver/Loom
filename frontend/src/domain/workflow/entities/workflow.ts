// Domain entities and type contracts for workflow graph (moved from src/types/workflow.ts)

// Tool configuration value type for serialization
export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | Record<string, unknown>[]
  | Record<string, unknown>;

export interface WorkflowMeta {
  name: string;
  description: string;
  author: string;
  workflowId: string;
  created: string;
}

/**
 * Tracks which configuration fields differ from defaults and should be serialized.
 */
export interface EmissionMap {
  [key: string]: boolean | EmissionMap | undefined;
}

export type ToolConfig = {
  [key: string]: FieldValue | EmissionMap | undefined;
  _emit?: EmissionMap;
};

export interface Socket {
  id: string;
  direction: "input" | "output";
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
  from: { tool: string; socket: string };
  to: { tool: string; socket: string };
}

export interface ToolDefinition {
  type: string;
  name: string;
  icon: string;
  category: "inout" | "preparation" | "join" | "aggregate";
  defaultConfig: ToolConfig;
  sockets: Socket[];
}

export type ToolCategory =
  | "favorites"
  | "inout"
  | "preparation"
  | "join"
  | "aggregate";

export interface ConnectionState {
  isConnecting: boolean;
  startTool?: string;
  startSocket?: string;
  startSocketType?: "input" | "output";
  currentX?: number;
  currentY?: number;
}
